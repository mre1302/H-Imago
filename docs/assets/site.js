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

  const siteHeader = document.querySelector('.site-header');
  let headerFrame = false;

  const actualizarHeader = () => {
    headerFrame = false;
    if (siteHeader) {
      siteHeader.classList.toggle('is-scrolled', window.scrollY > 10);
    }
  };

  const pedirHeader = () => {
    if (headerFrame) return;
    headerFrame = true;
    window.requestAnimationFrame(actualizarHeader);
  };

  window.addEventListener('scroll', pedirHeader, { passive: true });
  actualizarHeader();

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

      const duracion = Math.min(950, Math.max(460, Math.abs(distancia) * 0.32));
      let inicio = null;
      const suavizar = (t) => 1 - Math.pow(1 - t, 4);

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
      { fill: '#d7a64f', rgb: '215, 166, 79' },
      { fill: '#78a3c7', rgb: '120, 163, 199' },
      { fill: '#83a47b', rgb: '131, 164, 123' },
      { fill: '#b38bb8', rgb: '179, 139, 184' }
    ];

    const crearBrillos = () => colores.map((color) => {
      const lado = 96;
      const sprite = document.createElement('canvas');
      sprite.width = lado;
      sprite.height = lado;
      const g = sprite.getContext('2d');
      const grad = g.createRadialGradient(lado / 2, lado / 2, 0, lado / 2, lado / 2, lado / 2);
      grad.addColorStop(0, `rgba(${color.rgb}, 0.32)`);
      grad.addColorStop(0.45, `rgba(${color.rgb}, 0.09)`);
      grad.addColorStop(1, `rgba(${color.rgb}, 0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, lado, lado);
      return sprite;
    });

    const brillos = crearBrillos();
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
    let puntero = null;

    const crearGrupos = () => {
      const grupos = [];
      const cantidad = 4 + Math.floor(Math.random() * 2);
      for (let i = 0; i < cantidad; i += 1) {
        let x = 0.5;
        let y = 0.5;
        for (let intento = 0; intento < 40; intento += 1) {
          x = 0.18 + Math.random() * 0.64;
          y = 0.2 + Math.random() * 0.6;
          if (grupos.every((g) => Math.hypot(g.x - x, g.y - y) > 0.28)) break;
        }
        grupos.push({
          x,
          y,
          radio: 0.15 + Math.random() * 0.09,
          nucleo: 0.42 + Math.random() * 0.16,
          fuerza: 0.00028 + Math.random() * 0.00032
        });
      }
      return grupos;
    };

    const crearNodos = () => {
      const grupos = crearGrupos();
      const pesos = grupos.map(() => 0.55 + Math.random() * 1.1);
      const sumaPesos = pesos.reduce((suma, peso) => suma + peso, 0);
      const elegirGrupo = () => {
        let sorteo = Math.random() * sumaPesos;
        for (let i = 0; i < grupos.length; i += 1) {
          sorteo -= pesos[i];
          if (sorteo <= 0) return grupos[i];
        }
        return grupos[grupos.length - 1];
      };

      nodos = Array.from({ length: total }, (_, indice) => {
        const color = colores[indice % colores.length];
        const vx = (Math.random() - 0.5) * 0.12;
        const vy = (Math.random() - 0.5) * 0.12;
        return {
          x: width * (0.06 + Math.random() * 0.88),
          y: height * (0.1 + Math.random() * 0.8),
          vx,
          vy,
          ix: 0,
          iy: 0,
          r: indice < 8 ? 4.4 + Math.random() * 2 : 2 + Math.random() * 1.8,
          phase: Math.random() * Math.PI * 2,
          color,
          brillo: brillos[indice % brillos.length],
          grupo: elegirGrupo(),
          nomada: Math.random() < 0.16 ? 0.25 : 1,
          reposo: 0.6 + Math.random() * 0.26
        };
      });
    };

    const dibujar = (time = 0) => {
      ctx.clearRect(0, 0, width, height);
      const umbral = Math.min(width, height) * 0.29;

      for (let i = 0; i < nodos.length; i += 1) {
        const a = nodos[i];
        for (let j = i + 1; j < nodos.length; j += 1) {
          const b = nodos[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distancia = Math.hypot(dx, dy);
          if (distancia >= umbral) continue;
          const cercania = 1 - distancia / umbral;
          const destacado = arrastrando && (a === arrastrando || b === arrastrando);
          if (destacado) {
            ctx.lineWidth = 1.05;
            ctx.strokeStyle = `rgba(224, 169, 47, ${Math.min(0.85, cercania * 0.3 + 0.26).toFixed(3)})`;
          } else {
            ctx.lineWidth = 0.65;
            ctx.strokeStyle = `rgba(205, 190, 160, ${(cercania * 0.3).toFixed(3)})`;
          }
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const nodo of nodos) {
        const pulso = reduceMotion ? 1 : 1 + Math.sin(time * 0.0011 + nodo.phase) * 0.08;
        const radio = nodo.r * pulso;
        const halo = radio * 5;
        ctx.drawImage(nodo.brillo, nodo.x - halo / 2, nodo.y - halo / 2, halo, halo);
        ctx.beginPath();
        ctx.arc(nodo.x, nodo.y, radio, 0, Math.PI * 2);
        ctx.fillStyle = nodo.color.fill;
        ctx.fill();
      }
    };

    const mover = (time) => {
      if (!running) return;
      const enlace = Math.min(width, height) * 0.29;

      // Muelles muy suaves con reposo irregular: el tejido queda desigual,
      // más denso en unos puntos y laxo en otros, nunca como una malla regular.
      for (let i = 0; i < nodos.length; i += 1) {
        const a = nodos[i];
        for (let j = i + 1; j < nodos.length; j += 1) {
          const b = nodos[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distancia = Math.hypot(dx, dy) || 0.001;
          if (distancia >= enlace) continue;
          const reposo = enlace * ((a.reposo + b.reposo) / 2);
          const fuerza = (distancia - reposo) * 0.0004;
          const fx = (dx / distancia) * fuerza;
          const fy = (dy / distancia) * fuerza;
          if (a !== arrastrando) { a.vx += fx; a.vy += fy; }
          if (b !== arrastrando) { b.vx -= fx; b.vy -= fy; }
        }
      }

      for (const nodo of nodos) {
        if (nodo === arrastrando) {
          nodo.ix *= 0.8;
          nodo.iy *= 0.8;
          continue;
        }

        // Deriva errante: cada nodo deambula con su propio ritmo.
        nodo.vx += Math.cos(time * 0.00023 + nodo.phase) * 0.008;
        nodo.vy += Math.sin(time * 0.00019 + nodo.phase * 1.3) * 0.008;

        // Afín a su grupo: el núcleo atrae con suavidad más allá de su interior.
        const grupo = nodo.grupo;
        const dxg = grupo.x * width - nodo.x;
        const dyg = grupo.y * height - nodo.y;
        const dg = Math.hypot(dxg, dyg) || 0.001;
        const nucleo = grupo.radio * grupo.nucleo * Math.min(width, height);
        if (dg > nucleo) {
          const fuerza = (dg - nucleo) * grupo.fuerza * nodo.nomada;
          nodo.vx += (dxg / dg) * fuerza;
          nodo.vy += (dyg / dg) * fuerza;
        }

        // Bordes solo como salvaguarda: el contorno lo dibujan los grupos.
        const margen = 16;
        if (nodo.x < margen) nodo.vx += (margen - nodo.x) * 0.0025;
        if (nodo.x > width - margen) nodo.vx -= (nodo.x - (width - margen)) * 0.0025;
        if (nodo.y < margen) nodo.vy += (margen - nodo.y) * 0.0025;
        if (nodo.y > height - margen) nodo.vy -= (nodo.y - (height - margen)) * 0.0025;

        // Repulsión serena alrededor del cursor.
        if (puntero) {
          const dx = nodo.x - puntero.x;
          const dy = nodo.y - puntero.y;
          const distancia = Math.hypot(dx, dy);
          if (distancia > 0.001 && distancia < 110) {
            const fuerza = (1 - distancia / 110) * 0.05;
            nodo.ix += (dx / distancia) * fuerza;
            nodo.iy += (dy / distancia) * fuerza;
          }
        }

        // Amortiguación: la red se mueve serena, sin desbocarse.
        nodo.vx = (nodo.vx + nodo.ix) * 0.96;
        nodo.vy = (nodo.vy + nodo.iy) * 0.96;
        nodo.ix *= 0.85;
        nodo.iy *= 0.85;

        const velocidad = Math.hypot(nodo.vx, nodo.vy);
        if (velocidad > 0.55) {
          nodo.vx *= 0.55 / velocidad;
          nodo.vy *= 0.55 / velocidad;
        }

        nodo.x += nodo.vx;
        nodo.y += nodo.vy;

        // Salvaguarda: nunca salen del escenario.
        nodo.x = Math.max(6, Math.min(width - 6, nodo.x));
        nodo.y = Math.max(6, Math.min(height - 6, nodo.y));
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
      puntero = { x, y };
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
      puntero = { x, y };
      if (!arrastrando) {
        canvas.style.cursor = nodoCercano(x, y) ? 'grab' : 'default';
        return;
      }
      const dx = x - arrastrando.x;
      const dy = y - arrastrando.y;
      arrastrando.x = Math.max(8, Math.min(width - 8, x));
      arrastrando.y = Math.max(8, Math.min(height - 8, y));
      arrastrando.vx = Math.max(-1.2, Math.min(1.2, dx * 0.12));
      arrastrando.vy = Math.max(-1.2, Math.min(1.2, dy * 0.12));
      if (reduceMotion) dibujar();
      evento.preventDefault();
    });

    canvas.addEventListener('pointerup', terminarArrastre);
    canvas.addEventListener('pointercancel', terminarArrastre);
    canvas.addEventListener('pointerleave', () => {
      puntero = null;
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
