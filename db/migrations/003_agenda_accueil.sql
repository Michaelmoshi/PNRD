-- Prochains evenements de l'accueil (a venir) et membres mis en avant sur l'accueil
CREATE TABLE agenda (
  id          serial PRIMARY KEY,
  starts_at   timestamp NOT NULL,              -- heure locale, sans fuseau
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  published   boolean NOT NULL DEFAULT true
);
ALTER TABLE members ADD COLUMN featured boolean NOT NULL DEFAULT false;   -- affiche dans l'equipe dirigeante de l'accueil
