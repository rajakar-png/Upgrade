import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * Manages Cloudflare DNS records for custom subdomains.
 *
 * When a user sets subdomain "kaizen" on their server running at sg1.astranodes.cloud:25608,
 * this service creates:
 *   1. SRV record: _minecraft._tcp.kaizen.astranodes.cloud → sg1.astranodes.cloud:25608
 *      (so Minecraft clients can resolve the address)
 *   2. A record: kaizen.astranodes.cloud → node IP
 *      (for display / fallback)
 */
@Injectable()
export class DnsService {
  private readonly logger = new Logger(DnsService.name);
  private readonly api: AxiosInstance;
  private readonly zoneId: string;
  private readonly domain: string;
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    const apiToken = config.get<string>('app.cloudflare.apiToken');
    this.zoneId = config.get<string>('app.cloudflare.zoneId') || '';
    this.domain = config.get<string>('app.cloudflare.domain') || 'astranodes.cloud';
    this.enabled = !!(apiToken && this.zoneId);

    this.api = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      headers: {
        Authorization: `Bearer ${apiToken || ''}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    if (!this.enabled) {
      this.logger.warn(
        'Cloudflare DNS integration is disabled. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID to enable subdomain DNS records.',
      );
    }
  }

  /**
   * Create DNS records for a Minecraft subdomain.
   * @param subdomain - e.g. "kaizen"
   * @param nodeHost - e.g. "sg1.astranodes.cloud" or "15.235.193.64"
   * @param port - e.g. 25608
   */
  async createSubdomainRecords(
    subdomain: string,
    nodeHost: string,
    port: number,
  ): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(`DNS disabled — skipping record creation for ${subdomain}`);
      return;
    }

    try {
      // 1. Create SRV record: _minecraft._tcp.{subdomain}.{domain}
      await this.api.post(`/zones/${this.zoneId}/dns_records`, {
        type: 'SRV',
        name: `_minecraft._tcp.${subdomain}.${this.domain}`,
        data: {
          service: '_minecraft',
          proto: '_tcp',
          name: `${subdomain}.${this.domain}`,
          priority: 0,
          weight: 5,
          port,
          target: nodeHost,
        },
        ttl: 300,
        comment: `AstraNodes subdomain for ${subdomain}`,
      });
      this.logger.log(`Created SRV record: _minecraft._tcp.${subdomain}.${this.domain} → ${nodeHost}:${port}`);

      // 2. Create A or CNAME record for the subdomain itself
      const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(nodeHost);
      if (isIp) {
        await this.api.post(`/zones/${this.zoneId}/dns_records`, {
          type: 'A',
          name: `${subdomain}.${this.domain}`,
          content: nodeHost,
          ttl: 300,
          proxied: false,
          comment: `AstraNodes subdomain for ${subdomain}`,
        });
        this.logger.log(`Created A record: ${subdomain}.${this.domain} → ${nodeHost}`);
      } else {
        await this.api.post(`/zones/${this.zoneId}/dns_records`, {
          type: 'CNAME',
          name: `${subdomain}.${this.domain}`,
          content: nodeHost,
          ttl: 300,
          proxied: false,
          comment: `AstraNodes subdomain for ${subdomain}`,
        });
        this.logger.log(`Created CNAME record: ${subdomain}.${this.domain} → ${nodeHost}`);
      }
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      // If record already exists (code 81057/81058), ignore
      if (errors?.some?.((e: any) => e.code === 81057 || e.code === 81058)) {
        this.logger.warn(`DNS records for ${subdomain} already exist — skipping`);
        return;
      }
      this.logger.error(`Failed to create DNS records for ${subdomain}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Remove all DNS records for a subdomain.
   */
  async removeSubdomainRecords(subdomain: string): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(`DNS disabled — skipping record removal for ${subdomain}`);
      return;
    }

    try {
      // Find all records matching this subdomain
      const srvName = `_minecraft._tcp.${subdomain}.${this.domain}`;
      const hostName = `${subdomain}.${this.domain}`;

      // Search for SRV records
      const srvRes = await this.api.get(`/zones/${this.zoneId}/dns_records`, {
        params: { name: srvName, type: 'SRV' },
      });
      for (const record of srvRes.data?.result || []) {
        await this.api.delete(`/zones/${this.zoneId}/dns_records/${record.id}`);
        this.logger.log(`Deleted SRV record ${record.id} for ${subdomain}`);
      }

      // Search for A/CNAME records
      for (const type of ['A', 'CNAME']) {
        const res = await this.api.get(`/zones/${this.zoneId}/dns_records`, {
          params: { name: hostName, type },
        });
        for (const record of res.data?.result || []) {
          // Only delete records we created (check comment)
          if (record.comment?.includes('AstraNodes')) {
            await this.api.delete(`/zones/${this.zoneId}/dns_records/${record.id}`);
            this.logger.log(`Deleted ${type} record ${record.id} for ${subdomain}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to remove DNS records for ${subdomain}: ${err.message}`);
      // Don't throw — subdomain removal from DB should still proceed
    }
  }
}
