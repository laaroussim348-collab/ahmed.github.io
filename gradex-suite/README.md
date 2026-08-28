# GRADEX — Débits de Crue & Bassins Versants

Fusion de **GRADEX** (méthode de Guillot & Duband, 1967 — débits de crue par
extrapolation du gradient des pluies extrêmes) et de **BV-Calc** (débit de
pointe des petits bassins versants — méthodes du *Guide technique
d'assainissement routier 2020*), en un seul logiciel de bureau (Electron).

- **Interface, rapport, mise en page** : ceux de GRADEX (barre de titre,
  menus Fichier/Éditer, barre d'outils, onglets, rapport Word) — inchangés.
- **Moteur de calcul** : GRADEX (méthode GRADEX, inchangée) **+** BV-Calc
  (7 méthodes de débit de pointe, temps de concentration, CN, Cr,
  délimitation automatique, pluviométrie NASA POWER — formules copiées à
  l'identique, aucune formule modifiée).
- **Licence** : celle de BV-Calc (Identifiant Machine + Google Sheets,
  tolérance hors-ligne de 7 jours) **+** un mode essai 24h autonome (comme
  BV-Calc), remplaçant l'ancien système IP de GRADEX.
- **Langues** : FR / AR (RTL) / EN / ES — système de traduction de BV-Calc,
  étendu à toute l'interface GRADEX, avec correction des quelques messages
  de BV-Calc qui n'étaient en réalité jamais traduits (voir plus bas).
- **Projet** : sauvegarde/ouverture `.hyd` de GRADEX, inchangée, étendue
  pour inclure aussi les données de l'onglet "Méthodes complémentaires".

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

## Construire les installeurs Windows

```bash
npm run dist          # version vendue (licence par code) -> dist/
npm run dist:essai     # version d'essai 24h, sans code    -> dist-essai/
```

Les deux versions s'installent l'une à côté de l'autre (noms, dossiers et
raccourcis distincts — voir `scripts/build-essai.mjs`).

## Licences — configuration (obligatoire avant toute distribution)

1. Ouvrez `admin/licences-admin.html` dans un navigateur — l'URL du Google
   Apps Script est déjà pré-remplie (`license-config.json` et
   `DEFAULT_GS_URL` pointent vers le déploiement de l'éditeur).
2. Saisissez votre **clé d'administration** dans le champ dédié de l'outil
   admin (elle doit être identique à `ADMIN_KEY` dans le script déployé —
   voir le panneau **Configuration** en bas de page pour la retrouver ou en
   définir une nouvelle).

> ⚠️ **La clé d'administration n'est jamais commitée dans ce dépôt** — elle
> reste uniquement dans le stockage local de votre navigateur une fois
> saisie dans l'outil admin. Les identifiants des anciens outils BV-Calc /
> GRADEX (distincts de ceux ci-dessus) ne doivent jamais être réutilisés
> pour ce produit fusionné.

Le mode essai 24h (`npm run dist:essai`) ne passe jamais par ce système : il
s'auto-active dès le premier lancement, sans code ni connexion, pendant 24h,
puis se verrouille définitivement (voir `src/services/trialClient.js`).

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
  licence/LicenceGate.js  Écran d'activation : visuel GRADEX, logique
                          BV-Calc (Identifiant Machine, essai 24h).
  tabs/MethodesTab.js     Onglet "Méthodes complémentaires" — porte
                          l'intégralité de l'ex-BV-Calc (délimitation,
                          pluviométrie, Cr, CN, 7 méthodes de débit de
                          pointe) dans l'habillage GRADEX.
  calculations/, data/    Moteur de calcul BV-Calc — copié À L'IDENTIQUE
                          (aucune formule modifiée), voir tests/.
  services/               Licence (machineId/licenseClient/trialClient),
                          délimitation (mghydro.com), pluviométrie (NASA
                          POWER) — copiés à l'identique de BV-Calc.
server.mjs                Sert build/ (interface compilée) + API de licence
                          et proxys réseau (délimitation, pluviométrie) —
                          repris de BV-Calc, adapté pour servir build/.
electron-main.mjs          Version vendue (licence par code).
electron-main-essai.mjs    Version d'essai (24h, build séparée).
admin/licences-admin.html  Outil d'administration unifié (fusion des deux
                          outils d'origine, schéma Identifiant Machine).
```

### Pourquoi des fichiers `.mjs` à la racine ?

Le moteur de calcul (`src/calculations`, `src/services`) doit être
importable à la fois par React/Webpack (côté interface) et par Node
(`server.mjs`, côté licence/proxy) — les deux via `import`/`export` ES
modules. Node et Webpack ne s'accordent pas sur la présence de
`"type": "module"` dans le `package.json` racine (Webpack, lui, veut pouvoir
importer `./App` sans extension). Solution : les scripts Node (`server.mjs`,
`electron-main*.mjs`, `scripts/build-essai.mjs`) sont explicitement en
ESM via l'extension `.mjs`, et chaque dossier du moteur de calcul
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

## Limites connues

- Les nombres groupés (ex. "1 000", "10 000") s'affichent dans l'ordre
  visuel inversé par le moteur de rendu RTL du navigateur en arabe (valeur
  réelle inchangée — c'est un artefact d'affichage bidi, pas une erreur de
  calcul).
- La police d'icônes (Tabler Icons) et l'import ERA5/NASA POWER nécessitent
  une connexion internet, comme dans les logiciels d'origine.
