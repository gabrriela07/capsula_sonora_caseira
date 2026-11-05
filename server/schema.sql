-- Rode no MySQL Workbench uma vez, ANTES de iniciar o servidor:
--   CREATE DATABASE IF NOT EXISTS capsula_sonora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- As tabelas abaixo são criadas automaticamente pelo servidor ao iniciar
-- (pode rodar manualmente também; todas usam IF NOT EXISTS).

-- Um scrobble por linha. A chave é um SHA-1 de usuário|uts|artista|música,
-- o que evita o limite de 3072 bytes de índices com textos longos em utf8mb4.
CREATE TABLE IF NOT EXISTS scrobbles (
  scrobble_key    CHAR(40)      NOT NULL,
  uts             BIGINT        NOT NULL,
  played_at_local DATETIME      NOT NULL,
  artist          VARCHAR(512)  NOT NULL,
  artist_mbid     VARCHAR(64)   NOT NULL DEFAULT '',
  album           VARCHAR(512)  NOT NULL DEFAULT '',
  album_mbid      VARCHAR(64)   NOT NULL DEFAULT '',
  track           VARCHAR(512)  NOT NULL,
  track_mbid      VARCHAR(64)   NOT NULL DEFAULT '',
  image_url       VARCHAR(1024) NOT NULL DEFAULT '',
  lastfm_url      VARCHAR(1024) NOT NULL DEFAULT '',
  streamable      TINYINT(1)    NOT NULL DEFAULT 0,
  track_key       CHAR(40)      NOT NULL,
  artist_key      CHAR(40)      NOT NULL,
  lastfm_user     VARCHAR(64)   NOT NULL DEFAULT '',
  PRIMARY KEY (scrobble_key),
  KEY idx_scrobbles_user_uts (lastfm_user, uts),
  KEY idx_scrobbles_uts (uts),
  KEY idx_scrobbles_track_key (track_key),
  KEY idx_scrobbles_artist_key (artist_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Duração cadastrada de cada música (track.getInfo). 0 = Last.fm não informa.
CREATE TABLE IF NOT EXISTS track_durations (
  track_key   CHAR(40)     NOT NULL,
  artist      VARCHAR(512) NOT NULL,
  track       VARCHAR(512) NOT NULL,
  duration_ms INT          NOT NULL DEFAULT 0,
  fetched_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (track_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gênero (tag principal do artista no Last.fm). '' = sem tag útil.
CREATE TABLE IF NOT EXISTS artist_genres (
  artist_key CHAR(40)     NOT NULL,
  artist     VARCHAR(512) NOT NULL,
  genre      VARCHAR(128) NOT NULL DEFAULT '',
  fetched_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (artist_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Histórico das sincronizações (útil para conferir pelo Workbench)
CREATE TABLE IF NOT EXISTS sync_log (
  id            INT          NOT NULL AUTO_INCREMENT,
  started_at    DATETIME     NOT NULL,
  finished_at   DATETIME     NULL,
  new_scrobbles INT          NOT NULL DEFAULT 0,
  new_durations INT          NOT NULL DEFAULT 0,
  new_genres    INT          NOT NULL DEFAULT 0,
  status        VARCHAR(20)  NOT NULL,
  message       VARCHAR(1024) NULL,
  lastfm_user   VARCHAR(64)  NOT NULL DEFAULT '',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
