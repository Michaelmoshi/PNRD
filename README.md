# PNRD — Site web du Parti National du Renouveau pour le Développement

Site vitrine statique (HTML, CSS, JavaScript), sans framework ni étape de compilation.

## Lancer le site en local

L'en-tête, le pied de page et le slider sont chargés par JavaScript : il faut un petit serveur
(ouvrir les fichiers directement dans le navigateur ne suffit pas).

```bash
node tools/server.js          # http://localhost:5500
PORT=5600 node tools/server.js   # autre port si 5500 est pris
```

## Structure du projet

```
PNRD/
├── index.html              Accueil
├── 404.html                Page introuvable (autonome, doit rester à la racine pour GitHub Pages)
├── pages/
│   ├── a-propos.html       Histoire, idéologie, doctrine, valeurs, emblème, organisation
│   ├── membres.html        Équipe par catégories
│   ├── adhesion.html       Formulaire d'adhésion (envoi par EmailJS)
│   ├── evenement.html      Détail d'un événement : evenement.html?id=1 (données dans data/evenements.json)
│   ├── mentions-legales.html
│   └── confidentialite.html
├── partials/               Morceaux de page communs : header.html, footer.html, slider.html
├── css/                    Feuilles de style (voir ci-dessous)
├── js/                     Scripts, un fichier par rôle (voir ci-dessous)
├── data/
│   └── evenements.json     Événements passés (page evenement.html)
├── assets/
│   ├── images/             hero/ (slider), about/, team/
│   ├── logo/               logo-pnrd.jpeg
│   ├── partners/           logos des partenaires
│   ├── videos/evenements/  vidéos, nommées  AAAA-MM-JJ-titre.mp4
│   └── favicon.*
└── tools/
    └── server.js           serveur de développement local (inutile en production)
```

Règles de nommage : minuscules, tirets à la place des espaces, pas d'accents dans les noms de fichiers.

## CSS

Les six fichiers sont chargés **dans cet ordre** par chaque page (l'ordre compte : les derniers l'emportent) :

1. `base.css` — variables (couleurs, polices), réinitialisation, mise en page commune
2. `layout.css` — en-tête, navigation, slider d'accueil
3. `home.css` — sections de l'accueil (à propos, vision, programmes, chiffres clés, agenda, événements passés)
4. `pages.css` — adhésion, détail d'un événement, contact, partenaires, à propos, membres
5. `footer.css` — pied de page, bouton « retour en haut », animations, pages légales
6. `responsive.css` — ajustements mobile (≤ 768 px). Toute règle bureau a son équivalent mobile ici.

## JavaScript

| Fichier | Rôle |
| --- | --- |
| `includes.js` | Charge les fragments (`<div data-include="partials/header.html">`) et corrige leurs liens selon la profondeur de la page |
| `nav.js` | Menu burger, menus déroulants, repérage de la page courante |
| `slider.js` | Slider d'accueil |
| `ui.js` | Bouton « retour en haut », apparition des blocs au défilement |
| `home.js` | Accueil : menu actif au défilement, lecteur des événements passés, chiffres clés animés |
| `team.js` | Page Membres : onglets de catégories |
| `evenement.js` | Page événement : lit `data/evenements.json` |
| `adhesion.js` | Formulaire d'adhésion : validation, anti-spam, envoi EmailJS |

### Chemins des pages

- Les fichiers de `pages/` déclarent `<html data-base="../">` et utilisent des chemins en `../`.
- Les fragments de `partials/` sont écrits **depuis la racine** (`assets/...`, `pages/...`) : `includes.js` ajoute `../` quand c'est nécessaire.

## Ajouter ou modifier un événement passé

1. Ajouter la vidéo dans `assets/videos/evenements/` (nom `AAAA-MM-JJ-titre.mp4`).
2. Ajouter une entrée dans `data/evenements.json` (id, date, titre, description, compte rendu, vidéo, affiche).
3. Pour qu'il apparaisse aussi dans le lecteur de l'accueil, ajouter la ligne correspondante dans la section
   « Événements passés » de `index.html`.

## Formulaire d'adhésion

L'envoi passe par [EmailJS](https://www.emailjs.com) : un modèle envoie la demande à l'adresse du parti, un second
(« Auto-Reply ») envoie la confirmation au candidat. Réglages dans le compte EmailJS ; identifiants utilisés par le site
dans `js/adhesion.js`. Protections : champ piège invisible, délai minimal, consentement obligatoire.

## À compléter avant la mise en ligne

- Remplacer les contenus provisoires : chiffres clés, photos, vidéos, logos des partenaires, liens des réseaux sociaux.
- Compléter les champs « [À compléter] » des pages légales.
- Compresser les images (WebP, < 200 Ko) et les vidéos.
- Renseigner l'adresse finale du site (images de partage `og:image`, plan du site, adresses canoniques).
