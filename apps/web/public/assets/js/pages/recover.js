import { api } from '../core/api.js';
import { mountThemeSwitches } from '../core/theme.js';
const $ = (id) => document.getElementById(id);
let token,
  revision = 0;
const error = $('recovery-error'),
  message = $('recovery-message');
const showError = (text) => {
  error.textContent = text;
  error.hidden = false;
};
const showMessage = (text) => {
  message.textContent = text;
  message.hidden = false;
};
function readLink() {
  const next = new URLSearchParams(location.hash.slice(1)).get('token');
  if (location.hash) history.replaceState(null, '', location.pathname);
  if (!next) return;
  token = next;
  revision++;
  error.hidden = true;
  message.hidden = true;
  $('new-password').value = '';
  $('confirm-password').value = '';
  $('request-form').hidden = true;
  $('reset-form').hidden = false;
  $('recovery-title').textContent = 'Elige una nueva contraseña';
  $('recovery-subtitle').textContent = 'El enlace dura 30 minutos y solo puede utilizarse una vez.';
}
readLink();
window.addEventListener('hashchange', readLink);
async function submit(form, action, onSuccess) {
  const current = revision;
  const button = form.querySelector('button[type=submit]');
  if (button.disabled) return;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  error.hidden = true;
  message.hidden = true;
  try {
    const result = await action();
    if (current === revision) onSuccess(result);
  } catch (err) {
    if (current === revision) showError(err.message);
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}
$('request-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $('recovery-email');
  if (!email.value.trim() || !email.checkValidity()) return showError('Escribe un correo válido.');
  submit(
    e.currentTarget,
    () => api.post('/auth/forgot-password', { email: email.value.trim() }),
    (result) => showMessage(result.message),
  );
});
$('reset-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const password = $('new-password').value;
  if (password.length < 6) return showError('La contraseña debe tener al menos 6 caracteres.');
  if (password !== $('confirm-password').value) return showError('Las contraseñas no coinciden.');
  submit(
    e.currentTarget,
    () => api.post('/auth/reset-password', { token, password }),
    (result) => {
      $('new-password').value = '';
      $('confirm-password').value = '';
      $('reset-form').hidden = true;
      showMessage(result.message);
    },
  );
});
mountThemeSwitches();
