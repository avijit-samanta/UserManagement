import crypto from 'crypto';

export function generateUuid(): string {
  return crypto.randomUUID();
}

let ticketCounter = 0;

export function generateTicketId(existingCount: number): string {
  ticketCounter = Math.max(ticketCounter, existingCount);
  ticketCounter += 1;
  return `TCK-${String(ticketCounter).padStart(6, '0')}`;
}

let messageCounter = 0;

export function generateMessageId(): string {
  messageCounter += 1;
  return `MSG-${Date.now()}-${messageCounter}`;
}
