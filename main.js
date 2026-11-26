'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Menu, session } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { Worker } = require('worker_threads');
const { fileURLToPath } = require('url');
const db = require('./db/database');
const { dentroDe, rutaPermitida, resolverRutaReal } = require('./lib/rutas');
const { normalizarTipoRelacion } = require('./db/definiciones');
const {
  METRICAS_ANALISIS,
  MAX_NODOS_ANALISIS,
  MAX_ARISTAS_ANALISIS,
  MAX_TEXTO_ETIQUETA,
} = require('./lib/analisis-rsh/constantes');
const { restriccionRelacion, relacionPermitida } = require('./src/js/modulos/taxonomia-relaciones');
const { inspeccionarSQLite } = require('./db/sqlite');
const { recolectarSugerenciasBloques } = require('./lib/sugerencias-bloques');

let ventana = null;
let configCache = null;
const analisisEjecuciones = new Map();
let analisisSecuencia = 0;

/* ------------------------------------------------------------------ */
/* Configuración persistente (SQLite local o MySQL/MariaDB de equipo)  */
/* ------------------------------------------------------------------ */

function rutaConfig() {
  return path.join(app.getPath('userData'), 'himago-config.json');
}

let avisoConfig = null;

function rutaSqlitePorDefecto() {
  return path.join(app.getPath('userData'), 'himago.db');
}

function expandirRuta(ruta) {
  const texto = String(ruta || '').trim();
  if (!texto) return rutaSqlitePorDefecto();
  if (texto === '~') return os.homedir();
  if (texto.startsWith(`~${path.sep}`) || texto.startsWith('~/')) {
    return path.join(os.homedir(), texto.slice(2));
  }
  return texto;
}

function validarConfigEntrada(cfg) {
  if (!objetoValido(cfg)) throw new Error('Configuración no válida.');
  const datos = { ...cfg };
  if (datos.motor === 'mysql' || (!datos.motor && datos.host)) {
    const campos = [
      ['host', 255, true], ['user', 128, false], ['password', 2048, false],
      ['database', 64, true],
    ];
    for (const [campo, maximo, obligatorio] of campos) {
      const valor = String(datos[campo] ?? '');
      if (obligatorio && !valor.trim()) throw new Error(`El campo «${campo}» es obligatorio.`);
      if (valor.length > maximo) throw new Error(`El campo «${campo}» es demasiado largo.`);
      if (valor.includes('\u0000') || /[\r\n]/.test(valor)) {
        throw new Error(`El campo «${campo}» contiene caracteres no válidos.`);
      }
    }
    const puerto = Number(datos.port);
    if (datos.port !== undefined && datos.port !== '' && (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535)) {
      throw new Error('El puerto debe ser un número entre 1 y 65535.');
    }
    if (datos.sslCa != null && typeof datos.sslCa !== 'string') {
      throw new Error('El certificado CA no es válido.');
    }
    if (datos.sslCa && (datos.sslCa.length > 65535 || datos.sslCa.includes('\u0000'))) {
      throw new Error('El certificado CA no es válido.');
    }
  } else {
    const ruta = String(datos.ruta ?? '');
    if (ruta.length > 4096) throw new Error('La ruta de la base de datos es demasiado larga.');
    if (ruta.includes('\u0000')) throw new Error('La ruta de la base de datos contiene caracteres no válidos.');
  }
  return datos;
}

function esHostLocal(host) {
  const valor = String(host || '').trim().toLowerCase();
  return valor === 'localhost' || valor === '127.0.0.1' || valor === '::1' || valor === '[::1]';
}

function booleanoConfig(valor) {
  return valor === true || valor === 1 || valor === '1' || valor === 'true' || valor === 'sí';
}

function normalizarConfig(cfg) {
  const datos = validarConfigEntrada(cfg || {});
  if (datos.motor === 'mysql' || (!datos.motor && datos.host)) {
    const host = String(datos.host || '127.0.0.1').trim();
    return {
      motor: 'mysql',
      host,
      port: Number(datos.port) || 3306,
      user: String(datos.user || '').trim(),
      password: String(datos.password || ''),
      database: String(datos.database || 'himago').trim() || 'himago',
      ssl: datos.ssl === undefined ? !esHostLocal(host) : booleanoConfig(datos.ssl),
      sslVerificar: datos.sslVerificar === undefined ? true : booleanoConfig(datos.sslVerificar),
      sslCa: datos.sslCa ? String(datos.sslCa) : '',
    };
  }
  const valor = expandirRuta(datos.ruta);
  const absoluta = path.isAbsolute(valor)
    ? valor
    : path.resolve(app.getPath('documents'), valor);
  return { motor: 'sqlite', ruta: path.resolve(absoluta) };
}

function leerConfig() {
  if (configCache) {
    return avisoConfig ? { ...configCache, avisoConfig } : { ...configCache };
  }
  avisoConfig = null;
  const ruta = rutaConfig();
  try {
    const crudo = JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^\uFEFF/, ''));
    const datos = { ...crudo };
    if (datos.passwordCifrada) {
      try {
        if (safeStorage.isEncryptionAvailable()) {
          datos.password = safeStorage.decryptString(Buffer.from(String(datos.passwordCifrada), 'base64'));
          if (process.platform === 'linux'
            && typeof safeStorage.getSelectedStorageBackend === 'function'
            && safeStorage.getSelectedStorageBackend() === 'basic_text') {
            avisoConfig = 'El sistema no ofrece un almacén de claves seguro: la contraseña se guarda con protección básica del sistema de archivos.';
          }
        } else if (!datos.password) {
          datos.password = '';
          avisoConfig = 'La contraseña guardada no se puede descifrar en este equipo. Vuelve a introducirla en Configuración.';
        }
      } catch {
        datos.password = '';
        avisoConfig = 'No se pudo descifrar la contraseña guardada. Vuelve a introducirla en Configuración.';
      }
    }
    delete datos.passwordCifrada;
    configCache = normalizarConfig(datos);
    return avisoConfig ? { ...configCache, avisoConfig } : { ...configCache };
  } catch (err) {
    if (fs.existsSync(ruta)) {
      try {
        fs.copyFileSync(ruta, `${ruta}.corrupto-${Date.now()}`);
        avisoConfig = 'La configuración estaba dañada. Se ha conservado una copia y se usará la base local por defecto.';
      } catch { /* sin copia de seguridad */ }
    }
    console.error('[config] No se pudo leer la configuración:', err.message);
    configCache = normalizarConfig(null);
    return avisoConfig ? { ...configCache, avisoConfig } : { ...configCache };
  }
}

