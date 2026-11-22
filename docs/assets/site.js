(() => {
  'use strict';

  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const themeColor = document.querySelector('meta[name="theme-color"]');

  const leerTema = () => {
    try {
      const guardado = localStorage.getItem('himago-theme');
      return guardado === 'light' || guardado === 'dark' ? guardado : null;
    } catch {
      return null;
    }
  };

  const guardarTema = (tema) => {
    try {
      localStorage.setItem('himago-theme', tema);
    } catch {
      /* El navegador puede bloquear localStorage; el tema sigue funcionando. */
    }
  };

  const actualizarBotonTema = () => {
    if (!toggle) return;
    const esClaro = root.dataset.theme === 'light';
    const etiqueta = esClaro ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';
    toggle.setAttribute('aria-label', etiqueta);
    toggle.setAttribute('title', etiqueta);
    if (themeColor) themeColor.setAttribute('content', esClaro ? '#fbf7ef' : '#080a0c');
  };

  const temaGuardado = leerTema();
  if (temaGuardado) root.dataset.theme = temaGuardado;
  actualizarBotonTema();

  if (toggle) {
    toggle.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
      guardarTema(root.dataset.theme);
      actualizarBotonTema();
    });
  }

  const dialog = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const closeButton = document.getElementById('lightbox-close');

  if (!dialog || !lightboxImage || !lightboxCaption || typeof dialog.showModal !== 'function') {
    return;
  }

  document.querySelectorAll('.gallery-button').forEach((button) => {
    button.addEventListener('click', () => {
      const image = button.querySelector('img');
      const full = button.getAttribute('data-full');
      if (!full) return;
      lightboxImage.setAttribute('src', full);
      lightboxImage.setAttribute('alt', image ? image.getAttribute('alt') || '' : '');
      lightboxCaption.textContent = button.getAttribute('data-caption') || '';
      dialog.showModal();
    });
  });

  if (closeButton) {
    closeButton.addEventListener('click', () => dialog.close());
  }

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
})();
