import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { gettingStartedCard } from '../public/assets/js/ui/gettingStarted.js';

const { document, window } = parseHTML('<html><body></body></html>');
Object.assign(globalThis, { document, Node: window.Node });
const empty = () => ({ accounts: [{ initialBalance: 0 }, { initialBalance: 0 }], transactions: [], budgets: [] });

test('una cuenta en cero ofrece configurar cuentas, añadir movimientos y restaurar datos propios', () => {
  const data = empty();
  const before = structuredClone(data);
  let clicks = 0;
  const card = gettingStartedCard(data, (...args) => {
    assert.equal(args.length, 0, 'no se pasa el evento como movimiento existente');
    clicks++;
  });
  assert.match(card.textContent, /Tu cuenta comienza en cero/);
  assert.equal(card.querySelectorAll('ol li').length, 3);
  assert.equal(card.querySelector('[href="#/cuentas"]').textContent, 'Configurar mis cuentas');
  assert.ok(card.querySelector('[href="#/presupuestos"]'));
  assert.ok(card.querySelector('[href="#/perfil"]'));
  card.querySelector('button').click();
  assert.equal(clicks, 1);
  assert.deepEqual(data, before, 'abrir la guía no genera datos financieros');
});

test('la guía no vuelve a aparecer por mirar un mes vacío cuando ya hay datos históricos', () => {
  const data = empty();
  for (const patch of [
    { transactions: [{ date: Date.parse('2020-01-01'), amount: 10 }] },
    { budgets: [{ month: 0, year: 2020, amount: 100 }] },
    { accounts: [{ initialBalance: 500 }] },
    { accounts: [{ initialBalance: -50 }] },
  ]) {
    assert.equal(
      gettingStartedCard({ ...data, ...patch }, () => {}),
      null,
    );
  }
});

test('al reiniciar en cero la guía reaparece y admite saldos cero serializados', () => {
  const data = empty();
  data.accounts[0].initialBalance = '0.00';
  assert.ok(gettingStartedCard(data, () => {}));
});
