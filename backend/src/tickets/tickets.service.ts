import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus, TicketPriority } from '@prisma/client';
import { IsString, MinLength, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TICKET_CREATED, TICKET_REPLIED } from '../events/events';

export class CreateTicketDto {
  @IsString() @MinLength(5) @MaxLength(120) subject: string;
  @IsString() @MinLength(10) message: string;
  @IsEnum(TicketPriority) @IsOptional() priority?: TicketPriority = TicketPriority.medium;
}

export class ReplyTicketDto {
  @IsString() @MinLength(1) message: string;
}

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getUserTickets(userId: number) {
    return this.prisma.ticket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { take: 1, orderBy: { createdAt: 'desc' }, select: { message: true, createdAt: true } },
      },
    });
  }

  async getTicket(ticketId: number, userId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { email: true } } },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new ForbiddenException();
    return ticket;
  }

  async create(userId: number, dto: CreateTicketDto) {
    const ticket = await this.prisma.$transaction(async (tx) => {
      const t = await tx.ticket.create({
        data: { userId, subject: dto.subject, priority: dto.priority || TicketPriority.medium },
        include: { user: { select: { email: true } } },
      });
      await tx.ticketMessage.create({
        data: { ticketId: t.id, userId, message: dto.message },
      });
      return t;
    });

    // Emit event for notifications (decoupled from Discord)
    this.eventEmitter.emit(TICKET_CREATED, {
      type: 'new',
      id: ticket.id,
      subject: ticket.subject,
      priority: ticket.priority,
      user: ticket.user,
      message: dto.message,
    });

    return ticket;
  }

  async reply(ticketId: number, userId: number, dto: ReplyTicketDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { email: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new ForbiddenException();
    if (ticket.status === TicketStatus.closed) throw new ForbiddenException('Ticket is closed');
    if (ticket.status === TicketStatus.resolved) throw new ForbiddenException('Ticket is resolved');

    const message = await this.prisma.ticketMessage.create({
      data: { ticketId, userId, message: dto.message },
    });
    await this.prisma.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.open } });

    // Emit event for notifications (decoupled from Discord)
    this.eventEmitter.emit(TICKET_REPLIED, {
      type: 'reply',
      id: ticket.id,
      subject: ticket.subject,
      priority: ticket.priority,
      user: ticket.user,
      message: dto.message,
    });

    return message;
  }

  async closeTicket(ticketId: number, userId: number) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new ForbiddenException();
    return this.prisma.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.closed } });
  }
}
