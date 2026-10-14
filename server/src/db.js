import { readFile } from 'node:fs/promises';
import mysql from 'mysql2';
import { config } from './config.js';

// Pool "callback" (necessário para streaming) + interface de Promises para o resto
export const pool = mysql.createPool({
  ...config.mysql,
  charset: 'utf8mb4',
  connectionLimit: 6,
  supportBigNumbers: true,
  bigNumberStrings: false,
});
export const db = pool.promise();

/** Conexão avulsa para streaming. Lembre de chamar release(). */
export function getConnection() {
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => (error ? reject(error) : resolve(connection)));
  });
}

/** Cria as tabelas (IF NOT EXISTS) a partir do schema.sql. */
export async function ensureSchema() {
  const sql = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  const statements = sql
    .split('\n').filter((line) => !line.trim().startsWith('--')).join('\n')
    .split(';').map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) await db.query(statement);
}
