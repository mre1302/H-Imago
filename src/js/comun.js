'use strict';
/* eslint-disable no-unused-vars -- estas utilidades se usan desde otros <script> globales */

/* H-IMAGO · Utilidades compartidas del renderer */

window.MODULOS = {};

/* Caché compartida por proyecto para listados ligeros de entidades. Evita
   repetir las mismas consultas al abrir fichas y formularios de relación. */
window.HimagoCache = (() => {
  const mapa = new Map();
  const pendientes = new Map();
  const TTL = 15000;
  const LIMITE = 200;
  let generacion = 0;
  const clave = (tipo, proyectoId) => `${proyectoId}:${tipo}`;
  return {
    async listar(tipo, proyectoId, { forzar = false } = {}) {
      const k = clave(tipo, proyectoId);
      const guardado = mapa.get(k);
      if (!forzar && guardado && Date.now() - guardado.instante < TTL) return guardado.filas;
      if (!forzar && pendientes.has(k)) return pendientes.get(k);
      const generacionInicial = generacion;
      const promesa = llamar(api.entidadListarResumen(tipo, proyectoId))
        .then((filas) => {
          if (generacion === generacionInicial) {
            mapa.delete(k);
            mapa.set(k, { instante: Date.now(), filas });
            while (mapa.size > LIMITE) mapa.delete(mapa.keys().next().value);
          }
          return filas;
        })
        .finally(() => {
          if (pendientes.get(k) === promesa) pendientes.delete(k);
        });
      pendientes.set(k, promesa);
      return promesa;
    },
    invalidar(proyectoId) {
      generacion++;
      if (proyectoId == null) {
        mapa.clear();
        pendientes.clear();
        return;
      }
      for (const k of [...mapa.keys()]) {
        if (k.startsWith(`${proyectoId}:`)) mapa.delete(k);
      }
      for (const k of [...pendientes.keys()]) {
        if (k.startsWith(`${proyectoId}:`)) pendientes.delete(k);
      }
    },
  };
})();

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

function escaparHTML(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}

/** Lanza la promesa IPC y desenvuelve {ok, datos|error}. */
function llamar(promesa) {
  return promesa.then((r) => {
    if (!r.ok) throw new Error(r.error || 'Error desconocido');
    return r.datos;
  });
}

/* ------------------------------------------------------------------ */
/* Carga diferida de los formularios de bloques                        */
/* ------------------------------------------------------------------ */

const SCRIPTS_BLOQUES = [
  'js/modulos/formularios-bloques.js',
  'js/modulos/ajustes-bloques.js',
  'js/modulos/bloques-registro.js',
];
let promesaBloques = null;

function cargarModulosBloques() {
  if (typeof FORMULARIOS_BLOQUES !== 'undefined'
    && typeof BloquesRegistro !== 'undefined'
    && window.HIMAGO_AJUSTES_BLOQUES) {
    return Promise.resolve();
  }
  if (promesaBloques) return promesaBloques;
  promesaBloques = (async () => {
    for (const src of SCRIPTS_BLOQUES) {
      if (document.querySelector(`script[data-himago-bloques="${src}"]`)) continue;
      await new Promise((resolver, rechazar) => {
        const script = document.createElement('script');
        script.src = src;
        script.dataset.himagoBloques = src;
        script.onload = () => resolver();
        script.onerror = () => {
          script.remove();
          rechazar(new Error(`No se pudo cargar ${src}`));
        };
        document.head.appendChild(script);
      });
    }
    if (typeof FORMULARIOS_BLOQUES === 'undefined'
      || typeof BloquesRegistro === 'undefined'
      || !window.HIMAGO_AJUSTES_BLOQUES) {
      throw new Error('Los módulos de bloques de registro no se cargaron completos.');
    }
  })().catch((err) => {
    promesaBloques = null;
    throw err;
  });
  return promesaBloques;
}

/* ------------------------------------------------------------------ */
/* Avisos (toasts)                                                     */
/* ------------------------------------------------------------------ */

function aviso(mensaje, tipo = 'info') {
  const cont = $('#avisos');
  if (!cont) return;
  const t = el('div', `toast toast-${tipo}`, mensaje);
  cont.appendChild(t);
  setTimeout(() => t.classList.add('visible'), 10);
  setTimeout(() => {
    t.classList.remove('visible');
    setTimeout(() => t.remove(), 300);
  }, 3600);
}

/* ------------------------------------------------------------------ */
/* Modales                                                             */
/* ------------------------------------------------------------------ */

const pilaModales = [];

