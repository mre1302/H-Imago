'use strict';

/* H-IMAGO · Fechas históricas
   - Parser de dataciones usuales: «19-X-1469», «19 de octubre de 1469»,
     «octubre de 1469», «c. 1520», «entre 1489 y 1512», «era 1507»…
   - Calendario dual juliano/gregoriano con conversión por día juliano (JDN),
     válido desde el 45 a. C. en adelante (calendarios prolépticos).
   - La fecha literal escrita se conserva siempre; el modelo estructurado
     (año/mes/día, sistema y precisión) es el que permite ordenar y filtrar. */

const FH_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const FH_MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const FH_DIAS_CABECERA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function fhNormalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function fhMesPorNombre(nombre) {
  const buscado = fhNormalizar(nombre);
  const indice = FH_MESES.findIndex((m) => fhNormalizar(m) === buscado);
  return indice >= 0 ? indice + 1 : null;
}

function fhAnioEtiqueta(anio) {
  return anio > 0 ? String(anio) : `${1 - anio} a. C.`;
}

/* ---------------- Conversiones de calendario (JDN) ---------------- */

function fhJdn(calendario, anio, mes, dia) {
  const a = Math.floor((14 - mes) / 12);
  const y = anio + 4800 - a;
  const m = mes + 12 * a - 3;
  const base = dia + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4);
  if (calendario === 'gregoriano') {
    return base - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  }
  return base - 32083;
}

function fhDesdeJdn(calendario, jdn) {
  if (calendario === 'gregoriano') {
    const a = jdn + 32044;
    const b = Math.floor((4 * a + 3) / 146097);
    const c = a - Math.floor((146097 * b) / 4);
    const d = Math.floor((4 * c + 3) / 1461);
    const e = c - Math.floor((1461 * d) / 4);
    const m = Math.floor((5 * e + 2) / 153);
    return {
      anio: 100 * b + d - 4800 + Math.floor(m / 10),
      mes: m + 3 - 12 * Math.floor(m / 10),
      dia: e - Math.floor((153 * m + 2) / 5) + 1,
    };
  }
  const c = jdn + 32082;
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    anio: d - 4800 + Math.floor(m / 10),
    mes: m + 3 - 12 * Math.floor(m / 10),
    dia: e - Math.floor((153 * m + 2) / 5) + 1,
  };
}

function fhDiaSemana(jdn) {
  return ((jdn + 1) % 7 + 7) % 7; // 0 = domingo
}

/* ---------------- Parser de dataciones ---------------- */

