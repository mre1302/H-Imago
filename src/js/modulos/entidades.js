'use strict';

/* H-IMAGO · Módulo genérico de entidades (listado maestro + ficha editable
   + relaciones). Lo comparten Personas, Instituciones, Lugares, Patrimonios
   y Fuentes. */

const TIPOS_RELACION = ['persona', 'institucion', 'lugar', 'patrimonio'];

const OPCIONES = {
  genero: ['Masculino', 'Femenino', 'No especificado'],
  tipo_persona_lugar: null, // reservado
};

/* Selectores que definen la variante del formulario de fuentes (van tras
   título y autor). Se declaran antes de DEFINICIONES porque éste los usa. */
const CAMPOS_SELECTOR_FUENTE = [
  { clave: 'categoria', etiqueta: 'Categoría', tipo: 'select', opciones: FUENTES_CATEGORIAS, ancho: 4 },
  { clave: 'tipo', etiqueta: 'Tipo de fuente', tipo: 'taxonomia-fuentes', ancho: 8 },
];

const DEFINICIONES = {
  persona: {
    titulo: 'Personas',
    singular: 'persona',
    nuevaEtiqueta: 'Nueva persona',
    relaciones: true,
    etiqueta: nombrePersona,
    resumen: (p) => [
      rangoAnios(p.anio_nacimiento, p.anio_defuncion),
      p.ocupacion,
    ].filter(Boolean).join(' · '),
    columnas: [
      { titulo: 'Apellidos', valor: (f) => f.apellidos || '—' },
      { titulo: 'Nombre', valor: (f) => f.nombre || '—' },
      { titulo: 'Género', valor: (f) => f.genero || '—' },
      { titulo: 'Año nac.', valor: (f) => f.anio_nacimiento ?? '—' },
      { titulo: 'Año def.', valor: (f) => f.anio_defuncion ?? '—' },
      { titulo: 'Lugar de nacimiento', valor: (f) => f.lugar_nacimiento || '—' },
      { titulo: 'Ocupación / oficio', valor: (f) => f.ocupacion || '—' },
    ],
    exigirUnoDe: ['nombre', 'apellidos'],
    mensajeUnoDe: 'Indica al menos el nombre o los apellidos.',
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre', ancho: 6, pista: 'Basta con indicar el nombre o los apellidos.' },
      { clave: 'apellidos', etiqueta: 'Apellidos', ancho: 6, pista: 'El directorio se ordena por apellidos y, después, por nombre.' },
      { clave: 'alias', etiqueta: 'Alias / sobrenombre', ancho: 5 },
      { clave: 'genero', etiqueta: 'Género', tipo: 'select', opciones: OPCIONES.genero, ancho: 3 },
      { clave: 'tratamiento', etiqueta: 'Tratamiento / título', ancho: 4 },
      { clave: 'anio_nacimiento', etiqueta: 'Año de nacimiento', tipo: 'anio', ancho: 3 },
      { clave: 'fecha_exacta_nacimiento', etiqueta: 'FECHA EXACTA (nacimiento)', tipo: 'fecha-historica', ancho: 3, pista: 'Solo si la fuente la da: «19-X-1469», «19 de octubre de 1469»…' },
      { clave: 'anio_defuncion', etiqueta: 'Año de defunción', tipo: 'anio', ancho: 3 },
      { clave: 'fecha_exacta_defuncion', etiqueta: 'FECHA EXACTA (defunción)', tipo: 'fecha-historica', ancho: 3 },
      { clave: 'lugar_nacimiento', etiqueta: 'Lugar de nacimiento', tipo: 'select-lugar', ancho: 6 },
      { clave: 'lugar_defuncion', etiqueta: 'Lugar de defunción', tipo: 'select-lugar', ancho: 6 },
      { clave: 'ocupacion', etiqueta: 'Ocupación / oficio', ancho: 6 },
      { clave: 'institucion_id', etiqueta: 'Institución (ocupación)', tipo: 'entidad', entidad: 'institucion', ancho: 6, pista: 'Al guardar la ficha con ocupación e institución se crea la relación «Persona · Miembro · Institución» si aún no existe.' },
      { clave: 'notas', etiqueta: 'Notas', tipo: 'area', filas: 5, ancho: 12 },
    ],
  },
  institucion: {
    titulo: 'Instituciones',
    singular: 'institución',
    nuevaEtiqueta: 'Nueva institución',
    relaciones: true,
    etiqueta: (f) => f.nombre || '(sin nombre)',
    resumen: (f) => [
      f.tipo,
      rangoAnios(f.anio_fundacion, f.anio_disolucion),
    ].filter(Boolean).join(' · '),
    columnas: [
      { titulo: 'Nombre', valor: (f) => f.nombre || '—' },
      { titulo: 'Tipo', valor: (f) => f.tipo || '—' },
      { titulo: 'Fundación', valor: (f) => f.anio_fundacion ?? '—' },
      { titulo: 'Disolución', valor: (f) => f.anio_disolucion ?? '—' },
    ],
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre *', ancho: 8 },
      { clave: 'tipo', etiqueta: 'Tipo', ancho: 4 },
      { clave: 'anio_fundacion', etiqueta: 'Año de fundación', tipo: 'anio', ancho: 3 },
      { clave: 'fecha_exacta_fundacion', etiqueta: 'FECHA EXACTA (fundación)', tipo: 'fecha-historica', ancho: 3 },
      { clave: 'anio_disolucion', etiqueta: 'Año de disolución', tipo: 'anio', ancho: 3 },
      { clave: 'fecha_exacta_disolucion', etiqueta: 'FECHA EXACTA (disolución)', tipo: 'fecha-historica', ancho: 3 },
      { clave: 'lugar_id', etiqueta: 'Sede / lugar', tipo: 'entidad', entidad: 'lugar', ancho: 6, pista: 'Al guardar la ficha con sede se crea la relación «Lugar · Sede · Institución» si aún no existe.' },
      { clave: 'notas', etiqueta: 'Notas', tipo: 'area', filas: 5, ancho: 12 },
    ],
  },
  lugar: {
    titulo: 'Lugares',
    singular: 'lugar',
    nuevaEtiqueta: 'Nuevo lugar',
    relaciones: true,
    etiqueta: (f) => f.nombre || '(sin nombre)',
    resumen: (f) => [
      f.tipo,
      (f.latitud != null && f.longitud != null)
        ? `(${Number(f.latitud).toFixed(4)}, ${Number(f.longitud).toFixed(4)})`
        : 'sin georreferenciar',
    ].filter(Boolean).join(' · '),
    columnas: [
      { titulo: 'Nombre', valor: (f) => f.nombre || '—' },
      { titulo: 'Tipo', valor: (f) => f.tipo || '—' },
      { titulo: 'Latitud', valor: (f) => (f.latitud != null ? Number(f.latitud).toFixed(4) : '—') },
      { titulo: 'Longitud', valor: (f) => (f.longitud != null ? Number(f.longitud).toFixed(4) : '—') },
    ],
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre *', ancho: 8 },
      { clave: 'tipo', etiqueta: 'Tipo', ancho: 4 },
      { clave: 'latitud', etiqueta: 'Latitud', ancho: 3, pista: 'Decimal: 41.6523 (capturable en el Georreferenciador)' },
      { clave: 'longitud', etiqueta: 'Longitud', ancho: 3, pista: 'Decimal: -4.7239' },
      { clave: 'notas', etiqueta: 'Notas', tipo: 'area', filas: 5, ancho: 12 },
    ],
  },
  patrimonio: {
    titulo: 'Patrimonios',
    singular: 'patrimonio',
    nuevaEtiqueta: 'Nuevo patrimonio',
    relaciones: true,
    etiqueta: (f) => f.nombre || '(sin nombre)',
    resumen: (f) => [f.tipo, f.propietario, f.valor].filter(Boolean).join(' · '),
    columnas: [
      { titulo: 'Nombre', valor: (f) => f.nombre || '—' },
      { titulo: 'Tipo', valor: (f) => f.tipo || '—' },
      { titulo: 'Propietario / titular', valor: (f) => f.propietario || '—' },
      { titulo: 'Valor / tasación', valor: (f) => f.valor || '—' },
    ],
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre *', ancho: 8 },
      { clave: 'tipo', etiqueta: 'Tipo', ancho: 4 },
      { clave: 'propietario', etiqueta: 'Propietario / titular (persona o institución)', tipo: 'select-propietario', ancho: 6, pista: 'Puede ser una persona o una institución. Al guardar se crea la relación «Propietario» si aún no existe.' },
      { clave: 'lugar_id', etiqueta: 'Ubicación', tipo: 'entidad', entidad: 'lugar', ancho: 6 },
      { clave: 'valor', etiqueta: 'Valor / tasación', ancho: 6, pista: 'Moneda de la época: «12.000 maravedíes»…' },
      { clave: 'notas', etiqueta: 'Notas', tipo: 'area', filas: 3, ancho: 12 },
    ],
  },
  fuente: {
    titulo: 'Fuentes',
    singular: 'fuente',
    nuevaEtiqueta: 'Nueva fuente',
    relaciones: false,
    etiqueta: (f) => f.titulo || '(sin título)',
    resumen: (f) => [
      f.categoria,
      f.tipo,
      f.autor,
      [f.anio_inicio ?? null, f.anio_fin ?? null].filter((v) => v != null).join(' – '),
    ].filter(Boolean).join(' · '),
    columnas: [
      { titulo: 'Título', valor: (f) => f.titulo || '—' },
      { titulo: 'Categoría', valor: (f) => f.categoria || categoriaDeTipoFuente(f.tipo) || '—' },
      { titulo: 'Tipo', valor: (f) => f.tipo || '—' },
      { titulo: 'Autor / emisor', valor: (f) => f.autor || '—' },
      { titulo: 'Año', valor: (f) => [f.anio_inicio ?? null, f.anio_fin ?? null].filter((v) => v != null).join(' – ') || '—' },
      { titulo: 'Ubicación', valor: (f) => f.repositorio || f.ubicacion || '—' },
    ],
    campos: camposFuente({}),
    camposDinamicos: camposFuente,
  },
};

/* ------------------------------------------------------------------ */
/* Formulario condicional de FUENTES                                   */
/* ------------------------------------------------------------------ */

function camposFuente(base) {
  const categoria = String(base.categoria || '');
  const tipo = String(base.tipo || '');
  const tituloYAutor = (etiquetaAutor = 'Autor') => [
    { clave: 'titulo', etiqueta: 'Título *', ancho: 8 },
    { clave: 'autor', etiqueta: etiquetaAutor, ancho: 4 },
  ];
  const notas = { clave: 'notas', etiqueta: 'Notas', tipo: 'area', filas: 4, ancho: 12 };

  if (categoria === 'Bibliografía') {
    if (tipo === 'Libros') {
      return [
        ...tituloYAutor(),
        ...CAMPOS_SELECTOR_FUENTE,
        { clave: 'anio_inicio', etiqueta: 'Año', tipo: 'anio', ancho: 4 },
        { clave: 'lugar', etiqueta: 'Lugar', ancho: 4 },
        { clave: 'editorial', etiqueta: 'Editorial', ancho: 4 },
        notas,
      ];
    }
    if (tipo === 'Capítulos de libro') {
      return [
        ...tituloYAutor(),
        ...CAMPOS_SELECTOR_FUENTE,
        { clave: 'editor', etiqueta: 'Editor', ancho: 4 },
        { clave: 'libro', etiqueta: 'Libro', ancho: 6 },
        { clave: 'paginas', etiqueta: 'Páginas', ancho: 2 },
        { clave: 'anio_inicio', etiqueta: 'Año', tipo: 'anio', ancho: 4 },
        { clave: 'lugar', etiqueta: 'Lugar', ancho: 4 },
        { clave: 'editorial', etiqueta: 'Editorial', ancho: 4 },
        notas,
      ];
    }
    if (tipo === 'Artículos académicos') {
      return [
        ...tituloYAutor(),
        ...CAMPOS_SELECTOR_FUENTE,
        { clave: 'revista', etiqueta: 'Revista', ancho: 5 },
        { clave: 'lugar', etiqueta: 'Lugar', ancho: 4 },
        { clave: 'anio_publicacion', etiqueta: 'Año de publicación', tipo: 'anio', ancho: 3 },
        { clave: 'anio_inicio', etiqueta: 'Año', tipo: 'anio', ancho: 3 },
        { clave: 'volumen', etiqueta: 'Volumen', ancho: 3 },
        { clave: 'numero', etiqueta: 'Número', ancho: 3 },
        { clave: 'doi', etiqueta: 'DOI', ancho: 3 },
        notas,
      ];
    }
    if (tipo === 'Actas, presentaciones y conferencias') {
      return [
        ...tituloYAutor(),
        ...CAMPOS_SELECTOR_FUENTE,
        { clave: 'evento', etiqueta: 'Evento', ancho: 6 },
        { clave: 'anio_inicio', etiqueta: 'Año', tipo: 'anio', ancho: 3 },
        { clave: 'lugar', etiqueta: 'Lugar', ancho: 3 },
        notas,
      ];
    }
    if (tipo === 'Tesis') {
      return [
        ...tituloYAutor(),
        ...CAMPOS_SELECTOR_FUENTE,
        { clave: 'anio_inicio', etiqueta: 'Año', tipo: 'anio', ancho: 4 },
        { clave: 'facultad', etiqueta: 'Facultad', ancho: 4 },
        { clave: 'universidad', etiqueta: 'Universidad', ancho: 4 },
        notas,
      ];
    }
  }

  /* Formulario general */
  return [
    ...tituloYAutor('Autor / productor'),
    ...CAMPOS_SELECTOR_FUENTE,
    { clave: 'anio_inicio', etiqueta: 'Desde (año)', tipo: 'anio', ancho: 4 },
    { clave: 'anio_fin', etiqueta: 'Hasta (año)', tipo: 'anio', ancho: 4 },
    { clave: 'lugar', etiqueta: 'Lugar', ancho: 4 },
    { clave: 'repositorio', etiqueta: 'Repositorio', ancho: 4 },
    { clave: 'fondo', etiqueta: 'Fondo', ancho: 4 },
    { clave: 'signatura', etiqueta: 'Signatura', ancho: 4 },
    notas,
  ];
}

/** Rango de años para los resúmenes: «1451 – 1504» con faltantes como «¿?». */
function rangoAnios(inicio, fin) {
  if (inicio == null && fin == null) return '';
  return `${inicio ?? '¿?'} – ${fin ?? '¿?'}`;
}

/* ------------------------------------------------------------------ */
/* Fábrica de módulos                                                  */
/* ------------------------------------------------------------------ */

