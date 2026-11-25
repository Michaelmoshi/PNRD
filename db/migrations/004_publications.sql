-- Publications du site : chaque clic sur « Publier » cree une version (dossier published/v<id>) ; une seule est en ligne
CREATE TABLE publications (
  id           serial PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  user_id      integer REFERENCES users(id) ON DELETE SET NULL,
  note         text NOT NULL DEFAULT '',
  content_hash text NOT NULL,                  -- empreinte des pages generees : sert a savoir s'il reste des modifications
  live         boolean NOT NULL DEFAULT false,
  purged       boolean NOT NULL DEFAULT false  -- dossier supprime pour faire de la place (version trop ancienne)
);
CREATE UNIQUE INDEX publications_one_live ON publications (live) WHERE live;

-- Les editeurs peuvent publier
UPDATE roles SET permissions = array_append(permissions, 'publier')
 WHERE code = 'editeur' AND NOT ('publier' = ANY (permissions));
