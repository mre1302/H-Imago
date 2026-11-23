(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const heroVisual = document.querySelector('.hero-visual');
  let framePending = false;

  const actualizarScroll = () => {
    framePending = false;
    if (!reduceMotion && heroVisual && window.innerWidth > 900) {
      const desplazamiento = Math.max(-36, Math.min(36, window.scrollY * -0.045));
      heroVisual.style.transform = `translate3d(0, ${desplazamiento.toFixed(2)}px, 0)`;
    }
  };

  const pedirScroll = () => {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(actualizarScroll);
  };

  window.addEventListener('scroll', pedirScroll, { passive: true });
  window.addEventListener('resize', pedirScroll);
  actualizarScroll();

  document.querySelectorAll('a[href^="#"]').forEach((enlace) => {
    enlace.addEventListener('click', (evento) => {
      const hash = enlace.getAttribute('href');
      if (!hash || hash.length < 2) return;
      const destino = document.getElementById(hash.slice(1));
      if (!destino) return;
      evento.preventDefault();

      const margen = 96;
      const destinoY = Math.max(0, destino.getBoundingClientRect().top + window.scrollY - margen);
      const inicioY = window.scrollY;
      const distancia = destinoY - inicioY;

      if (reduceMotion || Math.abs(distancia) < 2) {
        window.scrollTo(0, destinoY);
        history.pushState(null, '', hash);
        return;
      }

      const duracion = Math.min(850, Math.max(420, Math.abs(distancia) * 0.28));
      let inicio = null;
      const suavizar = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

      const paso = (marca) => {
        if (inicio === null) inicio = marca;
        const progreso = Math.min(1, (marca - inicio) / duracion);
        window.scrollTo(0, inicioY + distancia * suavizar(progreso));
        if (progreso < 1) {
          window.requestAnimationFrame(paso);
        } else {
          history.pushState(null, '', hash);
        }
      };

      window.requestAnimationFrame(paso);
    });
  });

  const alinearConHash = () => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    const destino = document.getElementById(hash.slice(1));
    if (!destino) return;
    const destinoY = Math.max(0, destino.getBoundingClientRect().top + window.scrollY - 96);
    if (Math.abs(window.scrollY - destinoY) > 2) {
      window.scrollTo(0, destinoY);
    }
  };

  window.addEventListener('load', alinearConHash, { once: true });
  window.addEventListener('popstate', alinearConHash);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(alinearConHash);
  }

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const objetivos = document.querySelectorAll(
      '.section-head, .about-copy, .about-method, .chapter-head, .chapter-copy, .chapter-prose, .chapter-foot, .media-figure, .gallery-title, .step, .download-panel, .news-feature, .news-item, .community-grid > *, .footer-inner'
    );

    objetivos.forEach((elemento) => {
      elemento.classList.add('reveal');
      if (elemento.matches('.media-figure, .step, .news-item')) {
        const hermanos = Array.from(elemento.parentElement.children);
        const posicion = hermanos.indexOf(elemento);
        elemento.style.setProperty('--reveal-delay', `${Math.min(posicion, 5) * 55}ms`);
      }
    });

    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add('is-visible');
        observador.unobserve(entrada.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    objetivos.forEach((elemento) => observador.observe(elemento));
  }

  const iniciarRed = (canvas) => {
    const ctx = canvas.getContext('2d');
    const stage = canvas.closest('.network-stage');
    if (!ctx || !stage) return;

    const colores = [
      { fill: '#d7a64f', soft: 'rgba(215, 166, 79, 0.16)' },
      { fill: '#78a3c7', soft: 'rgba(120, 163, 199, 0.14)' },
      { fill: '#83a47b', soft: 'rgba(131, 164, 123, 0.14)' },
      { fill: '#b38bb8', soft: 'rgba(179, 139, 184, 0.14)' }
    ];
    const total = 64;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let nodos = [];
    let frame = 0;
    let running = false;
    let visible = true;
    let arrastrando = null;
    let pointerActivo = null;

    const crearNodos = () => {
      nodos = Array.from({ length: total }, (_, indice) => {
        const color = colores[indice % colores.length];
        return {
          x: width * (0.06 + Math.random() * 0.88),
          y: height * (0.1 + Math.random() * 0.8),
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          r: indice < 8 ? 3.5 + Math.random() * 1.4 : 1.4 + Math.random() * 2,
          phase: Math.random() * Math.PI * 2,
          color
        };
      });
    };

    const dibujar = (time = 0) => {
      ctx.clearRect(0, 0, width, height);
      const umbral = Math.min(width, height) * 0.29;

      ctx.lineWidth = 0.65;
      for (let i = 0; i < nodos.length; i += 1) {
        const a = nodos[i];
        for (let j = i + 1; j < nodos.length; j += 1) {
          const b = nodos[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distancia = Math.hypot(dx, dy);
          if (distancia >= umbral) continue;
          const alpha = (1 - distancia / umbral) * 0.3;
          ctx.strokeStyle = `rgba(205, 190, 160, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const nodo of nodos) {
        const pulso = reduceMotion ? 1 : 1 + Math.sin(time * 0.0011 + nodo.phase) * 0.08;
        const radio = nodo.r * pulso;
        ctx.beginPath();
        ctx.arc(nodo.x, nodo.y, radio + 3.8, 0, Math.PI * 2);
        ctx.fillStyle = nodo.color.soft;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(nodo.x, nodo.y, radio, 0, Math.PI * 2);
        ctx.fillStyle = nodo.color.fill;
        ctx.fill();
      }
    };

    const mover = (time) => {
      if (!running) return;
      for (const nodo of nodos) {
        if (nodo === arrastrando) continue;
        nodo.x += nodo.vx;
        nodo.y += nodo.vy;
        if (nodo.x < 8 || nodo.x > width - 8) nodo.vx *= -1;
        if (nodo.y < 8 || nodo.y > height - 8) nodo.vy *= -1;
      }
      dibujar(time);
      frame = window.requestAnimationFrame(mover);
    };

    const detener = () => {
      running = false;
      window.cancelAnimationFrame(frame);
    };

    const arrancar = () => {
      if (running || reduceMotion) return;
      running = true;
      frame = window.requestAnimationFrame(mover);
    };

    const redimensionar = () => {
      const rect = stage.getBoundingClientRect();
      const nextWidth = Math.max(1, rect.width);
      const nextHeight = Math.max(1, rect.height);
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (nodos.length && Math.abs(nextWidth - width) < 1 && Math.abs(nextHeight - height) < 1 && nextDpr === dpr) {
        return;
      }
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      crearNodos();
      dibujar();
    };

    const puntoLocal = (evento) => {
      const rect = canvas.getBoundingClientRect();
      return { x: evento.clientX - rect.left, y: evento.clientY - rect.top };
    };

    const nodoCercano = (x, y) => {
      let elegido = null;
      let mejor = Infinity;
      for (const nodo of nodos) {
        const distancia = Math.hypot(nodo.x - x, nodo.y - y);
        if (distancia <= nodo.r + 12 && distancia < mejor) {
          elegido = nodo;
          mejor = distancia;
        }
      }
      return elegido;
    };

    const terminarArrastre = (evento) => {
      if (!arrastrando) return;
      if (evento && pointerActivo !== null && evento.pointerId !== pointerActivo) return;
      try {
        if (pointerActivo !== null && canvas.hasPointerCapture(pointerActivo)) {
          canvas.releasePointerCapture(pointerActivo);
        }
      } catch {
        /* La captura puede haberse perdido al salir de la ventana. */
      }
      arrastrando = null;
      pointerActivo = null;
      canvas.classList.remove('is-dragging');
      canvas.style.cursor = 'grab';
    };

    canvas.addEventListener('pointerdown', (evento) => {
      const { x, y } = puntoLocal(evento);
      const nodo = nodoCercano(x, y);
      if (!nodo) return;
      arrastrando = nodo;
      pointerActivo = evento.pointerId;
      nodo.vx = 0;
      nodo.vy = 0;
      nodos.splice(nodos.indexOf(nodo), 1);
      nodos.push(nodo);
      try {
        canvas.setPointerCapture(evento.pointerId);
      } catch {
        /* Algunos navegadores no permiten capturar un puntero sintético. */
      }
      canvas.classList.add('is-dragging');
      canvas.style.cursor = 'grabbing';
      evento.preventDefault();
    });

    canvas.addEventListener('pointermove', (evento) => {
      const { x, y } = puntoLocal(evento);
      if (!arrastrando) {
        canvas.style.cursor = nodoCercano(x, y) ? 'grab' : 'default';
        return;
      }
      const dx = x - arrastrando.x;
      const dy = y - arrastrando.y;
      arrastrando.x = Math.max(8, Math.min(width - 8, x));
      arrastrando.y = Math.max(8, Math.min(height - 8, y));
      arrastrando.vx = Math.max(-3, Math.min(3, dx * 0.35));
      arrastrando.vy = Math.max(-3, Math.min(3, dy * 0.35));
      if (reduceMotion) dibujar();
      evento.preventDefault();
    });

    canvas.addEventListener('pointerup', terminarArrastre);
    canvas.addEventListener('pointercancel', terminarArrastre);
    canvas.addEventListener('pointerleave', () => {
      if (!arrastrando) canvas.style.cursor = 'default';
    });

    if ('ResizeObserver' in window) {
      new ResizeObserver(redimensionar).observe(stage);
    } else {
      window.addEventListener('resize', redimensionar);
    }

    if ('IntersectionObserver' in window) {
      const observador = new IntersectionObserver((entradas) => {
        visible = entradas.some((entrada) => entrada.isIntersecting);
        if (visible) arrancar();
        else detener();
      }, { threshold: 0.12 });
      observador.observe(stage);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) detener();
      else if (visible) arrancar();
    });

    redimensionar();
    if (reduceMotion) dibujar();
    else arrancar();
  };

  const canvas = document.getElementById('network-canvas');
  if (canvas) iniciarRed(canvas);

  const dialog = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const closeButton = document.getElementById('lightbox-close');

  if (dialog && lightboxImage && lightboxCaption && typeof dialog.showModal === 'function') {
    document.querySelectorAll('.gallery-button').forEach((button) => {
      button.addEventListener('click', () => {
        const image = button.querySelector('img');
        const full = button.getAttribute('data-full');
        if (!full) return;
        lightboxImage.setAttribute('src', full);
        lightboxImage.setAttribute('alt', image ? image.getAttribute('alt') || '' : '');
        lightboxCaption.textContent = button.getAttribute('data-caption') || '';
        if (!dialog.open) dialog.showModal();
      });
    });

    if (closeButton) {
      closeButton.addEventListener('click', () => dialog.close());
    }

    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }
})();
