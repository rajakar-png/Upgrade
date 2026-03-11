import { Controller, Get, Post, Patch, Param, Body, UseGuards, ParseIntPipe, HttpCode } from '@nestjs/common';
import { TicketsService, CreateTicketDto, ReplyTicketDto } from './tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.ticketsService.getUserTickets(user.id);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.ticketsService.getTicket(id, user.id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user.id, dto);
  }

  @Post(':id/reply')
  @HttpCode(200)
  reply(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any, @Body() dto: ReplyTicketDto) {
    return this.ticketsService.reply(id, user.id, dto);
  }

  @Patch(':id/close')
  @HttpCode(200)
  close(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.ticketsService.closeTicket(id, user.id);
  }
}
