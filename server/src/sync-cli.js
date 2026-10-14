// Sincronização manual pelo terminal: npm run sync (dentro de server/)
import { ensureSchema, pool } from './db.js';
import { sincronizar } from './sync.js';

try {
  await ensureSchema();
  const resumo = await sincronizar();
  console.log('[sync] concluído', resumo);
} catch (erro) {
  console.error(erro);
  process.exitCode = 1;
} finally {
  pool.end();
}
