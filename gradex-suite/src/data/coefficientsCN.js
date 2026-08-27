/**
 * coefficientsCN.js
 * -----------------------------------------------------------------------
 * Table « CN II d'un bassin versant en fonction de l'occupation du sol »
 * (Ia = 0.2S, adaptée de Chow et al. 1988 ; Rivard, 2005).
 * Source : Guide technique d'assainissement routier 2020, p.22.
 * Transcription depuis l'image de la page (pas d'OCR, lecture directe).
 *
 * CN II = conditions antécédentes d'humidité MOYENNES — « c'est l'état
 * couramment utilisé et fourni par les tables usuelles » (guide, p.23).
 * -----------------------------------------------------------------------
 */

export const GROUPES_SOL_CN = {
  A: 'Sol de faible potentiel de ruissellement, fond sable ou gravier bien drainé',
  B: "Sol avec taux d'infiltration moyen, sable ou gravier modérément drainé",
  C: "Sol avec taux d'infiltration lent, sols à texture fine",
  D: "Sol avec un très faible taux d'infiltration, argile en surface",
};

export const TABLE_CN = [
  { categorie: 'Terrain cultivé', condition: 'Sans traitement de conservation', A: 72, B: 81, C: 88, D: 91 },
  { categorie: 'Terrain cultivé', condition: 'Avec traitement de conservation', A: 62, B: 71, C: 78, D: 81 },
  { categorie: 'Pâturage', condition: 'Mauvaise condition', A: 68, B: 79, C: 86, D: 89 },
  { categorie: 'Pâturage', condition: 'Bonne condition', A: 39, B: 61, C: 74, D: 80 },
  { categorie: 'Champs ou prairie', condition: 'Bonne condition', A: 30, B: 58, C: 71, D: 78 },
  { categorie: 'Boisé ou forêt', condition: 'Mauvais couvert', A: 45, B: 66, C: 77, D: 83 },
  { categorie: 'Boisé ou forêt', condition: 'Bon couvert (protégé par broussailles)', A: 25, B: 55, C: 70, D: 77 },
  { categorie: 'Espaces verts, pelouses, parcs, cimetières', condition: 'Bonne condition (≥75% en gazon)', A: 39, B: 61, C: 74, D: 80 },
  { categorie: 'Espaces verts, pelouses, parcs, cimetières', condition: 'Condition moyenne (50-75% en gazon)', A: 49, B: 69, C: 79, D: 84 },
  { categorie: 'Secteurs commerciaux', condition: '85% imperméable', A: 89, B: 92, C: 94, D: 95 },
  { categorie: 'Secteurs industriels', condition: '72% imperméable', A: 81, B: 88, C: 91, D: 93 },
  { categorie: 'Résidentiel — lots ≤ 0.05 ha', condition: '65% imperméable', A: 77, B: 85, C: 90, D: 92 },
  { categorie: 'Résidentiel — lots 0.1 ha', condition: '38% imperméable', A: 61, B: 75, C: 83, D: 87 },
  { categorie: 'Résidentiel — lots 0.13 ha', condition: '30% imperméable', A: 57, B: 72, C: 81, D: 86 },
  { categorie: 'Résidentiel — lots 0.2 ha', condition: '25% imperméable', A: 54, B: 70, C: 80, D: 85 },
  { categorie: 'Résidentiel — lots 0.4 ha', condition: '20% imperméable', A: 51, B: 68, C: 79, D: 84 },
  { categorie: 'Stationnements pavés, toits, entrées d\'autos', condition: 'Pavé', A: 98, B: 98, C: 98, D: 98 },
  { categorie: 'Rues', condition: 'Pavées avec bordures et égout pluvial', A: 98, B: 98, C: 98, D: 98 },
  { categorie: 'Rues', condition: 'Gravier', A: 76, B: 85, C: 89, D: 91 },
  { categorie: 'Rues', condition: 'Non aménagée', A: 72, B: 82, C: 87, D: 89 },
];
