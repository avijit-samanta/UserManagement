import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

let client: AnySupabaseClient | undefined;

// In-memory data store for fallback when Supabase credentials are not provided
const tables: Record<string, any[]> = {
  users: [],
  tickets: [],
  ticket_messages: [],
  attachments: [],
};

const storageStore = new Map<string, { buffer: Buffer; contentType: string }>();
let ticketCounter = 1;

function parseOrFilter(filterStr: string): Array<(row: any) => boolean> {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of filterStr) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts.map((part) => {
    const eqMatch = part.match(/^([^.]+)\.eq\.(.*)$/);
    if (eqMatch) {
      const [, col, val] = eqMatch;
      return (row: any) => String(row[col] ?? '') === val;
    }
    const inMatch = part.match(/^([^.]+)\.in\.\((.*)\)$/);
    if (inMatch) {
      const [, col, list] = inMatch;
      const vals = list.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
      return (row: any) => vals.includes(String(row[col] ?? ''));
    }
    return () => true;
  });
}

function createMockSupabaseClient(): AnySupabaseClient {
  return {
    from(tableName: string) {
      if (!tables[tableName]) {
        tables[tableName] = [];
      }

      let filters: Array<(row: any) => boolean> = [];
      let sortFn: ((a: any, b: any) => number) | undefined;
      let action: 'select' | 'insert' | 'update' | 'delete' = 'select';
      let insertRows: any[] = [];
      let updatePatch: any = {};
      let isCountHead = false;

      const execute = (singleMode?: 'single' | 'maybeSingle') => {
        const table = tables[tableName];

        if (action === 'insert') {
          // If inserting into ticket_messages, check ticket foreign key
          if (tableName === 'ticket_messages') {
            for (const r of insertRows) {
              if (r.ticket_id && !tables.tickets.some((t: any) => t.id === r.ticket_id)) {
                return { data: null, error: { code: '23503', message: 'foreign_key_violation' } };
              }
            }
          }

          const inserted: any[] = [];
          for (const item of insertRows) {
            const row = { ...item };
            if (!row.id) {
              if (tableName === 'tickets') {
                row.id = `TCK-${String(ticketCounter++).padStart(6, '0')}`;
              } else {
                row.id = crypto.randomUUID();
              }
            }
            const now = new Date().toISOString();
            if (!row.created_at) row.created_at = now;
            if (!row.updated_at && (tableName === 'users' || tableName === 'tickets')) {
              row.updated_at = now;
            }
            table.push(row);
            inserted.push(row);
          }

          if (singleMode === 'single') {
            return { data: inserted[0] ?? null, error: inserted.length === 0 ? { code: 'PGRST116', message: 'Not found' } : null };
          }
          if (singleMode === 'maybeSingle') {
            return { data: inserted[0] ?? null, error: null };
          }
          return { data: inserted, error: null };
        }

        let filtered = table.filter((row: any) => filters.every((fn) => fn(row)));

        if (action === 'update') {
          const updated: any[] = [];
          for (const row of filtered) {
            Object.assign(row, updatePatch, { updated_at: new Date().toISOString() });
            updated.push({ ...row });
          }
          if (singleMode === 'single') {
            return { data: updated[0] ?? null, error: updated.length === 0 ? { code: 'PGRST116', message: 'Not found' } : null };
          }
          if (singleMode === 'maybeSingle') {
            return { data: updated[0] ?? null, error: null };
          }
          return { data: updated, error: null };
        }

        if (action === 'delete') {
          const deleted: any[] = [];
          const remaining: any[] = [];
          for (const row of table) {
            if (filters.every((fn) => fn(row))) {
              deleted.push(row);
            } else {
              remaining.push(row);
            }
          }
          tables[tableName] = remaining;

          if (singleMode === 'single') {
            return { data: deleted[0] ?? null, error: deleted.length === 0 ? { code: 'PGRST116', message: 'Not found' } : null };
          }
          if (singleMode === 'maybeSingle') {
            return { data: deleted[0] ?? null, error: null };
          }
          return { data: deleted, error: null };
        }

        // Action is select
        if (isCountHead) {
          return { count: filtered.length, data: null, error: null };
        }

        if (sortFn) {
          filtered = [...filtered].sort(sortFn);
        }

        if (singleMode === 'single') {
          if (filtered.length === 0) {
            return { data: null, error: { code: 'PGRST116', message: 'Row not found' } };
          }
          return { data: filtered[0], error: null };
        }

        if (singleMode === 'maybeSingle') {
          return { data: filtered[0] ?? null, error: null };
        }

        return { data: filtered, error: null };
      };

      const builder: any = {
        select(_cols?: string, options?: { count?: string; head?: boolean }) {
          if (options?.count === 'exact' && options?.head === true) {
            isCountHead = true;
          }
          return builder;
        },
        eq(col: string, val: any) {
          filters.push((row: any) => String(row[col] ?? '') === String(val ?? ''));
          return builder;
        },
        ilike(col: string, val: string) {
          filters.push((row: any) => String(row[col] ?? '').toLowerCase() === String(val ?? '').toLowerCase());
          return builder;
        },
        in(col: string, vals: any[]) {
          const stringVals = Array.isArray(vals) ? vals.map((v) => String(v)) : [];
          filters.push((row: any) => stringVals.includes(String(row[col] ?? '')));
          return builder;
        },
        or(filterStr: string) {
          const subfilters = parseOrFilter(filterStr);
          filters.push((row: any) => subfilters.some((fn) => fn(row)));
          return builder;
        },
        not(col: string, op: string, val: any) {
          if (op === 'is' && val === null) {
            filters.push((row: any) => row[col] !== null && row[col] !== undefined);
          } else if (op === 'eq') {
            filters.push((row: any) => String(row[col] ?? '') !== String(val ?? ''));
          } else {
            filters.push((row: any) => row[col] !== val);
          }
          return builder;
        },
        is(col: string, val: any) {
          if (val === null) {
            filters.push((row: any) => row[col] === null || row[col] === undefined);
          } else {
            filters.push((row: any) => row[col] === val);
          }
          return builder;
        },
        order(col: string, { ascending = true }: { ascending?: boolean } = {}) {
          sortFn = (a: any, b: any) => {
            const va = a[col] ?? '';
            const vb = b[col] ?? '';
            if (va < vb) return ascending ? -1 : 1;
            if (va > vb) return ascending ? 1 : -1;
            return 0;
          };
          return builder;
        },
        insert(data: any) {
          action = 'insert';
          insertRows = Array.isArray(data) ? data : [data];
          return builder;
        },
        update(patch: any) {
          action = 'update';
          updatePatch = patch;
          return builder;
        },
        delete() {
          action = 'delete';
          return builder;
        },
        single() {
          return Promise.resolve(execute('single'));
        },
        maybeSingle() {
          return Promise.resolve(execute('maybeSingle'));
        },
        then(resolve: (val: any) => any, reject?: (err: any) => any) {
          return Promise.resolve(execute()).then(resolve, reject);
        },
      };

      return builder;
    },
    storage: {
      from(_bucket: string) {
        return {
          upload: async (storagePath: string, buffer: Buffer, options?: { contentType?: string }) => {
            storageStore.set(storagePath, {
              buffer,
              contentType: options?.contentType || 'application/octet-stream',
            });
            return { data: { path: storagePath }, error: null };
          },
          download: async (storagePath: string) => {
            const item = storageStore.get(storagePath);
            if (!item) {
              return { data: null, error: { message: 'File not found in storage' } };
            }
            const arrayBuf = item.buffer.buffer.slice(
              item.buffer.byteOffset,
              item.buffer.byteOffset + item.buffer.byteLength,
            );
            return {
              data: {
                arrayBuffer: async () => arrayBuf,
              },
              error: null,
            };
          },
          remove: async (paths: string[]) => {
            for (const p of paths) {
              storageStore.delete(p);
            }
            return { data: paths.map((p) => ({ name: p })), error: null };
          },
        };
      },
    },
  } as unknown as AnySupabaseClient;
}

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const lower = value.toLowerCase();
  return (
    lower.includes('your-project-ref') ||
    lower.includes('your-db-password') ||
    lower.includes('placeholder') ||
    lower.includes('example.com') ||
    lower.includes('sb_secret_...')
  );
}

export function switchToMockClient(): AnySupabaseClient {
  client = createMockSupabaseClient();
  return client;
}

export function getSupabaseClient(): AnySupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || isPlaceholder(url) || isPlaceholder(key)) {
    console.info('[AI Studio] Supabase credentials not provided or placeholder — using in-memory store.');
    client = createMockSupabaseClient();
    return client;
  }

  try {
    client = createClient(url, key, {
      db: { schema: process.env.SUPABASE_SCHEMA || 'public' },
      auth: { persistSession: false },
    });
    console.info('[AI Studio] Connected to Supabase at', url);
    return client;
  } catch (err) {
    console.warn('[AI Studio] Failed to initialize Supabase client, falling back to in-memory store:', err);
    client = createMockSupabaseClient();
    return client;
  }
}

export function resetSupabaseClientForTests(): void {
  client = undefined;
  tables.users = [];
  tables.tickets = [];
  tables.ticket_messages = [];
  tables.attachments = [];
  storageStore.clear();
  ticketCounter = 1;
}