function mostrarModal(contenido, { alCerrar } = {}) {
  const capa = $('#capa-modales');
  const overlay = el('div', 'modal-overlay');
  const panel = el('div', 'modal');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.tabIndex = -1;
  panel.appendChild(contenido);
  overlay.appendChild(panel);
  capa.appendChild(overlay);

  const focoAnterior = document.activeElement;
  let cerrado = false;
  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    document.removeEventListener('keydown', escapar);
    document.removeEventListener('keydown', atraparFoco);
    const indice = pilaModales.indexOf(cerrar);
    if (indice >= 0) pilaModales.splice(indice, 1);
    overlay.remove();
    if (focoAnterior && typeof focoAnterior.focus === 'function') {
      try { focoAnterior.focus(); } catch { /* elemento ya eliminado */ }
    }
    if (alCerrar) alCerrar();
  }
  function escapar(ev) {
    if (ev.key === 'Escape' && pilaModales[pilaModales.length - 1] === cerrar) {
      ev.preventDefault();
      cerrar();
    }
  }
  function atraparFoco(ev) {
    if (ev.key !== 'Tab' || pilaModales[pilaModales.length - 1] !== cerrar) return;
    const enfocables = [...panel.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((elemento) => elemento.offsetParent !== null);
    if (!enfocables.length) return;
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (ev.shiftKey && document.activeElement === primero) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && document.activeElement === ultimo) {
      ev.preventDefault();
      primero.focus();
    }
  }
  pilaModales.push(cerrar);
  overlay.addEventListener('mousedown', (ev) => { if (ev.target === overlay) cerrar(); });
  document.addEventListener('keydown', escapar);
  document.addEventListener('keydown', atraparFoco);

  const titulo = contenido.querySelector('h3');
  panel.setAttribute('aria-label', titulo ? titulo.textContent : 'Diálogo');
  const primero = panel.querySelector('input, textarea, select, button');
  if (primero) primero.focus();
  return { overlay, panel, cerrar };
}

function confirmar(mensaje, titulo = 'Confirmar') {
  return new Promise((resolver) => {
    let resuelto = false;
    const decidir = (valor) => {
      if (resuelto) return;
      resuelto = true;
      resolver(valor);
    };
    const contenido = el('div', 'modal-contenido');
    contenido.appendChild(el('h3', 'modal-titulo', titulo));
    contenido.appendChild(el('p', 'modal-mensaje', mensaje));
    const fila = el('div', 'modal-acciones');
    const btnNo = el('button', 'btn', 'Cancelar');
    const btnSi = el('button', 'btn btn-peligroso', 'Aceptar');
    fila.append(btnNo, btnSi);
    contenido.appendChild(fila);
    const { cerrar } = mostrarModal(contenido, { alCerrar: () => decidir(false) });
    btnNo.addEventListener('click', () => { decidir(false); cerrar(); });
    btnSi.addEventListener('click', () => { decidir(true); cerrar(); });
  });
}

function pedirTexto({ titulo, etiqueta, valor = '', placeholder = '', boton = 'Aceptar' }) {
  return new Promise((resolver) => {
    let resuelto = false;
    const decidir = (valorFinal) => {
      if (resuelto) return;
      resuelto = true;
      resolver(valorFinal);
    };
    const contenido = el('div', 'modal-contenido');
    contenido.appendChild(el('h3', 'modal-titulo', titulo));
    const campo = el('div', 'campo');
    campo.appendChild(el('label', '', etiqueta));
    const input = el('input', 'entrada');
    input.value = valor;
    input.placeholder = placeholder;
    campo.appendChild(input);
    contenido.appendChild(campo);
    const fila = el('div', 'modal-acciones');
    const btnNo = el('button', 'btn', 'Cancelar');
    const btnSi = el('button', 'btn btn-primario', boton);
    fila.append(btnNo, btnSi);
    contenido.appendChild(fila);
    const { cerrar } = mostrarModal(contenido, { alCerrar: () => decidir(null) });
    const aceptar = () => { const texto = input.value.trim() || null; decidir(texto); cerrar(); };
    btnNo.addEventListener('click', () => { decidir(null); cerrar(); });
    btnSi.addEventListener('click', aceptar);
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') aceptar(); });
  });
}

/* ------------------------------------------------------------------ */
/* Formato y etiquetas                                                 */
/* ------------------------------------------------------------------ */

function formatearFecha(valor) {
  if (!valor) return '';
  let texto = String(valor);
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(texto)) {
    texto = `${texto.replace(' ', 'T')}Z`;
  }
  const d = new Date(texto);
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function nombrePersona(p) {
  return [p.nombre, p.apellidos].filter(Boolean).join(' ') || p.alias || '(sin nombre)';
}

function etiquetaEntidad(tipo, fila) {
  if (tipo === 'persona') return nombrePersona(fila);
  if (tipo === 'fuente') return fila.titulo || '(sin título)';
  return fila.nombre || '(sin nombre)';
}

/** Etiqueta legible del tipo de entidad (singular). */
const NOMBRE_TIPO = {
  persona: 'Persona',
  institucion: 'Institución',
  lugar: 'Lugar',
  patrimonio: 'Patrimonio',
  fuente: 'Fuente',
};

const COLORES_TIPO = {
  persona: '#d9a05b',
  institucion: '#7ea8c9',
  lugar: '#86b28a',
  patrimonio: '#b98cc4',
};

/* Paleta estable para la capa opcional de comunidades del Análisis RSH. */
const COLORES_COMUNIDADES = [
  '#e3c35a', '#7ea8c9', '#86b28a', '#b98cc4',
  '#d98b8b', '#6fc3c0', '#d4a373', '#9d9dd6',
  '#c7a27a', '#8ab6d6', '#a8c686', '#c6a0d8',
];
