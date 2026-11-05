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

async function colunaExiste(tabela, coluna) {
  const [[linha]] = await db.query(
    'SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [tabela, coluna],
  );
  return Number(linha.total) > 0;
}

/**
 * Migração multiusuário (idempotente): adiciona lastfm_user em scrobbles e sync_log.
 * Os dados antigos (de antes da migração) passam a pertencer ao LASTFM_USER, se definido.
 */
async function migrarMultiusuario() {
  if (!(await colunaExiste('scrobbles', 'lastfm_user'))) {
    console.log('[db] migrando scrobbles para multiusuário…');
    await db.query("ALTER TABLE scrobbles ADD COLUMN lastfm_user VARCHAR(64) NOT NULL DEFAULT '', ADD INDEX idx_scrobbles_user_uts (lastfm_user, uts)");
  }
  if (!(await colunaExiste('sync_log', 'lastfm_user'))) {
    await db.query("ALTER TABLE sync_log ADD COLUMN lastfm_user VARCHAR(64) NOT NULL DEFAULT ''");
  }
  if (config.lastfm.defaultUser) {
    const [resultado] = await db.query("UPDATE scrobbles SET lastfm_user = ? WHERE lastfm_user = ''", [config.lastfm.defaultUser]);
    await db.query("UPDATE sync_log SET lastfm_user = ? WHERE lastfm_user = ''", [config.lastfm.defaultUser]);
    if (resultado.affectedRows) console.log(`[db] ${resultado.affectedRows} scrobbles antigos atribuídos a ${config.lastfm.defaultUser}`);
  }
}

/** Cria as tabelas (IF NOT EXISTS) a partir do schema.sql e aplica as migrações. */
export async function ensureSchema() {
  const sql = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  const statements = sql
    .split('\n').filter((line) => !line.trim().startsWith('--')).join('\n')
    .split(';').map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) await db.query(statement);
  await migrarMultiusuario();
}
