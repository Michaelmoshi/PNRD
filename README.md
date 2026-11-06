# PNRD — Site web du Parti National du Renouveau pour le Développement

Site vitrine statique (HTML, CSS, JavaScript), sans framework ni étape de compilation.

## Lancer le site en local

Le menu, le pied de page et le slider sont **écrits directement dans chaque page** : on peut ouvrir
`index.html` tel quel dans le navigateur. Un petit serveur reste utile pour la page d'un événement
(qui lit `data/evenements.json`) et pour tester comme en ligne :

```bash
node tools/server.js          # http://localhost:5500
PORT=5600 node tools/server.js   # autre port si 5500 est pris
```

## Modifier le menu, le pied de page ou le slider

1. Modifier le fichier concerné dans `partials/` (`header.html`, `footer.html`, `slider.html`), écrit avec des liens
   depuis la racine du site (`assets/...`, `pages/...`).
2. Lancer `node tools/build.js` : il recopie le fragment dans toutes les pages et corrige les liens selon leur dossier.

Ne pas modifier le menu ou le pied de page directement dans une page : le prochain `build` écraserait le changement.

## Structure du projet

```
PNRD/
├── index.html              Accueil
├── 404.html                Page introuvable (autonome, doit rester à la racine pour GitHub Pages)
├── pages/
│   ├── a-propos.html       Histoire, idéologie, doctrine, valeurs, emblème, organisation
│   ├── programmes.html     Programmes et réalisations (éducation, environnement, infrastructures, innovation)
│   ├── membres.html        Équipe par catégories
│   ├── adhesion.html       Formulaire d'adhésion (envoi par EmailJS)
│   ├── evenement.html      Détail d'un événement : evenement.html?id=1 (données dans data/evenements.json)
│   ├── mentions-legales.html
│   └── confidentialite.html
├── partials/               Sources du menu, du pied de page et du slider (recopiés dans les pages par tools/build.js)
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
    ├── build.js            recopie partials/ dans les pages
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
| `includes.js` | Signale que la page est prête aux autres scripts ; sait aussi charger un fragment `data-include` (repli) |
| `nav.js` | Menu burger, menus déroulants, repérage de la page courante |
| `slider.js` | Slider d'accueil |
| `ui.js` | Bouton « retour en haut », apparition des blocs au défilement |
| `home.js` | Accueil : menu actif au défilement, lecteur des événements passés, chiffres clés animés |
| `team.js` | Page Membres : onglets de catégories |
| `evenement.js` | Page événement : lit `data/evenements.json` |
| `adhesion.js` | Formulaire d'adhésion : validation, anti-spam, envoi EmailJS |

### Chemins des pages

- Les fichiers de `pages/` déclarent `<html data-base="../">` et utilisent des chemins en `../`.
- Les fragments de `partials/` sont écrits **depuis la racine** (`assets/...`, `pages/...`) : `tools/build.js` ajoute `../` dans les pages du dossier `pages/`.

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
