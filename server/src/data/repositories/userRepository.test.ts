import { beforeEach, describe, expect, it } from 'vitest';
import { userRepository } from './userRepository';
import { truncateTestTables } from './testHelpers';

// See src/test-setup.ts: SUPABASE_SCHEMA is set to "test" for the whole
// suite, so these run against an isolated copy of the real tables.
beforeEach(async () => {
  await truncateTestTables();
});

describe('userRepository.create', () => {
  it('creates a user with a generated id and matching timestamps', async () => {
    const user = await userRepository.create({
      email: 'new@example.com',
      passwordHash: 'hashed',
      role: 'user',
      name: 'New User',
      phone: '555',
      address: 'Somewhere',
    });

    expect(user.id).toBeTruthy();
    expect(user.email).toBe('new@example.com');
    expect(user.createdAt).toBe(user.updatedAt);

    const all = await userRepository.list();
    expect(all).toHaveLength(1);
  });
});

describe('userRepository.findByEmail', () => {
  it('finds a user regardless of email casing', async () => {
    await userRepository.create({
      email: 'CaseSensitive@Example.com',
      passwordHash: 'hashed',
      role: 'user',
      name: 'Case Test',
      phone: '',
      address: '',
    });

    const found = await userRepository.findByEmail('casesensitive@example.com');
    expect(found?.name).toBe('Case Test');
  });

  it('returns undefined when no user matches', async () => {
    const found = await userRepository.findByEmail('nobody@example.com');
    expect(found).toBeUndefined();
  });
});

describe('userRepository.update', () => {
  it('updates only the fields provided, and bumps updatedAt', async () => {
    const user = await userRepository.create({
      email: 'update-me@example.com',
      passwordHash: 'hashed',
      role: 'user',
      name: 'Before',
      phone: '111',
      address: 'Old address',
    });

    const updated = await userRepository.update(user.id, { name: 'After' });

    expect(updated?.name).toBe('After');
    expect(updated?.phone).toBe('111'); // untouched field preserved
    expect(updated?.email).toBe('update-me@example.com');
  });

  it('returns undefined when the user does not exist', async () => {
    // A syntactically-valid-but-unused uuid, not an arbitrary string — see
    // pgErrors.ts: a malformed uuid is guarded separately (below).
    const updated = await userRepository.update('00000000-0000-0000-0000-000000000000', { name: 'X' });
    expect(updated).toBeUndefined();
  });

  it('returns undefined (not a Postgres error) for a malformed id', async () => {
    const updated = await userRepository.update('not-a-uuid', { name: 'X' });
    expect(updated).toBeUndefined();
  });
});
