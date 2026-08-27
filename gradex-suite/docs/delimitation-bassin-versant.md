# Délimitation automatique du bassin versant (SIG)

> **Mise à jour du 12/08/2026** — l'option 1 ci-dessous (mghydro.com) est
> maintenant **intégrée directement dans BV-Calc** : bouton « Calculer
> automatiquement » sur l'étape « 02 — Bassin versant » (voir `README.md §8`).
> Ce document reste utile pour comprendre les limites de la méthode et pour
> les solutions alternatives (Google Earth Engine, QGIS) si vous avez besoin
> d'une délimitation plus précise ou contrôlée.

Vous avez demandé que la délimitation du bassin versant (et l'extraction
automatique de ses caractéristiques : surface, longueur, pente) puisse se
faire via Google Earth Engine ou un site équivalent. C'est une bonne idée et
c'est réalisable — mais c'est une brique **entièrement différente** du moteur
hydrologique livré dans `src/calculations/` : il s'agit de traitement SIG
(modèle numérique de terrain, directions d'écoulement) et non de formules
hydrologiques. Je n'ai pas intégré cette brique directement dans BV-Calc dans
cette première version, pour deux raisons honnêtes :

1. **Fiabilité** : un algorithme de délimitation par bassin versant que je ne
   peux pas tester (mon environnement de développement n'a pas d'accès
   réseau) est risqué à vous livrer « tel quel » pour un usage d'ingénierie —
   une limite de bassin versant subtilement fausse fausserait Q sans que rien
   ne le signale. Je préfère vous orienter vers des outils déjà publiés,
   éprouvés et maintenus, plutôt que d'écrire un script de délimitation non
   vérifié.
2. **Le Maroc aride est justement une zone difficile pour ces algorithmes** —
   voir l'avertissement au §3 ci-dessous, qui vient directement de la
   documentation de l'outil recommandé.

Voici 3 pistes concrètes, classées de la plus simple à la plus avancée.

---

## 1. Solution la plus simple : Global Watersheds (mghydro.com)

**<https://mghydro.com/watersheds/>** — application web gratuite, sans
inscription, couverture mondiale (Maroc compris), basée sur les données
**MERIT-Hydro** (résolution ~90 m). Aucun compte Google Earth Engine requis.

**Utilisation manuelle :**
1. Cliquer sur la carte à l'endroit exact de l'exutoire (buse, pont, point
   d'intérêt du projet routier) — de préférence directement sur un cours
   d'eau visible.
2. Cliquer sur « Delineate » (mode « Upstream »).
3. Le contour du bassin versant et le réseau hydrographique amont s'affichent,
   avec la **surface en km²**.
4. Dans « Options », cocher « Make downloadable » pour exporter en GeoPackage,
   Shapefile, KML ou GeoJSON, et récupérer la longueur du thalweg principal et
   les altitudes dans un logiciel SIG (QGIS, gratuit).

**Utilisation automatisée (API, sans clé requise) :**
```
https://mghydro.com/app/watershed_api?lat=<latitude>&lng=<longitude>&precision=high
```
Réponse en GeoJSON, incluant `"area_km2"` directement dans les propriétés du
polygone. Il existe aussi `upstream_rivers_api` (réseau hydrographique amont,
utile pour mesurer L) et `flowpath_api`.

**Utilisation directe dans QGIS** (pratique pour un bureau d'études) :
`Couche > Ajouter une couche > Ajouter une couche vecteur`, Type de source
`Protocole HTTP(S)`, Type `GeoJSON`, coller l'URL de l'API ci-dessus.

⚠️ **Avertissement (documentation officielle de l'outil, traduit) :**
*« L'algorithme fonctionne mal pour les petits bassins versants. »* et
*« Les zones désertiques et arides » — dont l'Afrique du Nord est citée
explicitement comme exemple — sont un « problème type », car le réseau de
talwegs y est mal défini faute de ruissellement fréquent.* Pour vos petits
bassins versants marocains, **utilisez toujours le mode « higher precision »**
et **vérifiez visuellement le contour obtenu** (carte topographique, imagerie
satellite) avant de l'utiliser pour un calcul de débit réel.

---

## 2. Dans Google Earth Engine (comme vous le demandiez)

GEE ne fournit pas nativement un simple bouton « délimiter ce bassin
versant » ; deux approches existent :

### 2a. Recherche dans un bassin pré-découpé (HydroBASINS) — simple, approximatif

Le jeu de données `WWF/HydroSHEDS/v1/Basins/hybas_<niveau>` (niveaux 1 à 12,
du plus grand au plus petit) contient des polygones de sous-bassins
**pré-calculés**. On peut trouver celui qui contient un point donné :

```javascript
// À coller dans code.earthengine.google.com
var point = ee.Geometry.Point([-6.85, 33.97]); // [longitude, latitude] — à adapter
var bassins = ee.FeatureCollection('WWF/HydroSHEDS/v1/Basins/hybas_9'); // niveau 9 ≈ petits sous-bassins
var monBassin = bassins.filterBounds(point).first();

Map.centerObject(point, 11);
Map.addLayer(monBassin, {color: 'blue'}, 'Sous-bassin HydroBASINS');
print('Surface (km²) :', ee.Number(monBassin.get('SUB_AREA')));
```

**Limite importante** : ceci renvoie le sous-bassin prédéfini le plus proche,
**pas** le bassin versant exact drainant vers votre point précis (buse, pont).
Utile pour une estimation rapide / de reconnaissance, pas pour un exutoire
précis au mètre près.

### 2b. Délimitation exacte à partir d'un point (pour un exutoire précis)

Techniquement possible dans GEE à partir des données de direction
d'écoulement (MERIT Hydro, bande `dir`), mais l'algorithme (remontée
itérative du réseau de drainage pixel par pixel) est trop complexe pour que
je vous le livre sans pouvoir le tester moi-même dans cet environnement sans
accès réseau. Si vous voulez cette voie, l'option 1 (mghydro.com, mêmes
données MERIT-Hydro, méthode déjà publiée et testée) donne le même résultat
sans risque, gratuitement, sans écrire de code.

### Accès à Google Earth Engine — point d'attention pour un bureau d'études

Depuis la bascule de GEE vers Google Cloud, l'accès (même gratuit) nécessite
la création d'un **projet Google Cloud** et son enregistrement via le
formulaire d'éligibilité non-commerciale. Or Google distingue explicitement
usage non-commercial et commercial ; un bureau d'études facturant une étude
utilisant GEE entre probablement dans la catégorie **usage commercial**, qui
nécessite un compte de facturation (même si le coût réel pour ce type
d'usage ponctuel reste généralement faible). À vérifier sur
[la page d'accès Earth Engine](https://developers.google.com/earth-engine/guides/access)
avant de bâtir un processus de production autour de GEE.

---

## 3. Solution la plus précise : QGIS + GRASS `r.watershed` (recommandée pour un usage professionnel)

Si vous utilisez déjà QGIS (probable dans un bureau d'études), l'algorithme
`r.watershed` de GRASS (intégré à QGIS via la boîte à outils Processing) est
la méthode la plus éprouvée et la plus précise, car vous contrôlez le MNT
utilisé (SRTM 30m, ou mieux, un MNT local/LiDAR si disponible) :

1. Télécharger un MNT couvrant le bassin (ex. Copernicus GLO-30, gratuit,
   via [OpenTopography](https://opentopography.org) ou le plugin QGIS
   *SRTM-Downloader*).
2. `Traitement > Boîte à outils > GRASS > r.watershed` (entrée : MNT ; sortie :
   accumulation de flux + directions).
3. `r.water.outlet` avec les coordonnées de votre exutoire → bassin versant.
4. Convertir le raster résultant en polygone (`r.to.vect`), lire la surface
   dans la table attributaire.
5. Le thalweg principal et sa longueur s'obtiennent avec `r.stream.extract`
   ou en traçant le plus long chemin depuis la ligne de partage des eaux.

C'est plus long à mettre en place que les options 1-2, mais indépendant de
tout service en ligne, sans limite d'usage commercial, et couramment utilisé
dans les bureaux d'études pour ce type de projet.

---

## 4. Comment réinjecter le résultat dans BV-Calc

Quelle que soit l'option choisie, reportez manuellement dans l'onglet
« 02 — Bassin versant » de BV-Calc :

| Dans BV-Calc | À lire dans le résultat SIG |
|---|---|
| Surface (A) | Surface du polygone du bassin versant |
| Longueur du thalweg principal (L) | Longueur cumulée du cours d'eau le plus long, de l'exutoire à la ligne de partage des eaux |
| Altitude min. (exutoire) | Altitude au point de sortie |
| Altitude max. | Point le plus haut du bassin (ou de son cours d'eau principal) |
| Tronçons (pente pondérée) | Découper le thalweg principal en 2-4 segments à pente à peu près constante, lire l'altitude à chaque changement de pente |

## 5. Prochaine étape possible

Si vous voulez que la prochaine version de BV-Calc **appelle automatiquement**
l'API de mghydro.com (option 1) depuis l'application — un nouvel onglet
« 00 — Délimitation » où l'on clique sur une carte et où S, L et les altitudes
se remplissent seuls — c'est réalisable : l'API est simple (GET, JSON, sans
clé). Cela demandera un aller-retour pour valider les résultats sur des cas
réels (je n'ai pas d'accès réseau dans mon environnement de développement pour
le tester moi-même de bout en bout).
