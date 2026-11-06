// Formulaire d'adhésion : validation, anti-spam et envoi par EmailJS (service, modèle et clé publique ci-dessous).

(function () {
  emailjs.init('0VBOxYZujOv7UuSVa');
})();

(function () {
  var form = document.getElementById('adhesion-form');
  var btn = document.getElementById('adhesion-btn');
  var status = document.getElementById('adhesion-status');
  var openedAt = Date.now();

  function say(kind, text) {
    status.className = 'form-status is-' + kind;
    status.textContent = text;
  }

  /* Messages d'erreur en français, à la place de ceux du navigateur */
  var messages = {
    'f-email': 'Entrez une adresse e-mail valide, par exemple nom@domaine.com.',
    'f-tel': 'Entrez un numéro valide (chiffres, espaces ou +), par exemple +243900000000.',
    'f-consent': 'Vous devez accepter pour envoyer votre demande.'
  };
  form.querySelectorAll('input, select').forEach(function (el) {
    el.addEventListener('invalid', function () {
      if (el.validity.valueMissing) {
        el.setCustomValidity(el.id === 'f-consent' ? messages['f-consent'] : 'Ce champ est obligatoire.');
      } else {
        el.setCustomValidity(messages[el.id] || 'Valeur non valide.');
      }
    });
    el.addEventListener('input', function () { el.setCustomValidity(''); });
    el.addEventListener('change', function () { el.setCustomValidity(''); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var field = function (id) { return document.getElementById(id).value.trim(); };

    /* Robots : champ piège rempli, ou formulaire envoyé en moins de 3 secondes.
       On répond comme si tout allait bien, sans rien envoyer. */
    if (field('f-site') !== '' || Date.now() - openedAt < 3000) {
      say('success', 'Votre demande d\'adhésion a bien été envoyée !');
      form.reset();
      return;
    }

    var fullName = [field('f-prenom'), field('f-nom'), field('f-postnom')].join(' ');
    var params = {
      /* Variables du modèle EmailJS par défaut (« A message by {{name}} », {{title}}) */
      name: fullName,
      from_name: fullName,
      title: "Nouvelle demande d'adhésion",
      reply_to: field('f-email'),
      nom: field('f-nom'),
      postnom: field('f-postnom'),
      prenom: field('f-prenom'),
      telephone: field('f-tel'),
      email: field('f-email'),
      piece: field('f-piece'),
      sexe: field('f-sexe'),
      profession: field('f-profession'),
      ville: field('f-ville'),
      adresse: field('f-adresse'),
      message: [
        'Nom : ' + field('f-nom'),
        'Post-nom : ' + field('f-postnom'),
        'Prénom : ' + field('f-prenom'),
        'Tél : ' + field('f-tel'),
        'Email : ' + field('f-email'),
        "N° passeport / carte d'électeur : " + field('f-piece'),
        'Sexe : ' + field('f-sexe'),
        'Profession : ' + field('f-profession'),
        "Ville / territoire d'habitation : " + field('f-ville'),
        'Adresse : ' + field('f-adresse'),
        'Consentement au traitement de la demande : oui'
      ].join('\n')
    };

    btn.disabled = true;
    btn.textContent = 'Envoi en cours…';
    say('info', 'Envoi de votre demande…');

    emailjs.send('service_a2c1zxf', 'template_caknya8', params)
      .then(function () {
        say('success', 'Votre demande d\'adhésion a bien été envoyée ! Un message de confirmation vous a été adressé : pensez à vérifier vos courriers indésirables (spam).');
        form.reset();
      })
      .catch(function () {
        say('error', 'L\'envoi a échoué. Vérifiez votre connexion et réessayez, ou écrivez-nous à infopnrd09@gmail.com.');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "S'enregistrer";
      });
  });
})();
