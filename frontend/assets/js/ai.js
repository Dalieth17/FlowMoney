// ai.js — clasificador local de gastos por reglas heurísticas (sin conexión).
// Dada una descripción ("Starbucks"), sugiere la categoría más probable y una confianza.
// Equivale al módulo de IA de la app Android; aquí vive 100% en el navegador.

import { KEYWORD_RULES } from './data.js';

/** Normaliza: minúsculas y sin tildes. */
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Clasifica una descripción.
 * @returns {{name:string, confidence:number, matched:string}|null}
 */
export function classify(description, type = 'EXPENSE') {
  const text = normalize(description);
  if (text.length < 2) return null;

  // Un ingreso casi siempre es Salario salvo señal clara de otra categoría.
  const tokens = text.split(/\s+/);
  let best = null;

  for (const [name, keywords] of Object.entries(KEYWORD_RULES)) {
    for (const kwRaw of keywords) {
      const kw = normalize(kwRaw);
      let score = 0;
      if (tokens.includes(kw)) score = 0.96;                 // token exacto
      else if (text.includes(kw)) score = kw.length >= 5 ? 0.9 : 0.75; // subcadena
      if (score > 0 && (!best || score > best.confidence)) {
        best = { name, confidence: score, matched: kwRaw };
      }
    }
  }

  // Ajuste por tipo: si es ingreso y no hay match fuerte, sugiere Salario.
  if (type === 'INCOME' && (!best || best.confidence < 0.9)) {
    return { name: 'Salario', confidence: best ? Math.max(best.confidence, 0.7) : 0.7, matched: 'ingreso' };
  }

  return best; // puede ser null -> la UI ofrece "Otros"
}

/** Etiqueta legible de confianza. */
export function confidenceLabel(c) {
  if (c >= 0.9) return 'alta';
  if (c >= 0.75) return 'media';
  return 'baja';
}
