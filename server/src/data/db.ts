import fs from 'fs/promises';
import path from 'path';
import type { DbShape } from '../models/types';

const DB_PATH = path.resolve(__dirname, '../../../data/db.json');

// Serializes writes to the JSON file within this process. Sufficient for a
// single-process local-file store; a real database or a file-locking
// library would be required for a multi-process deployment.
let writeLock: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeLock.then(fn, fn);
  writeLock = result.catch(() => undefined);
  return result as Promise<T>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// On Windows, fs.rename() can transiently fail with EPERM/EBUSY right after
// fs.writeFile() if antivirus or a file indexer briefly holds the temp file
// open. A short retry clears this up without surfacing an error to callers.
async function renameWithRetry(from: string, to: string, attempts = 5): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (attempt === attempts || (code !== 'EPERM' && code !== 'EBUSY')) {
        throw err;
      }
      await delay(50 * attempt);
    }
  }
}

export async function dbExists(): Promise<boolean> {
  try {
    await fs.access(DB_PATH);
    return true;
  } catch {
    return false;
  }
}

export async function readDb(): Promise<DbShape> {
  const raw = await fs.readFile(DB_PATH, 'utf-8');
  return JSON.parse(raw) as DbShape;
}

export async function writeDb(db: DbShape): Promise<void> {
  await withLock(async () => {
    // A unique temp file per write avoids any chance of two in-flight
    // writes (even serialized ones racing a slow antivirus scan) colliding
    // on the same path.
    const tmpPath = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
    await renameWithRetry(tmpPath, DB_PATH);
  });
}

export async function initDbIfMissing(initial: DbShape): Promise<void> {
  if (await dbExists()) return;
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await writeDb(initial);
}
