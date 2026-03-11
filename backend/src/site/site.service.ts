import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SiteService {
  constructor(private prisma: PrismaService) {}

  async getSection(sectionName: string) {
    const row = await this.prisma.siteContent.findUnique({ where: { sectionName } });
    return row ? JSON.parse(row.contentJson) : null;
  }

  async getAllSections() {
    const rows = await this.prisma.siteContent.findMany();
    return rows.reduce((acc, row) => {
      acc[row.sectionName] = JSON.parse(row.contentJson);
      return acc;
    }, {} as Record<string, any>);
  }

  async upsertSection(sectionName: string, content: any) {
    return this.prisma.siteContent.upsert({
      where: { sectionName },
      create: { sectionName, contentJson: JSON.stringify(content) },
      update: { contentJson: JSON.stringify(content) },
    });
  }

  async getSettings() {
    return this.prisma.siteSetting.findFirst();
  }

  async updateSettings(data: any) {
    const existing = await this.prisma.siteSetting.findFirst();
    if (existing) {
      return this.prisma.siteSetting.update({ where: { id: existing.id }, data });
    }
    return this.prisma.siteSetting.create({ data });
  }

  async getLandingPlans() {
    return this.prisma.landingPlan.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  }

  async getFeatures() {
    return this.prisma.feature.findMany();
  }
}
