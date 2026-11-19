import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { parseHTML } from 'linkedom';
import { api } from '../public/assets/js/core/api.js';
const html = await readFile(new URL('../public/recover.html', import.meta.url), 'utf8');
let seq = 0;
async function setup(token = '') {
  const { document, window } = parseHTML(html);
  let replacement;
  Object.assign(globalThis, {
    document,
    window,
    Node: window.Node,
    location: { hash: token ? `#token=${token}` : '', pathname: '/recover.html' },
    history: {
      replaceState: (_state, _title, url) => {
        replacement = url;
        globalThis.location.hash = '';
      },
    },
  });
  await import(`../public/assets/js/pages/recover.js?test=${++seq}`);
  const submit = async (id) => {
    document.getElementById(id).dispatchEvent(new window.Event('submit', { cancelable: true }));
    await nextTurn();
  };
  return { document, submit, replacement };
}
test('solicitar enlace muestra mensaje genérico y evita envíos simultáneos', async () => {
  const { document, submit } = await setup();
  const email = document.getElementById('recovery-email');
  email.value = '  prueba@example.test  ';
  email.checkValidity = () => true;
  let resolve,
    calls = 0;
  api.post = (path, body) => {
    assert.equal(path, '/auth/forgot-password');
    assert.equal(body.email, 'prueba@example.test');
    calls++;
    return new Promise((done) => {
      resolve = done;
    });
  };
  await submit('request-form');
  await submit('request-form');
  assert.equal(calls, 1);
  resolve({ message: 'Si existe una cuenta recibirás un enlace' });
  await nextTurn();
  assert.equal(document.getElementById('recovery-message').hidden, false);
  assert.equal(document.querySelector('#request-form button').disabled, false);
});
test('token se retira de la URL, confirma contraseña y vuelve a ingreso sin sesión automática', async () => {
  const token = 'a'.repeat(43),
    { document, submit, replacement } = await setup(token);
  assert.equal(replacement, '/recover.html');
  assert.equal(document.getElementById('request-form').hidden, true);
  assert.equal(document.getElementById('reset-form').hidden, false);
  document.getElementById('new-password').value = 'secret123';
  document.getElementById('confirm-password').value = 'different';
  api.post = () => assert.fail('No debe enviar contraseñas que no coinciden');
  await submit('reset-form');
  assert.ok(document.getElementById('recovery-error').textContent.includes('no coinciden'));
  document.getElementById('confirm-password').value = 'secret123';
  api.post = async (path, body) => {
    assert.equal(path, '/auth/reset-password');
    assert.deepEqual(body, { token, password: 'secret123' });
    return { message: 'Contraseña actualizada' };
  };
  await submit('reset-form');
  assert.equal(document.getElementById('new-password').value, '');
  assert.equal(document.getElementById('reset-form').hidden, true);
  assert.ok(document.querySelector('a[href="login.html"]'));
});
test('enlace caducado conserva opción de solicitar otro y muestra el error del servidor', async () => {
  const { document, submit } = await setup('b'.repeat(43));
  document.getElementById('new-password').value = 'secret123';
  document.getElementById('confirm-password').value = 'secret123';
  api.post = async () => {
    throw Error('El enlace ha caducado');
  };
  await submit('reset-form');
  assert.equal(document.getElementById('recovery-error').textContent, 'El enlace ha caducado');
  assert.ok(document.querySelector('a[href="recover.html"]'));
  assert.equal(document.querySelector('#reset-form button').disabled, false);
});

test('abrir un enlace en la misma pestaña activa el formulario e ignora el mensaje anterior pendiente', async () => {
  const { document, submit } = await setup();
  const email = document.getElementById('recovery-email');
  email.value = 'prueba@example.test';
  email.checkValidity = () => true;
  let resolve;
  api.post = () =>
    new Promise((done) => {
      resolve = done;
    });
  await submit('request-form');
  globalThis.location.hash = `#token=${'c'.repeat(43)}`;
  globalThis.window.dispatchEvent(new globalThis.window.Event('hashchange'));
  resolve({ message: 'Solicitud anterior' });
  await nextTurn();
  assert.equal(document.getElementById('request-form').hidden, true);
  assert.equal(document.getElementById('reset-form').hidden, false);
  assert.equal(document.getElementById('recovery-message').hidden, true);
  assert.equal(globalThis.location.hash, '');
});
