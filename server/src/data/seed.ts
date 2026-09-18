import { initDbIfMissing } from './db';
import { hashPassword } from '../utils/password';
import { generateUuid } from '../utils/id';
import type { DbShape } from '../models/types';

export async function seedIfNeeded(): Promise<void> {
  const now = new Date().toISOString();

  const initial: DbShape = {
    users: [
      {
        id: generateUuid(),
        email: 'admin@example.com',
        passwordHash: hashPassword('Admin@123'),
        role: 'admin',
        name: 'Alex Administrator',
        phone: '+1 (555) 010-0001',
        address: '100 Admin Plaza, Suite 1, Metropolis',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: generateUuid(),
        email: 'user@example.com',
        passwordHash: hashPassword('User@123'),
        role: 'user',
        name: 'Jamie User',
        phone: '+1 (555) 010-0002',
        address: '200 Resident Ave, Apt 4B, Metropolis',
        createdAt: now,
        updatedAt: now,
      },
    ],
    tickets: [],
  };

  await initDbIfMissing(initial);
}