function parsearFechaHistorica(valor) {
  const original = String(valor || '').trim();
  if (!original) return null;
  let t = fhNormalizar(original).replace(/\s+/g, ' ');

  let precision = 'dia';
  if (/^(c\.?|ca\.?|circa|h\.?|fl\.?)\s*/.test(t)) {
    precision = 'aproximada';
    t = t.replace(/^(c\.?|ca\.?|circa|h\.?|fl\.?)\s*/, '');
  }

  let sistema = '';
  if (/^era\s+/.test(t)) {
    sistema = 'era';
    t = t.replace(/^era\s+/, '');
  }
  /* La era hispánica empieza 38 años antes de la era cristiana: el modelo
     guarda siempre el año d.C. y solo lo convierte al mostrarlo. */
  const ajusteEra = sistema === 'era' ? -38 : 0;
  const anioEra = (n) => Number(n) + ajusteEra;

  if (/^(antes|despues|posterior|anterior|entre)\b/.test(t)) precision = 'rango';

  let m = /^entre\s+(\d{3,4})\s+y\s+(\d{3,4})$/.exec(t);
  if (m) return { sistema, precision: 'rango', anio: anioEra(m[1]), mes: null, dia: null };

  m = /^(?:antes|despues|posterior|anterior)\s+de\s+(\d{3,4})$/.exec(t);
  if (m) return { sistema, precision: 'rango', anio: anioEra(m[1]), mes: null, dia: null };

  m = /^(\d{3,4})\s*[-–]\s*(\d{3,4})$/.exec(t);
  if (m) return { sistema, precision: 'rango', anio: anioEra(m[1]), mes: null, dia: null };

  const mesRomano = (texto) => {
    const mapa = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
    return mapa[String(texto || '').toLowerCase()] || null;
  };

  m = /^(\d{1,2})[/.-](\d{1,2}|[ivxlcdm]+)[/.-](\d{3,4})$/.exec(t);
  if (m) {
    return {
      sistema, precision,
      anio: anioEra(m[3]),
      mes: /^\d+$/.test(m[2]) ? Number(m[2]) : mesRomano(m[2]),
      dia: Number(m[1]),
    };
  }

  m = /^(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{3,4})$/.exec(t);
  if (m) {
    const mes = fhMesPorNombre(m[2]);
    if (mes) return { sistema, precision, anio: anioEra(m[3]), mes, dia: Number(m[1]) };
  }

  m = /^([a-z]+)\s+de\s+(\d{3,4})$/.exec(t);
  if (m) {
    const mes = fhMesPorNombre(m[1]) || mesRomano(m[1]);
    if (mes) return { sistema, precision: precision === 'dia' ? 'mes' : precision, anio: anioEra(m[2]), mes, dia: null };
  }

  m = /^(\d{1,4})\s*a\.\s*c\.$/.exec(t);
  if (m) return { sistema, precision, anio: 1 - Number(m[1]), mes: null, dia: null };

  m = /^(-?\d{3,4})$/.exec(t);
  if (m) return { sistema, precision: precision === 'dia' ? 'anio' : precision, anio: anioEra(m[1]), mes: null, dia: null };

  return null;
}

function formatearFechaHistorica(meta) {
  if (!meta || meta.anio == null) return '';
  const conEra = meta.sistema === 'era';
  const etiquetaAnio = conEra ? `era ${meta.anio + 38}` : fhAnioEtiqueta(meta.anio);
  const aproximada = meta.precision === 'aproximada';
  const completa = meta.precision !== 'anio' && meta.precision !== 'aproximada' && meta.precision !== 'rango';
  let texto;
  if (meta.dia && meta.mes && completa) {
    texto = `${meta.dia} de ${FH_MESES[meta.mes - 1]} de ${etiquetaAnio}`;
  } else if (meta.mes && (meta.precision === 'mes' || meta.precision === 'dia')) {
    texto = `${FH_MESES[meta.mes - 1]} de ${etiquetaAnio}`;
  } else {
    texto = etiquetaAnio;
  }
  return aproximada ? `c. ${texto}` : texto;
}

/* ---------------- Calendario visual dual ---------------- */

let fhPopoverAbierto = null;
let fhFuera = null;

function fhCerrar() {
  if (fhFuera) {
    document.removeEventListener('mousedown', fhFuera);
    fhFuera = null;
  }
  if (fhPopoverAbierto) {
    fhPopoverAbierto.remove();
    fhPopoverAbierto = null;
  }
}

function fhAnioReferencia(fuente) {
  const valor = typeof fuente === 'function'
    ? fuente()
    : (fuente && typeof fuente === 'object' && 'value' in fuente ? fuente.value : fuente);
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : null;
}

