import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { config } from '../config';
import { migrate } from './schema';

const dir = path.dirname(config.dbPath);
if (dir && dir !== '.' && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(config.dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

migrate(db);
