<?php
// Configuration
$destinataire = "nolanmoshy@gmail.com"; // <-- Mets ton email ici
$sujet = "Nouvelle adhésion au PNRD";

// Vérifie que le formulaire est soumis
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Sécurisation des données
    $nom = htmlspecialchars(trim($_POST["nom_complet"]));
    $email = filter_var($_POST["email"], FILTER_SANITIZE_EMAIL);
    $telephone = htmlspecialchars(trim($_POST["telephone"]));
    $message = htmlspecialchars(trim($_POST["message"]));

    // Construction du contenu de l'email
    $contenu = "Nom complet : $nom\n";
    $contenu .= "Email : $email\n";
    $contenu .= "Téléphone : $telephone\n";
    $contenu .= "Message :\n$message\n";

    // Envoi de l'email
    $headers = "From: $email\r\nReply-To: $email\r\n";
    
    if (mail($destinataire, $sujet, $contenu, $headers)) {
        echo "✅ Votre message a été envoyé avec succès.";
    } else {
        echo "❌ Erreur lors de l’envoi du message. Veuillez réessayer.";
    }
} else {
    echo "Méthode non autorisée.";
}
?>
