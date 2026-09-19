import { describe, expect, it } from 'vitest';
import { generateMessageId, generateTicketId, generateUuid } from './id';

describe('generateUuid', () => {
  it('generates a v4-shaped UUID', () => {
    expect(generateUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('generates unique values across calls', () => {
    expect(generateUuid()).not.toBe(generateUuid());
  });
});

describe('generateTicketId', () => {
  // ticketCounter is module-level state shared across every call in this
  // process, so assertions check *shape* and *monotonic increase*, not an
  // exact absolute value — that would be brittle against execution order.
  it('formats as TCK- followed by a 6-digit, zero-padded number', () => {
    expect(generateTicketId(0)).toMatch(/^TCK-\d{6}$/);
  });

  it('always increases, never repeats or goes backward', () => {
    const first = Number(generateTicketId(0).split('-')[1]);
    const second = Number(generateTicketId(0).split('-')[1]);
    expect(second).toBe(first + 1);
  });

  it('jumps forward to stay ahead of a larger existing count', () => {
    const before = Number(generateTicketId(0).split('-')[1]);
    const jumped = Number(generateTicketId(before + 50).split('-')[1]);
    expect(jumped).toBeGreaterThan(before + 50);
  });
});

describe('generateMessageId', () => {
  it('never issues the same id twice, even called back-to-back', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateMessageId()));
    expect(ids.size).toBe(50);
  });
});
