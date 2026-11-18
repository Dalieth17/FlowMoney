// Aplica el tema guardado antes de pintar la página (script clásico y síncrono: evita un parpadeo
// del tema equivocado). La CSP solo permite scripts propios, por eso no va en línea en el HTML.
(() => {
  let theme = 'green';
  try {
    const saved = localStorage.getItem('flowmoney.theme');
    if (saved === 'green' || saved === 'mono') theme = saved;
  } catch {
    /* almacenamiento bloqueado: se usa el tema por defecto */
  }
  document.documentElement.dataset.theme = theme;
})();
