import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Sempre lê server/.env, de qualquer pasta onde o comando for executado
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name} no arquivo server/.env`);
  return value;
};

export const config = {
  mysql: {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 3307),
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: required('MYSQL_DATABASE'),
  },
  lastfm: {
    apiKey: required('LASTFM_API_KEY'),
    user: required('LASTFM_USER'),
  },
  port: Number(process.env.PORT ?? 3001),
  appPassword: process.env.APP_PASSWORD ?? '',
  timeZone: process.env.TZ_LOCAL ?? 'America/Sao_Paulo',
  syncIntervalMinutes: Math.max(5, Number(process.env.SYNC_INTERVAL_MINUTES ?? 60)),
};
