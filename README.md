# PNRD — Site web du Parti National du Renouveau pour le Développement

Site vitrine statique (HTML, CSS, JavaScript), sans framework. Une petite étape d'assemblage (`npm run build`)
recopie le menu, le pied de page et quelques données dans les pages.

## Démarrage rapide

```bash
npm install          # une fois : installe l'outil de validation HTML et active les vérifications avant commit
npm run serve        # http://localhost:5500
```

| Commande | Rôle |
| --- | --- |
| `npm run serve` | Serveur local (`PORT=5600 npm run serve` pour un autre port) |
| `npm run build` | Met à jour les pages à partir de leurs sources (menu, pied de page, événements, SEO) |
| `npm run check` | Vérifie que les pages sont à jour, que le HTML est propre et valide |
| `npm run lint` | HTML sans CSS ni JavaScript en ligne, liens externes sécurisés |
| `npm run validate` | Validation formelle du HTML (html-validate) |

Le menu, le pied de page et le slider sont **écrits directement dans chaque page** : on peut aussi ouvrir
`index.html` tel quel dans le navigateur. Le serveur reste utile pour la page d'un événement (elle lit
`data/evenements.json`) et pour tester comme en ligne.

### Tester sur un téléphone

Le serveur affiche, au démarrage, une adresse « Sur téléphone (même Wi-Fi) » du type `http://192.168.1.20:5500`.
Ouvrir cette adresse depuis le téléphone, connecté au même Wi-Fi que l'ordinateur.

## Ce qui est généré (ne pas modifier à la main)

`npm run build` recopie ou calcule, dans les zones encadrées de marqueurs `<!-- … -->` :

| Source | Destination |
| --- | --- |
| `partials/header.html`, `footer.html`, `slider.html` | menu, pied de page et slider de **toutes** les pages |
| `data/evenements.json` | lecteur « Événements passés » de l'accueil |
| `site.json` | adresse canonique, image de partage (`og:image`), `sitemap.xml`, `robots.txt` |

Modifier la **source**, puis lancer `npm run build`. Un changement fait directement dans une page, à l'intérieur de
ces zones, serait écrasé. Si on oublie de lancer `build`, `npm run check` (et le commit) le signale.

Quand le site aura son nom de domaine : changer `url` dans `site.json`, puis `npm run build`.

## Vérifications automatiques

- **Avant chaque commit** (`.githooks/pre-commit`, activé par `npm install`) : pages à jour + HTML propre.
- **À chaque envoi sur GitHub** (`.github/workflows/check.yml`) : `npm run check` complet.

## Bonnes pratiques

- **HTML = structure uniquement** : pas de balise `<style>`, pas d'attribut `style="…"`, pas de `<script>` avec du
  code, pas de `onclick="…"`. Le style va dans `css/`, le comportement dans `js/`. Seule exception : les données
  structurées `<script type="application/ld+json">` de l'accueil (des données, pas du code).
- Lien qui s'ouvre dans un nouvel onglet : `rel="noopener noreferrer"`.
- Accessibilité : lien « Aller au contenu », zone `<main id="contenu">`, boutons réels (pas de `<div>` cliquable),
  cibles tactiles d'au moins 24 px, contrastes suffisants.
- `404.html` est autonome : sa feuille de style est `css/404.css`.

## Structure du projet

```
PNRD/
├── index.html              Accueil
├── 404.html                Page introuvable (autonome, doit rester à la racine pour GitHub Pages)
├── pages/
│   ├── a-propos.html       Histoire, idéologie, doctrine, valeurs, emblème, organisation
│   ├── programmes.html     Programmes et réalisations
│   ├── membres.html        Équipe par catégories
│   ├── adhesion.html       Formulaire d'adhésion (envoi par EmailJS)
│   ├── evenement.html      Détail d'un événement : evenement.html?id=1 (données dans data/evenements.json)
│   ├── mentions-legales.html
│   └── confidentialite.html
├── partials/               Sources du menu, du pied de page et du slider
├── css/                    Feuilles de style (voir ci-dessous)
├── js/                     Scripts, un fichier par rôle (voir ci-dessous)
├── data/evenements.json    Événements passés
├── assets/                 images/ (hero, about, team), logo/, partners/, videos/evenements/, favicon.*
├── tools/                  build.js, lint-html.js, server.js
├── site.json               Adresse du site, image de partage
├── package.json            Commandes npm
├── .githooks/ .github/     Vérifications avant commit et à l'envoi
└── .htmlvalidate.json      Réglages de la validation HTML
```

Règles de nommage : minuscules, tirets à la place des espaces, pas d'accents dans les noms de fichiers.

## CSS

Les six fichiers sont chargés **dans cet ordre** par chaque page (l'ordre compte : les derniers l'emportent) :

1. `base.css` — variables (couleurs, polices), réinitialisation, mise en page commune
2. `layout.css` — en-tête, navigation, slider d'accueil
3. `home.css` — sections de l'accueil (à propos, vision, programmes, chiffres clés, agenda, événements passés)
4. `pages.css` — adhésion, détail d'un événement, contact, partenaires, à propos, programmes, membres, pages légales
5. `footer.css` — pied de page, bouton « retour en haut », animations
6. `responsive.css` — ajustements mobile. Toute règle bureau a son équivalent mobile ici.

Menu : barre de liens au-dessus de 1000 px (compacte jusqu'à 1380 px), menu burger en dessous.

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

Les pages du dossier `pages/` déclarent `<html data-base="../">`. Les fragments de `partials/` sont écrits depuis
la racine du site ; `tools/build.js` ajoute `../` quand c'est nécessaire.

## Ajouter ou modifier un événement passé

1. Ajouter la vidéo dans `assets/videos/evenements/` (nom `AAAA-MM-JJ-titre.mp4`).
2. Ajouter une entrée dans `data/evenements.json` (id, date, titre, description, compte rendu, vidéo, affiche).
3. Lancer `npm run build` : l'accueil et la page de l'événement sont à jour (une seule source de données).

## Formulaire d'adhésion

L'envoi passe par [EmailJS](https://www.emailjs.com) : un modèle envoie la demande à l'adresse du parti, un second
(« Auto-Reply ») envoie la confirmation au candidat. Réglages dans le compte EmailJS ; identifiants utilisés par le site
dans `js/adhesion.js`. Protections : champ piège invisible, délai minimal, consentement obligatoire.

## À compléter avant la mise en ligne

- Remplacer les contenus provisoires : chiffres clés, photos, vidéos, logos des partenaires, liens des réseaux sociaux.
- Compléter les champs « [À compléter] » des pages légales.
- Compresser les images (WebP, < 200 Ko) et les vidéos (c'est la principale marge d'amélioration de la vitesse).
- Mettre le nom de domaine définitif dans `site.json` puis `npm run build`.
- Tester sur un vrai téléphone.
