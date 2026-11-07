import { createClient, type Client } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

export interface Cylinder {
  id: number;
  serial_number: string;
  cylinder_number: string;
  gas_type: string;
  updated_at: string;
}

export interface Ticket {
  id: number;
  ticket_code: string;
  customer_name: string;
  sj_number: string;
  retrieval_date: string;
  notes: string;
  total_items: number;
  created_at: string;
}

export interface TicketItem {
  id: number;
  ticket_id: number;
  serial_number: string;
  cylinder_number: string;
  gas_type: string;
  input_method: string;
  created_at: string;
}

const globalForDb = globalThis as unknown as {
  libsqlClient?: Client;
  tablesInitialized?: boolean;
};

export function getDb(): Client {
  if (!globalForDb.libsqlClient) {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (tursoUrl) {
      // Connect to Turso Cloud (Production / Vercel)
      globalForDb.libsqlClient = createClient({
        url: tursoUrl,
        authToken: tursoToken,
      });
    } else {
      // Connect to Local SQLite File (Local Development fallback)
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const dbPath = path.join(dataDir, "asset_retrieval.db");
      globalForDb.libsqlClient = createClient({
        url: `file:${dbPath.replace(/\\/g, "/")}`,
      });
    }
  }

  return globalForDb.libsqlClient;
}

export async function ensureTablesExist(): Promise<void> {
  if (globalForDb.tablesInitialized) return;
  const db = getDb();

  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS cylinders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serial_number TEXT UNIQUE NOT NULL COLLATE NOCASE,
        cylinder_number TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
        gas_type TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );`,
      `CREATE INDEX IF NOT EXISTS idx_cylinders_serial ON cylinders(serial_number);`,
      `CREATE INDEX IF NOT EXISTS idx_cylinders_number ON cylinders(cylinder_number);`,
      `CREATE INDEX IF NOT EXISTS idx_cylinders_gas ON cylinders(gas_type);`,
      `CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_code TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        sj_number TEXT NOT NULL,
        retrieval_date TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        total_items INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );`,
      `CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_tickets_sj ON tickets(sj_number);`,
      `CREATE TABLE IF NOT EXISTS ticket_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        serial_number TEXT NOT NULL,
        cylinder_number TEXT NOT NULL DEFAULT '',
        gas_type TEXT NOT NULL DEFAULT '',
        input_method TEXT NOT NULL DEFAULT 'MANUAL',
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      );`,
      `CREATE INDEX IF NOT EXISTS idx_ticket_items_ticket ON ticket_items(ticket_id);`,
    ],
    "write"
  );

  globalForDb.tablesInitialized = true;
}