function fabricarModuloEntidad(def) {
  let cont = null;
  let proyecto = null;
  let lista = [];
  let filtro = '';
  let modo = 'nada'; // 'nada' | 'nuevo' | 'editar'
  let filaActual = null;
  let sucio = false;
  let cacheReferencias = { lugar: [], institucion: [] };
  let cacheRel = [];
  let cacheEnt = {};
  let cacheFuentes = [];
  let refs = {}; // referencias de UI
  let letraActiva = null;
  let escuchaResize = false;
  let filtroCategoriaRel = null;
  let relacionEnEdicion = null;
  let relacionSucio = false;
  let objetivoBloqueId = null;
  let objetivoCuadernoId = null;
  let pilaDeshacer = [];
  let bytesPilaDeshacer = 0;
  const LIMITE_BYTES_DESHACER = 25_000_000;
  let estadoFormulario = null;
  let estadoInicialFormulario = null;
  let deshaciendo = false;
  let tareasPendientes = new Set();
  let alRedimensionar = null;
  let temporizadorBusqueda = null;
  let generacionMontaje = 0;
  let generacionFormulario = 0;
  let generacionRelaciones = 0;
  let generacionSeleccion = 0;
  let guardandoFicha = false;
  let temporizadorSnapshot = null;
  let clavesOrden = new WeakMap();
  let clavesSecundarias = new WeakMap();
  let limiteDirectorio = 400;
  let limiteLista = 400;
  const LIMITE_DIRECTORIO = 400;
  const colador = new Intl.Collator('es', { sensitivity: 'base' });
  const letrasCache = new WeakMap();

  function notificarCambios() {
    document.dispatchEvent(new CustomEvent('himago:cambios'));
  }

  function notificarContadores() {
    document.dispatchEvent(new CustomEvent('himago:contadores'));
  }

  function invalidarCacheEntidades() {
    if (window.HimagoCache && typeof window.HimagoCache.invalidar === 'function') {
      window.HimagoCache.invalidar(proyecto?.id);
    }
  }

  function listarResumenEntidades(tipo, proyectoId) {
    if (window.HimagoCache && typeof window.HimagoCache.listar === 'function') {
      return window.HimagoCache.listar(tipo, proyectoId);
    }
    return llamar(api.entidadListarResumen(tipo, proyectoId));
  }

  function invalidarCacheBloques() {
    if (typeof BloquesRegistro !== 'undefined'
      && typeof BloquesRegistro.invalidarCache === 'function') {
      BloquesRegistro.invalidarCache();
    }
  }

  /** Anula las referencias al formulario anterior para que sus closures no
      retengan inputs, selects enormes ni listeners ya retirados del DOM. */
  function limpiarRefsFormulario() {
    refs.inputs = {};
    refs.camposActuales = null;
    refs.formRel = null;
    refs.guardarRelacionPendiente = null;
    refs.cargarRelacion = null;
    refs.limpiarFormRel = null;
    refs.pintarCampos = null;
    refs.listaRel = null;
    refs.barraCat = null;
    refs.bloqueRelaciones = null;
    refs.bloqueFusiones = null;
    refs.bloqueCuadernos = null;
    refs.btnGuardar = null;
    refs.btnAnadir = null;
    refs.btnGuardarRelacion = null;
    refs.btnCancelarEdicion = null;
    refs.pistaEdicion = null;
  }

  function registrarTarea(tarea) {
    tareasPendientes.add(tarea);
    return () => tareasPendientes.delete(tarea);
  }

  function hayCambiosExternos() {
    for (const tarea of tareasPendientes) {
      if (tarea.hayCambios()) return true;
    }
    return false;
  }

  function hayCambios() {
    return sucio || relacionSucio || hayCambiosExternos();
  }

  /* ---------------- UI ---------------- */

  async function montar(contenedor, proj, opciones = {}) {
    const generacion = ++generacionMontaje;
    cont = contenedor;
    proyecto = proj;
    sucio = false; relacionSucio = false; relacionEnEdicion = null; modo = 'nada'; filaActual = null; filtro = ''; letraActiva = null;
    objetivoBloqueId = opciones.seleccionar && opciones.bloqueId ? Number(opciones.bloqueId) : null;
    objetivoCuadernoId = opciones.seleccionar && opciones.cuadernoId ? Number(opciones.cuadernoId) : null;
    if (temporizadorBusqueda) { clearTimeout(temporizadorBusqueda); temporizadorBusqueda = null; }
    if (temporizadorSnapshot) { clearTimeout(temporizadorSnapshot); temporizadorSnapshot = null; }
    limpiarDeshacer();
    tareasPendientes.clear();
    clavesOrden = new WeakMap();
    clavesSecundarias = new WeakMap();
    limiteDirectorio = LIMITE_DIRECTORIO;
    limiteLista = LIMITE_DIRECTORIO;
    guardandoFicha = false;
    cont.innerHTML = '';

    const raiz = el('div', 'modulo modulo-entidad');
    const barra = el('div', 'ent-barra');
    barra.appendChild(el('h2', 'ent-titulo', def.titulo));

    const buscar = el('input', 'entrada ent-buscar');
    buscar.type = 'search';
    buscar.placeholder = 'Buscar…';
    buscar.addEventListener('input', () => {
      filtro = buscar.value.toLowerCase();
      if (temporizadorBusqueda) clearTimeout(temporizadorBusqueda);
      temporizadorBusqueda = setTimeout(() => {
        temporizadorBusqueda = null;
        limiteDirectorio = LIMITE_DIRECTORIO;
        limiteLista = LIMITE_DIRECTORIO;
        dibujarLista();
        if (refs.tablaDir?.isConnected) dibujarTablaDirectorio();
      }, 150);
    });
    barra.appendChild(buscar);

    const btnNueva = el('button', 'btn btn-primario', `+ ${def.nuevaEtiqueta}`);
    btnNueva.addEventListener('click', async () => {
      if (hayCambios()) {
        const ok = await confirmar('Hay cambios sin guardar en la ficha. ¿Descartarlos y crear una nueva?', 'Cambios sin guardar');
        if (!ok) return;
      }
      abrirFormulario(null);
    });
    barra.appendChild(btnNueva);
    raiz.appendChild(barra);

    const cuerpo = el('div', 'ent-cuerpo');
    refs.lista = el('div', 'ent-lista');
    refs.detalle = el('div', 'ent-detalle');
    refs.lista.addEventListener('click', (ev) => {
      const item = ev.target.closest('.ent-item');
      if (!item) return;
      const fila = lista.find((f) => String(f.id) === item.dataset.id);
      if (fila) seleccionar(fila);
    });
    cuerpo.append(refs.lista, refs.detalle);
    raiz.appendChild(cuerpo);
    cont.appendChild(raiz);

    try {
      const referencias = new Set();
      for (const campo of def.campos) {
        if (campo.tipo === 'entidad') referencias.add(campo.entidad);
        else if (campo.tipo === 'select-lugar') referencias.add('lugar');
        else if (campo.tipo === 'select-persona') referencias.add('persona');
        else if (campo.tipo === 'select-propietario') {
          referencias.add('persona');
          referencias.add('institucion');
        }
      }
      const peticiones = [listarResumenEntidades(def.singularClave(), proyecto.id)];
      for (const ref of referencias) {
        peticiones.push(listarResumenEntidades(ref, proyecto.id));
      }
      const resultado = await Promise.all(peticiones);
      if (generacion !== generacionMontaje) return;
      lista = resultado[0];
      lista.sort(compararEntidades);
      cacheReferencias = { lugar: [], institucion: [], persona: [] };
      [...referencias].forEach((tipoRef, i) => {
        cacheReferencias[tipoRef] = resultado[i + 1];
      });
    } catch (err) {
      if (generacion !== generacionMontaje || !cont || !refs.lista?.isConnected) return;
      refs.lista.appendChild(el('div', 'vacio error', err.message));
      return;
    }

    dibujarLista();
    mostrarDirectorio();

    if (opciones.seleccionar && opciones.seleccionar.tipo === claveTipo()) {
      const fila = lista.find((f) => f.id === Number(opciones.seleccionar.id));
      if (fila) seleccionar(fila);
    }
  }

  /* clave tipo: el api usa 'persona' | 'institucion' | ... igual que la clave */
  function claveTipo() { return def.clave; }
  def.singularClave = def.singularClave || (() => def.clave);

  /* ---------------- Lista ---------------- */

  function dibujarLista() {
    refs.lista.innerHTML = '';
    const visibles = lista.filter(coincideFiltro);
    if (!visibles.length) {
      refs.lista.appendChild(el('div', 'vacio', filtro ? 'Sin resultados.' : 'Sin registros todavía.'));
      return;
    }
    const mostrados = visibles.slice(0, limiteLista);
    for (const f of mostrados) {
      const item = el('div', 'ent-item');
      item.dataset.id = String(f.id);
      item.appendChild(el('div', 'ent-item-titulo', def.etiqueta(f)));
      const resumen = def.resumen(f);
      if (resumen) item.appendChild(el('div', 'ent-item-sub', resumen));
      if (filaActual && f.id === filaActual.id && modo !== 'nuevo') item.classList.add('seleccionado');
      refs.lista.appendChild(item);
    }
    if (visibles.length > mostrados.length) {
      const restantes = visibles.length - mostrados.length;
      const btnMas = el('button', 'btn btn-mini', `Mostrar más (${restantes})`);
      btnMas.type = 'button';
      btnMas.addEventListener('click', () => {
        limiteLista += LIMITE_DIRECTORIO;
        dibujarLista();
      });
      refs.lista.appendChild(btnMas);
    }
  }

  async function seleccionar(fila) {
    const solicitud = ++generacionSeleccion;
    const montaje = generacionMontaje;
    const vigente = () => (
      solicitud === generacionSeleccion
      && montaje === generacionMontaje
      && Boolean(cont)
      && Boolean(refs.lista)
    );
    if (hayCambios()) {
      const ok = await confirmar('Hay cambios sin guardar en la ficha. ¿Descartarlos?', 'Cambios sin guardar');
      if (!ok || !vigente()) return;
    }
    let datos;
    try {
      datos = await llamar(api.entidadObtener(claveTipo(), fila.id, proyecto.id));
    } catch (err) {
      if (!vigente()) return;
      aviso(`No se pudo abrir la ficha: ${err.message}`, 'error');
      return;
    }
    if (!vigente()) return;
    filaActual = datos;
    modo = 'editar';
    sucio = false;
    relacionSucio = false;
    dibujarLista();
    abrirFormulario(datos);
  }

  /* ---------------- Directorio alfabético ---------------- */

  const LETRAS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

  function claveOrden(fila) {
    /* Las personas se ordenan por apellidos (como el listado del archivo);
       el resto de entidades, por su nombre/título. Las partículas iniciales
       («de», «del», «la»…) no desplazan el apellido al final del alfabeto. */
    if (claveTipo() === 'persona') return textoOrdenPersona(fila);
    return def.etiqueta(fila);
  }

  const PARTICULAS_APELLIDO = /^(?:de|del|la|las|los|el|do|da|dos|das)\s+/i;

  function textoOrdenPersona(fila) {
    const original = String(fila.apellidos || '').trim() || String(fila.nombre || '').trim();
    let texto = original;
    let anterior = null;
    while (anterior !== texto) {
      anterior = texto;
      texto = texto.replace(PARTICULAS_APELLIDO, '').trim();
    }
    return texto || original;
  }

  /** Normaliza para comparar: sin tildes, sin distinción de mayúsculas y
      conservando los apellidos compuestos como una sola clave. */
  function normalizarOrden(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es')
      .replace(/[^a-z0-9ñ]+/g, ' ')
      .trim();
  }

  function clavePrimaria(fila, tipo = claveTipo()) {
    if (clavesOrden.has(fila)) return clavesOrden.get(fila);
    const valor = tipo === 'persona'
      ? normalizarOrden(textoOrdenPersona(fila))
      : normalizarOrden(etiquetaEntidad(tipo, fila));
    clavesOrden.set(fila, valor);
    return valor;
  }

  function claveSecundaria(fila) {
    if (clavesSecundarias.has(fila)) return clavesSecundarias.get(fila);
    const valor = normalizarOrden(fila.nombre || fila.apellidos || '');
    clavesSecundarias.set(fila, valor);
    return valor;
  }

  function coincideFiltro(fila) {
    if (!filtro) return true;
    return `${def.etiqueta(fila)} ${def.resumen(fila)}`.toLowerCase().includes(filtro);
  }

  /* Comparador de las listas y del directorio. En PERSONAS la clasificación
     es APELLIDOS y el criterio secundario NOMBRES; quien no tenga apellidos
     se ordena por su nombre. */
  function compararEntidades(a, b) {
    const cmp = colador.compare(clavePrimaria(a), clavePrimaria(b));
    if (cmp) return cmp;
    return colador.compare(claveSecundaria(a), claveSecundaria(b));
  }

  function letraDe(fila) {
    if (letrasCache.has(fila)) return letrasCache.get(fila);
    const crudo = String(claveOrden(fila)).trim();
    let letra;
    if (crudo.charAt(0).toUpperCase() === 'Ñ') {
      letra = 'Ñ';
    } else {
      const sinTildes = normalizarOrden(crudo);
      const primera = sinTildes.charAt(0).toUpperCase();
      letra = /[A-Z]/.test(primera) ? primera : '#';
    }
    letrasCache.set(fila, letra);
    return letra;
  }

  function ordenarEntidades(lista, tipo) {
    return lista.slice().sort((a, b) => {
      const cmp = colador.compare(clavePrimaria(a, tipo), clavePrimaria(b, tipo));
      if (cmp) return cmp;
      return colador.compare(claveSecundaria(a), claveSecundaria(b));
    });
  }

  function mostrarDirectorio() {
    generacionFormulario++;
    generacionSeleccion++;
    modo = 'nada';
    filaActual = null;
    sucio = false;
    relacionSucio = false;
    relacionEnEdicion = null;
    limiteDirectorio = LIMITE_DIRECTORIO;
    tareasPendientes.clear();
    if (refs.limpiarCierreFuentes) {
      refs.limpiarCierreFuentes();
      refs.limpiarCierreFuentes = null;
    }
    limpiarRefsFormulario();
    if (window.FechaHistorica && typeof window.FechaHistorica.cerrar === 'function') {
      window.FechaHistorica.cerrar();
    }
    limpiarDeshacer();
    refs.detalle.innerHTML = '';
    refs.detalle.scrollTop = 0;

    const raizDir = el('div', 'directorio');
    const cabecera = el('div', 'detalle-cabecera');
    cabecera.appendChild(el('h3', 'detalle-titulo', `Directorio de ${def.titulo.toLowerCase()}`));
    raizDir.appendChild(cabecera);
    raizDir.appendChild(el('p', 'pista',
      'Elige una letra para filtrar por inicial. Haz clic en una fila para abrir su ficha.'));

    const abecedario = el('div', 'directorio-abecedario');
    for (const letra of LETRAS) {
      const boton = el('button', 'letra', letra);
      boton.type = 'button';
      boton.title = `Filtrar por «${letra}»`;
      boton.addEventListener('click', () => {
        letraActiva = letraActiva === letra ? null : letra;
        limiteDirectorio = LIMITE_DIRECTORIO;
        dibujarTablaDirectorio();
      });
      abecedario.appendChild(boton);
    }
    refs.abecedario = abecedario;
    raizDir.appendChild(abecedario);

    refs.tablaDir = el('div', 'directorio-tabla');
    raizDir.appendChild(refs.tablaDir);
    refs.detalle.appendChild(raizDir);
    dibujarTablaDirectorio();
    requestAnimationFrame(ajustarAnchosDirectorio);
    if (!escuchaResize) {
      escuchaResize = true;
      alRedimensionar = () => ajustarAnchosDirectorio();
      window.addEventListener('resize', alRedimensionar);
    }
  }

  /* La tabla adopta exactamente el ancho de la fila alfabética: se mide el
     ancho natural de los botones (no el del contenedor estirado) y se aplica
     a la barra y al recuadro de la tabla. */
  function ajustarAnchosDirectorio() {
    if (!refs.abecedario?.isConnected || !refs.tablaDir?.isConnected) return;
    const botones = [...refs.abecedario.children];
    if (!botones.length) return;
    const estilo = getComputedStyle(refs.abecedario);
    const hueco = parseFloat(estilo.columnGap || estilo.gap || '0') || 0;
    const anchoBotones = botones.reduce((suma, b) => suma + b.getBoundingClientRect().width, 0);
    const anchoNatural = anchoBotones + hueco * (botones.length - 1);
    const disponible = refs.detalle.clientWidth
      - (parseFloat(getComputedStyle(refs.detalle).paddingLeft) || 0)
      - (parseFloat(getComputedStyle(refs.detalle).paddingRight) || 0);
    const ancho = Math.max(0, Math.min(anchoNatural, disponible));
    refs.abecedario.style.width = `${ancho}px`;
    refs.tablaDir.style.width = `${ancho}px`;
  }

  function dibujarTablaDirectorio() {
    const contenedor = refs.tablaDir;
    if (!contenedor) return;
    contenedor.innerHTML = '';
    $$('.letra', refs.detalle).forEach((b) => b.classList.toggle('activa', b.textContent === letraActiva));

    const filas = lista
      .filter((f) => (!letraActiva || letraDe(f) === letraActiva) && coincideFiltro(f))
      .slice()
      .sort(compararEntidades);

    if (!filas.length) {
      contenedor.appendChild(el('div', 'vacio',
        letraActiva
          ? `Sin registros en la letra «${letraActiva}».`
          : (filtro ? 'Sin resultados.' : 'Sin registros todavía. Usa «+ Nueva».')));
      return;
    }

    const tabla = document.createElement('table');
    tabla.className = 'tabla-directorio';
    const thead = document.createElement('thead');
    const filaCabecera = document.createElement('tr');
    for (const col of def.columnas) filaCabecera.appendChild(el('th', '', col.titulo));
    thead.appendChild(filaCabecera);
    tabla.appendChild(thead);

    const tbody = document.createElement('tbody');
    const visibles = filas.slice(0, limiteDirectorio);
    const fragmento = document.createDocumentFragment();
    for (const f of visibles) {
      const tr = document.createElement('tr');
      tr.tabIndex = 0;
      tr.dataset.id = String(f.id);
      for (const col of def.columnas) tr.appendChild(el('td', '', String(col.valor(f))));
      fragmento.appendChild(tr);
    }
    tbody.appendChild(fragmento);
    tbody.addEventListener('click', (ev) => {
      const tr = ev.target.closest('tr[data-id]');
      if (!tr) return;
      const fila = filas.find((f) => String(f.id) === tr.dataset.id);
      if (fila) seleccionar(fila);
    });
    tbody.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const tr = ev.target.closest('tr[data-id]');
      if (!tr) return;
      ev.preventDefault();
      const fila = filas.find((f) => String(f.id) === tr.dataset.id);
      if (fila) seleccionar(fila);
    });
    tabla.appendChild(tbody);
    contenedor.appendChild(tabla);
    if (filas.length > visibles.length) {
      const pie = el('div', 'directorio-pie');
      const restantes = filas.length - visibles.length;
      const btnMas = el('button', 'btn btn-mini', `Mostrar ${Math.min(LIMITE_DIRECTORIO, restantes)} más (${restantes} restantes)`);
      btnMas.type = 'button';
      btnMas.addEventListener('click', () => {
        limiteDirectorio += LIMITE_DIRECTORIO;
        dibujarTablaDirectorio();
      });
      pie.appendChild(btnMas);
      contenedor.appendChild(pie);
    }
  }

  /* ---------------- Ficha ---------------- */

  function snapshotFormulario() {
    const snap = {};
    for (const [clave, entrada] of Object.entries(refs.inputs || {})) {
      snap[clave] = {
        valor: entrada.value,
        meta: entrada._meta !== undefined ? JSON.parse(JSON.stringify(entrada._meta)) : undefined,
      };
    }
    return snap;
  }

  function reiniciarDeshacer() {
    if (temporizadorSnapshot) { clearTimeout(temporizadorSnapshot); temporizadorSnapshot = null; }
    pilaDeshacer = [];
    bytesPilaDeshacer = 0;
    estadoFormulario = snapshotFormulario();
    estadoInicialFormulario = estadoFormulario
      ? JSON.parse(JSON.stringify(estadoFormulario))
      : null;
  }

  function limpiarDeshacer() {
    if (temporizadorSnapshot) { clearTimeout(temporizadorSnapshot); temporizadorSnapshot = null; }
    pilaDeshacer = [];
    bytesPilaDeshacer = 0;
    estadoFormulario = null;
    estadoInicialFormulario = null;
  }

  function registrarCambioFormulario() {
    if (deshaciendo) return;
    if (temporizadorSnapshot) clearTimeout(temporizadorSnapshot);
    const generacion = generacionMontaje;
    temporizadorSnapshot = setTimeout(() => {
      temporizadorSnapshot = null;
      if (generacion !== generacionMontaje || deshaciendo || !refs.inputs) return;
      const actual = snapshotFormulario();
      if (!estadoFormulario) {
        estadoFormulario = actual;
        return;
      }
      const serializado = JSON.stringify(actual);
      if (serializado.length > 5_000_000) return;
      if (serializado === JSON.stringify(estadoFormulario)) return;
      const bytes = JSON.stringify(estadoFormulario).length;
      pilaDeshacer.push({ estado: estadoFormulario, bytes });
      bytesPilaDeshacer += bytes;
      while (pilaDeshacer.length > 50 || bytesPilaDeshacer > LIMITE_BYTES_DESHACER) {
        const descartado = pilaDeshacer.shift();
        bytesPilaDeshacer -= descartado.bytes;
      }
      estadoFormulario = actual;
      sucio = true;
      document.dispatchEvent(new CustomEvent('himago:cambios'));
    }, 300);
  }

  function aplicarSnapshotFormulario(snap) {
    deshaciendo = true;
    const esFuente = def.clave === 'fuente';
    const categoriaSnap = snap.categoria?.valor;
    const tipoSnap = snap.tipo?.valor;
    const categoriaActual = refs.inputs.categoria?.value;
    const tipoActual = refs.inputs.tipo?.value;
    if (esFuente && (categoriaSnap !== categoriaActual || tipoSnap !== tipoActual)) {
      const valores = {};
      for (const [clave, dato] of Object.entries(snap)) valores[clave] = dato.valor;
      if (typeof refs.pintarCampos === 'function') {
        refs.pintarCampos(valores, { reiniciar: false });
      }
    }
    for (const [clave, entrada] of Object.entries(refs.inputs || {})) {
      const dato = snap[clave];
      if (!dato) continue;
      entrada.value = dato.valor;
      if (dato.meta !== undefined) entrada._meta = JSON.parse(JSON.stringify(dato.meta));
    }
    deshaciendo = false;
    estadoFormulario = snapshotFormulario();
    sucio = estadoInicialFormulario
      ? JSON.stringify(estadoFormulario) !== JSON.stringify(estadoInicialFormulario)
      : true;
    document.dispatchEvent(new CustomEvent('himago:cambios'));
  }

  function deshacerFormulario() {
    if (temporizadorSnapshot) { clearTimeout(temporizadorSnapshot); temporizadorSnapshot = null; }
    if (!pilaDeshacer.length) return false;
    const anterior = pilaDeshacer.pop();
    bytesPilaDeshacer -= anterior.bytes;
    aplicarSnapshotFormulario(anterior.estado);
    return true;
  }

  function valorParaImpresion(campo, fila) {
    const valor = fila[campo.clave];
    if (campo.tipo === 'entidad') {
      const lista = cacheReferencias[campo.entidad] || [];
      const encontrado = lista.find((x) => String(x.id) === String(valor));
      return encontrado ? etiquetaEntidad(campo.entidad, encontrado) : (valor ?? '');
    }
    return valor ?? '';
  }

  function imprimirFicha(fila) {
    const zona = document.querySelector('#zona-impresion');
    if (!zona) return;
    zona.innerHTML = '';
    const doc = el('div', 'impresion-ficha');
    doc.appendChild(el('div', 'impresion-marca', 'H-IMAGO'));
    doc.appendChild(el('h1', 'impresion-titulo', def.etiqueta(fila)));
    if (fila.identificador) doc.appendChild(el('p', 'impresion-id', fila.identificador));
    doc.appendChild(el('p', 'impresion-meta', `${def.titulo} · ${proyecto.nombre}`));

    doc.appendChild(el('h2', '', 'Datos de la ficha'));
    const tabla = el('table', 'impresion-tabla');
    const campos = refs.camposActuales || def.campos;
    for (const campo of campos) {
      const valor = valorParaImpresion(campo, fila);
      const tr = el('tr');
      tr.appendChild(el('th', '', campo.etiqueta.replace(' *', '')));
      tr.appendChild(el('td', '', valor == null || valor === '' ? '—' : String(valor)));
      tabla.appendChild(tr);
    }
    doc.appendChild(tabla);

    doc.appendChild(el('h2', '', 'Relaciones'));
    const relaciones = relacionesPropias();
    if (!relaciones.length) {
      doc.appendChild(el('p', 'impresion-vacio', 'Sin relaciones registradas.'));
    } else {
      const tablaRel = el('table', 'impresion-tabla impresion-relaciones');
      const thead = el('thead');
      const cab = el('tr');
      for (const titulo of ['Relación', 'Tipo', 'Procedencia', 'Fechas', 'Lugares', 'Fuentes', 'Notas']) {
        cab.appendChild(el('th', '', titulo));
      }
      thead.appendChild(cab);
      tablaRel.appendChild(thead);
      const tbody = el('tbody');
      for (const r of relaciones) {
        const fechas = [
          r.fecha_exacta_inicio || r.anio_inicio || '',
          r.fecha_exacta_fin || r.anio_fin || '',
        ].filter((v) => v !== '' && v != null).join(' – ');
        const lugares = [r.lugar_inicio_nombre, r.lugar_fin_nombre].filter(Boolean).join(' → ');
        const fuentes = (r.fuentes || [])
          .map((f) => (typeof f === 'object' ? f.titulo : f))
          .filter(Boolean).join(', ');
        const tr = el('tr');
        const flecha = typeof window.flechaRelacion === 'function'
          ? window.flechaRelacion(r.tipo)
          : '→';
        tr.appendChild(el('td', '', `${r.origen_nombre} ${flecha} ${r.destino_nombre}`));
        tr.appendChild(el('td', '', r.tipo || '—'));
        tr.appendChild(el('td', '', r.procedencia || 'MANUAL'));
        tr.appendChild(el('td', '', fechas || '—'));
        tr.appendChild(el('td', '', lugares || '—'));
        tr.appendChild(el('td', '', fuentes || '—'));
        tr.appendChild(el('td', '', r.notas || '—'));
        tbody.appendChild(tr);
      }
      tablaRel.appendChild(tbody);
      doc.appendChild(tablaRel);
    }
    doc.appendChild(el('p', 'impresion-pie', `Impreso el ${new Date().toLocaleString('es-ES')}`));
    zona.appendChild(doc);

    let limpiarTimer = null;
    const limpiar = () => {
      if (limpiarTimer) { clearTimeout(limpiarTimer); limpiarTimer = null; }
      zona.innerHTML = '';
    };
    window.addEventListener('afterprint', limpiar, { once: true });
    limpiarTimer = setTimeout(limpiar, 30000);
    window.print();
  }

  function abrirFormulario(fila) {
    generacionFormulario++;
    generacionRelaciones++;
    generacionSeleccion++;
    filaActual = fila;
    modo = fila ? 'editar' : 'nuevo';
    sucio = false;
    relacionSucio = false;
    tareasPendientes.clear();
    if (refs.limpiarCierreFuentes) {
      refs.limpiarCierreFuentes();
      refs.limpiarCierreFuentes = null;
    }
    limpiarRefsFormulario();
    if (window.FechaHistorica && typeof window.FechaHistorica.cerrar === 'function') {
      window.FechaHistorica.cerrar();
    }
    filtroCategoriaRel = null;
    relacionEnEdicion = null;
    cacheRel = [];
    cacheEnt = {};
    cacheFuentes = [];
    refs.detalle.innerHTML = '';
    refs.detalle.scrollTop = 0;

    const cabecera = el('div', 'detalle-cabecera');
    const bloqueTitulo = el('div', 'detalle-titulo-bloque');
    bloqueTitulo.appendChild(el('h3', 'detalle-titulo', fila ? def.etiqueta(fila) : def.nuevaEtiqueta));
    if (fila && fila.identificador) {
      bloqueTitulo.appendChild(el('span', 'identificador-entidad', fila.identificador));
    }
    cabecera.appendChild(bloqueTitulo);

    const acciones = el('div', 'detalle-acciones');
    const btnDirectorio = el('button', 'btn btn-mini', '☰ Directorio');
    btnDirectorio.title = 'Volver al directorio alfabético';
    btnDirectorio.addEventListener('click', async () => {
      if (hayCambios()) {
        const ok = await confirmar('Hay cambios sin guardar. ¿Descartarlos y volver al directorio?', 'Cambios sin guardar');
        if (!ok) return;
      }
      mostrarDirectorio();
    });
    acciones.appendChild(btnDirectorio);
    if (fila && def.relaciones) {
      const btnGrafo = el('button', 'btn btn-mini', 'Ver grafo');
      btnGrafo.title = 'Ver este nodo en la vista de grafo';
      btnGrafo.addEventListener('click', () => {
        navegar('grafo', { seleccionar: { tipo: claveTipo(), id: fila.id } });
      });
      acciones.appendChild(btnGrafo);
    }
    const btnGuardar = el('button', 'btn btn-primario', 'Guardar');
    btnGuardar.addEventListener('click', () => guardarFormulario());
    acciones.appendChild(btnGuardar);
    refs.btnGuardar = btnGuardar;
    if (fila) {
      const btnEliminar = el('button', 'btn btn-peligroso', 'Eliminar');
      btnEliminar.addEventListener('click', eliminarFila);
      acciones.appendChild(btnEliminar);
      if (def.relaciones) {
        const btnImprimir = el('button', 'btn btn-mini btn-imprimir');
        btnImprimir.type = 'button';
        btnImprimir.title = 'Imprimir ficha y relaciones';
        btnImprimir.innerHTML =
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
          + '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>'
          + '<span>IMPRIMIR</span>';
        btnImprimir.addEventListener('click', () => imprimirFicha(fila));
        acciones.appendChild(btnImprimir);
      }
    }
    cabecera.appendChild(acciones);
    refs.detalle.appendChild(cabecera);

    const grid = el('div', 'campos-grid');
    refs.detalle.appendChild(grid);

    const valoresBase = fila ? { ...fila } : {};

    function camposDeFormulario(valores) {
      return def.camposDinamicos ? def.camposDinamicos(valores) : def.campos;
    }

    function pintarCampos(valores, { reiniciar = true } = {}) {
      grid.innerHTML = '';
      refs.inputs = {};
      refs.camposActuales = camposDeFormulario(valores);
      for (let i = 0; i < refs.camposActuales.length; i++) {
        const campo = refs.camposActuales[i];
        let claveAnio = null;
        if (campo.tipo === 'fecha-historica') {
          for (let j = i - 1; j >= 0; j--) {
            if (refs.camposActuales[j].tipo === 'anio') { claveAnio = refs.camposActuales[j].clave; break; }
          }
          if (!claveAnio) {
            for (let j = i + 1; j < refs.camposActuales.length; j++) {
              if (refs.camposActuales[j].tipo === 'anio') { claveAnio = refs.camposActuales[j].clave; break; }
            }
          }
        }
        refs.inputs[campo.clave] = dibujarCampo(grid, campo, valores, {
          anioReferencia: claveAnio ? () => refs.inputs[claveAnio]?.value : null,
        });
      }
      if (def.clave === 'fuente') conectarFormularioFuente(valores);
      if (reiniciar) reiniciarDeshacer();
      else estadoFormulario = snapshotFormulario();
    }

    pintarCampos(valoresBase);
    refs.pintarCampos = pintarCampos;
    grid.addEventListener('input', registrarCambioFormulario);
    grid.addEventListener('change', registrarCambioFormulario);

    /* Fuentes: cuadernos de transcripción bajo el formulario */
    if (def.clave === 'fuente') montarCuadernos(fila);

    /* Fuentes: la variante del formulario depende de categoría + tipo */
    function conectarFormularioFuente(valores) {
      conectarTaxonomiaFuentes();
      const selCategoria = refs.inputs.categoria;
      const selTipo = refs.inputs.tipo;
      if (!selCategoria || !selTipo) return;
      const rehacer = () => {
        if (estadoFormulario) {
          const anterior = estadoFormulario;
          const bytes = JSON.stringify(anterior).length;
          pilaDeshacer.push({ estado: anterior, bytes });
          bytesPilaDeshacer += bytes;
          while (pilaDeshacer.length > 50 || bytesPilaDeshacer > LIMITE_BYTES_DESHACER) {
            const descartado = pilaDeshacer.shift();
            bytesPilaDeshacer -= descartado.bytes;
          }
        }
        const actuales = { ...valores };
        for (const [clave, entrada] of Object.entries(refs.inputs)) actuales[clave] = entrada.value;
        pintarCampos(actuales, { reiniciar: false });
        sucio = true;
        notificarCambios();
      };
      selCategoria.addEventListener('change', rehacer);
      selTipo.addEventListener('change', rehacer);
    }

    if (def.relaciones) {
      refs.bloqueRelaciones = el('div', 'bloque-relaciones');
      refs.detalle.appendChild(refs.bloqueRelaciones);
      if (fila) prepararRelaciones(); else dibujarRelacionesVacias();

      refs.bloqueFusiones = el('div', 'bloque-fusiones');
      refs.detalle.appendChild(refs.bloqueFusiones);
      if (fila) montarFusiones(fila);
      else refs.bloqueFusiones.appendChild(el('div', 'pista', 'Guarda el registro para gestionar fusiones y coincidencias.'));
    }
  }

  /** Fuentes: la categoría filtra los tipos del selector contiguo. */
  function conectarTaxonomiaFuentes() {
    const selCategoria = refs.inputs.categoria;
    const selTipo = refs.inputs.tipo;
    if (!selCategoria || !selTipo) return;

    const repoblar = (conservar) => {
      const categoria = selCategoria.value;
      const actual = conservar ? selTipo.value : '';
      selTipo.innerHTML = '';
      selTipo.appendChild(new Option('— tipo de fuente —', ''));
      const grupos = categoria && FUENTES_TAXONOMIA[categoria]
        ? [[categoria, FUENTES_TAXONOMIA[categoria]]]
        : Object.entries(FUENTES_TAXONOMIA);
      for (const [nombre, tipos] of grupos) {
        const grupo = el('optgroup');
        grupo.label = nombre;
        for (const tipo of tipos) grupo.appendChild(new Option(tipo, tipo));
        selTipo.appendChild(grupo);
      }
      if (actual && ![...selTipo.options].some((op) => op.value === actual)) {
        selTipo.appendChild(new Option(`(actual) ${actual}`, actual));
      }
      if (actual) selTipo.value = actual;
    };

    /* Al editar, si sólo consta el tipo, deducir su categoría */
    if (!selCategoria.value && selTipo.value) {
      const deducida = categoriaDeTipoFuente(selTipo.value);
      if (deducida) selCategoria.value = deducida;
    }
    selCategoria.addEventListener('change', () => repoblar(true));
    repoblar(true);
  }

  /* ---------------- Cuadernos de transcripción (Fuentes) ---------------- */

  function recolectarSugerenciasBloques(bloques) {
    const mapa = { '*': new Set() };
    const agregar = (clave, valor) => {
      const texto = String(valor == null ? '' : valor).replace(/\s+/g, ' ').trim();
      if (!texto || texto.length > 160) return;
      const normalizada = String(clave || '').trim().toUpperCase();
      (mapa[normalizada] ||= new Set()).add(texto);
      mapa['*'].add(texto);
      if (/^-?\d{3,4}$/.test(texto)) (mapa.ANIO ||= new Set()).add(texto);
    };
    const equivalencias = {
      nombres: 'NOMBRES', nombre: 'NOMBRE', apellidos: 'APELLIDOS',
      empleo: 'EMPLEO/OFICIO', institucion_texto: 'INSTITUCIÓN',
      institucion: 'INSTITUCIÓN', lugar: 'LUGAR', tipo: 'TIPO',
      titulo: 'TÍTULO', materia: 'MATERIA', valor: 'VALOR/TASACIÓN', item: 'ÍTEM',
    };
    const recorrer = (nodo) => {
      if (Array.isArray(nodo)) {
        nodo.forEach(recorrer);
        return;
      }
      if (!nodo || typeof nodo !== 'object') return;
      for (const [clave, valor] of Object.entries(nodo)) {
        if (/_meta$/i.test(clave) || clave === 'meta') continue;
        if (typeof valor === 'string' || typeof valor === 'number') {
          agregar(equivalencias[clave] || '*', valor);
        } else {
          recorrer(valor);
        }
      }
    };
    for (const bloque of bloques) recorrer(bloque.datos || {});
    return Object.fromEntries(
      Object.entries(mapa).map(([clave, valores]) => [
        clave,
        [...valores]
          .filter((valor) => clave !== '*' || /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(valor))
          .slice(0, 500),
      ])
    );
  }

  async function montarCuadernos(fuente) {
    const generacion = generacionFormulario;
    const bloqueObjetivo = objetivoBloqueId;
    const cuadernoObjetivo = objetivoCuadernoId;
    objetivoBloqueId = null;
    objetivoCuadernoId = null;
    const fuenteId = fuente ? fuente.id : null;
    if (!fuenteId) {
      const bloque = el('div', 'bloque-cuadernos');
      refs.bloqueCuadernos = bloque;
      bloque.appendChild(el('p', 'pista',
        'Guarda la fuente para comenzar a añadir cuadernos de transcripción y bloques de registro.'));
      refs.detalle.appendChild(bloque);
      return;
    }
    if (generacion !== generacionFormulario || !refs.detalle?.isConnected) return;
    const bloque = el('div', 'bloque-cuadernos');
    refs.bloqueCuadernos = bloque;

    let modulosListos = false;
    let promesaModulos = null;
    async function asegurarModulos() {
      if (modulosListos) return true;
      if (promesaModulos) return promesaModulos;
      promesaModulos = cargarModulosBloques().then(
        () => { modulosListos = true; return true; },
        (err) => {
          aviso(`No se pudieron cargar los formularios de bloques: ${err.message}`, 'error');
          promesaModulos = null;
          return false;
        }
      );
      return promesaModulos;
    }

    const barra = el('div', 'cuadernos-barra');
    const btnCuaderno = el('button', 'btn btn-mini', '+ Añadir cuaderno');
    const btnBloque = el('button', 'btn btn-mini', '+ Añadir bloque de registro');
    const btnOrdenBloques = el('button', 'btn btn-mini', 'Más recientes primero');
    btnOrdenBloques.title = 'Cambiar el orden de los bloques de registro';
    btnOrdenBloques.hidden = true;
    barra.append(btnCuaderno, btnBloque, btnOrdenBloques);
    const lista = el('div', 'cuadernos-lista');
    let ordenBloques = 'asc';
    let sugerenciasBloques = {};
    let creandoBloque = false;
    let creandoCuaderno = false;
    let cargasIniciales = 0;
    let liberarCargaInicial = null;

    /* Panel de bloques de registro: periodos → tipos de formulario */
    const panelBloques = el('div', 'bloques-registro');
    panelBloques.hidden = true;
    const cabBloques = el('div', 'bloques-cabecera');
    cabBloques.appendChild(el('span', 'bloques-titulo', 'Bloque de registro'));
    const btnCerrarBloques = el('button', 'btn btn-mini', '✕');
    btnCerrarBloques.title = 'Cerrar el selector de bloques';
    cabBloques.appendChild(btnCerrarBloques);

    let periodoActivo = PERIODOS_BLOQUES.find((p) => p.habilitado) || null;
    let regionActiva = ETIQUETAS_ESPACIALES.find((r) => r.habilitado) || null;

    const contextoBloques = el('div', 'bloques-contexto');

    const filaTemporal = el('div', 'bloques-filtro');
    filaTemporal.appendChild(el('span', 'bloques-filtro-etiqueta', 'Etiqueta temporal'));
    const barraPeriodos = el('div', 'bloques-periodos');
    for (const periodo of PERIODOS_BLOQUES) {
      const boton = el('button', `bloques-periodo${periodo.habilitado ? '' : ' deshabilitado'}`, periodo.etiqueta);
      boton.type = 'button';
      boton.disabled = !periodo.habilitado;
      if (periodo.habilitado) {
        if (periodoActivo && periodo.clave === periodoActivo.clave) boton.classList.add('activo');
        boton.addEventListener('click', () => {
          periodoActivo = periodo;
          for (const hermano of barraPeriodos.children) {
            hermano.classList.toggle('activo', hermano === boton);
          }
          actualizarListaBloques();
        });
      } else {
        boton.title = 'Etiqueta temporal aún no disponible';
      }
      barraPeriodos.appendChild(boton);
    }
    filaTemporal.appendChild(barraPeriodos);

    const filaEspacial = el('div', 'bloques-filtro');
    filaEspacial.appendChild(el('span', 'bloques-filtro-etiqueta', 'Etiqueta espacial'));
    const barraRegiones = el('div', 'bloques-regiones');
    for (const region of ETIQUETAS_ESPACIALES) {
      const boton = el('button', `bloques-region${region.habilitado ? '' : ' deshabilitado'}`, region.etiqueta);
      boton.type = 'button';
      boton.disabled = !region.habilitado;
      if (region.habilitado) {
        if (regionActiva && region.clave === regionActiva.clave) boton.classList.add('activo');
        boton.addEventListener('click', () => {
          regionActiva = region;
          for (const hermano of barraRegiones.children) {
            hermano.classList.toggle('activo', hermano === boton);
          }
          actualizarListaBloques();
        });
      } else {
        boton.title = 'Etiqueta espacial aún no disponible';
      }
      barraRegiones.appendChild(boton);
    }
    filaEspacial.appendChild(barraRegiones);

    const listaBloques = el('div', 'bloques-lista');
    listaBloques.hidden = true;
    const listaBloquesReg = el('div', 'bloques-registrados');
    panelBloques.append(cabBloques, filaTemporal, filaEspacial, contextoBloques, listaBloques);
    bloque.append(barra, panelBloques, listaBloquesReg, lista);
    refs.detalle.appendChild(bloque);

    function actualizarListaBloques() {
      listaBloques.innerHTML = '';
      listaBloques.hidden = false;
      if (!periodoActivo || !regionActiva) {
        contextoBloques.textContent = '';
        listaBloques.appendChild(el('p', 'pista', 'Selecciona una etiqueta temporal y una espacial.'));
        return;
      }
      contextoBloques.textContent = `${regionActiva.etiqueta} · ${periodoActivo.etiqueta}`;
      const bloques = bloquesDeContexto(periodoActivo.clave, regionActiva.clave);
      if (!bloques) {
        listaBloques.appendChild(el('p', 'pista', 'Aún no hay formularios para esta combinación de etiquetas.'));
        return;
      }
      for (const [categoria, nombres] of Object.entries(bloques)) {
        const grupo = el('div', 'bloques-grupo');
        grupo.appendChild(el('div', 'bloques-grupo-titulo', categoria));
        const opciones = el('div', 'bloques-opciones');
        for (const nombre of nombres) {
          const boton = el('button', 'btn btn-mini bloque-opcion', nombre);
          boton.type = 'button';
          boton.addEventListener('click', () => {
            for (const hermano of listaBloques.querySelectorAll('.bloque-opcion')) {
              hermano.classList.toggle('seleccionado', hermano === boton);
            }
            abrirNuevoBloque(nombre, categoria, periodoActivo, regionActiva);
          });
          opciones.appendChild(boton);
        }
        grupo.appendChild(opciones);
        listaBloques.appendChild(grupo);
      }
    }

    function aplicarOrdenBloques() {
      const tarjetas = [...listaBloquesReg.querySelectorAll('.bloque-registrado')];
      tarjetas.sort((a, b) => {
        const fechaA = Number(a.dataset.creado || 0);
        const fechaB = Number(b.dataset.creado || 0);
        if (fechaA !== fechaB) return fechaA - fechaB;
        return Number(a.dataset.bloqueId || 0) - Number(b.dataset.bloqueId || 0);
      });
      if (ordenBloques === 'desc') tarjetas.reverse();
      for (const tarjeta of tarjetas) listaBloquesReg.appendChild(tarjeta);
      btnOrdenBloques.textContent = ordenBloques === 'asc'
        ? 'Más recientes primero'
        : 'Más antiguos primero';
      btnOrdenBloques.hidden = tarjetas.length === 0;
    }

    btnOrdenBloques.addEventListener('click', () => {
      ordenBloques = ordenBloques === 'asc' ? 'desc' : 'asc';
      aplicarOrdenBloques();
    });

    actualizarListaBloques();

    btnCerrarBloques.addEventListener('click', () => {
      panelBloques.hidden = true;
      btnBloque.classList.remove('modo-activo');
    });

    async function abrirNuevoBloque(nombre, categoria, periodo, region) {
      if (creandoBloque) return;
      if (!fuenteId) {
        aviso('Guarda la fuente antes de añadir bloques de registro.', 'error');
        return;
      }
      if (!await asegurarModulos()) return;
      const esquema = FORMULARIOS_BLOQUES[nombre];
      if (!esquema) { aviso('Formulario no disponible.', 'error'); return; }
      creandoBloque = true;
      try {
        const registro = await llamar(api.bloqueCrear(fuenteId, {
          periodo: periodo.clave,
          region: region ? region.clave : 'hispanoamerica',
          tipo: nombre,
          categoria,
        }, proyecto.id));
        if (!listaBloquesReg.isConnected) return;
        listaBloquesReg.appendChild(crearTarjetaBloque(registro, esquema, { abrirEditor: true }));
        aplicarOrdenBloques();
        panelBloques.hidden = true;
        btnBloque.classList.remove('modo-activo');
        aviso(`Bloque «${nombre}» creado`, 'exito');
      } catch (err) { aviso(err.message, 'error'); }
      finally { creandoBloque = false; }
    }

    function crearTarjetaBloque(registro, esquema, { abrirEditor = false } = {}) {
      const tarjeta = el('div', 'bloque-registrado');
      tarjeta.dataset.bloqueId = String(registro.id);
      const fechaCreacion = registro.fecha_creacion
        ? new Date(registro.fecha_creacion).getTime()
        : NaN;
      tarjeta.dataset.creado = Number.isFinite(fechaCreacion) ? String(fechaCreacion) : '';
      const cabecera = el('div', 'bloque-registrado-cab');
      const titulo = el('div', 'bloque-registrado-titulo');
      titulo.appendChild(el('span', 'bloque-tipo', registro.tipo));
      if (registro.categoria) titulo.appendChild(el('span', 'bloque-categoria', registro.categoria));
      const etiquetaPeriodo = PERIODOS_BLOQUES.find((p) => p.clave === registro.periodo)?.etiqueta
        || registro.periodo || '';
      const etiquetaRegion = ETIQUETAS_ESPACIALES.find((r) => r.clave === registro.region)?.etiqueta
        || ETIQUETAS_ESPACIALES.find((r) => r.clave === 'hispanoamerica')?.etiqueta || '';
      if (etiquetaRegion || etiquetaPeriodo) {
        titulo.appendChild(el('span', 'bloque-contexto', `${etiquetaRegion} · ${etiquetaPeriodo}`));
      }
      cabecera.appendChild(titulo);

      const acciones = el('div', 'bloque-registrado-acciones');
      const btnEditar = el('button', 'btn btn-mini', 'EDITAR');
      const btnImportar = el('button', 'btn btn-mini', 'IMPORTAR');
      const btnDescargar = el('button', 'btn btn-mini', 'DESCARGAR');
      const btnGuardar = el('button', 'btn btn-mini btn-primario', 'GUARDAR');
      const btnCancelar = el('button', 'btn btn-mini', 'CANCELAR');
      const btnCerrar = el('button', 'btn btn-mini', 'CERRAR');
      const btnEliminar = el('button', 'btn btn-mini btn-peligroso', 'ELIMINAR');
      btnImportar.title = 'Importar un bloque del mismo tipo desde un archivo JSON';
      btnDescargar.title = 'Descargar este bloque como archivo JSON';
      acciones.append(btnEditar, btnImportar, btnDescargar, btnGuardar, btnCancelar, btnCerrar, btnEliminar);
      cabecera.appendChild(acciones);
      tarjeta.appendChild(cabecera);

      const cuerpo = el('div', 'bloque-cuerpo');
      tarjeta.appendChild(cuerpo);

      let editor = null;
      let guardado = registro.datos || {};
      let datosCargados = !registro._resumen;
      let editorSucio = false;
      let quitarTarea = null;
      let guardadoBloquePromesa = null;
      let cargaDatosPromesa = null;

      async function asegurarDatos() {
        if (datosCargados) return true;
        if (cargaDatosPromesa) return cargaDatosPromesa;
        if (!window.api || typeof window.api.bloqueObtener !== 'function') {
          aviso('Esta versión no puede cargar el bloque bajo demanda.', 'error');
          return false;
        }
        cargaDatosPromesa = (async () => {
          try {
            const fila = await llamar(window.api.bloqueObtener(registro.id, proyecto.id));
            if (!tarjeta.isConnected) return false;
            if (fila.datosInvalidos) {
              aviso('El bloque tiene datos dañados; no se puede editar hasta repararlo.', 'error');
              return false;
            }
            guardado = fila.datos || {};
            registro.datos = guardado;
            datosCargados = true;
            return true;
          } catch (err) {
            aviso(`No se pudo cargar el bloque: ${err.message}`, 'error');
            return false;
          }
        })().finally(() => { cargaDatosPromesa = null; });
        return cargaDatosPromesa;
      }

      const resumen = () => {
        if (quitarTarea) { quitarTarea(); quitarTarea = null; }
        editor = null;
        editorSucio = false;
        cuerpo.innerHTML = '';
        if (!datosCargados) {
          cuerpo.appendChild(el('div', 'pista',
            'Bloque guardado. Pulsa «EDITAR» para cargar y editar su contenido.'));
          return;
        }
        const completos = (typeof BloquesRegistro !== 'undefined'
          && typeof BloquesRegistro.datosRegistro === 'function')
          ? BloquesRegistro.datosRegistro(esquema, guardado)
          : { titulo: '', signatura: '' };
        if (completos.titulo) {
          cuerpo.appendChild(el('div', 'bloque-resumen-titulo', completos.titulo));
        }
        cuerpo.appendChild(el('div', 'bloque-resumen-signatura',
          `SIGNATURA · ${completos.signatura || '—'}`));
        cuerpo.appendChild(el('div', 'pista', 'Bloque guardado. Pulsa «EDITAR» para abrirlo.'));
        notificarCambios();
      };

      const actualizarBotones = (editando) => {
        btnEditar.hidden = editando;
        btnImportar.hidden = editando;
        btnDescargar.hidden = editando;
        btnGuardar.hidden = !editando;
        btnCancelar.hidden = !editando;
        btnCerrar.hidden = !editando;
        btnEliminar.hidden = editando;
      };

      async function guardarEditor() {
        if (!editor) return true;
        /* Si ya hay una petición en vuelo, todos los llamadores esperan la
           misma promesa; nunca se devuelve un éxito prematuro. */
        if (guardadoBloquePromesa) return guardadoBloquePromesa;
        guardadoBloquePromesa = (async () => {
          const datos = editor.obtenerDatos();
          await llamar(api.bloqueActualizar(registro.id, datos, proyecto.id));
          guardado = datos;
          registro.datos = datos;
          editorSucio = false;
          notificarCambios();
          return true;
        })();
        try {
          return await guardadoBloquePromesa;
        } finally {
          guardadoBloquePromesa = null;
        }
      }

      async function cerrarEditorConAviso() {
        if (editorSucio) {
          const ok = await confirmar(
            'Hay cambios sin guardar en este bloque de registro. ¿Descartarlos?',
            'Cambios sin guardar'
          );
          if (!ok) return;
        }
        resumen();
        actualizarBotones(false);
      }

      async function abrir() {
        cuerpo.innerHTML = '';
        cuerpo.appendChild(el('div', 'pista', 'Cargando formulario…'));
        if (!await asegurarDatos()) {
          if (tarjeta.isConnected) {
            cuerpo.innerHTML = '';
            cuerpo.appendChild(el('div', 'vacio error', 'No se pudo cargar el contenido del bloque.'));
          }
          return;
        }
        const marcar = () => {
          if (!editorSucio) {
            editorSucio = true;
            notificarCambios();
          }
        };
        try {
          editor = await BloquesRegistro.crearEditor(esquema, guardado, {
            proyectoId: proyecto.id,
            sugerencias: sugerenciasBloques,
            marcarCambio: marcar,
          });
          if (!tarjeta.isConnected) return;
          cuerpo.innerHTML = '';
          cuerpo.appendChild(editor.elemento);
          editorSucio = false;
          if (quitarTarea) quitarTarea();
          quitarTarea = registrarTarea({
            hayCambios: () => editorSucio,
            guardar: guardarEditor,
          });
          editor.elemento.addEventListener('input', marcar);
          editor.elemento.addEventListener('change', marcar);
          actualizarBotones(true);
        } catch (err) {
          cuerpo.innerHTML = '';
          cuerpo.appendChild(el('div', 'vacio error', err.message));
        }
      }

      actualizarBotones(false);
      if (abrirEditor) abrir();
      else resumen();

      btnEditar.addEventListener('click', abrir);
      btnDescargar.addEventListener('click', async () => {
        try {
          const r = await llamar(api.bloqueExportar(registro.id, proyecto.id));
          if (!r.cancelado) aviso(`Bloque descargado en «${r.ruta}»`, 'exito');
        } catch (err) { aviso(err.message, 'error'); }
      });
      btnImportar.addEventListener('click', async () => {
        const ok = await confirmar(
          `Se reemplazará el contenido guardado del bloque «${registro.tipo}» `
          + 'por el archivo que elijas. Las relaciones editadas se conservan. ¿Continuar?',
          'Importar bloque'
        );
        if (!ok) return;
        try {
          const r = await llamar(api.bloqueImportar(registro.id, proyecto.id));
          if (r.cancelado) return;
          guardado = r.bloque?.datos || {};
          registro.datos = guardado;
          resumen();
          actualizarBotones(false);
          const creadas = Object.values(r.creadas || {}).reduce((a, b) => a + b, 0);
          const reutilizadas = Object.values(r.reutilizadas || {}).reduce((a, b) => a + b, 0);
          const homonimos = Number(r.homonimosPreservados || 0);
          const detalle = !creadas && !reutilizadas
            ? ''
            : ` · ${creadas} entidades nuevas, ${reutilizadas} reutilizadas`
              + (homonimos ? `, ${homonimos} homónimos preservados` : '');
          invalidarCacheBloques();
          invalidarCacheEntidades();
          notificarContadores();
          aviso(`Bloque importado${detalle}`, 'exito');
        } catch (err) { aviso(err.message, 'error'); }
      });
      btnGuardar.addEventListener('click', async () => {
        if (!editor) return;
        btnGuardar.disabled = true;
        try {
          const ok = await guardarEditor();
          if (!ok) return;
          aviso('Bloque de registro guardado', 'exito');
          resumen();
          actualizarBotones(false);
        } catch (err) {
          aviso(err.message, 'error');
        } finally {
          if (btnGuardar.isConnected) btnGuardar.disabled = false;
        }
      });
      btnCancelar.addEventListener('click', cerrarEditorConAviso);
      btnCerrar.addEventListener('click', cerrarEditorConAviso);
      btnEliminar.addEventListener('click', async () => {
        const ok = await confirmar(`¿Eliminar el bloque «${registro.tipo}»?`, 'Eliminar bloque');
        if (!ok) return;
        try {
          await llamar(api.bloqueEliminar(registro.id, proyecto.id));
          /* Si el editor estaba abierto y sucio, su tarea quedaría huérfana:
             hayCambios() sería true para siempre y Ctrl+S intentaría guardar
             un bloque que ya no existe. */
          if (quitarTarea) { quitarTarea(); quitarTarea = null; }
          editor = null;
          editorSucio = false;
          notificarCambios();
          tarjeta.remove();
          aplicarOrdenBloques();
          aviso('Bloque eliminado', 'exito');
        } catch (err) { aviso(err.message, 'error'); }
      });

      return tarjeta;
    }

    btnCuaderno.addEventListener('click', async () => {
      if (!fuenteId) {
        aviso('Guarda la fuente antes de añadir cuadernos.', 'error');
        return;
      }
      if (creandoCuaderno) return;
      creandoCuaderno = true;
      btnCuaderno.disabled = true;
      try {
        const cuaderno = await llamar(api.cuadernoCrear(fuenteId, proyecto.id));
        if (!lista.isConnected) return;
        const vacio = lista.querySelector('.vacio');
        if (vacio) vacio.remove();
        const tarjeta = crearTarjetaCuaderno(cuaderno, lista.querySelectorAll('.cuaderno').length + 1, { nuevo: true });
        lista.appendChild(tarjeta);
        aviso('Cuaderno creado', 'exito');
      } catch (err) { aviso(err.message, 'error'); }
      finally {
        creandoCuaderno = false;
        if (btnCuaderno.isConnected && cargasIniciales === 0) btnCuaderno.disabled = false;
      }
    });

    btnBloque.addEventListener('click', async () => {
      if (!panelBloques.hidden) {
        panelBloques.hidden = true;
        btnBloque.classList.remove('modo-activo');
        return;
      }
      btnBloque.disabled = true;
      const ok = await asegurarModulos();
      btnBloque.disabled = false;
      if (!ok) return;
      panelBloques.hidden = false;
      btnBloque.classList.add('modo-activo');
      listaBloques.hidden = true;
      listaBloques.innerHTML = '';
      for (const hermano of barraPeriodos.children) hermano.classList.remove('activo');
      actualizarListaBloques();
      panelBloques.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    if (!fuenteId) {
      lista.appendChild(el('div', 'vacio mini',
        'Guarda la fuente para comenzar a añadir cuadernos de transcripción.'));
      return;
    }

    /* Hasta que no terminen las dos cargas iniciales no se permite crear
       tarjetas: el HTML se reemplaza con la respuesta y una tarjeta recién
       creada podría desaparecer de la vista (aunque exista en la BD). */
    cargasIniciales = 2;
    btnCuaderno.disabled = true;
    btnBloque.disabled = true;
    liberarCargaInicial = () => {
      if (cargasIniciales > 0) cargasIniciales--;
      if (cargasIniciales !== 0) return;
      if (btnCuaderno.isConnected) btnCuaderno.disabled = false;
      if (btnBloque.isConnected) btnBloque.disabled = false;
    };

    llamar(api.cuadernoListar(fuenteId, proyecto.id)).then((cuadernos) => {
      if (!lista.isConnected) return;
      if (!cuadernos.length) {
        lista.appendChild(el('div', 'vacio mini', 'Sin cuadernos todavía. Usa «+ Añadir cuaderno».'));
        return;
      }
      lista.innerHTML = '';
      cuadernos.forEach((cuaderno, i) => {
        const esObjetivo = cuadernoObjetivo != null && Number(cuaderno.id) === cuadernoObjetivo;
        const tarjeta = crearTarjetaCuaderno(cuaderno, i + 1, { abrirEditor: esObjetivo });
        lista.appendChild(tarjeta);
        if (esObjetivo) {
          setTimeout(() => {
            tarjeta.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
            const area = tarjeta.querySelector('textarea');
            if (area) area.focus();
          }, 80);
        }
      });
    }).catch((err) => {
      if (lista.isConnected) lista.appendChild(el('div', 'vacio error', err.message));
    }).finally(() => { if (liberarCargaInicial) liberarCargaInicial(); });

    function crearTarjetaBloqueIncompatible(registro, motivo) {
      const tarjeta = el('div', 'bloque-registrado');
      tarjeta.dataset.bloqueId = String(registro.id);
      const cabecera = el('div', 'bloque-registrado-cab');
      const titulo = el('div', 'bloque-registrado-titulo');
      titulo.appendChild(el('span', 'bloque-tipo', registro.tipo || '(sin tipo)'));
      if (registro.categoria) titulo.appendChild(el('span', 'bloque-categoria', registro.categoria));
      cabecera.appendChild(titulo);
      const acciones = el('div', 'bloque-registrado-acciones');
      const btnDescargar = el('button', 'btn btn-mini', 'DESCARGAR');
      const btnEliminar = el('button', 'btn btn-mini btn-peligroso', 'ELIMINAR');
      acciones.append(btnDescargar, btnEliminar);
      cabecera.appendChild(acciones);
      tarjeta.appendChild(cabecera);
      const cuerpo = el('div', 'bloque-cuerpo');
      cuerpo.appendChild(el('div', 'vacio error', motivo));
      tarjeta.appendChild(cuerpo);
      btnDescargar.addEventListener('click', async () => {
        try {
          const r = await llamar(api.bloqueExportar(registro.id, proyecto.id));
          if (!r.cancelado) aviso(`Bloque descargado en «${r.ruta}»`, 'exito');
        } catch (err) { aviso(err.message, 'error'); }
      });
      btnEliminar.addEventListener('click', async () => {
        const ok = await confirmar(`¿Eliminar el bloque «${registro.tipo || registro.id}»?`, 'Eliminar bloque');
        if (!ok) return;
        try {
          await llamar(api.bloqueEliminar(registro.id, proyecto.id));
          tarjeta.remove();
          aplicarOrdenBloques();
          aviso('Bloque eliminado', 'exito');
        } catch (err) { aviso(err.message, 'error'); }
      });
      return tarjeta;
    }

    llamar(api.bloqueListar(fuenteId, proyecto.id)).then(async (bloques) => {
      if (!listaBloquesReg.isConnected) return;
      sugerenciasBloques = recolectarSugerenciasBloques(bloques);
      if (typeof api.bloqueSugerencias === 'function') {
        try {
          sugerenciasBloques = await llamar(api.bloqueSugerencias(fuenteId, proyecto.id));
        } catch { /* se conservan las sugerencias de los bloques ya cargados */ }
      }
      if (!listaBloquesReg.isConnected) return;
      listaBloquesReg.innerHTML = '';
      if (bloques.length) {
        const ok = await asegurarModulos();
        if (!ok) {
          listaBloquesReg.appendChild(el('div', 'vacio error',
            'No se pudieron cargar los formularios; los bloques guardados no se pueden abrir ahora.'));
          return;
        }
      }
      for (const registro of bloques) {
        const esObjetivo = bloqueObjetivo != null && Number(registro.id) === bloqueObjetivo;
        const esquema = FORMULARIOS_BLOQUES[registro.tipo];
        if (!esquema) {
          const tarjeta = crearTarjetaBloqueIncompatible(
            registro,
            `Tipo de bloque no reconocido: «${registro.tipo}». Se conserva el contenido; puedes descargarlo o eliminarlo.`
          );
          listaBloquesReg.appendChild(tarjeta);
          if (esObjetivo) setTimeout(() => tarjeta.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 120);
          continue;
        }
        if (registro.datosInvalidos) {
          const tarjeta = crearTarjetaBloqueIncompatible(
            registro,
            'El contenido guardado de este bloque está dañado. Se conserva el JSON original; descárgalo antes de eliminarlo.'
          );
          listaBloquesReg.appendChild(tarjeta);
          if (esObjetivo) setTimeout(() => tarjeta.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 120);
          continue;
        }
        const tarjeta = crearTarjetaBloque(registro, esquema, { abrirEditor: esObjetivo });
        listaBloquesReg.appendChild(tarjeta);
        if (esObjetivo) setTimeout(() => tarjeta.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 160);
      }
      aplicarOrdenBloques();
    }).catch((err) => {
      if (!listaBloquesReg.isConnected) return;
      listaBloquesReg.innerHTML = '';
      listaBloquesReg.appendChild(el('div', 'vacio error', `No se pudieron cargar los bloques: ${err.message}`));
    }).finally(() => { if (liberarCargaInicial) liberarCargaInicial(); });
  }

  function crearTarjetaCuaderno(datos, indice, { nuevo = false, abrirEditor = false } = {}) {
    const esResumen = datos._resumen === true;
    const estado = {
      id: datos.id,
      fojas: Array.isArray(datos.fojas) ? datos.fojas.slice() : [],
      contenidoGuardado: esResumen ? '' : (datos.contenido || ''),
      fojasGuardadas: Array.isArray(datos.fojas) ? datos.fojas.slice() : [],
      contenidoCargado: !esResumen || Boolean(nuevo),
      editando: Boolean(nuevo),
      abrirAlCargar: Boolean(abrirEditor && !nuevo),
      numerando: false,
      sucio: false,
    };
    let quitarTarea = null;
    let cargaContenidoPromesa = null;

    async function asegurarContenido() {
      if (estado.contenidoCargado) return true;
      if (cargaContenidoPromesa) return cargaContenidoPromesa;
      if (!window.api || typeof window.api.cuadernoObtener !== 'function') {
        aviso('Esta versión no puede cargar la transcripción bajo demanda.', 'error');
        return false;
      }
      cargaContenidoPromesa = (async () => {
        try {
          const fila = await llamar(window.api.cuadernoObtener(estado.id, proyecto.id));
          if (!tarjeta.isConnected) return false;
          estado.contenidoGuardado = fila.contenido || '';
          estado.fojas = Array.isArray(fila.fojas) ? fila.fojas.slice() : [];
          estado.fojasGuardadas = estado.fojas.slice();
          estado.contenidoCargado = true;
          texto.value = estado.contenidoGuardado;
          return true;
        } catch (err) {
          aviso(`No se pudo cargar el cuaderno: ${err.message}`, 'error');
          return false;
        }
      })().finally(() => { cargaContenidoPromesa = null; });
      return cargaContenidoPromesa;
    }

    async function guardarCuaderno() {
      if (!await asegurarContenido()) return false;
      await llamar(api.cuadernoActualizar(estado.id, {
        contenido: texto.value,
        fojas: estado.fojas,
      }, proyecto.id));
      estado.contenidoGuardado = texto.value;
      estado.fojasGuardadas = estado.fojas.slice();
      estado.sucio = false;
      notificarCambios();
      return true;
    }

    const tarjeta = el('div', 'cuaderno');
    const cabecera = el('div', 'cuaderno-cabecera');
    cabecera.appendChild(el('span', 'cuaderno-titulo', `Cuaderno ${indice}`));

    const herramientas = el('div', 'cuaderno-herramientas');
    const btnNumerar = el('button', 'btn btn-mini', 'NUMERAR LÍNEAS');
    const btnFoja = el('button', 'btn btn-mini', 'INSERTAR FOJA');
    herramientas.append(btnNumerar, btnFoja);
    cabecera.appendChild(herramientas);
    tarjeta.appendChild(cabecera);

    const editor = el('div', 'cuaderno-editor');
    const numeros = el('div', 'cuaderno-numeros');
    numeros.hidden = true;
    const texto = el('textarea', 'entrada cuaderno-texto');
    texto.rows = 8;
    texto.value = estado.contenidoCargado ? estado.contenidoGuardado : '';
    texto.readOnly = !estado.editando;
    texto.placeholder = esResumen
      ? 'Pulsa EDITAR para cargar la transcripción…'
      : 'Transcribe o anota aquí el contenido de la fuente…';
    editor.append(numeros, texto);
    tarjeta.appendChild(editor);

    const acciones = el('div', 'cuaderno-acciones');
    const btnCerrar = el('button', 'btn btn-mini', 'CERRAR');
    const btnGuardar = el('button', 'btn btn-mini btn-primario', 'GUARDAR');
    const btnEditar = el('button', 'btn btn-mini', 'EDITAR');
    const btnEliminar = el('button', 'btn btn-mini btn-peligroso', 'ELIMINAR');
    acciones.append(btnCerrar, btnGuardar, btnEditar, btnEliminar);
    tarjeta.appendChild(acciones);

    quitarTarea = registrarTarea({
      hayCambios: () => estado.sucio,
      guardar: guardarCuaderno,
    });

    function pintarNumeros() {
      if (!estado.numerando) return;
      const lineas = texto.value.split('\n');
      const cortes = new Set(estado.fojas.filter((n) => n >= 1 && n <= lineas.length));
      let foja = 1;
      let linea = 0;
      const etiquetas = [];
      for (let i = 1; i <= lineas.length; i++) {
        const esCorte = i !== 1 && cortes.has(i);
        if (esCorte) { foja++; linea = 0; }
        linea++;
        etiquetas.push(foja > 1 && esCorte ? `F${foja} · ${linea}` : String(linea));
      }
      numeros.textContent = etiquetas.join('\n');
      numeros.scrollTop = texto.scrollTop;
    }

    let numeroPendiente = false;
    function programarPintarNumeros() {
      if (!estado.numerando || numeroPendiente) return;
      numeroPendiente = true;
      const marco = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (callback) => setTimeout(callback, 0);
      marco(() => {
        numeroPendiente = false;
        pintarNumeros();
      });
    }

    function actualizarBotones() {
      editor.hidden = !estado.editando;
      herramientas.hidden = !estado.editando;
      texto.readOnly = !estado.editando;
      btnGuardar.disabled = !estado.editando;
      btnEditar.disabled = estado.editando;
      btnCerrar.disabled = !estado.editando;
      btnNumerar.disabled = !estado.editando;
      btnFoja.disabled = !estado.editando;
      tarjeta.classList.toggle('en-edicion', estado.editando);
    }

    btnNumerar.addEventListener('click', () => {
      estado.numerando = !estado.numerando;
      numeros.hidden = !estado.numerando;
      btnNumerar.classList.toggle('modo-activo', estado.numerando);
      if (estado.numerando) pintarNumeros();
    });

    btnFoja.addEventListener('click', () => {
      const pos = texto.selectionStart ?? texto.value.length;
      const antes = texto.value.slice(0, pos);
      const despues = texto.value.slice(pos);
      const insercion = `${antes.endsWith('\n') ? '' : '\n'}\n`;
      texto.value = antes + insercion + despues;
      const lineasHasta = (antes + insercion).split('\n').length;
      if (lineasHasta > 1) {
        estado.fojas = [...new Set([...estado.fojas, lineasHasta])].sort((a, b) => a - b);
      }
      estado.sucio = true;
      notificarCambios();
      texto.selectionStart = texto.selectionEnd = pos + insercion.length;
      texto.focus();
      if (estado.numerando) programarPintarNumeros();
    });

    texto.addEventListener('input', () => {
      estado.sucio = true;
      notificarCambios();
      if (estado.numerando) programarPintarNumeros();
    });
    texto.addEventListener('scroll', () => {
      numeros.scrollTop = texto.scrollTop;
    });

    btnGuardar.addEventListener('click', async () => {
      try {
        await guardarCuaderno();
        notificarCambios();
        aviso('Cuaderno guardado', 'exito');
      } catch (err) { aviso(err.message, 'error'); }
    });

    btnCerrar.addEventListener('click', async () => {
      if (estado.sucio) {
        const ok = await confirmar('Hay cambios sin guardar en el cuaderno. ¿Cerrarlo y descartarlos?', 'Cambios sin guardar');
        if (!ok) return;
        texto.value = estado.contenidoGuardado;
        estado.fojas = estado.fojasGuardadas.slice();
        estado.sucio = false;
        notificarCambios();
        if (estado.numerando) pintarNumeros();
      }
      estado.editando = false;
      actualizarBotones();
    });

    btnEditar.addEventListener('click', () => {
      if (estado.contenidoCargado) {
        estado.editando = true;
        actualizarBotones();
        texto.focus();
        return;
      }
      asegurarContenido().then((ok) => {
        if (!ok || !tarjeta.isConnected) return;
        estado.editando = true;
        actualizarBotones();
        texto.focus();
      }, () => {});
    });

    btnEliminar.addEventListener('click', async () => {
      const ok = await confirmar('¿Eliminar este cuaderno? Su contenido se perderá.', 'Eliminar cuaderno');
      if (!ok) return;
      try {
        await llamar(api.cuadernoEliminar(estado.id, proyecto.id));
        if (quitarTarea) { quitarTarea(); quitarTarea = null; }
        estado.sucio = false;
        notificarCambios();
        aviso('Cuaderno eliminado', 'exito');
        tarjeta.remove();
      } catch (err) { aviso(err.message, 'error'); }
    });

    actualizarBotones();
    if (nuevo) {
      setTimeout(() => texto.focus(), 30);
    } else if (estado.abrirAlCargar) {
      setTimeout(async () => {
        if (await asegurarContenido()) {
          estado.editando = true;
          actualizarBotones();
          texto.focus();
        }
      }, 0);
    }
    return tarjeta;
  }

  /* ---------------- Fusiones y coincidencias ---------------- */

  async function montarFusiones(fila) {
    const bloque = refs.bloqueFusiones;
    bloque.innerHTML = '';
    bloque.appendChild(el('h3', 'bloque-titulo', 'Fusiones y coincidencias'));
    bloque.appendChild(el('p', 'pista',
      'Datos auxiliares de depuración documental: no inciden en el grafo ni en el análisis.'));

    let candidatos = [];
    try {
      candidatos = lista.filter((f) => f.id !== fila.id);
      if (!candidatos.length) {
        const todas = await listarResumenEntidades(claveTipo(), proyecto.id);
        candidatos = todas.filter((f) => f.id !== fila.id);
      }
    } catch (err) {
      bloque.appendChild(el('div', 'vacio error', err.message));
      return;
    }
    if (!bloque.isConnected) return;

    const selector = el('div', 'fusion-selector');
    selector.appendChild(el('label', '', 'Entidad con la que comparar'));
    const sel = el('select', 'entrada');
    if (!candidatos.length) {
      sel.appendChild(new Option('— no hay otras fichas del mismo tipo —', ''));
    }
    for (const candidato of candidatos) {
      const etiqueta = `${candidato.identificador ? `${candidato.identificador} · ` : ''}${def.etiqueta(candidato)}`;
      sel.appendChild(new Option(etiqueta, String(candidato.id)));
    }
    selector.appendChild(sel);
    bloque.appendChild(selector);

    const acciones = el('div', 'fusion-acciones');
    const btnFusionar = el('button', 'btn btn-mini btn-peligroso', 'FUSIONAR');
    const btnCoincidencia = el('button', 'btn btn-mini', 'POSIBLE COINCIDENCIA');
    acciones.append(btnFusionar, btnCoincidencia);
    bloque.appendChild(acciones);

    const formCoincidencia = el('div', 'coincidencia-form');
    formCoincidencia.hidden = true;
    const inNotas = el('textarea', 'entrada');
    inNotas.rows = 3;
    inNotas.placeholder = 'Notas de la posible coincidencia (indicios, dudas, fuentes…)';
    const btnRegistrar = el('button', 'btn btn-mini btn-primario', 'Registrar coincidencia');
    formCoincidencia.append(inNotas, btnRegistrar);
    bloque.appendChild(formCoincidencia);

    const listaCoincidencias = el('div', 'coincidencias-lista');
    bloque.appendChild(listaCoincidencias);

    let coincidencias = [];
    let registrandoCoincidencia = false;
    const nombres = new Map(candidatos.map((c) => [c.id, def.etiqueta(c)]));

    function pintarCoincidencias() {
      listaCoincidencias.innerHTML = '';
      const propias = coincidencias.filter((c) =>
        c.tipo === claveTipo() && (c.entidad_a === fila.id || c.entidad_b === fila.id));
      if (!propias.length) {
        listaCoincidencias.appendChild(el('div', 'vacio mini', 'Sin coincidencias registradas.'));
        return;
      }
      for (const coincidencia of propias) {
        const otroId = coincidencia.entidad_a === fila.id ? coincidencia.entidad_b : coincidencia.entidad_a;
        const item = el('div', 'coincidencia-item');
        const texto = el('div', 'coincidencia-texto');
        texto.appendChild(el('div', 'coincidencia-titulo',
          `Posible coincidencia con ${nombres.get(otroId) || `#${otroId}`}`));
        if (coincidencia.notas) texto.appendChild(el('div', 'ent-item-sub', coincidencia.notas));
        item.appendChild(texto);
        const btn = el('button', 'btn btn-peligroso btn-mini', '✕');
        btn.title = 'Eliminar coincidencia';
        btn.addEventListener('click', async () => {
          const ok = await confirmar('¿Eliminar esta posible coincidencia?', 'Eliminar coincidencia');
          if (!ok) return;
          try {
            await llamar(api.coincidenciaEliminar(coincidencia.id, proyecto.id));
            coincidencias = coincidencias.filter((x) => x.id !== coincidencia.id);
            pintarCoincidencias();
            aviso('Coincidencia eliminada', 'exito');
          } catch (err) { aviso(err.message, 'error'); }
        });
        item.appendChild(btn);
        listaCoincidencias.appendChild(item);
      }
    }

    try {
      coincidencias = await llamar(api.coincidenciaListar(proyecto.id));
    } catch (err) {
      coincidencias = [];
      if (!bloque.isConnected) return;
      listaCoincidencias.innerHTML = '';
      const fallo = el('div', 'vacio error', `No se pudieron cargar las coincidencias: ${err.message}`);
      const btnReintentar = el('button', 'btn btn-mini', 'Reintentar');
      btnReintentar.type = 'button';
      btnReintentar.addEventListener('click', () => montarFusiones(fila));
      fallo.appendChild(btnReintentar);
      listaCoincidencias.appendChild(fallo);
      return;
    }
    if (!bloque.isConnected) return;
    pintarCoincidencias();

    btnCoincidencia.addEventListener('click', () => {
      if (!sel.value) { aviso('No hay otra ficha con la que comparar.', 'error'); return; }
      formCoincidencia.hidden = !formCoincidencia.hidden;
      if (!formCoincidencia.hidden) inNotas.focus();
    });

    btnRegistrar.addEventListener('click', async () => {
      if (!sel.value || registrandoCoincidencia) return;
      registrandoCoincidencia = true;
      btnRegistrar.disabled = true;
      try {
        await llamar(api.coincidenciaCrear({
          proyecto_id: proyecto.id,
          tipo: claveTipo(),
          entidad_a: fila.id,
          entidad_b: Number(sel.value),
          notas: inNotas.value.trim(),
        }, proyecto.id));
        coincidencias = await llamar(api.coincidenciaListar(proyecto.id));
        inNotas.value = '';
        formCoincidencia.hidden = true;
        pintarCoincidencias();
        aviso('Posible coincidencia registrada', 'exito');
      } catch (err) {
        aviso(err.message, 'error');
      } finally {
        registrandoCoincidencia = false;
        if (btnRegistrar.isConnected) btnRegistrar.disabled = false;
      }
    });

    btnFusionar.addEventListener('click', async () => {
      if (hayCambios()) {
        aviso('Guarda los cambios de la ficha antes de fusionarla.', 'error');
        return;
      }
      if (!sel.value) { aviso('Selecciona la otra ficha para fusionar.', 'error'); return; }
      const absorbida = candidatos.find((c) => c.id === Number(sel.value));
      if (!absorbida) return;
      const ok = await confirmar(
        `Se fusionará «${def.etiqueta(absorbida)}»${absorbida.identificador ? ` (${absorbida.identificador})` : ''} `
        + `en «${def.etiqueta(fila)}»${fila.identificador ? ` (${fila.identificador})` : ''}. `
        + 'La ficha absorbida se eliminará: sus relaciones pasarán a la superviviente, pero sus datos propios se perderán. '
        + 'Esta acción no se puede deshacer.',
        'Fusionar fichas'
      );
      if (!ok) return;
      try {
        const superviviente = await llamar(api.entidadFusionar(claveTipo(), fila.id, absorbida.id, proyecto.id));
        invalidarCacheBloques();
        invalidarCacheEntidades();
        notificarContadores();
        lista = await llamar(api.entidadListar(claveTipo(), proyecto.id));
        lista.sort(compararEntidades);
        dibujarLista();
        aviso(`«${def.etiqueta(absorbida)}» se fusionó en la ficha actual`, 'exito');
        abrirFormulario(superviviente);
      } catch (err) { aviso(err.message, 'error'); }
    });
  }

  function dibujarCampo(grid, campo, fila, opciones = {}) {
    const envoltura = el('div', `campo campo-${campo.ancho}`);
    const etiqueta = el('label', '', campo.etiqueta);
    envoltura.appendChild(etiqueta);

    let entrada;
    const valor = fila ? (fila[campo.clave] ?? '') : '';

    if (campo.tipo === 'area') {
      entrada = el('textarea', `entrada${campo.mono ? ' mono' : ''}`);
      entrada.rows = campo.filas || 4;
      entrada.value = valor;
    } else if (campo.tipo === 'fecha-historica') {
      const caja = el('div', 'fecha-historica');
      entrada = el('input', 'entrada');
      entrada.value = valor;
      entrada.placeholder = '19-X-1469 · 19 de octubre de 1469';
      caja.appendChild(entrada);
      envoltura.appendChild(caja);
      let meta = {};
      try {
        const crudo = fila ? fila[`${campo.clave}_meta`] : null;
        meta = crudo && typeof crudo === 'string' ? JSON.parse(crudo) : (crudo || {});
      } catch { meta = {}; }
      FechaHistorica.adjuntar(entrada, meta, () => { sucio = true; }, {
        anio: opciones.anioReferencia,
      });
    } else if (campo.tipo === 'select') {
      entrada = el('select', 'entrada');
      entrada.appendChild(new Option('—', ''));
      const opcionesSelect = campo.opciones || [];
      for (const op of opcionesSelect) entrada.appendChild(new Option(op, op));
      const valorTexto = valor === null || valor === undefined ? '' : String(valor);
      if (valorTexto && !opcionesSelect.some((op) => String(op) === valorTexto)) {
        entrada.appendChild(new Option(`(actual) ${valorTexto}`, valorTexto));
      }
      entrada.value = valorTexto;
    } else if (campo.tipo === 'entidad') {
      entrada = el('select', 'entrada');
      entrada.appendChild(new Option('—', ''));
      for (const f of cacheReferencias[campo.entidad] || []) {
        entrada.appendChild(new Option(etiquetaEntidad(campo.entidad, f), String(f.id)));
      }
      const valorTexto = valor === null || valor === undefined ? '' : String(valor);
      if (valorTexto && ![...entrada.options].some((op) => op.value === valorTexto)) {
        const actual = (cacheReferencias[campo.entidad] || [])
          .find((f) => String(f.id) === valorTexto);
        entrada.appendChild(new Option(
          actual ? `(actual) ${etiquetaEntidad(campo.entidad, actual)}` : `(actual) #${valorTexto}`,
          valorTexto
        ));
      }
      entrada.value = valorTexto;
    } else if (campo.tipo === 'taxonomia-fuentes') {
      entrada = el('select', 'entrada');
      entrada.appendChild(new Option('— tipo de fuente —', ''));
      for (const [categoria, tipos] of Object.entries(FUENTES_TAXONOMIA)) {
        const grupo = el('optgroup');
        grupo.label = categoria;
        for (const tipo of tipos) grupo.appendChild(new Option(tipo, tipo));
        entrada.appendChild(grupo);
      }
      if (valor && ![...entrada.options].some((op) => op.value === valor)) {
        entrada.appendChild(new Option(`(actual) ${valor}`, valor));
      }
      entrada.value = valor ? String(valor) : '';
    } else if (campo.tipo === 'select-lugar') {
      entrada = el('select', 'entrada');
      entrada.appendChild(new Option('— lugar —', ''));
      const nombres = new Set();
      for (const f of cacheReferencias.lugar || []) {
        const nombre = String(f.nombre || '').trim();
        if (!nombre || nombres.has(nombre)) continue;
        nombres.add(nombre);
        const etiqueta = f.identificador ? `${nombre} (${f.identificador})` : nombre;
        entrada.appendChild(new Option(etiqueta, nombre));
      }
      const actual = String(valor || '').trim();
      if (actual && !nombres.has(actual)) {
        entrada.appendChild(new Option(`(actual) ${actual}`, actual));
      }
      entrada.value = actual;
    } else if (campo.tipo === 'select-persona') {
      entrada = el('select', 'entrada');
      entrada.appendChild(new Option('— persona —', ''));
      const nombres = new Set();
      for (const f of ordenarEntidades(cacheReferencias.persona || [], 'persona')) {
        const nombre = etiquetaEntidad('persona', f);
        if (!nombre || nombres.has(nombre)) continue;
        nombres.add(nombre);
        entrada.appendChild(new Option(nombre, nombre));
      }
      const actual = String(valor || '').trim();
      if (actual && !nombres.has(actual)) {
        entrada.appendChild(new Option(`(actual) ${actual}`, actual));
      }
      entrada.value = actual;
    } else if (campo.tipo === 'select-propietario') {
      entrada = el('select', 'entrada');
      entrada.appendChild(new Option('— propietario —', ''));
      const nombres = new Set();
      const grupos = [
        ['Personas', 'persona', cacheReferencias.persona || [], (f) => normalizarOrden(textoOrdenPersona(f))],
        ['Instituciones', 'institucion', cacheReferencias.institucion || [], (f) => normalizarOrden(f.nombre)],
      ];
      for (const [etiquetaGrupo, tipoEntidad, lista, clave] of grupos) {
        const grupo = el('optgroup');
        grupo.label = etiquetaGrupo;
        for (const f of lista.slice().sort((a, b) => colador.compare(clave(a), clave(b)))) {
          const nombre = etiquetaEntidad(tipoEntidad, f);
          if (!nombre || nombres.has(nombre)) continue;
          nombres.add(nombre);
          const textoOpcion = f.identificador ? `${nombre} (${f.identificador})` : nombre;
          grupo.appendChild(new Option(textoOpcion, nombre));
        }
        if (grupo.children.length) entrada.appendChild(grupo);
      }
      const actual = String(valor || '').trim();
      if (actual && !nombres.has(actual)) {
        entrada.appendChild(new Option(`(actual) ${actual}`, actual));
      }
      entrada.value = actual;
    } else if (campo.tipo === 'anio') {
      entrada = el('input', 'entrada');
      entrada.type = 'number';
      entrada.step = '1';
      entrada.placeholder = 'aaaa';
      entrada.value = valor != null ? valor : '';
    } else {
      entrada = el('input', 'entrada');
      entrada.value = valor;
      if (campo.clave === 'latitud' || campo.clave === 'longitud') entrada.inputMode = 'decimal';
    }

    entrada.dataset.clave = campo.clave;
    entrada.id = `campo-${def.clave}-${campo.clave}`;
    etiqueta.htmlFor = entrada.id;
    entrada.addEventListener('input', () => { sucio = true; });
    entrada.addEventListener('change', () => { sucio = true; });
    if (!entrada.parentElement) envoltura.appendChild(entrada);
    if (campo.pista) envoltura.appendChild(el('div', 'pista', campo.pista));
    grid.appendChild(envoltura);
    return entrada;
  }

  function reunirValores() {
    const datos = {};
    for (const [clave, entrada] of Object.entries(refs.inputs)) {
      datos[clave] = entrada.value;
      if (entrada._meta !== undefined) {
        datos[`${clave}_meta`] = JSON.stringify(entrada._meta || {});
      }
    }
    return datos;
  }

  async function guardarFormulario() {
    if (guardandoFicha) return false;
    const generacionGuardado = generacionFormulario;
    const montajeGuardado = generacionMontaje;
    guardandoFicha = true;
    const botonGuardar = refs.btnGuardar;
    const contenedor = refs.detalle;
    const inertPrevio = contenedor ? Boolean(contenedor.inert) : false;
    if (botonGuardar) {
      botonGuardar.disabled = true;
      botonGuardar.textContent = 'Guardando…';
    }
    /* Mientras se guarda no se aceptan ediciones nuevas. Si el usuario abre
       otra ficha desde la lista, la comprobación de generación evita que la
       respuesta tardía sobrescriba el formulario actual. */
    if (contenedor && contenedor.isConnected) {
      if ('inert' in contenedor) contenedor.inert = true;
      contenedor.setAttribute('aria-busy', 'true');
    }
    const sigueVigente = () => (
      generacionFormulario === generacionGuardado
      && generacionMontaje === montajeGuardado
      && Boolean(refs.lista)
    );
    try {
    if (relacionSucio && refs.guardarRelacionPendiente) {
      const relacionOk = await refs.guardarRelacionPendiente();
      if (!relacionOk) return false;
      if (!sigueVigente()) return true;
    }
    if (!sigueVigente()) return true;
    const datos = reunirValores();
    const campos = refs.camposActuales || def.campos;
    const obligatorio = campos.find((c) => c.etiqueta.includes('*'));
    if (obligatorio && !String(datos[obligatorio.clave] || '').trim()) {
      aviso(`El campo «${obligatorio.etiqueta.replace(' *', '')}» es obligatorio.`, 'error');
      return false;
    }
    if (def.exigirUnoDe
      && !def.exigirUnoDe.some((clave) => String(datos[clave] || '').trim())) {
      if (def.mensajeUnoDe) {
        aviso(def.mensajeUnoDe, 'error');
        return false;
      }
      const nombres = def.exigirUnoDe
        .map((clave) => campos.find((c) => c.clave === clave)?.etiqueta)
        .filter(Boolean)
        .map((etiqueta) => etiqueta.replace(' *', '').toLowerCase());
      aviso(`Indica al menos ${nombres.join(' o ')}.`, 'error');
      return false;
    }
    try {
      const eraNuevo = modo === 'nuevo';
      const idGuardado = eraNuevo ? null : filaActual.id;
      let fila;
      if (eraNuevo) {
        fila = await llamar(api.entidadCrear(claveTipo(), proyecto.id, datos));
      } else {
        fila = await llamar(api.entidadActualizar(claveTipo(), idGuardado, datos, proyecto.id));
      }
      if (generacionMontaje !== montajeGuardado) return true;
      if (!sigueVigente()) {
        const indiceTardio = lista.findIndex((f) => f.id === fila.id);
        if (indiceTardio >= 0) lista[indiceTardio] = fila;
        else lista.push(fila);
        lista.sort(compararEntidades);
        if (refs.lista) dibujarLista();
        notificarContadores();
        return true;
      }
      filaActual = fila; modo = 'editar'; sucio = false;
      invalidarCacheBloques();
      invalidarCacheEntidades();
      reiniciarDeshacer();
      document.dispatchEvent(new CustomEvent('himago:cambios'));

      if (def.relaciones) {
        try {
          await sincronizarRelacionesManuales(fila, datos);
        } catch (err) {
          aviso(`La ficha se guardó, pero no se pudieron sincronizar sus relaciones: ${err.message}`, 'error');
        }
      }
      if (!sigueVigente()) {
        const indiceTardio = lista.findIndex((f) => f.id === fila.id);
        if (indiceTardio >= 0) lista[indiceTardio] = fila;
        else lista.push(fila);
        lista.sort(compararEntidades);
        if (refs.lista) dibujarLista();
        notificarContadores();
        return true;
      }
      const conservarEditor = !eraNuevo && hayCambiosExternos();
      const indice = lista.findIndex((f) => f.id === fila.id);
      if (indice >= 0) lista[indice] = fila; else lista.push(fila);
      lista.sort(compararEntidades);
      dibujarLista();
      if (!conservarEditor) abrirFormulario(fila);
      else {
        const titulo = refs.detalle.querySelector('.detalle-titulo');
        if (titulo) titulo.textContent = def.etiqueta(fila);
        if (def.relaciones) prepararRelaciones();
      }
      // restaurar la selección visual por identificador, no por título (homónimos)
      $$('.ent-item', refs.lista).forEach((it) => it.classList.remove('seleccionado'));
      const item = [...refs.lista.children].find((it) => it.dataset.id === String(fila.id));
      if (item) item.classList.add('seleccionado');
      aviso(`${NOMBRE_TIPO[claveTipo()]} guardado`, 'exito');
      notificarContadores();
      return true;
    } catch (err) {
      aviso(err.message, 'error');
      return false;
    }
    } finally {
      guardandoFicha = false;
      if (contenedor && contenedor.isConnected) {
        if ('inert' in contenedor) contenedor.inert = inertPrevio;
        contenedor.removeAttribute('aria-busy');
      }
      if (botonGuardar && botonGuardar.isConnected) {
        botonGuardar.disabled = false;
        botonGuardar.textContent = 'Guardar';
      }
    }
  }

  /** Relaciones manuales derivadas de los campos de la ficha. */
  async function sincronizarRelacionesManuales(fila, datos) {
    if (claveTipo() === 'persona') return sincronizarMembresia(fila, datos);
    if (claveTipo() === 'institucion') return sincronizarSede(fila, datos);
    if (claveTipo() === 'patrimonio') return sincronizarPropietario(fila, datos);
  }

  /** Ocupación + institución: crea una relación MANUAL PERSONA – MIEMBRO –
      INSTITUCIÓN si no existe ya una relación Miembro con esa institución. */
  async function sincronizarMembresia(fila, datos) {
    if (claveTipo() !== 'persona') return;
    const ocupacion = String(datos.ocupacion || '').trim();
    const iid = Number(datos.institucion_id) || null;
    const objetivo = ocupacion && iid ? iid : null;
    const propias = await llamar(api.relacionListarDeEntidad(proyecto.id, 'persona', fila.id));
    const miembros = propias.filter((r) =>
      r.tipo === 'Miembro'
      && r.origen_tipo === 'persona' && Number(r.origen_id) === Number(fila.id)
      && r.destino_tipo === 'institucion');
    const marcadas = miembros.filter((r) => r.regla === 'ficha:membresia');
    /* Las marcadas son las que creó esta sincronización. Si no hay marca
       (datos antiguos) solo se limpia cuando es la única relación Miembro,
       para no borrar membresías manuales múltiples. */
    const candidatas = marcadas.length ? marcadas : (miembros.length === 1 ? miembros : []);
    let yaTiene = false;
    for (const relacion of candidatas) {
      if (objetivo && Number(relacion.destino_id) === objetivo) {
        yaTiene = true;
        continue;
      }
      try { await llamar(api.relacionEliminar(relacion.id, proyecto.id)); } catch { /* ya no existe */ }
    }
    if (!objetivo || yaTiene) return;
    try {
      await llamar(api.relacionCrear({
        proyecto_id: proyecto.id,
        origen_tipo: 'persona',
        origen_id: fila.id,
        destino_tipo: 'institucion',
        destino_id: objetivo,
        tipo: 'Miembro',
        regla: 'ficha:membresia',
        fuentes: [],
      }, proyecto.id));
      aviso('Relación MANUAL «Persona · Miembro · Institución» creada', 'exito');
    } catch (err) {
      aviso(`No se pudo crear la relación de pertenencia: ${err.message}`, 'error');
    }
  }

  /** Sede / lugar: crea una relación MANUAL LUGAR – SEDE – INSTITUCIÓN
      si no existe ya una relación Sede con ese lugar. */
  async function sincronizarSede(fila, datos) {
    if (claveTipo() !== 'institucion') return;
    const lid = Number(datos.lugar_id) || null;
    const propias = await llamar(api.relacionListarDeEntidad(proyecto.id, 'institucion', fila.id));
    const sede = propias.filter((r) => r.tipo === 'Sede' && (
      (r.destino_tipo === 'institucion' && Number(r.destino_id) === Number(fila.id))
      || (r.origen_tipo === 'institucion' && Number(r.origen_id) === Number(fila.id))
    ));
    const marcadas = sede.filter((r) => r.regla === 'ficha:sede');
    const candidatas = marcadas.length ? marcadas : (sede.length === 1 ? sede : []);
    let yaTiene = false;
    for (const relacion of candidatas) {
      const valida = Boolean(lid)
        && relacion.origen_tipo === 'lugar' && Number(relacion.origen_id) === lid
        && relacion.destino_tipo === 'institucion' && Number(relacion.destino_id) === Number(fila.id);
      const heredada = Boolean(lid)
        && relacion.origen_tipo === 'institucion' && Number(relacion.origen_id) === Number(fila.id)
        && relacion.destino_tipo === 'lugar' && Number(relacion.destino_id) === lid;
      if (valida || heredada) {
        yaTiene = true;
        continue;
      }
      try { await llamar(api.relacionEliminar(relacion.id, proyecto.id)); } catch { /* ya no existe */ }
    }
    if (!lid || yaTiene) return;
    try {
      await llamar(api.relacionCrear({
        proyecto_id: proyecto.id,
        origen_tipo: 'lugar',
        origen_id: lid,
        destino_tipo: 'institucion',
        destino_id: fila.id,
        tipo: 'Sede',
        regla: 'ficha:sede',
        fuentes: [],
      }, proyecto.id));
      aviso('Relación MANUAL «Lugar · Sede · Institución» creada', 'exito');
    } catch (err) {
      aviso(`No se pudo crear la relación de sede: ${err.message}`, 'error');
    }
  }

  /** Propietario/titular: crea una relación MANUAL PROPIETARIO – PATRIMONIO.
      El propietario puede ser una persona o una institución. */
  async function sincronizarPropietario(fila, datos) {
    if (claveTipo() !== 'patrimonio') return;
    const nombre = String(datos.propietario || '').trim();
    const normalizar = (v) => String(v || '').trim().toLocaleLowerCase('es');
    const buscar = (tipo) => {
      const lista = cacheReferencias[tipo] || [];
      return lista.find((f) => etiquetaEntidad(tipo, f) === nombre)
        || lista.find((f) => normalizar(etiquetaEntidad(tipo, f)) === normalizar(nombre));
    };
    const persona = nombre ? buscar('persona') : null;
    const institucion = persona ? null : (nombre ? buscar('institucion') : null);
    const propietario = persona
      ? { tipo: 'persona', fila: persona }
      : (institucion ? { tipo: 'institucion', fila: institucion } : null);
    const relaciones = await llamar(api.relacionListarDeEntidad(proyecto.id, 'patrimonio', fila.id));
    const propias = relaciones.filter((r) =>
      r.tipo === 'Propietario'
      && r.destino_tipo === 'patrimonio' && Number(r.destino_id) === Number(fila.id));
    const marcadas = propias.filter((r) => r.regla === 'ficha:propietario');
    const candidatas = marcadas.length ? marcadas : (propias.length === 1 ? propias : []);
    let yaTiene = false;
    for (const relacion of candidatas) {
      const coincide = Boolean(propietario)
        && relacion.origen_tipo === propietario.tipo
        && Number(relacion.origen_id) === Number(propietario.fila.id);
      if (coincide) {
        yaTiene = true;
        continue;
      }
      try { await llamar(api.relacionEliminar(relacion.id, proyecto.id)); } catch { /* ya no existe */ }
    }
    if (!propietario || yaTiene) return;
    try {
      await llamar(api.relacionCrear({
        proyecto_id: proyecto.id,
        origen_tipo: propietario.tipo,
        origen_id: propietario.fila.id,
        destino_tipo: 'patrimonio',
        destino_id: fila.id,
        tipo: 'Propietario',
        regla: 'ficha:propietario',
        fuentes: [],
      }, proyecto.id));
      aviso(`Relación MANUAL «${NOMBRE_TIPO[propietario.tipo]} · Propietario · Patrimonio» creada`, 'exito');
    } catch (err) {
      aviso(`No se pudo crear la relación de propiedad: ${err.message}`, 'error');
    }
  }

  async function eliminarFila() {
    if (!filaActual) return;
    const ok = await confirmar(`¿Eliminar «${def.etiqueta(filaActual)}»? Sus relaciones también se eliminarán.`, 'Eliminar registro');
    if (!ok) return;
    try {
      await llamar(api.entidadEliminar(claveTipo(), filaActual.id, proyecto.id));
      invalidarCacheBloques();
      invalidarCacheEntidades();
      lista = lista.filter((f) => f.id !== filaActual.id);
      aviso('Registro eliminado', 'exito');
      notificarContadores();
      mostrarDirectorio();
      dibujarLista();
    } catch (err) { aviso(err.message, 'error'); }
  }

  /* ---------------- Relaciones ---------------- */

  async function prepararRelaciones() {
    if (!filaActual) return;
    const generacion = ++generacionRelaciones;
    const idFicha = filaActual.id;
    try {
      const resultado = await Promise.all([
        llamar(api.relacionListarDeEntidad(proyecto.id, claveTipo(), idFicha)),
        Promise.all(TIPOS_RELACION.map(async (t) => {
          const filas = await listarResumenEntidades(t, proyecto.id);
          return [t, filas];
        })),
        listarResumenEntidades('fuente', proyecto.id),
      ]);
      if (generacion !== generacionRelaciones || !filaActual || filaActual.id !== idFicha) return;
      cacheRel = resultado[0];
      cacheEnt = Object.fromEntries(resultado[1]);
      cacheFuentes = resultado[2] || [];
    } catch (err) {
      if (generacion !== generacionRelaciones || !filaActual || filaActual.id !== idFicha) return;
      cacheRel = []; cacheEnt = {}; cacheFuentes = [];
      aviso(`No se pudieron cargar las relaciones: ${err.message}`, 'error');
    }
    dibujarRelaciones();
  }

  function dibujarRelacionesVacias() {
    refs.bloqueRelaciones.innerHTML = '';
    refs.bloqueRelaciones.appendChild(el('div', 'pista', 'Guarda el registro para poder añadir relaciones.'));
  }

  function relacionesPropias() {
    if (!filaActual) return [];
    return cacheRel.filter((r) =>
      (r.origen_tipo === claveTipo() && r.origen_id === filaActual.id) ||
      (r.destino_tipo === claveTipo() && r.destino_id === filaActual.id));
  }

  /** Pinta sólo la lista de relaciones, respetando la categoría activa
      (el formulario de alta no se recrea al filtrar). */
  function pintarListaRelaciones() {
    if (!refs.listaRel) return;
    const propias = relacionesPropias();
    const visibles = filtroCategoriaRel
      ? propias.filter((r) => categoriaRelacion(r.tipo) === filtroCategoriaRel)
      : propias;

    if (refs.barraCat) {
      $$('.rel-cat', refs.barraCat).forEach((b) => {
        b.classList.toggle('activa', (b.dataset.categoria || null) === filtroCategoriaRel);
      });
    }

    refs.listaRel.innerHTML = '';
    if (!visibles.length) {
      refs.listaRel.appendChild(el('div', 'vacio mini',
        filtroCategoriaRel
          ? `Sin relaciones de categoría ${RELACIONES_CATEGORIAS_PLURAL[filtroCategoriaRel] || filtroCategoriaRel}.`
          : 'Sin relaciones todavía.'));
      return;
    }

    for (const r of visibles) {
      const item = el('div', 'relacion-item');
      if (relacionEnEdicion && relacionEnEdicion.id === r.id) item.classList.add('seleccionada');
      item.title = 'Clic para editar esta relación';
      const texto = el('div', 'relacion-texto');
      const lineaTipo = el('div', 'relacion-tipo');
      const flecha = typeof window.flechaRelacion === 'function'
        ? window.flechaRelacion(r.tipo)
        : '→';
      lineaTipo.appendChild(el('span', 'relacion-tipo-texto',
        `${r.origen_nombre} ${flecha} ${r.destino_nombre} · ${r.tipo}`));
      if (typeof relacionPermitida === 'function'
        && !relacionPermitida(r.tipo, r.origen_tipo, r.destino_tipo)) {
        item.classList.add('relacion-fuera-taxonomia');
        const avisoRel = el('span', 'rel-aviso', '⚠');
        avisoRel.title = 'Esta relación no cumple las restricciones de entidad de la taxonomía actual.';
        lineaTipo.appendChild(avisoRel);
      }
      lineaTipo.appendChild(el('span',
        `rel-procedencia ${String(r.procedencia || 'MANUAL').toLowerCase()}`,
        r.procedencia || 'MANUAL'));
      texto.appendChild(lineaTipo);
      const desdeTxt = r.fecha_exacta_inicio || (r.anio_inicio ?? '');
      const hastaTxt = r.fecha_exacta_fin || (r.anio_fin ?? '');
      const fechas = [desdeTxt, hastaTxt].filter((v) => v !== '' && v != null).join(' – ');
      const fuentesTxt = (r.fuentes || [])
        .map((f) => (typeof f === 'object'
          ? f.titulo
          : cacheFuentes.find((x) => Number(x.id) === Number(f))?.titulo))
        .filter(Boolean).join(', ');
      const extra = [
        fechas,
        [r.lugar_inicio_nombre, r.lugar_fin_nombre].filter(Boolean).join(' → '),
        fuentesTxt ? `Fuentes: ${fuentesTxt}` : '',
        r.notas,
      ].filter(Boolean).join(' · ');
      if (extra) texto.appendChild(el('div', 'ent-item-sub', extra));
      item.appendChild(texto);
      item.addEventListener('click', (ev) => {
        if (ev.target.closest('button')) return;
        if (refs.cargarRelacion) refs.cargarRelacion(r);
      });
      const btn = el('button', 'btn btn-peligroso btn-mini', '✕');
      btn.title = 'Eliminar relación';
      btn.addEventListener('click', async () => {
        const ok = await confirmar('¿Eliminar esta relación?', 'Eliminar relación');
        if (!ok) return;
        try {
          await llamar(api.relacionEliminar(r.id, proyecto.id));
          cacheRel = cacheRel.filter((x) => x.id !== r.id);
          if (relacionEnEdicion && relacionEnEdicion.id === r.id) {
            relacionEnEdicion = null;
            if (refs.limpiarFormRel) refs.limpiarFormRel();
          }
          pintarListaRelaciones();
          document.dispatchEvent(new CustomEvent('himago:contadores'));
        } catch (err) { aviso(err.message, 'error'); }
      });
      item.appendChild(btn);
      refs.listaRel.appendChild(item);
    }
  }

  function dibujarRelaciones() {
    const bloque = refs.bloqueRelaciones;
    bloque.innerHTML = '';

    bloque.appendChild(el('h3', 'bloque-titulo', 'Relaciones'));
    bloque.appendChild(el('p', 'pista',
      'Las relaciones nuevas se crean desde esta ficha como origen; la lista incluye también las que llegan a ella.'));

    /* Barra horizontal de categorías: «Todas» por defecto */
    const barraCat = el('div', 'rel-categorias');
    const opcionesCat = [
      [null, 'Todas'],
      ...Object.keys(TAXONOMIA_RELACIONES).map((cat) => [cat, RELACIONES_CATEGORIAS_PLURAL[cat] || cat]),
    ];
    for (const [categoria, etiqueta] of opcionesCat) {
      const boton = el('button', 'rel-cat', etiqueta);
      boton.type = 'button';
      if (categoria) boton.dataset.categoria = categoria;
      boton.title = categoria
        ? `Mostrar sólo las relaciones de categoría ${etiqueta}`
        : 'Mostrar todas las relaciones registradas';
      boton.addEventListener('click', () => {
        filtroCategoriaRel = categoria;
        pintarListaRelaciones();
      });
      barraCat.appendChild(boton);
    }
    refs.barraCat = barraCat;
    bloque.appendChild(barraCat);

    refs.listaRel = el('div', 'lista-relaciones');
    bloque.appendChild(refs.listaRel);
    pintarListaRelaciones();

    /* Formulario de nueva relación: retícula de 3 líneas alineadas (≈60 %)
       y NOTAS alto a la derecha (≈40 %, abarcando las 3 líneas). */
    const formulario = el('div', 'form-relacion');
    const cuerpo = el('div', 'form-relacion-cuerpo');
    const izquierda = el('div', 'form-relacion-izquierda');
    cuerpo.appendChild(izquierda);
    formulario.appendChild(cuerpo);
    const selTipo = el('select', 'entrada');
    for (const t of TIPOS_RELACION) selTipo.appendChild(new Option(NOMBRE_TIPO[t], t));

    const selEntidad = el('select', 'entrada');

    const selVocab = el('select', 'entrada');
    selVocab.title = 'Taxonomía de relaciones con restricciones de origen y destino';

    const pistaRestriccion = el('p', 'pista form-relacion-pista');
    formulario.appendChild(pistaRestriccion);

    let modoEdicion = false;
    let creandoRelacion = false;

    const nombrarTipos = (tipos) => (tipos || [])
      .map((t) => NOMBRE_TIPO[t] || t)
      .join(' o ');

    function esOrigenDeRelacion(r) {
      return Boolean(r)
        && r.origen_tipo === claveTipo()
        && Number(r.origen_id) === Number(filaActual.id);
    }

    function parejaActual() {
      if (modoEdicion && relacionEnEdicion) {
        const otro = selTipo.value || null;
        return esOrigenDeRelacion(relacionEnEdicion)
          ? { origen: claveTipo(), destino: otro }
          : { origen: otro, destino: claveTipo() };
      }
      return { origen: claveTipo(), destino: selTipo.value || null };
    }

    function poblarVocabulario({ filtrarDestino = true } = {}) {
      const anterior = selVocab.value;
      const { origen, destino } = parejaActual();
      const filtrar = filtrarDestino && Boolean(destino);
      const permitidas = new Set();
      for (const etiqueta of relacionesPorOrigen(origen)) {
        if (filtrar) {
          const restriccion = restriccionRelacion(etiqueta);
          if (!restriccion || !restriccion[1].includes(destino)) continue;
        }
        permitidas.add(etiqueta);
      }
      selVocab.innerHTML = '';
      selVocab.appendChild(new Option('— tipo de relación —', ''));
      for (const [categoria, etiquetas] of Object.entries(TAXONOMIA_RELACIONES)) {
        const lista = etiquetas.filter((etiqueta) => permitidas.has(etiqueta));
        if (!lista.length) continue;
        const grupo = el('optgroup');
        grupo.label = RELACIONES_CATEGORIAS_PLURAL[categoria] || categoria;
        for (const etiqueta of lista) grupo.appendChild(new Option(etiqueta, etiqueta));
        selVocab.appendChild(grupo);
      }
      /* Una relación heredada puede no cumplir las restricciones actuales:
         se ofrece como «actual» para poder consultarla o corregirla. */
      if (modoEdicion && relacionEnEdicion && relacionEnEdicion.tipo
        && !permitidas.has(relacionEnEdicion.tipo)
        && restriccionRelacion(relacionEnEdicion.tipo)) {
        const grupo = el('optgroup');
        grupo.label = 'Actual (fuera de la taxonomía para este par)';
        grupo.appendChild(new Option(`⚠ ${relacionEnEdicion.tipo}`, relacionEnEdicion.tipo));
        selVocab.appendChild(grupo);
      }
      selVocab.appendChild(new Option('⋯ Especificar otro tipo…', '__otro__'));
      if (anterior && [...selVocab.options].some((op) => op.value === anterior)) {
        selVocab.value = anterior;
      } else {
        selVocab.value = '';
      }
      sincronizarOtro();
      actualizarPistaRestriccion();
    }

    function actualizarPistaRestriccion() {
      const { origen, destino } = parejaActual();
      const tipo = selVocab.value;
      if (tipo === '__otro__') {
        pistaRestriccion.textContent = 'Tipo personalizado: sin restricciones de entidad.';
        return;
      }
      if (tipo) {
        const restriccion = restriccionRelacion(tipo);
        if (!restriccion) {
          pistaRestriccion.textContent = 'Tipo personalizado: sin restricciones de entidad.';
          return;
        }
        const aviso = modoEdicion && !relacionPermitida(tipo, origen, destino)
          ? ' · ⚠ la relación actual no cumple esta restricción'
          : '';
        pistaRestriccion.textContent =
          `Tipo «${tipo}»: origen ${nombrarTipos(restriccion[0])} → destino ${nombrarTipos(restriccion[1])}${aviso}.`;
        return;
      }
      if (!relacionesPorOrigen(origen).length) {
        pistaRestriccion.textContent =
          `La taxonomía no define relaciones con origen «${NOMBRE_TIPO[origen] || origen}»; `
          + 'solo puedes usar un tipo personalizado.';
      } else {
        pistaRestriccion.textContent =
          'Elige un tipo de relación; los tipos de destino se ajustan automáticamente.';
      }
    }

    function poblarEntidades({ conservar = false } = {}) {
      const anterior = conservar ? selEntidad.value : '';
      selEntidad.innerHTML = '';
      const tipo = selTipo.value;
      if (!tipo) {
        selEntidad.appendChild(new Option('— elige el tipo de entidad —', ''));
        return;
      }
      const opciones = ordenarEntidades(
        (cacheEnt[tipo] || []).filter((f) => !(claveTipo() === tipo && f.id === filaActual.id)),
        tipo
      );
      if (!opciones.length) selEntidad.appendChild(new Option('— sin registros —', ''));
      for (const f of opciones) selEntidad.appendChild(new Option(etiquetaEntidad(tipo, f), String(f.id)));
      if (anterior && [...selEntidad.options].some((op) => op.value === anterior)) {
        selEntidad.value = anterior;
      }
    }

    function poblarTiposDestino({ conservarEntidad = true } = {}) {
      if (modoEdicion) return; // los extremos de una relación existente no cambian
      const tipoAnterior = selTipo.value;
      const tipo = selVocab.value;
      let permitidos;
      if (tipo === '__otro__') {
        permitidos = TIPOS_RELACION.slice();
      } else if (tipo) {
        const lista = tiposDestinoRelacion(tipo, claveTipo());
        permitidos = lista == null ? TIPOS_RELACION.slice() : lista;
      } else {
        const set = new Set();
        for (const etiqueta of relacionesPorOrigen(claveTipo())) {
          const restriccion = restriccionRelacion(etiqueta);
          if (!restriccion) continue;
          for (const destino of restriccion[1]) set.add(destino);
        }
        permitidos = set.size ? TIPOS_RELACION.filter((t) => set.has(t)) : TIPOS_RELACION.slice();
      }
      selTipo.innerHTML = '';
      for (const t of TIPOS_RELACION) {
        if (permitidos.includes(t)) selTipo.appendChild(new Option(NOMBRE_TIPO[t], t));
      }
      if (!selTipo.options.length) selTipo.appendChild(new Option('— sin destinos permitidos —', ''));
      if ([...selTipo.options].some((op) => op.value === tipoAnterior)) selTipo.value = tipoAnterior;
      else selTipo.value = selTipo.options[0]?.value || '';
      poblarEntidades({ conservar: conservarEntidad && selTipo.value === tipoAnterior });
    }

    const inOtro = el('input', 'entrada');
    inOtro.placeholder = 'Tipo personalizado';
    inOtro.hidden = true;
    const sincronizarOtro = () => {
      const especial = selVocab.value === '__otro__';
      selVocab.hidden = especial;  // una sola celda visible: la fila no se desalinea
      inOtro.hidden = !especial;
      if (especial) inOtro.focus();
    };
    selVocab.addEventListener('change', () => {
      sincronizarOtro();
      if (modoEdicion) {
        actualizarPistaRestriccion();
        return;
      }
      poblarTiposDestino();
      if (!selVocab.value) poblarVocabulario({ filtrarDestino: false });
      actualizarPistaRestriccion();
    });
    selTipo.addEventListener('change', () => {
      poblarVocabulario({ filtrarDestino: true });
      poblarEntidades();
    });
    inOtro.addEventListener('input', actualizarPistaRestriccion);
    poblarVocabulario({ filtrarDestino: false });
    poblarTiposDestino();
    poblarEntidades();

    const inAnioIni = el('input', 'entrada');
    inAnioIni.type = 'number';
    inAnioIni.step = '1';
    inAnioIni.placeholder = 'Año inicial (ej.: 1489)';
    const inFechaIni = el('input', 'entrada');
    inFechaIni.placeholder = 'Fecha exacta desde (si la hay)';
    const cajaFechaIni = el('div', 'fecha-historica');
    cajaFechaIni.appendChild(inFechaIni);
    FechaHistorica.adjuntar(inFechaIni, {}, () => {}, { anio: () => inAnioIni.value });
    const selLugarIni = el('select', 'entrada');
    selLugarIni.title = 'Lugar (desde)';
    const poblarLugares = (sel) => {
      sel.innerHTML = '';
      sel.appendChild(new Option('— lugar —', ''));
      for (const f of cacheEnt.lugar || []) {
        sel.appendChild(new Option(etiquetaEntidad('lugar', f), String(f.id)));
      }
    };
    poblarLugares(selLugarIni);
    const inAnioFin = el('input', 'entrada');
    inAnioFin.type = 'number';
    inAnioFin.step = '1';
    inAnioFin.placeholder = 'Año de término';
    const inFechaFin = el('input', 'entrada');
    inFechaFin.placeholder = 'Fecha exacta hasta (si la hay)';
    const cajaFechaFin = el('div', 'fecha-historica');
    cajaFechaFin.appendChild(inFechaFin);
    FechaHistorica.adjuntar(inFechaFin, {}, () => {}, { anio: () => inAnioFin.value });
    const selLugarFin = el('select', 'entrada');
    selLugarFin.title = 'Lugar (hasta)';
    poblarLugares(selLugarFin);
    const inNotas = el('textarea', 'entrada form-relacion-notas');
    inNotas.placeholder = 'Notas (opcional)…';
    inNotas.rows = 4;

    /* FUENTES: respaldo documental de la relación (selección múltiple). */
    const fuentesSeleccionadas = new Set();
    const cajaFuentes = el('div', 'form-relacion-fuentes');
    const btnFuentes = el('button', 'entrada multi-fuentes-boton');
    btnFuentes.type = 'button';
    btnFuentes.title = 'Añadir una o varias fuentes como respaldo documental';
    const textoFuentes = el('span', 'multi-fuentes-texto', 'FUENTES · — sin fuentes —');
    const flechaFuentes = el('span', 'multi-fuentes-flecha', '▾');
    btnFuentes.append(textoFuentes, flechaFuentes);
    const panelFuentes = el('div', 'multi-fuentes-panel');
    panelFuentes.hidden = true;

    function actualizarResumenFuentes() {
      const seleccionadas = cacheFuentes.filter((f) => fuentesSeleccionadas.has(Number(f.id)));
      if (!seleccionadas.length) {
        textoFuentes.textContent = 'FUENTES · — sin fuentes —';
      } else {
        const titulos = seleccionadas.map((f) => f.titulo || `Fuente #${f.id}`).join(', ');
        textoFuentes.textContent =
          `FUENTES · ${seleccionadas.length} ${seleccionadas.length === 1 ? 'fuente' : 'fuentes'}: ${titulos}`;
      }
      for (const check of panelFuentes.querySelectorAll('input[type="checkbox"]')) {
        check.checked = fuentesSeleccionadas.has(Number(check.value));
      }
    }

    if (!cacheFuentes.length) {
      panelFuentes.appendChild(el('p', 'pista', 'No hay fuentes registradas en el proyecto.'));
    } else {
      for (const fuente of cacheFuentes) {
        const opcion = el('label', 'multi-fuentes-opcion');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.value = String(fuente.id);
        check.checked = fuentesSeleccionadas.has(Number(fuente.id));
        check.addEventListener('change', () => {
          const id = Number(fuente.id);
          if (check.checked) fuentesSeleccionadas.add(id);
          else fuentesSeleccionadas.delete(id);
          actualizarResumenFuentes();
          marcarRelacionSucio();
        });
        const info = el('span', 'multi-fuentes-info');
        info.appendChild(el('span', 'multi-fuentes-titulo', fuente.titulo || `Fuente #${fuente.id}`));
        const detalle = [
          fuente.categoria,
          fuente.tipo,
          [fuente.anio_inicio ?? null, fuente.anio_fin ?? null]
            .filter((v) => v != null).join(' – '),
        ].filter(Boolean).join(' · ');
        if (detalle) info.appendChild(el('small', '', detalle));
        opcion.append(check, info);
        panelFuentes.appendChild(opcion);
      }
    }

    btnFuentes.addEventListener('click', (ev) => {
      ev.stopPropagation();
      panelFuentes.hidden = !panelFuentes.hidden;
    });
    panelFuentes.addEventListener('mousedown', (ev) => ev.stopPropagation());
    if (refs.limpiarCierreFuentes) refs.limpiarCierreFuentes();
    const cerrarFuera = (ev) => {
      if (!cajaFuentes.contains(ev.target)) panelFuentes.hidden = true;
    };
    document.addEventListener('mousedown', cerrarFuera);
    refs.limpiarCierreFuentes = () => document.removeEventListener('mousedown', cerrarFuera);
    cajaFuentes.append(btnFuentes, panelFuentes);
    actualizarResumenFuentes();

    // Retícula izquierda: [tipo entidad · año] [nombre · fecha exacta] [tipo relación · lugar]
    izquierda.append(
      selTipo, selEntidad, selVocab, inOtro,
      inAnioIni, cajaFechaIni, selLugarIni,
      inAnioFin, cajaFechaFin, selLugarFin,
      cajaFuentes
    );
    const notasCol = el('div', 'form-relacion-notas');
    notasCol.appendChild(inNotas);
    cuerpo.appendChild(notasCol);

    const anioDe = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    };

    /* Referencias del formulario (para la edición de una relación) */
    refs.formRel = {
      selTipo, selEntidad, selVocab, inOtro,
      inAnioIni, inFechaIni, selLugarIni,
      inAnioFin, inFechaFin, selLugarFin, inNotas,
      fuentesSeleccionadas, actualizarResumenFuentes, panelFuentes,
    };

    const marcarRelacionSucio = () => {
      if (relacionSucio) return;
      relacionSucio = true;
      notificarCambios();
    };
    for (const entrada of [
      selTipo, selEntidad, selVocab, inOtro,
      inAnioIni, inFechaIni, selLugarIni,
      inAnioFin, inFechaFin, selLugarFin, inNotas,
    ]) {
      entrada.addEventListener('input', marcarRelacionSucio);
      entrada.addEventListener('change', marcarRelacionSucio);
    }

    const datosFormulario = () => {
      const especial = selVocab.value === '__otro__';
      return {
        tipo: especial ? inOtro.value.trim() : selVocab.value,
        anio_inicio: anioDe(inAnioIni.value),
        fecha_exacta_inicio: inFechaIni.value.trim(),
        fecha_exacta_inicio_meta: JSON.stringify(inFechaIni._meta || {}),
        lugar_inicio: selLugarIni.value ? Number(selLugarIni.value) : null,
        anio_fin: anioDe(inAnioFin.value),
        fecha_exacta_fin: inFechaFin.value.trim(),
        fecha_exacta_fin_meta: JSON.stringify(inFechaFin._meta || {}),
        lugar_fin: selLugarFin.value ? Number(selLugarFin.value) : null,
        notas: inNotas.value.trim(),
        fuentes: [...fuentesSeleccionadas],
      };
    };

    function extremosFormulario() {
      const otroTipo = selTipo.value;
      const otroId = Number(selEntidad.value);
      if (modoEdicion && relacionEnEdicion) {
        return esOrigenDeRelacion(relacionEnEdicion)
          ? {
              origen_tipo: claveTipo(),
              origen_id: filaActual.id,
              destino_tipo: otroTipo,
              destino_id: otroId,
            }
          : {
              origen_tipo: otroTipo,
              origen_id: otroId,
              destino_tipo: claveTipo(),
              destino_id: filaActual.id,
            };
      }
      return {
        origen_tipo: claveTipo(),
        origen_id: filaActual.id,
        destino_tipo: otroTipo,
        destino_id: otroId,
      };
    }

    async function crearRelacionDesdeFormulario() {
      if (creandoRelacion) return false;
      if (!selEntidad.value) {
        aviso('Selecciona la entidad destino.', 'error');
        return false;
      }
      const datos = datosFormulario();
      if (!datos.tipo) {
        aviso('Selecciona el tipo de relación o especifica uno.', 'error');
        return false;
      }
      if (restriccionRelacion(datos.tipo)
        && !relacionPermitida(datos.tipo, claveTipo(), selTipo.value)) {
        aviso(
          `La relación «${datos.tipo}» no está permitida de `
          + `${NOMBRE_TIPO[claveTipo()] || claveTipo()} a `
          + `${NOMBRE_TIPO[selTipo.value] || selTipo.value}.`,
          'error'
        );
        return false;
      }
      creandoRelacion = true;
      if (refs.btnAnadir) refs.btnAnadir.disabled = true;
      try {
        await llamar(api.relacionCrear({
          proyecto_id: proyecto.id,
          ...extremosFormulario(),
          ...datos,
        }, proyecto.id));
        relacionSucio = false;
        notificarCambios();
        aviso('Relación añadida', 'exito');
        await prepararRelaciones();
        notificarContadores();
        return true;
      } catch (err) {
        aviso(err.message, 'error');
        return false;
      } finally {
        creandoRelacion = false;
        if (refs.btnAnadir && refs.btnAnadir.isConnected) {
          refs.btnAnadir.disabled = Boolean(relacionEnEdicion);
        }
      }
    }
    async function actualizarRelacionDesdeFormulario() {
      if (!relacionEnEdicion) return true;
      if (!selEntidad.value) {
        aviso('Selecciona la entidad del otro extremo.', 'error');
        return false;
      }
      const datos = datosFormulario();
      if (!datos.tipo) {
        aviso('Selecciona el tipo de relación o especifica uno.', 'error');
        return false;
      }
      const extremos = extremosFormulario();
      const cambioTipo = datos.tipo !== relacionEnEdicion.tipo;
      const cambioExtremos = extremos.origen_tipo !== relacionEnEdicion.origen_tipo
        || Number(extremos.origen_id) !== Number(relacionEnEdicion.origen_id)
        || extremos.destino_tipo !== relacionEnEdicion.destino_tipo
        || Number(extremos.destino_id) !== Number(relacionEnEdicion.destino_id);
      if (restriccionRelacion(datos.tipo)
        && !relacionPermitida(datos.tipo, extremos.origen_tipo, extremos.destino_tipo)
        && (cambioTipo || cambioExtremos)) {
        aviso(
          `La relación «${datos.tipo}» no está permitida de `
          + `${NOMBRE_TIPO[extremos.origen_tipo] || extremos.origen_tipo} a `
          + `${NOMBRE_TIPO[extremos.destino_tipo] || extremos.destino_tipo}.`,
          'error'
        );
        return false;
      }
      try {
        await llamar(api.relacionActualizar(
          relacionEnEdicion.id,
          { ...datos, ...extremos },
          proyecto.id
        ));
        relacionEnEdicion = null;
        relacionSucio = false;
        notificarCambios();
        aviso('Relación actualizada', 'exito');
        await prepararRelaciones();
        return true;
      } catch (err) {
        aviso(err.message, 'error');
        return false;
      }
    }

    async function guardarRelacionPendiente() {
      if (!relacionSucio) return true;
      if (relacionEnEdicion) return actualizarRelacionDesdeFormulario();
      if (!refs.formRel || !selEntidad.value) {
        aviso('Hay una relación sin terminar: elige la entidad destino y el tipo, o cancela el formulario.', 'error');
        return false;
      }
      return crearRelacionDesdeFormulario();
    }

    const btnAnadir = el('button', 'btn', 'Añadir relación');
    refs.btnAnadir = btnAnadir;
    btnAnadir.addEventListener('click', () => { crearRelacionDesdeFormulario(); });

    const btnGuardarRelacion = el('button', 'btn btn-primario', 'Guardar relación');
    btnGuardarRelacion.disabled = true;
    btnGuardarRelacion.title = 'Guardar los cambios de la relación seleccionada';
    btnGuardarRelacion.addEventListener('click', () => { actualizarRelacionDesdeFormulario(); });

    refs.pistaEdicion = el('div', 'pista-edicion');
    refs.pistaEdicion.hidden = true;
    const btnCancelarEdicion = el('button', 'btn btn-mini', 'Cancelar edición');
    btnCancelarEdicion.addEventListener('click', () => {
      relacionEnEdicion = null;
      limpiarFormularioRelacion();
      pintarListaRelaciones();
    });
    refs.pistaEdicion.appendChild(btnCancelarEdicion);

    const accionesFormulario = el('div', 'form-relacion-botones');
    accionesFormulario.append(btnAnadir, btnGuardarRelacion);
    refs.btnGuardarRelacion = btnGuardarRelacion;
    refs.btnCancelarEdicion = btnCancelarEdicion;

    formulario.append(refs.pistaEdicion, accionesFormulario);
    bloque.appendChild(formulario);

    /* Cargar una relación existente en el formulario para editarla */
    function cargarRelacionEnFormulario(r) {
      relacionEnEdicion = r;
      modoEdicion = true;
      const f = refs.formRel;
      f.selTipo.disabled = false;
      f.selEntidad.disabled = false;
      f.selTipo.innerHTML = '';
      for (const t of TIPOS_RELACION) f.selTipo.appendChild(new Option(NOMBRE_TIPO[t], t));
      const esOrigen = esOrigenDeRelacion(r);
      const otroTipo = esOrigen ? r.destino_tipo : r.origen_tipo;
      const otroId = esOrigen ? r.destino_id : r.origen_id;
      if ([...f.selTipo.options].some((op) => op.value === otroTipo)) {
        f.selTipo.value = otroTipo;
      }
      poblarVocabulario({ filtrarDestino: true });
      poblarEntidades();
      if ([...f.selEntidad.options].some((op) => op.value === String(otroId ?? ''))) {
        f.selEntidad.value = String(otroId ?? '');
      }
      f.inAnioIni.value = r.anio_inicio ?? '';
      f.inFechaIni.value = r.fecha_exacta_inicio || '';
      try { f.inFechaIni._meta = r.fecha_exacta_inicio_meta ? JSON.parse(r.fecha_exacta_inicio_meta) : {}; } catch { f.inFechaIni._meta = {}; }
      f.inAnioFin.value = r.anio_fin ?? '';
      f.inFechaFin.value = r.fecha_exacta_fin || '';
      try { f.inFechaFin._meta = r.fecha_exacta_fin_meta ? JSON.parse(r.fecha_exacta_fin_meta) : {}; } catch { f.inFechaFin._meta = {}; }
      f.selLugarIni.value = r.lugar_inicio != null ? String(r.lugar_inicio) : '';
      f.selLugarFin.value = r.lugar_fin != null ? String(r.lugar_fin) : '';
      f.inNotas.value = r.notas || '';
      f.fuentesSeleccionadas.clear();
      for (const fuente of (r.fuentes || [])) {
        const id = Number(typeof fuente === 'object' ? fuente.id : fuente);
        if (Number.isFinite(id)) f.fuentesSeleccionadas.add(id);
      }
      f.actualizarResumenFuentes();
      const enTaxonomia = [...f.selVocab.options].some((op) => op.value === r.tipo);
      if (enTaxonomia) {
        f.selVocab.hidden = false;
        f.inOtro.hidden = true;
        f.selVocab.value = r.tipo;
        f.inOtro.value = '';
      } else {
        f.selVocab.hidden = true;
        f.selVocab.value = '__otro__';
        f.inOtro.hidden = false;
        f.inOtro.value = r.tipo || '';
      }
      actualizarPistaRestriccion();
      refs.pistaEdicion.hidden = false;
      const flecha = typeof window.flechaRelacion === 'function'
        ? window.flechaRelacion(r.tipo)
        : '→';
      refs.pistaEdicion.textContent = `Editando relación (${r.procedencia || 'MANUAL'}): ${r.origen_nombre} ${flecha} ${r.destino_nombre} (puedes cambiar el otro extremo). `;
      refs.pistaEdicion.appendChild(refs.btnCancelarEdicion);
      refs.btnCancelarEdicion.hidden = false;
      refs.btnGuardarRelacion.disabled = false;
      btnAnadir.disabled = true;
      relacionSucio = false;
      pintarListaRelaciones();
      formulario.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }

    function limpiarFormularioRelacion() {
      const f = refs.formRel;
      modoEdicion = false;
      f.selTipo.disabled = false;
      f.selEntidad.disabled = false;
      f.selTipo.innerHTML = '';
      for (const t of TIPOS_RELACION) f.selTipo.appendChild(new Option(NOMBRE_TIPO[t], t));
      f.selTipo.value = TIPOS_RELACION[0] || 'persona';
      f.selVocab.hidden = false;
      f.inOtro.hidden = true;
      f.selVocab.value = '';
      poblarVocabulario({ filtrarDestino: false });
      poblarTiposDestino({ conservarEntidad: false });
      f.inOtro.value = '';
      f.inAnioIni.value = '';
      f.inFechaIni.value = '';
      f.inFechaIni._meta = {};
      f.inAnioFin.value = '';
      f.inFechaFin.value = '';
      f.inFechaFin._meta = {};
      f.selLugarIni.value = '';
      f.selLugarFin.value = '';
      f.inNotas.value = '';
      f.fuentesSeleccionadas.clear();
      f.actualizarResumenFuentes();
      refs.pistaEdicion.hidden = true;
      refs.btnGuardarRelacion.disabled = true;
      btnAnadir.disabled = false;
      relacionSucio = false;
      notificarCambios();
    }

    /* La lista de relaciones (pintada aparte) necesita acceder al formulario */
    refs.cargarRelacion = cargarRelacionEnFormulario;
    refs.limpiarFormRel = limpiarFormularioRelacion;
    refs.guardarRelacionPendiente = guardarRelacionPendiente;
  }

  /* ---------------- API del módulo ---------------- */

  return {
    montar,
    hayCambios,
    puedeDeshacer: () => pilaDeshacer.length > 0,
    deshacer: () => deshacerFormulario(),
    async guardarPendiente() {
      let ok = true;
      if (relacionSucio && refs.guardarRelacionPendiente) {
        const relacionOk = await refs.guardarRelacionPendiente();
        if (!relacionOk) return false;
      }
      if (sucio && (modo === 'nuevo' || modo === 'editar')) {
        const resultado = await guardarFormulario();
        if (resultado === false) ok = false;
      }
      for (const tarea of [...tareasPendientes]) {
        if (!tarea.hayCambios()) continue;
        try {
          const resultado = await tarea.guardar();
          if (resultado === false) ok = false;
        } catch (err) {
          aviso(err.message, 'error');
          ok = false;
        }
      }
      return ok;
    },
    desmontar() {
      generacionMontaje++;
      generacionRelaciones++;
      generacionSeleccion++;
      if (temporizadorBusqueda) { clearTimeout(temporizadorBusqueda); temporizadorBusqueda = null; }
      if (temporizadorSnapshot) { clearTimeout(temporizadorSnapshot); temporizadorSnapshot = null; }
      tareasPendientes.clear();
      if (alRedimensionar) {
        window.removeEventListener('resize', alRedimensionar);
        alRedimensionar = null;
        escuchaResize = false;
      }
      if (refs.limpiarCierreFuentes) {
        refs.limpiarCierreFuentes();
        refs.limpiarCierreFuentes = null;
      }
      pilaDeshacer = [];
      bytesPilaDeshacer = 0;
      estadoFormulario = null;
      estadoInicialFormulario = null;
      lista = [];
      cacheReferencias = { lugar: [], institucion: [] };
      cacheRel = [];
      cacheEnt = {};
      cacheFuentes = [];
      filaActual = null;
      sucio = false;
      relacionSucio = false;
      relacionEnEdicion = null;
      objetivoBloqueId = null;
      objetivoCuadernoId = null;
      refs = {};
      cont = null;
      proyecto = null;
    },
  };
}

/* Las claves coinciden con los valores usados en la tabla `relaciones`. */

for (const clave of ['persona', 'institucion', 'lugar', 'patrimonio', 'fuente']) {
  const def = DEFINICIONES[clave];
  def.clave = clave;
  def.singularClave = () => clave;
  MODULOS[clave] = fabricarModuloEntidad(def);
}

