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

1. Ouvrez `admin/licences-admin.html` dans un navigateur.
2. Suivez le panneau **Configuration** en bas de page : créez un Google
   Sheet, déployez le Google Apps Script fourni, choisissez **votre propre**
   clé d'administration.
3. Collez l'URL du script dans `license-config.json` (à la racine) **et**
   dans le champ "URL Google Apps Script" de l'outil admin.

> ⚠️ **Aucune URL ni clé n'est pré-remplie** dans ce dépôt, volontairement :
> les identifiants réels utilisés par les anciens outils BV-Calc / GRADEX
> ne doivent jamais être copiés dans ce produit fusionné (ni commités dans
> un dépôt public) — ils resteraient valables pour n'importe qui les
> retrouverait, ce qui viderait le système de licence de son sens. Générez
> un déploiement neuf.

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

## Formules de temps de concentration : deux sources

L'onglet "Calculer TC" (Données) affiche maintenant **10** formules :
les 7 d'origine de GRADEX, **inchangées**, plus 3 ajoutées depuis BV-Calc
(Turrazza, Giandotti, Passini) — chaque ligne indique sa source.

En vérifiant les formules (recherche + comparaison, comme demandé), une
divergence réelle est apparue entre les deux logiciels sous **les mêmes
noms historiques** :

- **Giandotti** — la formule internationalement reconnue (vérifiée par
  recherche) est `tc(h) = (4√S + 1.5L) / (0.8√(Hmoy−H0))`. C'est exactement
  la formule que BV-Calc implémente. Le "Giandotti" déjà présent dans
  GRADEX (`64.8×(S×L)^0.333×I%^-0.5`) est une formule **différente** — une
  ambiguïté déjà présente dans le logiciel GRADEX d'origine, probablement
  héritée du classeur Excel qui a servi de référence à son auteur.
- **Passini** — GRADEX calcule `0.108×(S×L)^0.333×I(m/m)^-0.5`. Le guide
  technique d'assainissement routier définit Passini avec un coefficient et
  une convention d'unité différents (`0.8×(S×L)^(1/3)/I(%)^0.5`) ; la valeur
  que calcule GRADEX correspond en réalité, numériquement, à ce que ce même
  guide appelle **Turrazza** — BV-Calc documentait déjà cette ambiguïté
  côté classeur Excel de référence.

Conformément à la consigne ("garder exactement la même méthode de calcul"),
**aucune des deux formules d'origine n'a été modifiée** : les nouvelles
lignes BV-Calc portent un nom distinct (« *Giandotti (BV-Calc, formule
standard)* », « *Passini (BV-Calc, Guide RAR82)* ») précisément pour ne pas
laisser croire qu'elles recalculent la même chose que les lignes GRADEX
voisines.

Formules revérifiées par recherche à cette occasion : Kirpich
(`0.0195×L(m)^0.77×I^-0.385`, confirmé identique dans les deux logiciels),
et la méthode GRADEX elle-même (Guillot & Duband, EDF 1967 — extrapolation
par gradient des pluies extrêmes au-delà d'un débit-seuil/point pivot).

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
