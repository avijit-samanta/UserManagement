import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// db.ts reads DB_PATH from process.env at module-load time, so it must be
// set BEFORE that module (or anything importing it) is loaded. A dynamic
// import after setting the env var — rather than a static top-level import
// — is what makes that ordering guaranteed. Vitest isolates module state
// per test file by default, so this doesn't leak into other test files.
const TEST_DB_PATH = path.join(os.tmpdir(), `helpdesk-test-users-${process.pid}-${Date.now()}.json`);
process.env.DB_PATH = TEST_DB_PATH;

let userRepository: typeof import('./userRepository').userRepository;
let writeDb: typeof import('../db').writeDb;

beforeAll(async () => {
  ({ userRepository } = await import('./userRepository'));
  ({ writeDb } = await import('../db'));
});

beforeEach(async () => {
  await writeDb({ users: [], tickets: [] });
});

afterAll(async () => {
  await fs.rm(TEST_DB_PATH, { force: true });
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
    const updated = await userRepository.update('nonexistent-id', { name: 'X' });
    expect(updated).toBeUndefined();
  });
});
