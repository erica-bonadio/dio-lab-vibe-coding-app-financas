import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.join(__dirname, '..', 'src', 'db', 'client.ts');
const src = fs.readFileSync(clientPath, 'utf8');

const required = [
  'CREATE TABLE IF NOT EXISTS transactions',
  'CREATE TABLE IF NOT EXISTS goals',
  'CREATE TABLE IF NOT EXISTS chat_messages',
  'CREATE TABLE IF NOT EXISTS investments',
  'CREATE TABLE IF NOT EXISTS budgets',
  'amount_cents',
  'invested_cents',
  'limit_cents',
  'PRAGMA foreign_keys = ON',
];

const missing = required.filter((s) => !src.includes(s));
if (missing.length) {
  console.error('[db:check] FAIL — faltando no migrate:', missing.join(', '));
  process.exit(1);
}

console.log('[db:check] OK — schema Capim presente em src/db/client.ts');