function abrirCalendario(entrada, metaInicial, alCambiar, opciones = {}) {
  fhCerrar();
  const parseada = parsearFechaHistorica(entrada.value);
  const meta = {
    sistema: '', precision: 'dia', anio: null, mes: null, dia: null,
    ...(metaInicial && typeof metaInicial === 'object' ? metaInicial : {}),
  };
  if (meta.anio == null && parseada) Object.assign(meta, parseada);

  const anioCampo = fhAnioReferencia(opciones.anio);
  const calendarioBase = meta.sistema === 'juliano' || meta.sistema === 'era' ? 'juliano' : 'gregoriano';
  let sistemaSalida = meta.sistema === 'juliano' || meta.sistema === 'era' ? meta.sistema : 'gregoriano';
  let vista = {
    calendario: calendarioBase,
    anio: meta.anio ?? anioCampo ?? 1582,
    mes: meta.mes ?? 1,
  };
  let seleccionJdn = null;
  if (meta.anio != null && meta.mes != null && meta.dia != null) {
    seleccionJdn = fhJdn(calendarioBase, meta.anio, meta.mes, meta.dia);
  }

  const etiquetaAnioVista = (anio) => (sistemaSalida === 'era'
    ? `era ${anio + 38}`
    : fhAnioEtiqueta(anio));
  const anioVistaVisible = () => (sistemaSalida === 'era' ? vista.anio + 38 : vista.anio);

  const pop = el('div', 'fh-popover');
  const contenedor = entrada.closest('.fecha-historica') || entrada.parentElement;
  contenedor.style.position = 'relative';
  contenedor.appendChild(pop);
  fhPopoverAbierto = pop;

  const cabecera = el('div', 'fh-cabecera');
  cabecera.appendChild(el('span', 'fh-titulo', 'Calendario histórico'));

  const selSistema = el('select', 'entrada fh-sistema');
  for (const [valor, etiqueta] of [
    ['gregoriano', 'Gregoriano'],
    ['juliano', 'Juliano'],
    ['era', 'Era hispánica'],
  ]) {
    selSistema.appendChild(new Option(etiqueta, valor));
  }
  selSistema.value = sistemaSalida;
  cabecera.appendChild(selSistema);

  const selPrecision = el('select', 'entrada fh-precision');
  for (const [valor, etiqueta] of [
    ['dia', 'Precisión: día'],
    ['mes', 'Precisión: mes'],
    ['anio', 'Precisión: año'],
    ['aproximada', 'Precisión: aproximada'],
    ['rango', 'Precisión: rango'],
  ]) {
    selPrecision.appendChild(new Option(etiqueta, valor));
  }
  selPrecision.value = meta.precision || 'dia';
  cabecera.appendChild(selPrecision);

  const btnCerrar = el('button', 'btn btn-mini', '✕');
  btnCerrar.type = 'button';
  btnCerrar.title = 'Cerrar sin aplicar';
  cabecera.appendChild(btnCerrar);
  pop.appendChild(cabecera);

  const paneles = el('div', 'fh-paneles');
  pop.appendChild(paneles);

  const pie = el('div', 'fh-pie');
  const detalle = el('span', 'fh-detalle', '');
  const acciones = el('div', 'fh-acciones');
  const btnLimpiar = el('button', 'btn btn-mini', 'Limpiar');
  const btnAplicar = el('button', 'btn btn-mini btn-primario', 'Aplicar');
  acciones.append(btnLimpiar, btnAplicar);
  pie.append(detalle, acciones);
  pop.appendChild(pie);

  function jdnPrimerDiaVista() {
    return fhJdn(vista.calendario, vista.anio, vista.mes, 1);
  }

  function pintarPanel(calendario, titulo) {
    const jdnInicio = jdnPrimerDiaVista();
    const partes = fhDesdeJdn(calendario, jdnInicio);
    const panel = el('div', 'fh-panel');

    const cab = el('div', 'fh-panel-cab');
    const btnAnt = el('button', 'fh-nav', '‹');
    const btnSig = el('button', 'fh-nav', '›');
    btnAnt.type = 'button';
    btnSig.type = 'button';
    btnAnt.title = 'Mes anterior';
    btnSig.title = 'Mes siguiente';
    const etiquetaMes = el('span', 'fh-panel-mes',
      `${FH_MESES[partes.mes - 1]} ${etiquetaAnioVista(partes.anio)}`);
    cab.append(btnAnt, etiquetaMes, btnSig);
    panel.appendChild(cab);
    panel.appendChild(el('div', 'fh-panel-titulo', titulo));

    const mover = (delta) => {
      let anio = partes.anio;
      let mes = partes.mes + delta;
      if (mes < 1) { mes = 12; anio -= 1; }
      if (mes > 12) { mes = 1; anio += 1; }
      vista = { calendario, anio, mes };
      pintar();
    };
    btnAnt.addEventListener('click', () => mover(-1));
    btnSig.addEventListener('click', () => mover(1));

    const rejilla = el('div', 'fh-rejilla');
    for (const dia of FH_DIAS_CABECERA) rejilla.appendChild(el('span', 'fh-dia-cab', dia));
    const primerJdn = fhJdn(calendario, partes.anio, partes.mes, 1);
    const desplazamiento = (fhDiaSemana(primerJdn) + 6) % 7;
    for (let i = 0; i < desplazamiento; i++) rejilla.appendChild(el('span', 'fh-hueco', ''));
    const diasDelMes = fhJdn(
      calendario,
      partes.mes === 12 ? partes.anio + 1 : partes.anio,
      partes.mes === 12 ? 1 : partes.mes + 1,
      1
    ) - primerJdn;
    for (let dia = 1; dia <= diasDelMes; dia++) {
      const jdnDia = primerJdn + dia - 1;
      const boton = el('button', 'fh-dia', String(dia));
      boton.type = 'button';
      if (seleccionJdn === jdnDia) boton.classList.add('seleccionado');
      boton.addEventListener('click', () => {
        seleccionJdn = jdnDia;
        pintar();
      });
      rejilla.appendChild(boton);
    }
    panel.appendChild(rejilla);
    return panel;
  }

  function pintar() {
    paneles.innerHTML = '';
    const calendarioPanel = sistemaSalida === 'gregoriano' ? 'gregoriano' : 'juliano';
    const tituloPanel = sistemaSalida === 'era'
      ? 'ERA HISPÁNICA'
      : (sistemaSalida === 'juliano' ? 'JULIANO' : 'GREGORIANO');
    paneles.appendChild(pintarPanel(calendarioPanel, tituloPanel));
    if (seleccionJdn != null) {
      const partes = fhDesdeJdn(calendarioPanel, seleccionJdn);
      const etiqueta = sistemaSalida === 'era'
        ? 'era hispánica'
        : (sistemaSalida === 'juliano' ? 'juliano' : 'gregoriano');
      detalle.textContent = `${partes.dia} ${FH_MESES_CORTOS[partes.mes - 1]} ` +
        `${etiquetaAnioVista(partes.anio)} (${etiqueta})`;
    } else {
      detalle.textContent = 'Elige un día en el calendario.';
    }
    if (inAnio) inAnio.value = String(anioVistaVisible());
  }

  selSistema.addEventListener('change', () => {
    sistemaSalida = selSistema.value;
    vista.calendario = sistemaSalida === 'gregoriano' ? 'gregoriano' : 'juliano';
    if (seleccionJdn != null) {
      const partes = fhDesdeJdn(vista.calendario, seleccionJdn);
      vista.anio = partes.anio;
      vista.mes = partes.mes;
    }
    if (inAnio) inAnio.value = String(anioVistaVisible());
    pintar();
  });

  btnCerrar.addEventListener('click', () => {
    fhCerrar();
  });

  btnLimpiar.addEventListener('click', () => {
    entrada.value = '';
    entrada.dispatchEvent(new Event('input', { bubbles: true }));
    const vacia = { sistema: '', precision: 'dia', anio: null, mes: null, dia: null };
    if (alCambiar) alCambiar(vacia);
    fhCerrar();
  });

  btnAplicar.addEventListener('click', () => {
    const precision = selPrecision.value;
    let nueva;
    if (precision === 'aproximada' || precision === 'rango') {
      nueva = { ...meta, precision, anio: meta.anio ?? vista.anio };
    } else if (seleccionJdn == null) {
      nueva = {
        sistema: sistemaSalida === 'era' ? 'era' : vista.calendario,
        precision,
        anio: vista.anio,
        mes: precision === 'dia' || precision === 'mes' ? vista.mes : null,
        dia: null,
      };
    } else {
      const base = sistemaSalida === 'gregoriano' ? 'gregoriano' : 'juliano';
      const partes = fhDesdeJdn(base, seleccionJdn);
      nueva = {
        sistema: sistemaSalida === 'era' ? 'era' : base,
        precision,
        anio: partes.anio,
        mes: precision === 'anio' ? null : partes.mes,
        dia: precision === 'dia' ? partes.dia : null,
      };
    }
    entrada.value = formatearFechaHistorica(nueva);
    entrada.dispatchEvent(new Event('input', { bubbles: true }));
    if (alCambiar) alCambiar(nueva);
    fhCerrar();
  });

  /* Navegación por año desde la cabecera de la vista */
  const filaAnio = el('div', 'fh-anio-fila');
  const inAnio = el('input', 'entrada fh-anio');
  inAnio.type = 'number';
  inAnio.value = String(anioVistaVisible());
  inAnio.setAttribute('aria-label', 'Año de la vista');
  inAnio.addEventListener('change', () => {
    const valor = Number(inAnio.value);
    if (Number.isFinite(valor)) {
      vista.anio = sistemaSalida === 'era' ? valor - 38 : valor;
      inAnio.value = String(anioVistaVisible());
      pintar();
    }
  });
  filaAnio.append(el('span', 'fh-anio-etiqueta', 'Año de la vista'), inAnio);
  pop.insertBefore(filaAnio, paneles);

  pintar();

  function fuera(ev) {
    if (!pop.contains(ev.target) && ev.target !== entrada) {
      fhCerrar();
    }
  }
  fhFuera = fuera;
  document.addEventListener('mousedown', fuera);
}

