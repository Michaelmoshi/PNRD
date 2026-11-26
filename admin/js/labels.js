// Noms lisibles des pages et de leurs zones
export const PAGES = { accueil: 'Page d’accueil', 'a-propos': 'À propos', programmes: 'Programmes', membres: 'Équipe', adhesion: 'Adhésion',
  evenement: 'Détail d’un événement', 'mentions-legales': 'Mentions légales', confidentialite: 'Confidentialité' };

export const BLOCKS = { hero: 'Titre en haut de la page', main: 'Texte de la page', aside: 'Pourquoi nous rejoindre',
  'a-propos': 'À propos du parti', vision: 'Notre vision', programme: 'Programmes (titres)', implantation: 'Chiffres clés (titres)',
  'prochains-evenements': 'Prochains événements (titres)', evenements: 'Événements passés (titres)', contact: 'Contact',
  'equipe-dirigeante': 'Équipe dirigeante (texte)', partenaires: 'Partenaires (titres)',
  creation: 'Création du parti', ideologie: 'Idéologie et doctrine', valeurs: 'Nos valeurs', embleme: 'Notre emblème', organisation: 'Organisation', adhesion: 'Appel à nous rejoindre' };

// ordre d'apparition sur les pages
export const BLOCK_ORDER = ['hero', 'a-propos', 'creation', 'ideologie', 'valeurs', 'embleme', 'organisation', 'vision', 'programme', 'implantation',
  'prochains-evenements', 'evenements', 'contact', 'equipe-dirigeante', 'partenaires', 'aside', 'main', 'adhesion'];

export const ACTIONS = { creer: 'a ajouté', modifier: 'a modifié', supprimer: 'a supprimé', connexion: 's’est connecté', deconnexion: 's’est déconnecté',
  connexion_echec: 'connexion refusée', consulter: 'a consulté', noter: 'a ajouté une note à', envoyer: 'a envoyé', publier: 'a publié', restaurer: 'a remis en ligne une ancienne version de' };
export const ENTITIES = { slides: 'une grande photo', programmes: 'un programme', events: 'un événement passé', agenda: 'un événement à venir', members: 'un membre',
  'member-categories': 'un groupe de l’équipe', partners: 'un partenaire', content: 'un texte', settings: 'les réglages', media: 'une photo',
  applications: 'une demande d’adhésion', users: 'un compte', site: 'le site', auth: '' };
