# Servidor da Cápsula Sonora

Sincroniza o histórico do Last.fm no MySQL e serve o painel. O site passa a ler o
banco pelo servidor, sem chamar o Last.fm a cada abertura.

## 1. Banco (MySQL Workbench)

```sql
CREATE DATABASE IF NOT EXISTS capsula_sonora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

As tabelas (`scrobbles`, `track_durations`, `artist_genres`, `sync_log`) são criadas
sozinhas quando o servidor inicia. O script completo está em `schema.sql`.

## 2. Configuração

Copie `server/.env.example` para `server/.env` e preencha MySQL, chave e usuário do
Last.fm e a senha de acesso (`APP_PASSWORD`).

## 3. Rodar

Na raiz do projeto:

```bash
npm install
npm --prefix server install
npm run build      # gera a pasta dist/ com o site
npm run server     # sobe o servidor na porta 3001
```

Acesse `http://IP_DO_SERVIDOR:3001` (também pelo celular).

Em desenvolvimento, use dois terminais: `npm run server:dev` e `npm run dev`.
O Vite encaminha `/api` para a porta 3001.

## Sincronização

- Roda ao iniciar e depois a cada `SYNC_INTERVAL_MINUTES`.
- Busca só scrobbles novos. A carga inicial lê do mais antigo para o mais novo; se
  for interrompida, a próxima continua de onde parou.
- Depois busca a duração de cada música nova e o gênero de cada artista novo,
  uma vez só (fica gravado no banco).
- Manual: `npm run sync` na raiz, ou `POST /api/sync`.
- Conferir pelo Workbench: `SELECT * FROM sync_log ORDER BY id DESC;`

## Endpoints

- `GET /api/status` — totais e andamento da sincronização
- `GET /api/history.csv` — histórico completo (gzip), no formato que o site lê
- `POST /api/sync` — inicia uma sincronização
