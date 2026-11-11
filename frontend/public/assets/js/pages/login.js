// Punto de entrada de login.html: ingresar o crear cuenta.
import { api } from '../core/api.js';
import { h } from '../ui/dom.js';

const MIN_PASSWORD = 6;
const COPY = {
  login: {
    title: 'Hola de nuevo',
    subtitle: 'Ingresa para ver tu balance.',
    submit: 'Ingresar',
    busy: 'Ingresando…',
    switchText: '¿Primera vez?',
    switchLink: 'Crea una cuenta',
  },
  register: {
    title: 'Crea tu cuenta',
    subtitle: 'Empieza a ordenar tu dinero en un minuto.',
    submit: 'Crear cuenta',
    busy: 'Creando…',
    switchText: '¿Ya tienes cuenta?',
    switchLink: 'Ingresa',
  },
};

const $ = (id) => document.getElementById(id);
const els = {
  form: $('auth-form'),
  title: $('auth-title'),
  subtitle: $('auth-subtitle'),
  error: $('auth-err'),
  nameField: $('name-field'),
  name: $('f-name'),
  email: $('f-email'),
  password: $('f-password'),
  toggle: $('pw-toggle'),
  submit: $('submit-btn'),
  foot: $('auth-foot'),
  tabLogin: $('tab-login'),
  tabRegister: $('tab-register'),
};

let mode = 'login';

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = false;
}
function clearError() {
  els.error.hidden = true;
  els.error.textContent = '';
}

function setMode(next) {
  mode = next;
  const copy = COPY[mode];
  const isLogin = mode === 'login';
  clearError();

  els.tabLogin.setAttribute('aria-selected', String(isLogin));
  els.tabRegister.setAttribute('aria-selected', String(!isLogin));
  els.tabLogin.classList.toggle('active', isLogin);
  els.tabRegister.classList.toggle('active', !isLogin);
  els.nameField.hidden = isLogin;
  els.title.textContent = copy.title;
  els.subtitle.textContent = copy.subtitle;
  els.submit.textContent = copy.submit;
  els.password.autocomplete = isLogin ? 'current-password' : 'new-password';

  const link = h('a', { href: '#' }, copy.switchLink);
  link.addEventListener('click', (e) => {
    e.preventDefault();
    setMode(isLogin ? 'register' : 'login');
  });
  els.foot.replaceChildren(`${copy.switchText} `, link);
}

function validate() {
  if (mode === 'register' && els.name.value.trim().length < 2) return 'Escribe tu nombre';
  if (!els.email.value.trim()) return 'Escribe tu correo';
  if (!els.email.checkValidity()) return 'Correo no válido';
  if (els.password.value.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`;
  return null;
}

els.tabLogin.addEventListener('click', () => setMode('login'));
els.tabRegister.addEventListener('click', () => setMode('register'));

els.toggle.addEventListener('click', () => {
  const show = els.password.type === 'password';
  els.password.type = show ? 'text' : 'password';
  els.toggle.textContent = show ? 'Ocultar' : 'Ver';
  els.toggle.setAttribute('aria-pressed', String(show));
});

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const problem = validate();
  if (problem) return showError(problem);

  const credentials = { email: els.email.value.trim(), password: els.password.value };
  els.submit.disabled = true;
  els.submit.textContent = COPY[mode].busy;
  try {
    if (mode === 'register') await api.register({ ...credentials, name: els.name.value.trim() });
    else await api.login(credentials);
    location.replace('app.html');
  } catch (err) {
    showError(err.message);
    els.submit.disabled = false;
    els.submit.textContent = COPY[mode].submit;
  }
});

// Con sesión activa no tiene sentido mostrar el login.
api
  .me()
  .then(() => location.replace('app.html'))
  .catch(() => {});

// login.html#registro abre directamente "Crear cuenta" (enlaces desde la landing).
setMode(location.hash === '#registro' ? 'register' : 'login');
