'use strict';

/* H-IMAGO · Tema claro/oscuro.
   Es el primer script de ambas pantallas: aplica el tema guardado antes del
   primer pintado y cablea todos los conmutadores ([data-tema-boton]).
   La preferencia persiste en localStorage del perfil de la aplicación. */

(function () {
  const CLAVE = 'himago-tema';

  function temaGuardado() {
    try {
      return localStorage.getItem(CLAVE) === 'claro' ? 'claro' : 'oscuro';
    } catch {
      return 'oscuro';
    }
  }

  function actualizarImagenes(tema) {
    document.querySelectorAll('[data-logo-claro][data-logo-oscuro]').forEach((img) => {
      const origen = tema === 'claro' ? img.dataset.logoClaro : img.dataset.logoOscuro;
      if (origen && img.getAttribute('src') !== origen) img.src = origen;
    });
  }

  function actualizarBotones(tema) {
    document.querySelectorAll('[data-tema-boton]').forEach((b) => {
      b.textContent = tema === 'oscuro' ? '☀ Claro' : '☾ Oscuro';
      b.title = tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    });
  }

  function aplicar(tema) {
    document.documentElement.dataset.tema = tema;
    try { localStorage.setItem(CLAVE, tema); } catch { /* sin persistencia */ }
    actualizarBotones(tema);
    actualizarImagenes(tema);
    document.dispatchEvent(new CustomEvent('tema:changed', { detail: tema }));
  }

  function iniciar() {
    const tema = temaGuardado();
    document.documentElement.dataset.tema = tema;
    actualizarBotones(tema);
    actualizarImagenes(tema);
    document.querySelectorAll('[data-tema-boton]').forEach((boton) => {
      boton.addEventListener('click', () => {
        aplicar(document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro');
      });
    });
  }

  iniciar();
})();
