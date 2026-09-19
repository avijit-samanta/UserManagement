import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('hashPassword', () => {
  it('produces a bcrypt hash, not the plaintext', () => {
    const hash = hashPassword('Sup3rSecret!');
    expect(hash).not.toBe('Sup3rSecret!');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('produces a different hash each time for the same input (unique salt)', () => {
    const hash1 = hashPassword('same-input');
    const hash2 = hashPassword('same-input');
    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyPassword', () => {
  it('accepts the correct password against its own hash', () => {
    const hash = hashPassword('Sup3rSecret!');
    expect(verifyPassword('Sup3rSecret!', hash)).toBe(true);
  });

  it('rejects an incorrect password', () => {
    const hash = hashPassword('Sup3rSecret!');
    expect(verifyPassword('WrongPassword', hash)).toBe(false);
  });

  it('rejects an empty password', () => {
    const hash = hashPassword('Sup3rSecret!');
    expect(verifyPassword('', hash)).toBe(false);
  });
});