function guardarConfig(cfg) {
  const limpia = normalizarConfig(cfg);
  if (limpia.motor === 'sqlite') validarRutaSqliteSegura(limpia.ruta);
  const datos = { ...limpia };
  let avisoCifrado = null;
  if (limpia.motor === 'mysql' && limpia.password) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        datos.passwordCifrada = safeStorage.encryptString(limpia.password).toString('base64');
        delete datos.password;
      } else {
        avisoCifrado = 'El sistema no ofrece un almacén de claves seguro: la contraseña se guardará con protección básica del sistema de archivos.';
      }
    } catch {
      avisoCifrado = 'No se pudo cifrar la contraseña; se guardará con protección básica del sistema de archivos.';
    }
  }
  const destino = rutaConfig();
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const temporal = `${destino}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporal, JSON.stringify(datos, null, 2), { encoding: 'utf8', mode: 0o600 });
    try { fs.chmodSync(temporal, 0o600); } catch { /* Windows no usa mode */ }
    fs.renameSync(temporal, destino);
  } finally {
    try { if (fs.existsSync(temporal)) fs.unlinkSync(temporal); } catch { /* ya renombrado */ }
  }
  configCache = limpia;
  avisoConfig = avisoCifrado;
  return avisoCifrado ? { ...limpia, avisoConfig: avisoCifrado } : limpia;
}

function nombreArchivoSeguro(nombre) {
  return String(nombre || 'proyecto')
    .replace(/[\n\r\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'proyecto';
}

function destinoExportacionExplicito(datos) {
  if (!datos || !datos.destino) return null;
  if (app.isPackaged || process.env.HIMAGO_AUTOTEST !== '1') {
    throw new Error('Las exportaciones solo pueden guardarse eligiendo un destino en el diálogo del sistema.');
  }
  const destino = String(datos.destino);
  if (!rutaPermitida(destino, [app.getPath('temp')])) {
    throw new Error('La ruta de exportación de pruebas no está permitida.');
  }
  return destino;
}

function validarDestinoEscritura(destino) {
  if (!destino) return;
  const real = resolverRutaReal(destino);
  const basesApp = [
    app.getAppPath(),
    process.resourcesPath,
    path.dirname(app.getPath('exe')),
  ].filter(Boolean);
  for (const base of basesApp) {
    try {
      if (dentroDe(real, resolverRutaReal(base))) {
        throw new Error('No se puede escribir dentro de la carpeta de la aplicación.');
      }
    } catch (err) {
      if (err && /carpeta de la aplicación/i.test(err.message)) throw err;
    }
  }
}

async function escribirArchivoPrivado(destino, contenido) {
  validarDestinoEscritura(destino);
  const temporal = `${destino}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    await fs.promises.writeFile(temporal, contenido, { encoding: 'utf8', mode: 0o600 });
    try { await fs.promises.chmod(temporal, 0o600); } catch { /* Windows */ }
    try {
      await fs.promises.rename(temporal, destino);
    } catch (err) {
      if (!err || !['EEXIST', 'EPERM', 'ENOTEMPTY'].includes(err.code)) throw err;
      await fs.promises.rm(destino, { force: true });
      await fs.promises.rename(temporal, destino);
    }
  } finally {
    try { await fs.promises.rm(temporal, { force: true }); } catch { /* ya renombrado */ }
  }
}

/* ------------------------------------------------------------------ */
/* Análisis RSH: cálculo aislado en un worker_threads                  */
/* ------------------------------------------------------------------ */

function rutaWorkerAnalisisRSH() {
  const relativa = path.join('db', 'analisis-rsh-worker.js');
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', relativa);
  }
  return path.join(__dirname, relativa);
}

function textoAnalisis(valor, maximo = MAX_TEXTO_ETIQUETA) {
  return String(valor == null ? '' : valor).slice(0, maximo);
}

