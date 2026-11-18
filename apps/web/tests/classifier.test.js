import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, normalize, confidenceLabel } from '../public/assets/js/domain/classifier.js';

const categoryOf = (text, type) => classify(text, type)?.name ?? null;

describe('classify', () => {
  test('reconoce comercios conocidos', () => {
    assert.equal(categoryOf('Starbucks'), 'Alimentación');
    assert.equal(categoryOf('Uber'), 'Transporte');
    assert.equal(categoryOf('Netflix'), 'Entretenimiento');
    assert.equal(categoryOf("McDonald's"), 'Alimentación');
    assert.equal(categoryOf('Recibo de luz'), 'Servicios');
  });

  test('una frase gana a una palabra suelta (regresión: "Uber Eats" no es Transporte)', () => {
    assert.equal(categoryOf('Uber Eats'), 'Alimentación');
    assert.equal(categoryOf('pedido uber eats cena'), 'Alimentación');
  });

  test('ignora tildes y mayúsculas', () => {
    assert.equal(categoryOf('CLÍNICA San Felipe'), 'Salud');
    assert.equal(categoryOf('matricula universidad'), 'Educación');
  });

  test('las palabras clave cortas no coinciden dentro de otras palabras', () => {
    // "bar" (Entretenimiento) no debe activarse con "embarque".
    assert.equal(categoryOf('embarque'), null);
  });

  test('una palabra clave larga contenida en otra palabra sí cuenta', () => {
    assert.equal(categoryOf('Superfarmacia'), 'Salud'); // contiene "farmacia"
  });

  test('la palabra exacta gana a la contenida ("Metropolitano" no es el súper "Metro")', () => {
    assert.equal(categoryOf('Metropolitano tarjeta'), 'Transporte');
  });

  test('un ingreso sin señal clara se sugiere como Salario', () => {
    const result = classify('Transferencia de Juan', 'INCOME');
    assert.equal(result.name, 'Salario');
    assert.equal(confidenceLabel(result.confidence), 'baja');
  });

  test('texto vacío o muy corto no sugiere nada', () => {
    assert.equal(classify(''), null);
    assert.equal(classify('a'), null);
  });
});

describe('normalize', () => {
  test('quita tildes y espacios externos', () => {
    assert.equal(normalize('  Médico  '), 'medico');
  });
});
