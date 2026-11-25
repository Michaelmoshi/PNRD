-- PNRD CMS : schema initial (PostgreSQL)
-- Regle : ce fichier decrit la STRUCTURE seulement. Aucune donnee personnelle ici.

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------- utilisateurs et roles
CREATE TABLE roles (
  id          smallserial PRIMARY KEY,
  code        text NOT NULL UNIQUE,            -- admin, editeur, secretariat
  label       text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}'     -- ex: {contenu.ecrire, adhesions.lire}
);

CREATE TABLE users (
  id            serial PRIMARY KEY,
  email         citext NOT NULL UNIQUE,
  full_name     text NOT NULL,
  password_hash text NOT NULL,                 -- jamais le mot de passe en clair
  role_id       smallint NOT NULL REFERENCES roles(id),
  active        boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id         text PRIMARY KEY,                 -- identifiant aleatoire du cookie (hache)
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- medias
CREATE TABLE media (
  id          serial PRIMARY KEY,
  path        text NOT NULL UNIQUE,            -- ex: assets/uploads/2026/photo.webp
  kind        text NOT NULL CHECK (kind IN ('image','video','document')),
  alt         text NOT NULL DEFAULT '',
  width       integer,
  height      integer,
  uploaded_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- contenu du site
CREATE TABLE slides (
  id        serial PRIMARY KEY,
  position  integer NOT NULL DEFAULT 0,
  eyebrow   text NOT NULL DEFAULT '',
  title     text NOT NULL,
  subtitle  text NOT NULL DEFAULT '',
  style     text NOT NULL DEFAULT '',          -- slide--renouveau, etc.
  image_id  integer REFERENCES media(id) ON DELETE SET NULL,
  published boolean NOT NULL DEFAULT true
);

-- Textes libres des pages (a propos, vision, valeurs, embleme, slogan...) : une ligne par bloc
CREATE TABLE content_blocks (
  page       text NOT NULL,                    -- a-propos, accueil...
  key        text NOT NULL,                    -- vision, valeurs, embleme...
  title      text NOT NULL DEFAULT '',
  body       text NOT NULL DEFAULT '',         -- texte ou HTML assaini
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (page, key)
);

CREATE TABLE programmes (
  id        serial PRIMARY KEY,
  slug      text NOT NULL UNIQUE,
  position  integer NOT NULL DEFAULT 0,
  title     text NOT NULL,
  summary   text NOT NULL DEFAULT '',
  body      text NOT NULL DEFAULT '',
  image_id  integer REFERENCES media(id) ON DELETE SET NULL,
  published boolean NOT NULL DEFAULT true
);

CREATE TABLE events (
  id          serial PRIMARY KEY,
  event_date  date NOT NULL,
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  report      text[] NOT NULL DEFAULT '{}',    -- paragraphes du compte rendu
  poster_id   integer REFERENCES media(id) ON DELETE SET NULL,
  video_mp4   text NOT NULL DEFAULT '',
  video_webm  text NOT NULL DEFAULT '',
  published   boolean NOT NULL DEFAULT true
);

CREATE TABLE member_categories (
  id       serial PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  title    text NOT NULL,
  intro    text NOT NULL DEFAULT ''
);

CREATE TABLE members (
  id          serial PRIMARY KEY,
  category_id integer NOT NULL REFERENCES member_categories(id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,
  full_name   text NOT NULL,
  function    text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  photo_id    integer REFERENCES media(id) ON DELETE SET NULL,
  published   boolean NOT NULL DEFAULT true
);

CREATE TABLE partners (
  id        serial PRIMARY KEY,
  position  integer NOT NULL DEFAULT 0,
  name      text NOT NULL,
  url       text NOT NULL DEFAULT '',
  logo_id   integer REFERENCES media(id) ON DELETE SET NULL,
  published boolean NOT NULL DEFAULT true
);

-- Parametres : coordonnees, reseaux sociaux, chiffres cles, SEO (cle -> valeur)
CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- adhesions (DONNEES PERSONNELLES)
CREATE TYPE application_status AS ENUM ('recue', 'en_etude', 'acceptee', 'declinee');

CREATE TABLE applications (
  id          serial PRIMARY KEY,
  status      application_status NOT NULL DEFAULT 'recue',
  nom         text NOT NULL,
  postnom     text NOT NULL DEFAULT '',
  prenom      text NOT NULL,
  telephone   text NOT NULL,
  email       citext NOT NULL,
  piece       text NOT NULL DEFAULT '',
  sexe        text NOT NULL DEFAULT '',
  profession  text NOT NULL DEFAULT '',
  ville       text NOT NULL DEFAULT '',
  adresse     text NOT NULL DEFAULT '',
  consent_at  timestamptz NOT NULL,            -- preuve du consentement
  assigned_to integer REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX applications_status_idx ON applications (status, created_at DESC);

CREATE TABLE application_notes (
  id             serial PRIMARY KEY,
  application_id integer NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  author_id      integer REFERENCES users(id) ON DELETE SET NULL,
  note           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contact_messages (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  email      citext NOT NULL,
  message    text NOT NULL,
  handled    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- journal d audit
CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  user_id    integer REFERENCES users(id) ON DELETE SET NULL,
  action     text NOT NULL,                    -- creer, modifier, supprimer, connexion...
  entity     text NOT NULL,                    -- programmes, applications...
  entity_id  text,
  details    jsonb NOT NULL DEFAULT '{}',
  ip         inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);

-- ---------------------------------------------------------------- roles de depart (structure, pas de donnees personnelles)
INSERT INTO roles (code, label, permissions) VALUES
  ('admin',       'Administrateur',         ARRAY['*']),
  ('editeur',     'Editeur de contenu',     ARRAY['contenu.lire', 'contenu.ecrire', 'medias.ecrire']),
  ('secretariat', 'Secretariat (adhesions)', ARRAY['adhesions.lire', 'adhesions.ecrire', 'messages.lire']);
