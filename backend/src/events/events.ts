export const BILLING_UTR_SUBMITTED = 'billing.utr.submitted';
export const TICKET_CREATED = 'ticket.created';
export const TICKET_REPLIED = 'ticket.replied';

export interface UtrSubmittedEvent {
  id: number;
  amount: number;
  utrNumber: string;
  screenshotPath: string;
  user: { email: string };
}

export interface TicketEvent {
  type: 'new' | 'reply';
  id: number;
  subject: string;
  priority: string;
  user: { email: string };
  message?: string;
}
