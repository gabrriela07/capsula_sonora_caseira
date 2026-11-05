import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Sempre lê server/.env, de qualquer pasta onde o comando for executado
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name} no arquivo server/.env (ou nas variáveis de ambiente do servidor)`);
  return value;
};

/** Usuário do Last.fm normalizado (o Last.fm não diferencia maiúsculas). */
export const normalizarUsuario = (value) => String(value ?? '').trim().toLowerCase();

const lista = (value) => String(value ?? '').split(',').map(normalizarUsuario).filter(Boolean);

const sslAtivo = ['1', 'true', 'yes', 'sim'].includes(String(process.env.MYSQL_SSL ?? '').toLowerCase());

export const config = {
  mysql: {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 3307),
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: required('MYSQL_DATABASE'),
    // Bancos na nuvem (Aiven, TiDB etc.) exigem SSL: MYSQL_SSL=true
    ...(sslAtivo ? { ssl: process.env.MYSQL_SSL_CA ? { ca: process.env.MYSQL_SSL_CA.replace(/\\n/g, '\n') } : { rejectUnauthorized: false } } : {}),
  },
  lastfm: {
    apiKey: required('LASTFM_API_KEY'),
    /** Opcional: usuário aberto quando ninguém informa outro. */
    defaultUser: normalizarUsuario(process.env.LASTFM_USER),
    /** Opcional: lista separada por vírgula. Vazia = qualquer usuário público do Last.fm. */
    allowedUsers: lista(process.env.ALLOWED_USERS),
  },
  port: Number(process.env.PORT ?? 3001),
  appPassword: process.env.APP_PASSWORD ?? '',
  timeZone: process.env.TZ_LOCAL ?? 'America/Sao_Paulo',
  syncIntervalMinutes: Math.max(5, Number(process.env.SYNC_INTERVAL_MINUTES ?? 60)),
};
