// Clasificador local de gastos por reglas (sin red). Dada una descripción
// ("Starbucks") sugiere la categoría más probable y una confianza 0..1.

import { KEYWORD_RULES } from './rules.js';

/** Minúsculas y sin tildes, para comparar "Clínica" con "clinica". */
export const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Precalculamos las palabras normalizadas una sola vez.
const RULES = Object.entries(KEYWORD_RULES).map(([name, words]) => [name, words.map(normalize)]);

// Más específico gana: "uber eats" (frase) debe vencer a "uber" (palabra).
const PHRASE = 0.98;
const EXACT_TOKEN = 0.96;
const LONG_SUBSTRING = 0.9; // palabra clave de 5+ letras dentro de otra ("cineplanet" ⊃ "cine…")
const MIN_SUBSTRING_LENGTH = 5; // las cortas ("bar", "gas") solo cuentan como palabra completa
const INCOME_FALLBACK = 0.7;

function score(kw, text, tokens) {
  if (kw.includes(' ')) return text.includes(kw) ? PHRASE : 0;
  if (tokens.has(kw)) return EXACT_TOKEN;
  if (kw.length >= MIN_SUBSTRING_LENGTH && text.includes(kw)) return LONG_SUBSTRING;
  return 0;
}

/**
 * @param {string} description
 * @param {'INCOME'|'EXPENSE'} type
 * @returns {{name: string, confidence: number, matched: string} | null}
 */
export function classify(description, type = 'EXPENSE') {
  const text = normalize(description);
  if (text.length < 2) return null;
  const tokens = new Set(text.split(/[^a-z0-9ñ]+/).filter(Boolean));

  let best = null;
  for (const [name, keywords] of RULES) {
    for (const kw of keywords) {
      const s = score(kw, text, tokens);
      if (s > (best?.confidence ?? 0)) best = { name, confidence: s, matched: kw };
    }
  }

  // Un ingreso sin señal clara casi siempre es salario.
  if (type === 'INCOME' && (!best || best.confidence < LONG_SUBSTRING)) {
    return { name: 'Salario', confidence: Math.max(best?.confidence ?? 0, INCOME_FALLBACK), matched: 'ingreso' };
  }
  return best;
}

export function confidenceLabel(c) {
  if (c >= 0.9) return 'alta';
  if (c >= 0.75) return 'media';
  return 'baja';
}
