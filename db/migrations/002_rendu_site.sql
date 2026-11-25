-- Informations de presentation necessaires pour regenerer le site public a l'identique
ALTER TABLE member_categories ADD COLUMN slug text NOT NULL DEFAULT '';
ALTER TABLE member_categories ADD COLUMN icon text NOT NULL DEFAULT '';   -- contenu du <svg> de l'icone
ALTER TABLE partners ADD COLUMN logo_class text NOT NULL DEFAULT '';      -- ex. partner-logo-tall