/** Adjunta el botón de calendario a un input ya presente en el DOM. */
function adjuntarCalendarioFecha(entrada, metaInicial, alCambiar, opciones = {}) {
  entrada._meta = { ...(metaInicial && typeof metaInicial === 'object' ? metaInicial : {}) };
  const boton = el('button', 'btn btn-mini fecha-historica-boton');
  boton.type = 'button';
  boton.title = 'Abrir calendario histórico';
  boton.setAttribute('aria-label', 'Abrir calendario histórico');
  boton.innerHTML =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  (entrada.parentElement || entrada).appendChild(boton);
  boton.addEventListener('click', () => {
    abrirCalendario(entrada, entrada._meta, (nueva) => {
      entrada._meta = nueva;
      if (alCambiar) alCambiar(nueva);
      entrada.dispatchEvent(new Event('change', { bubbles: true }));
    }, opciones);
  });
  entrada.addEventListener('input', () => {
    if (!String(entrada.value || '').trim()) entrada._meta = {};
  });
  entrada.addEventListener('blur', () => {
    const formateado = entrada._meta && entrada._meta.anio != null
      ? formatearFechaHistorica(entrada._meta)
      : null;
    if (formateado && String(entrada.value || '').trim() === formateado) return;
    const parseada = parsearFechaHistorica(entrada.value);
    if (parseada) {
      entrada._meta = parseada;
      if (alCambiar) alCambiar(parseada);
      entrada.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (entrada._meta && Object.keys(entrada._meta).length) {
      entrada._meta = {};
      if (alCambiar) alCambiar({});
      entrada.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  return boton;
}

window.FechaHistorica = {
  parsear: parsearFechaHistorica,
  formatear: formatearFechaHistorica,
  adjuntar: adjuntarCalendarioFecha,
  anioReferencia: fhAnioReferencia,
  cerrar: fhCerrar,
  jdn: fhJdn,
  desdeJdn: fhDesdeJdn,
  meses: FH_MESES,
};
