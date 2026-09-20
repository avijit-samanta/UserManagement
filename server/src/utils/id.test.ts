import { describe, expect, it } from 'vitest';
import { generateUuid } from './id';

describe('generateUuid', () => {
  it('generates a v4-shaped UUID', () => {
    expect(generateUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('generates unique values across calls', () => {
    expect(generateUuid()).not.toBe(generateUuid());
  });
});
