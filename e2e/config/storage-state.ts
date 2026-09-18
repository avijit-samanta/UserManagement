import path from 'path';

const AUTH_DIR = path.join(__dirname, '..', '.auth');

export function storageStatePath(fileName: string): string {
  return path.join(AUTH_DIR, fileName);
}
