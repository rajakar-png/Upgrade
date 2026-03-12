import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  Interaction,
  AttachmentBuilder,
} from 'discord.js';
import { UtrStatus } from '@prisma/client';
import { join } from 'path';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BILLING_UTR_SUBMITTED,
  TICKET_CREATED,
  TICKET_REPLIED,
  UtrSubmittedEvent,
  TicketEvent,
} from '../events/events';

@Injectable()
export class DiscordBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordBotService.name);
  private client: Client | null = null;
  private ready = false;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.tryConnect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async getSettings() {
    return this.prisma.siteSetting.findFirst();
  }

  async tryConnect() {
    const settings = await this.getSettings();
    if (!settings?.discordBotEnabled || !settings?.discordBotToken) {
      this.logger.log('Discord bot disabled or no token configured');
      return;
    }
    await this.connect(settings.discordBotToken);
  }

  private async connect(token: string) {
    await this.disconnect();

    this.client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    this.client.on('ready', () => {
      this.ready = true;
      this.logger.log(`Discord bot connected as ${this.client?.user?.tag}`);
    });

    this.client.on('interactionCreate', (interaction) =>
      this.handleInteraction(interaction),
    );

    try {
      await this.client.login(token);
    } catch (err) {
      this.logger.error('Failed to connect Discord bot', err);
      this.client = null;
      this.ready = false;
    }
  }

  async disconnect() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.ready = false;
    }
  }

  async reconnect() {
    await this.disconnect();
    await this.tryConnect();
  }

  // ── Event Listeners ─────────────────────────────────────────────────────

  @OnEvent(BILLING_UTR_SUBMITTED)
  async handleUtrSubmitted(payload: UtrSubmittedEvent) {
    this.sendUtrNotification(payload).catch((err) =>
      this.logger.error('Failed to handle UTR submitted event', err),
    );
  }

  @OnEvent(TICKET_CREATED)
  async handleTicketCreated(payload: TicketEvent) {
    this.sendTicketNotification(payload.type, payload, payload.message).catch((err) =>
      this.logger.error('Failed to handle ticket created event', err),
    );
  }

  @OnEvent(TICKET_REPLIED)
  async handleTicketReplied(payload: TicketEvent) {
    this.sendTicketNotification(payload.type, payload, payload.message).catch((err) =>
      this.logger.error('Failed to handle ticket replied event', err),
    );
  }

  // ── Send UTR Notification ──────────────────────────────────────────────────

  async sendUtrNotification(submission: {
    id: number;
    amount: number;
    utrNumber: string;
    screenshotPath: string;
    user: { email: string };
  }) {
    const settings = await this.getSettings();
    if (!this.ready || !this.client) {
      this.logger.warn(`UTR notification skipped: bot ready=${this.ready}, client=${!!this.client}`);
      return;
    }
    if (!settings?.discordUtrChannelId) {
      this.logger.warn('UTR notification skipped: discordUtrChannelId not configured');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(
        settings.discordUtrChannelId,
      );
      if (!channel || !(channel instanceof TextChannel)) return;

      const embed = new EmbedBuilder()
        .setTitle('💰 New UTR Payment Submission')
        .setColor(0xff7a18)
        .addFields(
          { name: 'Submission ID', value: `#${submission.id}`, inline: true },
          {
            name: 'Amount',
            value: `₹${submission.amount.toFixed(2)}`,
            inline: true,
          },
          { name: 'UTR Number', value: submission.utrNumber, inline: true },
          { name: 'User', value: submission.user.email, inline: true },
        )
        .setTimestamp();

      // Attach screenshot as a file so Discord can display it
      const files: any[] = [];
      if (submission.screenshotPath) {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        const filePath = join(uploadDir, submission.screenshotPath);
        try {
          const attachment = new AttachmentBuilder(filePath, { name: 'screenshot.png' });
          files.push(attachment);
          embed.setImage('attachment://screenshot.png');
        } catch (fileErr) {
          this.logger.warn('Could not attach screenshot file', fileErr);
        }
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`utr_approve_${submission.id}`)
          .setLabel('✅ Approve')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`utr_reject_${submission.id}`)
          .setLabel('❌ Reject')
          .setStyle(ButtonStyle.Danger),
      );

      const pingRole = settings.discordPingRoleId
        ? `<@&${settings.discordPingRoleId}>`
        : '';

      await channel.send({
        content: pingRole
          ? `${pingRole} New payment requires review!`
          : 'New payment requires review!',
        embeds: [embed],
        components: [row],
        files,
      });
    } catch (err) {
      this.logger.error('Failed to send UTR notification', err);
    }
  }

  // ── Send Ticket Notification ───────────────────────────────────────────────

  async sendTicketNotification(
    type: 'new' | 'reply',
    ticket: {
      id: number;
      subject: string;
      priority: string;
      user: { email: string };
    },
    message?: string,
  ) {
    const settings = await this.getSettings();
    if (!this.ready || !this.client) {
      this.logger.warn(`Ticket notification skipped: bot ready=${this.ready}, client=${!!this.client}`);
      return;
    }
    if (!settings?.discordTicketChannelId) {
      this.logger.warn('Ticket notification skipped: discordTicketChannelId not configured');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(
        settings.discordTicketChannelId,
      );
      if (!channel || !(channel instanceof TextChannel)) {
        this.logger.warn(`Ticket channel ${settings.discordTicketChannelId} not found or not a text channel`);
        return;
      }

      const isNew = type === 'new';
      const embed = new EmbedBuilder()
        .setTitle(
          isNew ? '🎫 New Support Ticket' : '💬 Ticket Reply',
        )
        .setColor(isNew ? 0x5865f2 : 0x57f287)
        .addFields(
          { name: 'Ticket', value: `#${ticket.id} — ${ticket.subject}`, inline: false },
          { name: 'User', value: ticket.user.email, inline: true },
          { name: 'Priority', value: ticket.priority, inline: true },
        )
        .setTimestamp();

      if (message) {
        const truncated =
          message.length > 500 ? message.slice(0, 497) + '...' : message;
        embed.addFields({
          name: 'Message',
          value: truncated,
          inline: false,
        });
      }

      const pingRole = settings.discordPingRoleId
        ? `<@&${settings.discordPingRoleId}>`
        : '';

      await channel.send({
        content: pingRole
          ? `${pingRole} ${isNew ? 'New ticket opened!' : 'New ticket reply!'}`
          : isNew
            ? 'New ticket opened!'
            : 'New ticket reply!',
        embeds: [embed],
      });
    } catch (err) {
      this.logger.error('Failed to send ticket notification', err);
    }
  }

  // ── Handle Button Interactions ─────────────────────────────────────────────

  private async handleInteraction(interaction: Interaction) {
    if (!interaction.isButton()) return;

    const [action, type, idStr] = interaction.customId.split('_');
    if (action !== 'utr' || !idStr) return;
    const submissionId = parseInt(idStr, 10);
    if (isNaN(submissionId)) return;

    try {
      await interaction.deferUpdate();

      const sub = await this.prisma.utrSubmission.findUnique({
        where: { id: submissionId },
        include: { user: { select: { email: true } } },
      });

      if (!sub) {
        await interaction.followUp({
          content: 'Submission not found.',
          ephemeral: true,
        });
        return;
      }

      if (sub.status !== UtrStatus.pending) {
        await interaction.followUp({
          content: `This submission was already **${sub.status}**.`,
          ephemeral: true,
        });
        // Disable the buttons
        const disabledRow =
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('disabled_approve')
              .setLabel('✅ Approve')
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('disabled_reject')
              .setLabel('❌ Reject')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true),
          );
        await interaction.editReply({ components: [disabledRow] });
        return;
      }

      const isApprove = type === 'approve';

      if (isApprove) {
        // Approve: add balance = submission amount
        await this.prisma.$transaction(async (tx) => {
          await tx.utrSubmission.update({
            where: { id: submissionId },
            data: { status: UtrStatus.approved },
          });
          await tx.user.update({
            where: { id: sub.userId },
            data: { balance: { increment: sub.amount } },
          });
        });
      } else {
        await this.prisma.utrSubmission.update({
          where: { id: submissionId },
          data: { status: UtrStatus.rejected },
        });
      }

      // Update the message with result
      const resultEmbed = new EmbedBuilder()
        .setTitle(
          isApprove
            ? '✅ UTR Payment Approved'
            : '❌ UTR Payment Rejected',
        )
        .setColor(isApprove ? 0x57f287 : 0xed4245)
        .addFields(
          { name: 'Submission ID', value: `#${sub.id}`, inline: true },
          {
            name: 'Amount',
            value: `₹${sub.amount.toFixed(2)}`,
            inline: true,
          },
          { name: 'UTR Number', value: sub.utrNumber, inline: true },
          { name: 'User', value: sub.user.email, inline: true },
          {
            name: 'Processed By',
            value: interaction.user.tag,
            inline: true,
          },
        )
        .setTimestamp();

      const disabledRow =
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('disabled_approve')
            .setLabel('✅ Approved')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('disabled_reject')
            .setLabel('❌ Rejected')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true),
        );

      await interaction.editReply({
        content: isApprove
          ? `Payment **approved** by ${interaction.user.tag} — ₹${sub.amount.toFixed(2)} credited to ${sub.user.email}`
          : `Payment **rejected** by ${interaction.user.tag}`,
        embeds: [resultEmbed],
        components: [disabledRow],
      });
    } catch (err) {
      this.logger.error('Failed to handle UTR button interaction', err);
      try {
        await interaction.followUp({
          content: 'An error occurred while processing this action.',
          ephemeral: true,
        });
      } catch {}
    }
  }
}