function numeroAnalisis(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function validarPayloadAnalisisRSH(payload) {
  if (!objetoValido(payload)) throw new Error('Datos de análisis no válidos.');
  const nodos = Array.isArray(payload.nodos) ? payload.nodos : [];
  const aristas = Array.isArray(payload.aristas) ? payload.aristas : [];
  if (nodos.length > MAX_NODOS_ANALISIS) {
    throw new Error(`La red es demasiado grande (máximo ${MAX_NODOS_ANALISIS} entidades).`);
  }
  if (aristas.length > MAX_ARISTAS_ANALISIS) {
    throw new Error(`La red es demasiado grande (máximo ${MAX_ARISTAS_ANALISIS} relaciones).`);
  }
  const metricas = Array.isArray(payload.metricas)
    ? [...new Set(payload.metricas.filter((m) => METRICAS_ANALISIS.includes(m)))]
    : [];
  if (!metricas.length) throw new Error('Selecciona al menos una métrica de Análisis RSH.');
  const opciones = objetoValido(payload.opciones) ? payload.opciones : {};
  const solicitudId = textoAnalisis(payload.solicitudId, 100)
    || `ars-${Date.now()}-${++analisisSecuencia}`;

  const limpio = {
    solicitudId,
    metricas,
    nodos: nodos.map((nodo) => ({
      id: textoAnalisis(nodo && nodo.id, 200),
      tipo: textoAnalisis(nodo && nodo.tipo, 40),
      entidadId: numeroAnalisis(nodo && nodo.entidadId),
      etiqueta: textoAnalisis(nodo && nodo.etiqueta),
      identificador: textoAnalisis(nodo && nodo.identificador, 40),
      nombre: textoAnalisis(nodo && nodo.nombre, 200),
      apellidos: textoAnalisis(nodo && nodo.apellidos, 200),
      genero: textoAnalisis(nodo && nodo.genero, 80),
      tipoEntidad: textoAnalisis(nodo && nodo.tipoEntidad, 120),
      notas: textoAnalisis(nodo && nodo.notas, 500),
    })),
    aristas: aristas.map((arista) => ({
      id: arista && arista.id,
      origen: textoAnalisis(arista && arista.origen, 200),
      destino: textoAnalisis(arista && arista.destino, 200),
      tipo: textoAnalisis(arista && arista.tipo, 200),
      categoria: textoAnalisis(arista && arista.categoria, 120),
      procedencia: textoAnalisis(arista && arista.procedencia, 40),
      anioDesde: numeroAnalisis(arista && arista.anioDesde),
      anioHasta: numeroAnalisis(arista && arista.anioHasta),
      fecha: textoAnalisis(arista && arista.fecha, 300),
    })),
    opciones: {
      dirigida: opciones.dirigida !== false,
      incluirAislados: opciones.incluirAislados !== false,
      procedencia: ['todas', 'manuales', 'editadas', 'automatizadas'].includes(opciones.procedencia)
        ? opciones.procedencia
        : 'todas',
      resolucion: Number.isFinite(Number(opciones.resolucion)) ? Number(opciones.resolucion) : undefined,
      semilla: Number.isFinite(Number(opciones.semilla)) ? Math.trunc(Number(opciones.semilla)) : undefined,
      repeticiones: Number.isFinite(Number(opciones.repeticiones)) ? Number(opciones.repeticiones) : undefined,
    },
  };
  if (Buffer.byteLength(JSON.stringify(limpio), 'utf8') > 64 * 1024 * 1024) {
    throw new Error('La red es demasiado grande para el Análisis RSH (máximo 64 MB de datos).');
  }
  return limpio;
}

function ejecutarAnalisisRSH(payload, evento) {
  const solicitudId = payload.solicitudId;
  if (analisisEjecuciones.has(solicitudId)) {
    throw new Error('Ya hay un Análisis RSH en curso con ese identificador.');
  }
  if (analisisEjecuciones.size >= 4) {
    throw new Error('Hay demasiados cálculos de Análisis RSH en curso. Espera o cancela uno.');
  }
  return new Promise((resolver, rechazar) => {
    let worker;
    try {
      worker = new Worker(rutaWorkerAnalisisRSH(), {
        resourceLimits: { maxOldGenerationSizeMb: 1024 },
      });
    } catch (err) {
      rechazar(err);
      return;
    }
    const ejecucion = {
      worker,
      rechazar,
      terminada: false,
      solicitudId,
      temporizador: null,
    };
    const finalizar = (accion, valor) => {
      if (ejecucion.terminada) return;
      ejecucion.terminada = true;
      if (ejecucion.temporizador) clearTimeout(ejecucion.temporizador);
      analisisEjecuciones.delete(solicitudId);
      try { worker.terminate(); } catch { /* ya terminado */ }
      accion(valor);
    };
    ejecucion.temporizador = setTimeout(() => {
      finalizar(rechazar, new Error('El Análisis RSH superó el tiempo máximo de cálculo.'));
    }, 5 * 60 * 1000);
    analisisEjecuciones.set(solicitudId, ejecucion);
    worker.on('message', (mensaje) => {
      if (!mensaje || mensaje.solicitudId !== solicitudId) return;
      if (mensaje.tipo === 'progreso') {
        if (evento && evento.sender && !evento.sender.isDestroyed()) {
          evento.sender.send('analisis:progreso', {
            solicitudId,
            metrica: mensaje.metrica,
            hechas: mensaje.hechas,
            total: mensaje.total,
            aproximada: Boolean(mensaje.aproximada),
          });
        }
        return;
      }
      if (mensaje.tipo === 'resultado') {
        finalizar(resolver, mensaje.resultado);
        return;
      }
      if (mensaje.tipo === 'error') {
        finalizar(rechazar, new Error(mensaje.error || 'No se pudo calcular el Análisis RSH.'));
      }
    });
    worker.on('error', (err) => finalizar(rechazar, err));
    worker.on('exit', (codigo) => {
      if (!ejecucion.terminada) {
        finalizar(rechazar, new Error(`El cálculo del Análisis RSH terminó inesperadamente (código ${codigo}).`));
      }
    });
    try {
      worker.postMessage(payload);
    } catch (err) {
      finalizar(rechazar, err);
    }
  });
}


const TIPOS_ENTIDAD = ['persona', 'institucion', 'lugar', 'patrimonio', 'fuente'];

function idValido(id) {
  const n = Number(id);
  return Number.isInteger(n) && n > 0;
}

function tipoValido(tipo, permitirFuente = true) {
  const validos = permitirFuente ? TIPOS_ENTIDAD : TIPOS_ENTIDAD.filter((t) => t !== 'fuente');
  return validos.includes(tipo);
}

function objetoValido(valor) {
  return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
}

const NOMBRES_TIPO_RELACION = {
  persona: 'Persona',
  institucion: 'Institución',
  lugar: 'Lugar',
  patrimonio: 'Patrimonio',
  fuente: 'Fuente',
};

/** Valida una pareja origen → destino contra las restricciones de NRELACIONES.
    Los tipos personalizados (fuera de la taxonomía) no se restringen. */
function validarRelacionPermitida(tipo, origenTipo, destinoTipo) {
  const normalizado = normalizarTipoRelacion(tipo);
  if (!normalizado || !restriccionRelacion(normalizado)) return;
  if (!relacionPermitida(normalizado, origenTipo, destinoTipo)) {
    throw new Error(
      `La relación «${normalizado}» no está permitida de `
      + `${NOMBRES_TIPO_RELACION[origenTipo] || origenTipo} a `
      + `${NOMBRES_TIPO_RELACION[destinoTipo] || destinoTipo}.`
    );
  }
}

function basesPermitidas() {
  return [
    app.getPath('documents'),
    app.getPath('desktop'),
    app.getPath('downloads'),
    app.getPath('temp'),
  ];
}

function basesSqlitePermitidas() {
  return [app.getPath('userData'), ...basesPermitidas()];
}

function validarRutaSqliteSegura(ruta) {
  const destino = path.resolve(String(ruta || ''));
  if (!rutaPermitida(destino, basesSqlitePermitidas())) {
    throw new Error(
      'La base SQLite debe estar en la carpeta de datos de H-IMAGO, Documentos, Escritorio, Descargas o una carpeta temporal.'
    );
  }
  validarDestinoEscritura(destino);
  const userData = path.resolve(app.getPath('userData'));
  const extension = /\.(db|sqlite|sqlite3)$/i.test(path.basename(destino));
  if (dentroDe(destino, userData)) {
    const relativa = path.relative(userData, destino);
    const partes = relativa.split(path.sep).filter(Boolean);
    const enRaizPropia = partes.length === 1
      && /^himago(?:-[A-Za-z0-9_-]+)?\.db$/i.test(partes[0]);
    const enCarpetaPropia = partes.length >= 2
      && partes[0].toLowerCase() === 'databases'
      && extension;
    if (!enRaizPropia && !enCarpetaPropia) {
      throw new Error(
        'Dentro de la carpeta de datos de H-IMAGO solo se permite himago.db o archivos .db en databases/.'
      );
    }
  } else if (!extension) {
    const info = inspeccionarSQLite(destino);
    if (!info.existe || !info.himago) {
      throw new Error('El archivo SQLite debe tener extensión .db, .sqlite o .sqlite3.');
    }
  }
  const info = inspeccionarSQLite(destino);
  let vacia = false;
  try { vacia = info.existe && fs.statSync(destino).size === 0; } catch { /* sin acceso */ }
  if (info.existe && !info.himago && !vacia) {
    throw new Error(
      'El archivo existe pero no parece una base de datos de H-IMAGO. Elige otro archivo o crea una base nueva.'
    );
  }
}

const TAMANO_MAXIMO_IMPORTACION = 50 * 1024 * 1024;

async function leerJsonDeArchivo(origen) {
  const manejador = await fs.promises.open(origen, 'r');
  try {
    const info = await manejador.stat();
    if (!info.isFile()) throw new Error('La ruta indicada no es un archivo.');
    if (info.size > TAMANO_MAXIMO_IMPORTACION) {
      throw new Error(`El archivo es demasiado grande (máximo ${Math.round(TAMANO_MAXIMO_IMPORTACION / 1024 / 1024)} MB).`);
    }
    const texto = await manejador.readFile('utf8');
    if (Buffer.byteLength(texto, 'utf8') > TAMANO_MAXIMO_IMPORTACION) {
      throw new Error(`El archivo es demasiado grande (máximo ${Math.round(TAMANO_MAXIMO_IMPORTACION / 1024 / 1024)} MB).`);
    }
    return texto;
  } finally {
    await manejador.close();
  }
}

/* ------------------------------------------------------------------ */
/* Envoltorio de manejadores IPC: devuelve {ok, datos|error}           */
/* ------------------------------------------------------------------ */

function remitentePermitido(evento) {
  try {
    const frame = evento && (evento.senderFrame
      || (evento.sender && evento.sender.mainFrame));
    if (!frame || !frame.url) return false;
    return navegacionInterna(frame.url);
  } catch {
    return false;
  }
}

function gestionar(canal, fn) {
  ipcMain.handle(canal, async (evento, ...args) => {
    if (!remitentePermitido(evento)) {
      console.error(`[${canal}] remitente IPC no autorizado`);
      return { ok: false, error: 'Origen no autorizado.' };
    }
    try {
      return { ok: true, datos: await fn(...args) };
    } catch (err) {
      console.error(`[${canal}]`, err);
      return { ok: false, error: traducirError(err) };
    }
  });
}

function gestionarConEvento(canal, fn) {
  ipcMain.handle(canal, async (evento, ...args) => {
    if (!remitentePermitido(evento)) {
      console.error(`[${canal}] remitente IPC no autorizado`);
      return { ok: false, error: 'Origen no autorizado.' };
    }
    try {
      return { ok: true, datos: await fn(evento, ...args) };
    } catch (err) {
      console.error(`[${canal}]`, err);
      return { ok: false, error: traducirError(err) };
    }
  });
}

function traducirError(err) {
  const msg = err && err.message ? err.message : String(err);
  if (err && (err.code === 'ECONNREFUSED' || /ECONNREFUSED/.test(msg))) {
    return 'No se pudo conectar con MySQL (ECONNREFUSED). ¿Está el servidor en marcha y el puerto correcto?';
  }
  if (err && err.code === 'ER_ACCESS_DENIED_ERROR') {
    return 'Acceso denegado por MySQL: revisa usuario y contraseña.';
  }
  if (err && err.code === 'ENOTFOUND') {
    return 'No se encontró el servidor MySQL (ENOTFOUND). Revisa el host.';
  }
  if (/unable to open database file/i.test(msg)) {
    return 'No se pudo abrir el archivo SQLite. Comprueba la ruta y los permisos de la carpeta.';
  }
  if (/database is locked/i.test(msg)) {
    return 'La base SQLite está bloqueada por otro proceso. Cierra otras instancias de H-IMAGO e inténtalo de nuevo.';
  }
  if ((err && err.code === 'ER_DUP_ENTRY') || /UNIQUE constraint failed/i.test(msg)) {
    return 'Ya existe un registro con ese identificador. Vuelve a intentarlo.';
  }
  const campoObligatorio = /NOT NULL constraint failed:\s*([\w]+)\.([\w]+)/i.exec(msg);
  if (campoObligatorio) {
    return `El campo «${campoObligatorio[2]}» es obligatorio.`;
  }
  if (err && (err.code === 'ER_DATA_TOO_LONG' || /Data too long/i.test(msg))) {
    return 'Uno de los valores es demasiado largo para la base de datos.';
  }
  if (err && (err.code === 'ER_NO_SUCH_TABLE' || /no such table/i.test(msg))) {
    return 'La base de datos no tiene el esquema esperado. Revisa la configuración o vuelve a conectar.';
  }
  /* No devolver rutas, nombres de columnas ni mensajes internos del motor. */
  if (/SQLITE_|SQL syntax|Unknown column|ER_[A-Z_]+|constraint failed|syntax error/i.test(msg)) {
    return 'No se pudo completar la operación con la base de datos.';
  }
  if (/[A-Za-z]:\\|\/(?:Users|home|tmp|var|private)\//.test(msg)) {
    return 'No se pudo acceder al archivo solicitado.';
  }
  return msg;
}

/* ------------------------------------------------------------------ */
/* Registro de canales IPC                                             */
/* ------------------------------------------------------------------ */

function configPublica(cfg) {
  if (!cfg) return cfg;
  const { password, ...resto } = cfg;
  return { ...resto, passwordConfigurada: Boolean(password) };
}

/* La contraseña guardada solo puede reutilizarse contra exactamente la misma
   conexión. Sin esta comprobación, cualquier código del renderer podría
   descifrarla y enviarla a un host distinto con mantenerPassword: true. */
function mismaConexionMySQL(propuesta, guardada) {
  try {
    const a = normalizarConfig(propuesta);
    const b = normalizarConfig(guardada);
    if (a.motor !== 'mysql' || b.motor !== 'mysql') return false;
    return Number(a.port || 3306) === Number(b.port || 3306)
      && String(a.host || '') === String(b.host || '')
      && String(a.user || '') === String(b.user || '')
      && String(a.database || '') === String(b.database || '')
      && Boolean(a.ssl) === Boolean(b.ssl)
      && Boolean(a.sslVerificar) === Boolean(b.sslVerificar)
      && String(a.sslCa || '') === String(b.sslCa || '');
  } catch {
    return false;
  }
}

function exigirMismaConexionParaPassword(cfg) {
  if (!cfg || !cfg.mantenerPassword) return;
  if (cfg.motor === 'sqlite') return;
  const actual = leerConfig();
  if (actual.motor !== 'mysql') {
    throw new Error('No hay una contraseña MySQL guardada que reutilizar.');
  }
  if (!mismaConexionMySQL(cfg, actual)) {
    throw new Error(
      'La contraseña guardada solo puede reutilizarse con la misma conexión. '
      + 'Introduce de nuevo la contraseña al cambiar host, puerto, usuario, base de datos o TLS.'
    );
  }
}

function registrarIPC() {
  ipcMain.on('app:salir', (evento) => {
    if (remitentePermitido(evento)) app.quit();
  });

  gestionar('config:obtener', () => {
    const cfg = leerConfig();
    const publica = configPublica(cfg);
    return avisoConfig ? { ...publica, avisoConfig } : publica;
  });

  gestionar('config:guardar', (cfg) => {
    if (!objetoValido(cfg)) throw new Error('Configuración no válida.');
    exigirMismaConexionParaPassword(cfg);
    let datos = cfg;
    if (cfg.mantenerPassword && (!cfg.motor || cfg.motor === 'mysql')) {
      const actual = leerConfig();
      datos = { ...cfg, password: actual.password || '' };
    }
    delete datos.mantenerPassword;
    return configPublica(guardarConfig(datos));
  });

  gestionar('db:conectar', async (cfg) => {
    if (cfg != null && !objetoValido(cfg)) throw new Error('Configuración no válida.');
    exigirMismaConexionParaPassword(cfg);
    if (cfg && cfg.mantenerPassword) {
      const actual = leerConfig();
      cfg = { ...cfg, password: actual.password || '' };
    }
    if (cfg) delete cfg.mantenerPassword;
    const final = cfg ? normalizarConfig(cfg) : leerConfig();
    if (!final) throw new Error('No hay configuración de base de datos guardada. Abre Configuración.');
    if (final.motor === 'sqlite') validarRutaSqliteSegura(final.ruta);
    await db.conectar(final);
    return {
      database: final.database || db.config?.database,
      host: final.host || null,
      motor: db.motor,
      ruta: db.config?.ruta || null,
    };
  });

  gestionar('db:probar', async (cfg) => {
    if (cfg != null && !objetoValido(cfg)) throw new Error('Configuración no válida.');
    exigirMismaConexionParaPassword(cfg);
    if (cfg && cfg.mantenerPassword) {
      const actual = leerConfig();
      cfg = { ...cfg, password: actual.password || '' };
    }
    if (cfg) delete cfg.mantenerPassword;
    let datos = { ...leerConfig(), ...cfg };
    if (datos.motor !== 'mysql' && !datos.ruta) datos.ruta = rutaSqlitePorDefecto();
    if (datos.motor === 'mysql' && !datos.database) datos.database = 'himago';
    datos = normalizarConfig(datos);
    if (datos.motor === 'sqlite') validarRutaSqliteSegura(datos.ruta);
    return db.probar(datos);
  });

  gestionar('db:estado', () => ({
    conectado: db.estaConectado(),
    motor: db.motor,
    database: db.config?.database,
    ruta: db.config?.ruta,
  }));

  gestionar('proyecto:listar', async () => db.listarProyectos());
  gestionar('proyecto:crear', async (datos) => {
    if (!objetoValido(datos)) throw new Error('Datos de proyecto no válidos.');
    return db.crearProyecto(datos);
  });
  gestionar('proyecto:obtener', async (id) => {
    if (!idValido(id)) throw new Error('Identificador de proyecto no válido.');
    return db.obtenerProyecto(id);
  });
  gestionar('proyecto:eliminar', async (id) => {
    if (!idValido(id)) throw new Error('Identificador de proyecto no válido.');
    return db.eliminarProyecto(id);
  });
  gestionar('proyecto:guardar', async (id) => {
    if (!idValido(id)) throw new Error('Identificador de proyecto no válido.');
    return db.guardarProyecto(id);
  });
  gestionar('proyecto:editar', async (id, datos) => {
    if (!idValido(id)) throw new Error('Identificador de proyecto no válido.');
    if (!objetoValido(datos)) throw new Error('Datos de proyecto no válidos.');
    return db.actualizarProyecto(id, datos);
  });

  /* Exportar / importar proyectos como archivo .json portátil.
     Si se pasa ruta explícita se omite el diálogo (útil para pruebas). */
  gestionar('proyecto:exportar', async (id, destino = null) => {
    if (!idValido(id)) throw new Error('Identificador de proyecto no válido.');
    if (destino && !rutaPermitida(destino, basesPermitidas())) throw new Error('La ruta de exportación no está permitida.');
    if (!destino) {
      const proyecto = await db.obtenerProyecto(id);
      const opciones = {
        title: 'Exportar proyecto H-IMAGO',
        defaultPath: `${nombreArchivoSeguro(proyecto.nombre)}.json`,
        filters: [{ name: 'Proyecto H-IMAGO', extensions: ['json'] }],
      };
      const res = ventana
        ? await dialog.showSaveDialog(ventana, opciones)
        : await dialog.showSaveDialog(opciones);
      if (res.canceled || !res.filePath) return { cancelado: true };
      destino = res.filePath;
    }
    const datos = await db.exportarProyecto(id);
    await escribirArchivoPrivado(destino, JSON.stringify(datos, null, 2));
    return { ruta: destino, nombre: datos.proyecto.nombre };
  });

  gestionar('proyecto:importar', async (origen = null) => {
    if (origen && !rutaPermitida(origen, basesPermitidas())) throw new Error('La ruta de importación no está permitida.');
    if (!origen) {
      const opciones = {
        title: 'Importar proyecto H-IMAGO',
        filters: [{ name: 'Proyecto H-IMAGO', extensions: ['json'] }],
        properties: ['openFile'],
      };
      const res = ventana
        ? await dialog.showOpenDialog(ventana, opciones)
        : await dialog.showOpenDialog(opciones);
      if (res.canceled || !res.filePaths.length) return { cancelado: true };
      [origen] = res.filePaths;
    }
    const texto = await leerJsonDeArchivo(origen);
    let obj;
    try {
      obj = JSON.parse(texto.replace(/^\uFEFF/, ''));
    } catch {
      throw new Error('El archivo no contiene un JSON válido.');
    }
    const proyecto = await db.importarProyecto(obj);
    return { proyecto, ruta: origen };
  });

  gestionar('entidad:listar', async (tipo, proyectoId) => {
    if (!tipoValido(tipo)) throw new Error('Tipo de entidad no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    return db.listarEntidades(tipo, proyectoId);
  });
  gestionar('entidad:listar-resumen', async (tipo, proyectoId) => {
    if (!tipoValido(tipo)) throw new Error('Tipo de entidad no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    return db.listarEntidadesResumen(tipo, proyectoId);
  });
  gestionar('entidad:obtener', async (tipo, id, proyectoId) => {
    if (!tipoValido(tipo)) throw new Error('Tipo de entidad no válido.');
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarProyectoEntidad(tipo, id, proyectoId);
    return db.obtenerEntidad(tipo, id);
  });
  gestionar('entidad:crear', async (tipo, proyectoId, datos) => {
    if (!tipoValido(tipo)) throw new Error('Tipo de entidad no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    if (!objetoValido(datos)) throw new Error('Datos de entidad no válidos.');
    return db.crearEntidad(tipo, proyectoId, datos);
  });
  gestionar('entidad:actualizar', async (tipo, id, datos, proyectoId) => {
    if (!tipoValido(tipo)) throw new Error('Tipo de entidad no válido.');
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    if (!objetoValido(datos)) throw new Error('Datos de entidad no válidos.');
    await db.verificarProyectoEntidad(tipo, id, proyectoId);
    return db.actualizarEntidad(tipo, id, datos);
  });
  gestionar('entidad:eliminar', async (tipo, id, proyectoId) => {
    if (!tipoValido(tipo)) throw new Error('Tipo de entidad no válido.');
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarProyectoEntidad(tipo, id, proyectoId);
    return db.eliminarEntidad(tipo, id);
  });
  gestionar('entidad:fusionar', async (tipo, supervivienteId, absorbidaId, proyectoId) => {
    if (!tipoValido(tipo, false)) throw new Error('Tipo de entidad no válido para fusión.');
    if (!idValido(supervivienteId) || !idValido(absorbidaId)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarProyectoEntidad(tipo, supervivienteId, proyectoId);
    await db.verificarProyectoEntidad(tipo, absorbidaId, proyectoId);
    return db.fusionarEntidades(tipo, supervivienteId, absorbidaId);
  });

  gestionar('coincidencia:listar', async (proyectoId) => {
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    return db.listarCoincidencias(proyectoId);
  });
  gestionar('coincidencia:crear', async (datos, proyectoId) => {
    if (!objetoValido(datos)) throw new Error('Datos de coincidencia no válidos.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    if (Number(datos.proyecto_id) !== Number(proyectoId)) {
      throw new Error('La coincidencia no pertenece al proyecto activo.');
    }
    return db.crearCoincidencia(datos);
  });
  gestionar('coincidencia:eliminar', async (id, proyectoId) => {
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarCoincidenciaProyecto(id, proyectoId);
    return db.eliminarCoincidencia(id);
  });

  gestionar('relacion:listar', async (proyectoId) => {
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    return db.listarRelaciones(proyectoId);
  });
  gestionar('relacion:listar-entidad', async (proyectoId, tipo, id) => {
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    if (!tipoValido(tipo, false)) throw new Error('Tipo de entidad no válido.');
    if (!idValido(id)) throw new Error('Identificador no válido.');
    return db.listarRelacionesDeEntidad(proyectoId, tipo, id);
  });
  gestionar('relacion:crear', async (datos, proyectoId) => {
    if (!objetoValido(datos)) throw new Error('Datos de relación no válidos.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    if (Number(datos.proyecto_id) !== Number(proyectoId)) {
      throw new Error('La relación no pertenece al proyecto activo.');
    }
    validarRelacionPermitida(datos.tipo, datos.origen_tipo, datos.destino_tipo);
    return db.crearRelacion(datos);
  });
  gestionar('relacion:actualizar', async (id, datos, proyectoId) => {
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!objetoValido(datos)) throw new Error('Datos de relación no válidos.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarRelacionProyecto(id, proyectoId);
    const actual = await db.obtenerRelacion(id);
    if (!actual) throw new Error('La relación no existe.');
    /* Si el tipo o los extremos no cambian, se permite conservar una relación
       heredada que ya no cumpla la taxonomía (solo se actualizan fechas,
       notas o fuentes). */
    const tipoNuevo = normalizarTipoRelacion(datos.tipo);
    const origenTipo = datos.origen_tipo || actual.origen_tipo;
    const destinoTipo = datos.destino_tipo || actual.destino_tipo;
    const cambioExtremos = origenTipo !== actual.origen_tipo
      || destinoTipo !== actual.destino_tipo
      || (datos.origen_id != null && Number(datos.origen_id) !== Number(actual.origen_id))
      || (datos.destino_id != null && Number(datos.destino_id) !== Number(actual.destino_id));
    if (tipoNuevo && (tipoNuevo !== actual.tipo || cambioExtremos)) {
      validarRelacionPermitida(tipoNuevo, origenTipo, destinoTipo);
    }
    return db.actualizarRelacion(id, datos);
  });
  gestionar('relacion:eliminar', async (id, proyectoId) => {
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarRelacionProyecto(id, proyectoId);
    return db.eliminarRelacion(id);
  });

  gestionar('cuaderno:listar', async (fuenteId, proyectoId) => {
    if (!idValido(fuenteId)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarFuenteProyecto(fuenteId, proyectoId);
    return db.listarCuadernosResumen(fuenteId);
  });
  gestionar('cuaderno:obtener', async (id, proyectoId) => {
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarCuadernoProyecto(id, proyectoId);
    return db.obtenerCuaderno(id);
  });
  gestionar('cuaderno:crear', async (fuenteId, proyectoId) => {
    if (!idValido(fuenteId)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarFuenteProyecto(fuenteId, proyectoId);
    return db.crearCuaderno(fuenteId);
  });
  gestionar('cuaderno:actualizar', async (id, datos, proyectoId) => {
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!objetoValido(datos)) throw new Error('Datos de cuaderno no válidos.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarCuadernoProyecto(id, proyectoId);
    return db.actualizarCuaderno(id, datos);
  });
  gestionar('cuaderno:eliminar', async (id, proyectoId) => {
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarCuadernoProyecto(id, proyectoId);
    return db.eliminarCuaderno(id);
  });

  gestionar('bloque:listar', async (fuenteId, proyectoId) => {
    if (!idValido(fuenteId)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarFuenteProyecto(fuenteId, proyectoId);
    return db.listarBloquesResumen(fuenteId);
  });
  gestionar('bloque:obtener', async (id, proyectoId) => {
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarBloqueProyecto(id, proyectoId);
    return db.obtenerBloqueRegistro(id);
  });
  gestionar('bloque:sugerencias', async (fuenteId, proyectoId) => {
    if (!idValido(fuenteId)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarFuenteProyecto(fuenteId, proyectoId);
    return recolectarSugerenciasBloques(await db.listarDatosBloques(fuenteId));
  });
  gestionar('bloque:crear', async (fuenteId, datos, proyectoId) => {
    if (!idValido(fuenteId)) throw new Error('Identificador no válido.');
    if (!objetoValido(datos)) throw new Error('Datos de bloque no válidos.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarFuenteProyecto(fuenteId, proyectoId);
    return db.crearBloqueRegistro(fuenteId, datos);
  });
  gestionar('bloque:actualizar', async (id, datos, proyectoId) => {
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!objetoValido(datos)) throw new Error('Datos de bloque no válidos.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarBloqueProyecto(id, proyectoId);
    return db.actualizarBloqueRegistro(id, datos);
  });
  gestionar('bloque:eliminar', async (id, proyectoId) => {
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarBloqueProyecto(id, proyectoId);
    return db.eliminarBloqueRegistro(id);
  });

  /* Descargar / importar un bloque de registro concreto. */
  gestionar('bloque:exportar', async (id, proyectoId, destino = null) => {
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarBloqueProyecto(id, proyectoId);
    if (destino && !rutaPermitida(destino, basesPermitidas())) throw new Error('La ruta de exportación no está permitida.');
    const datos = await db.exportarBloqueRegistro(id);
    if (!destino) {
      const opciones = {
        title: 'Descargar bloque de registro',
        defaultPath: `bloque-${nombreArchivoSeguro(datos.tipo)}-${id}.json`,
        filters: [{ name: 'Bloque H-IMAGO', extensions: ['json'] }],
      };
      const res = ventana
        ? await dialog.showSaveDialog(ventana, opciones)
        : await dialog.showSaveDialog(opciones);
      if (res.canceled || !res.filePath) return { cancelado: true };
      destino = res.filePath;
    }
    await escribirArchivoPrivado(destino, JSON.stringify(datos, null, 2));
    return { cancelado: false, ruta: destino, tipo: datos.tipo };
  });

  gestionar('bloque:importar', async (id, proyectoId, origen = null) => {
    if (!idValido(id)) throw new Error('Identificador no válido.');
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    await db.verificarBloqueProyecto(id, proyectoId);
    if (origen && !rutaPermitida(origen, basesPermitidas())) throw new Error('La ruta de importación no está permitida.');
    if (!origen) {
      const opciones = {
        title: 'Importar bloque de registro',
        properties: ['openFile'],
        filters: [{ name: 'Bloque H-IMAGO', extensions: ['json'] }],
      };
      const res = ventana
        ? await dialog.showOpenDialog(ventana, opciones)
        : await dialog.showOpenDialog(opciones);
      if (res.canceled || !res.filePaths.length) return { cancelado: true };
      origen = res.filePaths[0];
    }
    const texto = await leerJsonDeArchivo(origen);
    let obj;
    try { obj = JSON.parse(texto.replace(/^\uFEFF/, '')); } catch {
      throw new Error('El archivo no contiene un JSON válido.');
    }
    const resultado = await db.importarBloqueRegistro(id, obj);
    return { cancelado: false, archivo: origen, ...resultado };
  });

  gestionar('busqueda:global', async (proyectoId, opciones) => {
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    if (opciones != null && !objetoValido(opciones)) throw new Error('Opciones de búsqueda no válidas.');
    const texto = opciones?.texto == null ? '' : String(opciones.texto);
    if (texto.length > 200) throw new Error('El texto de búsqueda es demasiado largo (máximo 200 caracteres).');
    const tiposEntidad = Array.isArray(opciones?.tiposEntidad) ? opciones.tiposEntidad : [];
    for (const tipo of tiposEntidad) {
      if (!tipoValido(tipo)) throw new Error('Tipo de entidad no válido.');
    }
    const tipoRelacion = opciones?.tipoRelacion == null ? '' : String(opciones.tipoRelacion);
    if (tipoRelacion.length > 160) throw new Error('El tipo de relación es demasiado largo (máximo 160 caracteres).');
    return db.buscarGlobal(proyectoId, {
      texto,
      tiposEntidad,
      tipoRelacion,
      limite: opciones?.limite,
      forzar: Boolean(opciones?.forzar),
    });
  });

  gestionar('grafo:datos', async (proyectoId) => {
    if (!idValido(proyectoId)) throw new Error('Identificador de proyecto no válido.');
    return db.datosGrafo(proyectoId);
  });

  /* Análisis RSH: opcional, bajo demanda y aislado en un worker. */
  gestionarConEvento('analisis:calcular', async (evento, payload) => {
    const limpio = validarPayloadAnalisisRSH(payload);
    return ejecutarAnalisisRSH(limpio, evento);
  });

  gestionar('analisis:cancelar', async (solicitudId) => {
    const id = String(solicitudId || '');
    const ejecucion = analisisEjecuciones.get(id);
    if (!ejecucion) return false;
    ejecucion.terminada = true;
    if (ejecucion.temporizador) clearTimeout(ejecucion.temporizador);
    analisisEjecuciones.delete(id);
    try { await ejecucion.worker.terminate(); } catch { /* ya terminado */ }
    ejecucion.rechazar(new Error('Cálculo del Análisis RSH cancelado.'));
    return true;
  });

  gestionar('analisis:exportar', async (datos) => {
    if (!objetoValido(datos)) throw new Error('Datos de exportación no válidos.');
    const contenido = String(datos.contenido || '');
    if (!contenido.trim()) throw new Error('El Análisis RSH no contiene datos para exportar.');
    if (Buffer.byteLength(contenido, 'utf8') > 25 * 1024 * 1024) {
      throw new Error('El Análisis RSH es demasiado grande para exportarlo (máximo 25 MB).');
    }
    let nombre = nombreArchivoSeguro(datos.nombre || 'analisis-rsh');
    if (!/\.csv$/i.test(nombre)) nombre = `${nombre}.csv`;
    let destino = destinoExportacionExplicito(datos);
    if (!destino) {
      const opciones = {
        title: 'Exportar Análisis RSH',
        defaultPath: nombre,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      };
      const res = ventana
        ? await dialog.showSaveDialog(ventana, opciones)
        : await dialog.showSaveDialog(opciones);
      if (res.canceled || !res.filePath) return { cancelado: true };
      destino = res.filePath;
    }
    await escribirArchivoPrivado(destino, contenido);
    return { cancelado: false, ruta: destino };
  });

  gestionar('grafo:exportar', async (datos) => {
    if (!objetoValido(datos)) throw new Error('Datos de exportación no válidos.');
    const contenido = String(datos.contenido || '');
    if (!contenido.trim()) throw new Error('La tabla del grafo no contiene datos para exportar.');
    if (Buffer.byteLength(contenido, 'utf8') > 25 * 1024 * 1024) {
      throw new Error('La tabla del grafo es demasiado grande para exportarla (máximo 25 MB).');
    }
    const tipo = String(datos.tipo || 'csv').toLowerCase();
    if (tipo !== 'csv' && tipo !== 'xls') {
      throw new Error('El formato de exportación de la tabla no es válido.');
    }
    const extension = tipo === 'xls' ? 'xls' : 'csv';
    let nombre = nombreArchivoSeguro(datos.nombre || 'grafo-tabla');
    if (!new RegExp(`\\.${extension}$`, 'i').test(nombre)) nombre = `${nombre}.${extension}`;
    let destino = destinoExportacionExplicito(datos);
    if (!destino) {
      const opciones = {
        title: tipo === 'xls' ? 'Exportar hoja de cálculo' : 'Exportar tabla CSV',
        defaultPath: nombre,
        filters: [tipo === 'xls'
          ? { name: 'Hoja de cálculo de Excel', extensions: ['xls'] }
          : { name: 'CSV', extensions: ['csv'] }],
      };
      const res = ventana
        ? await dialog.showSaveDialog(ventana, opciones)
        : await dialog.showSaveDialog(opciones);
      if (res.canceled || !res.filePath) return { cancelado: true };
      destino = res.filePath;
    }
    await escribirArchivoPrivado(destino, contenido);
    return { cancelado: false, ruta: destino };
  });
}

/* ------------------------------------------------------------------ */
/* Ventana principal                                                   */
/* ------------------------------------------------------------------ */

function navegacionInterna(url) {
  try {
    const destino = fileURLToPath(new URL(url));
    const base = path.resolve(__dirname, 'src');
    return dentroDe(path.resolve(destino), base);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Caché entre versiones                                               */
/* ------------------------------------------------------------------ */

/** Tras una actualización, invalida el HTML/CSS/JS y el código compilado que
    Chromium pudiera conservar de la versión anterior. */
async function limpiarCacheSiCambioVersion() {
  const ruta = path.join(app.getPath('userData'), 'himago-version.txt');
  const version = app.getVersion();
  let anterior = '';
  try { anterior = fs.readFileSync(ruta, 'utf8').trim(); } catch { /* primera ejecución */ }
  if (anterior === version) return;
  try { await session.defaultSession.clearCache(); } catch { /* sin caché HTTP */ }
  try { await session.defaultSession.clearCodeCaches({}); } catch { /* sin caché de código */ }
  try { fs.writeFileSync(ruta, version, 'utf8'); } catch { /* sin permisos */ }
}

/* ------------------------------------------------------------------ */
/* Corrección ortográfica                                              */
/* ------------------------------------------------------------------ */

const IDIOMAS_ORTOGRAFIA = ['es-ES', 'es', 'es-419', 'es-MX', 'es-AR'];

function configurarOrtografia(ventana) {
  try {
    const sesion = ventana.webContents.session;
    sesion.setSpellCheckerEnabled(true);
    const disponibles = sesion.availableSpellCheckerLanguages || [];
    const idioma = IDIOMAS_ORTOGRAFIA.find((codigo) => disponibles.includes(codigo));
    if (idioma) {
      sesion.setSpellCheckerLanguages([idioma]);
    } else {
      /* Sin diccionario español, es preferible no marcar como erróneas las
         palabras castellanas con un diccionario de otro idioma. */
      sesion.setSpellCheckerEnabled(false);
      console.warn('[ortografía] No hay diccionario español disponible en este equipo.');
    }
  } catch (err) {
    console.warn('[ortografía] No se pudo configurar el corrector:', err.message);
  }
}

function menuContextualOrtografia(ventana, params) {
  const plantilla = [];
  if (params.misspelledWord) {
    const sugerencias = (params.dictionarySuggestions || []).slice(0, 6);
    for (const sugerencia of sugerencias) {
      plantilla.push({
        label: sugerencia,
        click: () => ventana.webContents.replaceMisspelling(sugerencia),
      });
    }
    if (!sugerencias.length) {
      plantilla.push({ label: 'Sin sugerencias', enabled: false });
    }
    plantilla.push({ type: 'separator' });
    plantilla.push({
      label: `Añadir «${params.misspelledWord}» al diccionario`,
      click: () => ventana.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
    });
    plantilla.push({ type: 'separator' });
  }
  if (params.isEditable) {
    const flags = params.editFlags || {};
    plantilla.push(
      { role: 'cut', label: 'Cortar', enabled: flags.canCut !== false },
      { role: 'copy', label: 'Copiar', enabled: flags.canCopy !== false },
      { role: 'paste', label: 'Pegar', enabled: flags.canPaste !== false },
      { type: 'separator' },
      { role: 'selectAll', label: 'Seleccionar todo', enabled: flags.canSelectAll !== false }
    );
  } else if (params.selectionText) {
    plantilla.push({ role: 'copy', label: 'Copiar' });
  }
  if (!plantilla.length) return;
  Menu.buildFromTemplate(plantilla).popup({ window: ventana });
}

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#101216',
    title: 'H-IMAGO · Análisis histórico',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      devTools: !app.isPackaged || process.env.HIMAGO_DEVTOOLS === '1',
    },
  });

  ventana.setMenuBarVisibility(false);
  const paginaInicial = process.env.HIMAGO_PAGINA || 'index.html';
  const [archivoCrudo, consulta] = paginaInicial.split('?');
  const archivo = ['index.html', 'proyecto.html'].includes(archivoCrudo) ? archivoCrudo : 'index.html';
  const query = Object.fromEntries(new URLSearchParams(consulta || ''));
  if (process.env.HIMAGO_AUTOTEST) {
    console.log('[diagnóstico] paginaInicial =', paginaInicial, '| archivo =', archivo, '| query =', JSON.stringify(query));
  }

  /* Seguridad: la aplicación solo debe navegar a sus propias páginas. */
  ventana.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const bloquearNavegacionExterna = (evento, url) => {
    if (navegacionInterna(url)) return;
    evento.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => {});
  };
  ventana.webContents.on('will-navigate', bloquearNavegacionExterna);
  ventana.webContents.on('will-redirect', bloquearNavegacionExterna);
  try {
    ventana.webContents.session.setPermissionRequestHandler((_wc, _permiso, callback) => callback(false));
    ventana.webContents.session.setPermissionCheckHandler(() => false);
  } catch { /* sesión no disponible */ }
  configurarOrtografia(ventana);
  ventana.webContents.on('context-menu', (_evento, params) => {
    menuContextualOrtografia(ventana, params);
  });

  ventana.loadFile(path.join(__dirname, 'src', archivo), { query }).catch((err) => {
    console.error('[ventana] no se pudo cargar la página:', err);
    if (ventana && !ventana.isVisible()) ventana.show();
  });
  if (process.env.HIMAGO_AUTOTEST) ventana.maximize();
  ventana.webContents.on('did-finish-load', () => {
    if (process.env.HIMAGO_AUTOTEST) console.log('[diagnóstico] cargada:', ventana.webContents.getURL());
  });
  ventana.webContents.on('did-fail-load', (_e, codigo, descripcion) => {
    console.error('[ventana] fallo de carga:', codigo, descripcion);
    if (ventana && !ventana.isVisible()) ventana.show();
  });
  ventana.webContents.on('will-prevent-unload', (evento) => {
    const eleccion = dialog.showMessageBoxSync(ventana, {
      type: 'question',
      buttons: ['Seguir editando', 'Salir sin guardar'],
      defaultId: 0,
      cancelId: 0,
      title: 'Cambios sin guardar',
      message: 'Hay cambios sin guardar. ¿Cerrar la aplicación de todas formas?',
    });
    if (eleccion === 1) evento.preventDefault();
  });
  ventana.once('ready-to-show', () => ventana.show());

  /* Diagnóstico: los errores del renderer quedan en la consola del proceso
     principal (útiles cuando no hay DevTools abiertas). */
  ventana.webContents.on('console-message', (_evento, details) => {
    if (!details || (details.level !== 'error' && details.level !== 'warning')) return;
    console.error(`[renderer] ${details.message} (${details.sourceId}:${details.lineNumber})`);
  });
  ventana.webContents.on('render-process-gone', (_evento, detalles) => {
    console.error('[renderer] proceso terminado:', JSON.stringify(detalles));
  });

  /* Autoprueba opcional: HIMAGO_AUTOTEST=1 recorre el flujo real
     (índice → conexión → abrir proyecto → clicar secciones) y registra
     el resultado en la consola. */
  if (process.env.HIMAGO_AUTOTEST && !app.isPackaged) {
    require('./scripts/autoprueba').configurarAutoprueba({ app, ventana, fs });
  }
  ventana.on('closed', () => { ventana = null; });
}

/* La aceleración por hardware se desactiva solo cuando el entorno lo pide
   explícitamente (contenedores o Linux sin GPU). Así el canvas y Leaflet
   usan GPU por defecto en Windows/macOS/Linux normales. */
if (process.env.HIMAGO_SIN_GPU === '1') {
  app.disableHardwareAcceleration();
}

const instanciaUnica = app.requestSingleInstanceLock();
if (!instanciaUnica) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!ventana) {
      if (app.isReady()) crearVentana();
      return;
    }
    if (ventana.isMinimized()) ventana.restore();
    ventana.focus();
  });

  app.whenReady().then(async () => {
    await limpiarCacheSiCambioVersion();
    Menu.setApplicationMenu(null);
    registrarIPC();
    crearVentana();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) crearVentana();
    });
  }).catch((err) => {
    console.error('[app] Error al iniciar:', err);
    try { dialog.showErrorBox('No se pudo iniciar H-IMAGO', String(err && err.message ? err.message : err)); } catch { /* sin diálogo */ }
    app.quit();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  for (const ejecucion of analisisEjecuciones.values()) {
    ejecucion.terminada = true;
    try { ejecucion.worker.terminate(); } catch { /* ya terminado */ }
  }
  analisisEjecuciones.clear();
  try { db.pool?.end(); } catch { /* cierre best-effort */ }
});

process.on('uncaughtException', (err) => {
  console.error('Error no capturado en el proceso principal:', err);
  try {
    dialog.showErrorBox('Error inesperado de H-IMAGO', String(err && err.stack ? err.stack : err));
  } catch { /* diálogo no disponible */ }
  try { app.exit(1); } catch { process.exit(1); }
});

process.on('unhandledRejection', (err) => {
  console.error('Promesa no capturada en el proceso principal:', err);
  /* No cerramos la aplicación: una promesa rechazada en una operación
     secundaria no debe destruir el trabajo que el usuario tenga abierto. */
});
