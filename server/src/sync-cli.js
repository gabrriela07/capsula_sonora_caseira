// Sincronização manual pelo terminal (dentro de server/):
//   npm run sync -- nome_do_usuario     → sincroniza um usuário
//   npm run sync                        → sincroniza o LASTFM_USER ou todos os usuários já cadastrados
import { config, normalizarUsuario } from './config.js';
import { ensureSchema, pool } from './db.js';
import { sincronizar, usuariosConhecidos } from './sync.js';

try {
  await ensureSchema();
  const informado = normalizarUsuario(process.argv[2]);
  const usuarios = informado
    ? [informado]
    : [...new Set([config.lastfm.defaultUser, ...(await usuariosConhecidos())].filter(Boolean))];
  if (!usuarios.length) throw new Error('Informe o usuário: npm run sync -- nome_do_usuario');
  for (const user of usuarios) {
    const resumo = await sincronizar(user);
    console.log(`[sync:${user}] concluído`, resumo);
  }
} catch (erro) {
  console.error(erro);
  process.exitCode = 1;
} finally {
  pool.end();
}
