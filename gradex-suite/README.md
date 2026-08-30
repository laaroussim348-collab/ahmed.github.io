# HydroCrue — Débits de Crue & Bassins Versants

> **Nom du produit** : le logiciel s'appelle désormais **HydroCrue** (et non
> plus seulement "GRADEX") — il ne se limite plus à la seule méthode GRADEX
> depuis la fusion avec BV-Calc (8 méthodes de débit de pointe au total, voir
> plus bas). "GRADEX" reste, dans tout ce document et dans l'interface, le
> nom de la **méthode** de Guillot & Duband (1967) — une des méthodes
> proposées, plus le nom du produit.

Fusion de **GRADEX** (méthode de Guillot & Duband, 1967 — débits de crue par
extrapolation du gradient des pluies extrêmes) et de **BV-Calc** (débit de
pointe des petits bassins versants — méthodes du *Guide technique
d'assainissement routier 2020*), en un seul logiciel de bureau (Electron).

- **Interface, rapport, mise en page** : ceux de l'ex-GRADEX (barre de
  titre, menus Fichier/Éditer, barre d'outils, onglets, rapport Word) —
  inchangés, seul le nom affiché ("HydroCrue") a changé.
- **Moteur de calcul** : GRADEX (méthode GRADEX, inchangée, désormais une
  méthode sélectionnable parmi les autres — voir "Onglets fusionnés"
  plus bas) **+** BV-Calc (7 méthodes de débit de pointe, temps de
  concentration, CN, Cr, délimitation automatique, pluviométrie NASA POWER —
  formules copiées à l'identique, aucune formule modifiée).
- **Licence** : modèle UNIFIÉ essai + licence (façon AutoCAD, voir
  "Licences" plus bas) — un seul build, essai gratuit automatique de 3
  jours, puis activation à distance par l'éditeur (Identifiant Machine,
  Google Sheets), sans code à saisir.
- **Langues** : FR / AR (RTL) / EN / ES — système de traduction de BV-Calc,
  étendu à toute l'interface, avec correction des quelques messages de
  BV-Calc qui n'étaient en réalité jamais traduits (voir plus bas).
- **Projet** : sauvegarde/ouverture `.hyd` de l'ex-GRADEX, inchangée,
  étendue pour inclure aussi les données de l'onglet "Méthodes
  complémentaires".

## Démarrage rapide

```bash
npm install
npm run build      # compile l'interface React dans build/
npm run server     # sert build/ + API de licence sur http://localhost:3000
# ou, en une commande :
npm run serve
```

Application de bureau (Electron) :

```bash
npm run build
npm run electron    # ouvre la fenêtre native, pointée sur le serveur local
```

Développement (rechargement à chaud, sans passer par Electron) :

```bash
npm start           # http://localhost:3000 (react-scripts start)
```
> Le serveur de licence (`/api/*`) n'est disponible qu'avec `npm run server`
> / `npm run electron` (`npm start` sert uniquement l'UI React en direct).

Tests du moteur de calcul (porte les tests unitaires de BV-Calc, exécutés
contre les mêmes cas de référence Excel/guide — aucune formule n'a changé,
ils doivent rester à 23/23) :

```bash
npm test
```

## Construire l'installeur Windows

```bash
npm run dist          # un seul build, essai + licence -> dist/
```

Il n'existe plus qu'**un seul installeur** (voir "Licences" ci-dessous) —
l'ancienne version d'essai séparée (`npm run dist:essai`) a été retirée.

## Licences — modèle unifié essai + activation à distance (façon AutoCAD)

Depuis le 29/08/2026, HydroCrue utilise un modèle d'activation unique, sans
code, porté par `src/services/activationClient.js` (côté client) et par le
script Google Apps Script déployé (côté serveur — voir
`admin/licences-admin.html`, panneau Configuration, pour le script complet
et les instructions de déploiement) :

1. **Premier lancement** : le poste s'enregistre automatiquement auprès du
   serveur de licence par son **Identifiant Machine** (SHA-256 des adresses
   MAC) — aucune saisie, aucun compte. Un essai gratuit de **3 jours**
   démarre (`DUREE_ESSAI_HEURES = 72` dans `activationClient.js` — à garder
   identique à `TRIAL_HEURES` dans le script Apps Script).
2. **Passé ce délai**, le poste passe "en attente de paiement" : l'écran
   affiche l'Identifiant Machine et invite l'utilisateur à contacter
   l'éditeur — il n'y a rien d'autre à faire de son côté.
3. **Ouvrez `admin/licences-admin.html`** dans un navigateur — c'est la
   "plateforme" : elle liste tous les postes enregistrés (Identifiant
   Machine, première/dernière connexion, statut essai/en attente/actif),
   sans aucune autre information (pas de télémétrie au-delà de la licence).
   Saisissez votre **URL Google Apps Script** et votre **clé
   d'administration** (identique à `ADMIN_KEY` dans le script déployé —
   voir le panneau **Configuration** en bas de page pour le script à coller
   et les instructions de déploiement complètes) puis cliquez **Actualiser**.
4. **Une fois le paiement reçu**, choisissez une **durée** dans le menu en
   face de la ligne du client (1 mois, 6 mois, 1 an, Permanent, ou
   **Personnaliser…** pour un nombre de jours précis) puis cliquez
   **✅ Activer** (retrouvable par son Identifiant Machine, qu'il vous aura
   communiqué, ou par sa date de première connexion) — **aucun code à lui
   transmettre**. Son application se débloque automatiquement au prochain
   contrôle (toutes les 60s si elle est ouverte). Une licence à durée
   limitée qui arrive à expiration repasse automatiquement "en attente" côté
   plateforme (⚠️ Licence expirée) — reactivez-la avec le même bouton
   **🔄 Renouveler** pour prolonger l'accès.
5. **Pour bloquer un poste** : cliquez **⛔ Révoquer**. Effet au prochain
   contrôle (jusqu'à 7 jours de grâce si le poste était hors-ligne).

> ⚠️ **La clé d'administration n'est jamais commitée dans ce dépôt** — elle
> reste uniquement dans le stockage local de votre navigateur une fois
> saisie dans l'outil admin.

> ⚠️ **Changement de modèle (29/08/2026)** : ce système remplace l'ancien
> système à codes d'activation de BV-Calc/GRADEX. Si des clients avaient déjà
> reçu un code avec l'ancienne version, celui-ci n'est plus reconnu par le
> nouveau script Apps Script — ils réapparaîtront automatiquement dans la
> plateforme (en essai, ou directement activables) dès leur prochain
> lancement d'une version mise à jour.

## Architecture

```
src/
  App.js                 Coquille GRADEX (barre de titre, onglets, rapport,
                          projet .hyd) — code original GRADEX, formules
                          GRADEX inchangées (computeGRADEX, computeTC).
  ui.js                   Primitives visuelles GRADEX (Panel/Field/TBtn/...),
                          réutilisées par le nouvel onglet BV-Calc pour que
                          tout l'habillage reste cohérent.
  i18n.js / useI18n.js    Dictionnaire FR/AR/EN/ES (base = BV-Calc, étendu).
  licence/LicenceGate.js  Écran d'activation : visuel GRADEX, modèle
                          unifié essai + licence (Identifiant Machine,
                          aucun code — voir activationClient.js).
  tabs/LocalisationDelimitation.js  "Localisation & calcul automatique" —
                          rendu en tout premier dans l'onglet fusionné
                          (App.js), extrait de MethodesTab.js pour que la
                          délimitation soit le tout premier élément visible.
  tabs/MethodesTab.js     Reste de l'onglet "Méthodes complémentaires" —
                          porte l'ex-BV-Calc (géométrie, pluviométrie, Cr,
                          CN, 8 méthodes de débit de pointe dont GRADEX)
                          dans l'habillage GRADEX.
  calculations/, data/    Moteur de calcul BV-Calc — copié À L'IDENTIQUE
                          (aucune formule modifiée), voir tests/.
  services/activationClient.js  Modèle UNIFIÉ essai + licence (remplace les
                          anciens licenseClient.js/trialClient.js) —
                          Identifiant Machine, enregistrement/essai
                          automatique, activation à distance sans code.
  services/               machineId, délimitation (mghydro.com),
                          pluviométrie (NASA POWER) — copiés à l'identique
                          de BV-Calc.
server.mjs                Sert build/ (interface compilée) + API
                          d'activation et proxys réseau (délimitation,
                          pluviométrie) — repris de BV-Calc, adapté pour
                          servir build/.
electron-main.mjs          Point d'entrée UNIQUE (essai + licence, plus de
                          build séparée).
admin/licences-admin.html  Plateforme d'administration : liste des postes
                          enregistrés (essai/en attente/actif), activation
                          à distance par Identifiant Machine (un clic, sans
                          code) — voir "Licences" plus haut.
```

### Pourquoi des fichiers `.mjs` à la racine ?

Le moteur de calcul (`src/calculations`, `src/services`) doit être
importable à la fois par React/Webpack (côté interface) et par Node
(`server.mjs`, côté licence/proxy) — les deux via `import`/`export` ES
modules. Node et Webpack ne s'accordent pas sur la présence de
`"type": "module"` dans le `package.json` racine (Webpack, lui, veut pouvoir
importer `./App` sans extension). Solution : les scripts Node (`server.mjs`,
`electron-main.mjs`) sont explicitement en ESM via l'extension `.mjs`, et
chaque dossier du moteur de calcul
(`src/calculations/`, `src/data/`, `src/services/`, `tests/`) porte son
propre petit `package.json` `{"type":"module"}`. React/Webpack, lui,
continue de résoudre les imports du dossier `src/` normalement (sans
extension).

## Formules de temps de concentration : ambiguïté résolue

L'onglet "Calculer TC" (Données) affiche **8** formules : les 5 d'origine
de GRADEX inchangées (Kirpich, Espagnole, Californienne, Ventura, Lag Time)
+ 3 formules BV-Calc (Turrazza, Giandotti standard, Passini) — chaque
ligne indique sa source.

Historiquement (versions précédentes), GRADEX contenait aussi deux lignes
"Giandotti" et "Passini" **mal nommées depuis l'origine** :
`64.8×(S×L)^0.333×I%^-0.5` (étiquetée "Giandotti") et
`0.108×(S×L)^0.333×I(m/m)^-0.5` (étiquetée "Passini"). Un document dédié
« Calcul de temps de concentration », fourni par l'utilisateur avec des
exemples numériques vérifiés indépendamment, a permis d'identifier leurs
vrais noms :

- La formule à coefficient **64.8** (P en %) est en réalité celle de
  **PASSINI** (`tc(h)=1.08×(S×L)^(1/3)/I(%)^0.5` — le guide indiquait par
  erreur un coefficient 0.8 ; corrigé dans `concentrationTime.tcPassini`).
- La formule à coefficient **0.108** (P en m/m, pas en %) est celle de
  **TURRAZZA** (`concentrationTime.tcTurrazza` — le guide indiquait P en %
  par erreur ; confirmé aussi par la cellule Excel 'CARACT DE BV'!H22 qui
  utilise déjà P en m/m).
- **Giandotti** (la vraie formule, `tc(h) = (4√S + 1.5L) / (0.8√(Hmoy−H0))`)
  n'a jamais été présente dans GRADEX — uniquement via BV-Calc.

Les deux lignes GRADEX mal nommées ont été **retirées** (elles dupliquaient
strictement les formules BV-Calc Turrazza/Passini, une fois celles-ci
corrigées) plutôt que renommées, pour ne pas afficher deux lignes
identiques sous des noms différents. Aucune formule n'a été perdue : les
2 formules concernées restent disponibles, une seule fois chacune, sous
leur vrai nom, dans le bloc BV-Calc.

Formules Kirpich/Espagnole/Californienne/Ventura : confirmées identiques
(cellules Excel + document tc dédié), aucun changement.

## Traduction — corrections apportées à BV-Calc

En reconstruisant l'interface en React avec `t()` partout (au lieu
d'attributs `data-i18n` sur du HTML statique), deux catégories de textes
non traduits dans BV-Calc ont été corrigées :

1. `geoHint` (le paragraphe d'aide de "Localisation & calcul automatique")
   avait bien une entrée dans les 4 langues du dictionnaire, mais l'élément
   HTML correspondant n'avait pas l'attribut `data-i18n="geoHint"` — il
   restait donc affiché en français quelle que soit la langue choisie.
2. Une vingtaine de messages générés dynamiquement par `public/js/app.js`
   (ex. *"Pente pondérée : renseignez au moins un tronçon."*, *"Le
   coefficient de Montana a n'est pas encore renseigné."*, l'en-tête du
   tableau copié dans le presse-papiers...) étaient codés en dur en
   français dans le JavaScript, sans jamais passer par `t()`. Ils ont
   toutes une entrée dédiée dans `src/i18n.js` (préfixe `fix*`) dans les 4
   langues, utilisées par `src/tabs/MethodesTab.js`.

## Onglets fusionnés : "Données & Méthodes"

Les anciens onglets "Données" (GRADEX) et "Méthodes complémentaires"
(BV-Calc) sont désormais **un seul onglet** — plus besoin de naviguer entre
deux pages pour un même projet (`App.js`, `TABS` : l'entrée `methodes` a été
retirée, le contenu de `MethodesTab` s'affiche à la suite du contenu GRADEX
sous le même `tab === "donnees"`).

**GRADEX est désormais une méthode comme les autres** : une case "GRADEX"
apparaît dans le bloc "Sélection des méthodes à calculer", au même titre que
Rationnelle/Mac-Math/etc. — grisée tant que les données (Pjmax ≥ 3 valeurs +
surface) sont incomplètes, à cocher puis "Recalculer" pour l'ajouter au
tableau de résultats et au comparatif (`lignesComparatif`, dans `App.js`,
provient maintenant entièrement de `mcResultats` — plus d'injection
automatique et inconditionnelle d'une ligne GRADEX). Le calcul lui-même
(`computeGRADEX`) reste strictement inchangé ; seule sa représentation dans
l'UI est désormais uniforme avec les 8 méthodes BV-Calc.

**Téléchargement automatique de la série Pjmax avec la délimitation** :
quand la délimitation automatique du bassin (mghydro.com) aboutit,
`onImportToGradex()` transmet aussi les coordonnées (lat/lon) de l'exutoire
à `App.js`, qui déclenche alors lui-même l'import Open-Meteo ERA5 (même
fonction que le bouton manuel "Importer depuis Open-Meteo ERA5", juste
automatisée) — sans écraser une série déjà présente (collée/importée
manuellement).

## Corrections (retours utilisateur du 28/08/2026)

- **Pente non transmise à Mac-Math / Burkli-Ziegler** : la pente globale/
  pondérée était bien calculée et affichée, mais jamais réellement écrite
  dans l'état (`v.pente_m_par_m`) que ces deux méthodes lisent — corrigé par
  un effet de synchronisation automatique dans `MethodesTab.js` (respecte le
  sélecteur global/pondérée existant, `v.tcPenteSource`).
- **Couche "Occupation du sol" (ESA WorldCover/Terrascope) retirée** : ce
  service WMS s'est révélé indisponible aussi bien en environnement de
  développement qu'en usage réel — supprimée de `DelimitationCarte.js` sur
  demande explicite, plutôt que de continuer à afficher un bouton qui ne
  fonctionne pas.
- **Texte tronqué dans le menu déroulant Cr** : les libellés BCEOM étaient
  coupés artificiellement à 36 caractères (`.slice(0,36)…`) — le menu
  affiche maintenant le texte complet (champ mis sur sa propre ligne, plus
  large, dans `MethodesTab.js`).
- **Carte de délimitation** : grille de coordonnées (latitude/longitude,
  activable/désactivable, incluse dans l'export PNG), zoom min/max élargi
  (dézoom jusqu'au niveau 2/3, zoom jusqu'au niveau 19) pour couvrir aussi
  les grands bassins versants, résolution d'export doublée au minimum
  (qualité impression/rapport), délais réseau du service de délimitation
  augmentés à 60s (un grand bassin demande un calcul plus long), et
  l'avertissement "surface hors plage usuelle" reformulé pour ne plus
  laisser croire à un rejet (le calcul est toujours effectué).
- **Essai** : mécanisme vérifié, fonctionne comme prévu (verrouillage strict
  après le tout premier lancement) — un essai qui "ne marche plus" après une
  utilisation intensive prolongée est le comportement attendu, pas un bug.
  L'affichage du temps restant utilisait `Math.floor` (un essai qui vient de
  démarrer affichait une unité déjà entamée, ex. "23 h" au lieu de "24 h")
  — remplacé par `Math.ceil` dans `LicenceGate.js`, et affiche désormais des
  jours au-delà de 24h (ex. "3 j").
- **Renommage** : le produit s'appelle désormais **HydroCrue** (au lieu de
  "GRADEX" seul), pour refléter la fusion avec BV-Calc — voir la note en
  tête de ce document. "GRADEX" reste utilisé partout où il désigne la
  méthode de Guillot & Duband elle-même (une méthode parmi 8 désormais).
- **Icône** : remplacée par le jeu d'icônes fourni par l'éditeur (thème
  "oued" — montagnes, rivière, ciel), aux tailles standard Windows (16 à
  256px) — `build-resources/icon.ico`/`icon.png`, `public/favicon.ico`,
  `public/logo192.png`, `public/logo512.png`.
- **Licence — modèle unifié (29/08/2026)** : refonte complète du système de
  licence, façon AutoCAD — un seul build (plus de version d'essai séparée),
  essai gratuit automatique de 3 jours (porté de 24h, puis 7 jours, à 3
  jours dans cette même itération), et **activation à distance sans code** :
  chaque poste s'enregistre automatiquement par son Identifiant Machine ;
  l'éditeur active depuis une plateforme (`admin/licences-admin.html`,
  entièrement réécrite) d'un clic, sans que le client n'ait à envoyer ou
  saisir quoi que ce soit. Voir la section "Licences" plus haut pour le
  détail. `src/services/licenseClient.js` et `trialClient.js` sont
  remplacés par `src/services/activationClient.js` ; `electron-main-essai.mjs`
  et `scripts/build-essai.mjs` sont retirés.

## Corrections (retours utilisateur du 29/08/2026)

- **Délimitation déplacée en tête d'onglet** : la "Localisation & calcul
  automatique" (carte + coordonnées) était auparavant nichée sous les
  paramètres/Pjmax GRADEX dans l'onglet fusionné — c'est pourtant le point
  de départ naturel d'un nouveau projet (elle alimente automatiquement
  surface/périmètre/altitudes/pente ET la série Pjmax). Extraite dans un
  composant séparé (`src/tabs/LocalisationDelimitation.js`) et rendue en
  tout premier dans l'onglet "Données & Méthodes" (`App.js`). L'aperçu de
  carte est aussi passé de 150px à 380px de hauteur (visible "en
  professionnel", pas juste une vignette) et n'est plus replié par défaut.
- **"Zoom étendue"** (comme AutoCAD) ajouté à la carte de délimitation
  plein écran : recadre la vue sur l'ensemble du contour/tracé à tout
  moment (pas seulement à l'ouverture), via `L.featureGroup()` (au lieu de
  `layerGroup()`, qui n'expose pas `.getBounds()`).
- **Cartouche de la carte traduite** : les textes de la légende ("Limite du
  bassin versant", "Cours d'eau", "Exutoire") et le titre par défaut de la
  carte exportée étaient codés en dur en français — ils utilisent
  maintenant `t()` (import direct de `src/i18n.js`, la carte est dessinée
  hors du rendu React) et changent donc de langue avec le reste de
  l'interface.
- **Longueur du thalweg principal (L)** : placée sur sa propre ligne pleine
  largeur (au lieu de partager une case étroite avec Surface/Périmètre),
  pour rester lisible — c'est une donnée clé (pente, tc, plusieurs méthodes
  de débit de pointe en dépendent).
- **Rapport Word professionnalisé** : nouvelle section "Caractéristiques du
  bassin versant" (surface, périmètre, longueur du thalweg, altitudes,
  indice de compacité de Gravelius (Kg) + forme, indice de Horton (Kh),
  rectangle équivalent, pente globale/pondérée, tc/Cr/CN adoptés) — calculée
  par une fonction pure partagée (`calculerCaracteristiquesBV`, App.js)
  entre l'aperçu écran de l'onglet Rapport et l'export Word, pour qu'ils
  restent identiques. La section "Méthodes complémentaires" affiche
  désormais aussi le détail des calculs (étapes/formules/application/
  hypothèses de chaque méthode), pas seulement le résultat final — dans
  l'esprit d'un rapport de PFE/bureau d'études.

## Limites connues

- Les nombres groupés (ex. "1 000", "10 000") s'affichent dans l'ordre
  visuel inversé par le moteur de rendu RTL du navigateur en arabe (valeur
  réelle inchangée — c'est un artefact d'affichage bidi, pas une erreur de
  calcul).
- La police d'icônes (Tabler Icons) et l'import ERA5/NASA POWER nécessitent
  une connexion internet, comme dans les logiciels d'origine.
