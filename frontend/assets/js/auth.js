// auth.js — lógica del login/registro.
import { api } from './api.js';

let mode = 'login'; // 'login' | 'register'

const $ = (id) => document.getElementById(id);
const titleEl = $('auth-title');
const subEl = $('auth-subtitle');
const errEl = $('auth-err');
const nameField = $('name-field');
const nameInput = $('f-name');
const emailInput = $('f-email');
const pwInput = $('f-password');
const submitBtn = $('submit-btn');
const footEl = $('auth-foot');

function showError(msg) { errEl.textContent = msg; errEl.classList.add('show'); }
function clearError() { errEl.classList.remove('show'); errEl.textContent = ''; }

function setMode(next) {
  mode = next;
  clearError();
  const login = mode === 'login';
  $('tab-login').classList.toggle('active', login);
  $('tab-register').classList.toggle('active', !login);
  nameField.style.display = login ? 'none' : 'flex';
  titleEl.textContent = login ? 'Hola de nuevo' : 'Crea tu cuenta';
  subEl.textContent = login ? 'Ingresa para ver tu balance.' : 'Empieza a ordenar tu dinero en un minuto.';
  submitBtn.textContent = login ? 'Ingresar' : 'Crear cuenta';
  pwInput.autocomplete = login ? 'current-password' : 'new-password';
  footEl.innerHTML = login
    ? '¿Primera vez? <a href="#" id="go-register">Crea una cuenta</a>'
    : '¿Ya tienes cuenta? <a href="#" id="go-login">Ingresa</a>';
  const alt = document.getElementById(login ? 'go-register' : 'go-login');
  if (alt) alt.addEventListener('click', (e) => { e.preventDefault(); setMode(login ? 'register' : 'login'); });
}

$('tab-login').addEventListener('click', () => setMode('login'));
$('tab-register').addEventListener('click', () => setMode('register'));

$('pw-toggle').addEventListener('click', () => {
  const show = pwInput.type === 'password';
  pwInput.type = show ? 'text' : 'password';
  $('pw-toggle').textContent = show ? 'Ocultar' : 'Ver';
});

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const email = emailInput.value.trim();
  const password = pwInput.value;
  if (!email) return showError('Escribe tu correo');
  if (!password || password.length < 6) return showError('La contraseña debe tener al menos 6 caracteres');

  submitBtn.disabled = true;
  submitBtn.textContent = mode === 'login' ? 'Ingresando…' : 'Creando…';
  try {
    if (mode === 'register') {
      const name = nameInput.value.trim();
      if (name.length < 2) throw new Error('Escribe tu nombre');
      await api.register({ name, email, password });
    } else {
      await api.login({ email, password });
    }
    location.href = 'app.html';
  } catch (err) {
    showError(err.message || 'No se pudo completar');
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'login' ? 'Ingresar' : 'Crear cuenta';
  }
});

// Si ya hay sesión, ir directo a la app.
api.me().then((d) => { if (d && d.user) location.href = 'app.html'; }).catch(() => {});

setMode('login');
