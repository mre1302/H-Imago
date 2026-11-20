'use strict';

/* H-IMAGO · Cargador de un proyecto de ejemplo en la base de datos.
   Uso:
     npm run datos:ejemplo
     node scripts/semilla-ejemplo.js [host] [puerto] [usuario] [contraseña] [base]

   Los datos son de DEMOSTRACIÓN: se apoyan en hechos históricos reales
   (nombres, cargos, fechas principales) pero están simplificados y las notas
   son ilustrativas. No deben usarse como referencia académica. */

const fs = require('fs');
const path = require('path');
const db = require('../db/database');

/* ---------------- Configuración: argumentos > config de la app > valores por defecto ---------------- */

const ARGUMENTOS = process.argv.slice(2);
let cfg = { host: '127.0.0.1', port: 3306, user: 'himago', password: 'himago-demo', database: 'himago' };

const posiblesRutas = [
  process.env.APPDATA && path.join(process.env.APPDATA, 'H-IMAGO', 'himago-config.json'),
  process.env.XDG_CONFIG_HOME && path.join(process.env.XDG_CONFIG_HOME, 'H-IMAGO', 'himago-config.json'),
  path.join(process.env.HOME || '', '.config', 'H-IMAGO', 'himago-config.json'),
  path.join(process.env.HOME || '', '.config', 'h-imago', 'himago-config.json'),
  path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming', 'H-IMAGO', 'himago-config.json'),
].filter(Boolean);
for (const ruta of posiblesRutas) {
  try {
    Object.assign(cfg, JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^\uFEFF/, '')));
    break;
  } catch { /* siguiente ruta */ }
}
if (ARGUMENTOS.length >= 5) {
  cfg = {
    host: ARGUMENTOS[0],
    port: Number(ARGUMENTOS[1]) || 3306,
    user: ARGUMENTOS[2],
    password: ARGUMENTOS[3],
    database: ARGUMENTOS[4],
  };
}

/* ---------------- Datos de ejemplo ---------------- */

const PROYECTO = {
  nombre: 'Redes de poder en la Castilla de los Reyes Católicos (1474–1516)',
  creador: 'Manuel Ramírez Espíndola',
  descripcion: 'PROYECTO DE EJEMPLO PARA H-IMAGO. Prosopografía de la corte, el clero, la nobleza y las finanzas en torno a Isabel I y Fernando V: relaciones dinásticas, de clientela, institucionales y de mecenazgo. Datos simplificados con fines ilustrativos; sustitúyelos o compáralos con tus propios registros.',
};

const LUGARES = [
  { clave: 'valladolid', datos: { nombre: 'Valladolid', tipo: 'Ciudad', latitud: '41.6523', longitud: '-4.7239', notas: 'Boda de los Reyes Católicos (1469) y sede habitual del Consejo Real.' } },
  { clave: 'medina', datos: { nombre: 'Medina del Campo', tipo: 'Villa', latitud: '41.3108', longitud: '-4.9147', notas: 'Las ferias generales de mayo y octubre articulaban el crédito de todo el reino.' } },
  { clave: 'toledo', datos: { nombre: 'Toledo', tipo: 'Ciudad', latitud: '39.8628', longitud: '-4.0273', notas: 'Sede del primado arzobispal.' } },
  { clave: 'segovia', datos: { nombre: 'Segovia', tipo: 'Ciudad', latitud: '40.9481', longitud: '-4.1181', notas: 'Proclamación de Isabel como reina propietaria (13-XII-1474).' } },
  { clave: 'burgos', datos: { nombre: 'Burgos', tipo: 'Ciudad', latitud: '42.3411', longitud: '-3.6998' } },
  { clave: 'salamanca', datos: { nombre: 'Salamanca', tipo: 'Ciudad universitaria', latitud: '40.9701', longitud: '-5.6635' } },
  { clave: 'alcala', datos: { nombre: 'Alcalá de Henares', tipo: 'Villa', latitud: '40.4820', longitud: '-3.3599' } },
  { clave: 'granada', datos: { nombre: 'Granada', tipo: 'Ciudad', latitud: '37.1773', longitud: '-3.5986', notas: 'Conquistada el 2 de enero de 1492; fin de la guerra de Granada.' } },
  { clave: 'santafe', datos: { nombre: 'Santa Fe', tipo: 'Villa', latitud: '37.1892', longitud: '-3.5170', notas: 'Real fundado durante el sitio; en su campamento se firmaron las Capitulaciones.' } },
  { clave: 'plasencia', datos: { nombre: 'Plasencia', tipo: 'Ciudad señorial', latitud: '40.0286', longitud: '-6.0870' } },
  { clave: 'tordesillas', datos: { nombre: 'Tordesillas', tipo: 'Villa', latitud: '41.5047', longitud: '-4.9958' } },
  { clave: 'madrid', datos: { nombre: 'Madrid', tipo: 'Villa', latitud: '40.4168', longitud: '-3.7038' } },
];

const PERSONAS = [
  { clave: 'isabel', datos: { nombre: 'Isabel', apellidos: 'de Trastámara', alias: 'Isabel la Católica', genero: 'Femenino', fecha_nacimiento: '1451', fecha_defuncion: '1504', lugar_nacimiento: 'Madrigal de las Altas Torres', tratamiento: 'Reina de Castilla y de León', ocupacion: 'Reina propietaria', notas: 'Su proclamación en Segovia (1474) y la guerra de sucesión contra su sobrina Juana definieron el arranque del reinado.' } },
  { clave: 'fernando', datos: { nombre: 'Fernando', apellidos: 'de Trastámara', alias: 'Fernando el Católico', genero: 'Masculino', fecha_nacimiento: '1452', fecha_defuncion: '1516', lugar_nacimiento: 'Sos del Rey Católico', tratamiento: 'Rey de Aragón; consorte y gobernador de Castilla', ocupacion: 'Rey', notas: 'Unió bajo una misma pareja real las Coronas de Castilla y Aragón, manteniendo instituciones separadas.' } },
  { clave: 'mendoza', datos: { nombre: 'Pedro', apellidos: 'González de Mendoza', alias: 'El gran cardenal de España', genero: 'Masculino', fecha_nacimiento: '1428', fecha_defuncion: '1495', lugar_nacimiento: 'Guadalajara', tratamiento: 'Cardenal, arzobispo de Toledo y canciller mayor', ocupacion: 'Prelado y estadista', notas: 'Cabeza de la poderosa casa de Mendoza; su paso al bando isabelino decidió la guerra de sucesión.' } },
  { clave: 'cisneros', datos: { nombre: 'Francisco', apellidos: 'Jiménez de Cisneros', alias: 'El Cardenal Cisneros', genero: 'Masculino', fecha_nacimiento: '1436', fecha_defuncion: '1517', lugar_nacimiento: 'Torrelaguna', tratamiento: 'Cardenal, arzobispo de Toledo, confesor real y gobernador', ocupacion: 'Prelado y reformador', notas: 'Franciscano austero: reformó el clero, fundó Alcalá y gobernó Castilla dos veces tras la muerte de Felipe el Hermoso.' } },
  { clave: 'zuniga', datos: { nombre: 'Álvaro', apellidos: 'de Zúñiga y Guzmán', alias: 'El duque de Plasencia', genero: 'Masculino', fecha_nacimiento: 'c. 1410', fecha_defuncion: '1488', tratamiento: 'I duque de Plasencia, señor de Béjar', ocupacion: 'Grande de Castilla', notas: 'Rival de los Mendoza; se alzó por la Beltraneja y negoció luego su perdón con provecho.' } },
  { clave: 'bobadilla', datos: { nombre: 'Beatriz', apellidos: 'de Bobadilla', alias: 'La marquesa de Moya', genero: 'Femenino', fecha_nacimiento: 'c. 1440', fecha_defuncion: '1511', tratamiento: 'I marquesa de Moya, camarera mayor', ocupacion: 'Dama de la reina', notas: 'Amiga de la infancia de Isabel y su pieza más de confianza en la corte; leyenda negra la pinta aún más atrevida de lo que fue.' } },
  { clave: 'cabrera', datos: { nombre: 'Andrés', apellidos: 'de Cabrera', alias: 'El marqués de Moya', genero: 'Masculino', fecha_nacimiento: 'c. 1430', fecha_defuncion: '1511', tratamiento: 'I marqués de Moya, contador mayor', ocupacion: 'Contador y consejero real', notas: 'Guardó Segovia y el alcázar para Isabel en el momento decisivo.' } },
  { clave: 'gonzalo', datos: { nombre: 'Gonzalo', apellidos: 'Fernández de Córdoba', alias: 'El Gran Capitán', genero: 'Masculino', fecha_nacimiento: '1453', fecha_defuncion: '1515', lugar_nacimiento: 'Aguilar de la Frontera', tratamiento: 'I duque de Terranova y Santángelo', ocupacion: 'General', notas: 'Innovó la infantería que dominaría Europa un siglo; brillo en Granada, Nápoles y contra Francia.' } },
  { clave: 'juana', datos: { nombre: 'Juana', apellidos: 'de Trastámara', alias: 'La Beltraneja', genero: 'Femenino', fecha_nacimiento: '1462', fecha_defuncion: '1530', lugar_nacimiento: 'Madrid', tratamiento: 'Pretendiente al trono de Castilla', ocupacion: 'Infanta', notas: 'Legitimidad discutida desde su nacimiento; el mote con que la propaganda la marcó la persiguió hasta el claustro de Santa Clara de Coímbra.' } },
  { clave: 'galindo', datos: { nombre: 'Beatriz', apellidos: 'Galindo', alias: 'La Latina', genero: 'Femenino', fecha_nacimiento: '1464', fecha_defuncion: '1534', lugar_nacimiento: 'Salamanca', tratamiento: 'Humanista, preceptora de la reina', ocupacion: 'Latinista', notas: 'Sobresalió en latín en Salamanca; fundó en Madrid el hospital de la Santa Cruz, llamado «de la Latina» por ella.' } },
  { clave: 'pulgar', datos: { nombre: 'Fernando', apellidos: 'del Pulgar', genero: 'Masculino', fecha_nacimiento: 'c. 1423', fecha_defuncion: '1493', tratamiento: 'Cronista real y secretario de la reina', ocupacion: 'Escribano e historiador', notas: 'Autor de la Crónica de los Reyes Católicos y de Claros varones de Castilla, pieza capital de la prosopografía castellana.' } },
  { clave: 'colon', datos: { nombre: 'Cristóbal', apellidos: 'Colón', alias: 'Cristoforo Colombo', genero: 'Masculino', fecha_nacimiento: '1451', fecha_defuncion: '1506', lugar_nacimiento: 'Génova (hipótesis mayoritaria)', tratamiento: 'Almirante de la Mar Océana, virrey y gobernador de las Indias', ocupacion: 'Navegante', notas: 'El origen genovés domina la historiografía, aunque se ha disputado con hipótesis gallegas, portuguesas y mallorquinas.' } },
  { clave: 'santangel', datos: { nombre: 'Luis', apellidos: 'de Santángel', genero: 'Masculino', fecha_nacimiento: 'c. 1420', fecha_defuncion: '1492', lugar_nacimiento: 'Valencia', tratamiento: 'Escribano de ración del reino de Aragón', ocupacion: 'Financiero y funcionario real', notas: 'Converso; su aval financiero y su palabra ante la reina hicieron posible el viaje de 1492.' } },
  { clave: 'poncedeleon', datos: { nombre: 'Rodrigo', apellidos: 'Ponce de León', alias: 'El marqués de Cádiz', genero: 'Masculino', fecha_nacimiento: '1443', fecha_defuncion: '1492', tratamiento: 'I marqués y duque de Cádiz', ocupacion: 'Capitán fronterizo', notas: 'Protagonista de las campañas andaluzas; su rivalidad con la casa de Medina Sidonia alimenta toda una correspondencia.' } },
];

const INSTITUCIONES = [
  { clave: 'coronaCastilla', datos: { nombre: 'Corona de Castilla', tipo: 'Corona', fecha_fundacion: '1230', notas: 'Unión dinástica de León y Castilla; bajo los Reyes Católicos, monarquía autoritaria con expansión atlántica.' } },
  { clave: 'coronaAragon', datos: { nombre: 'Corona de Aragón', tipo: 'Corona', fecha_fundacion: '1137', notas: 'Confederación con cortes y economías mercantiles mediterráneas propias.' } },
  { clave: 'consejoReal', datos: { nombre: 'Consejo Real de Castilla', tipo: 'Consejo', fecha_fundacion: '1480', lugar_id: 'valladolid', notas: 'Reformado en 1480: letrados de formación jurídica, sin grandeza, para equilibrar a la nobleza.' } },
  { clave: 'hermandad', datos: { nombre: 'Santa Hermandad', tipo: 'Institución hermanada', fecha_fundacion: '1476', lugar_id: 'valladolid', notas: 'Milicia y tesorería municipal; su arca costeó parte de la primera expedición colombina.' } },
  { clave: 'arzobispado', datos: { nombre: 'Arzobispado de Toledo', tipo: 'Diócesis', fecha_fundacion: '1088', lugar_id: 'toledo', notas: 'Primado de las Españas y mitra más rica de Castilla.' } },
  { clave: 'univSalamanca', datos: { nombre: 'Universidad de Salamanca', tipo: 'Universidad', fecha_fundacion: '1218', lugar_id: 'salamanca' } },
  { clave: 'univAlcala', datos: { nombre: 'Universidad de Alcalá', tipo: 'Universidad', fecha_fundacion: '1499', lugar_id: 'alcala', notas: 'Proyecto de Cisneros: colegio mayor residencial y Biblia políglota complutense.' } },
];

const PATRIMONIOS = [
  { clave: 'patSantaCruz', datos: { nombre: 'Colegio de Santa Cruz de Valladolid', tipo: 'Edificio', propietario: 'Pedro González de Mendoza', lugar_id: 'valladolid', descripcion: 'Primer edificio renacentista de Castilla (1486–1491), colegio mayor dotado por el cardenal Mendoza.' } },
  { clave: 'patZuniga', datos: { nombre: 'Mayorazgo de la Casa de Zúñiga', tipo: 'Mayorazgo', propietario: 'Álvaro de Zúñiga y Guzmán', lugar_id: 'plasencia', valor: 'Estados de Plasencia y Béjar', descripcion: 'Señoríos elevados a ducado en 1476 tras la reconciliación del duque con la reina.' } },
  { clave: 'patCapillaReal', datos: { nombre: 'Capilla Real de Granada', tipo: 'Edificio', propietario: 'Corona de Castilla', lugar_id: 'granada', descripcion: 'Mandada construir por testamento de Isabel I (1504); panteón de los Reyes Católicos.' } },
  { clave: 'patSanIldefonso', datos: { nombre: 'Colegio Mayor de San Ildefonso', tipo: 'Edificio', propietario: 'Francisco Jiménez de Cisneros', lugar_id: 'alcala', descripcion: 'Sede fundacional de la Universidad de Alcalá (1499–1508).' } },
];

const FUENTES = [
  { clave: 'fSantaFe', datos: { titulo: 'Capitulaciones de Santa Fe', categoria: 'Registros institucionales', tipo: 'Actas, acuerdos, resoluciones', autor: 'Corona de Castilla y Cristóbal Colón', anio: '1492', ubicacion: 'Archivo General de Indias (Sevilla)', referencia: 'AGI, Patronato Real, leg. 295', transcripcion: 'Concesión a Colón de los títulos de Almirante de la Mar Océana, virrey y gobernador de las tierras que descubriera, con la décima parte de las ganancias. El original no se conserva; quedan copias protocolarias y las notas de los escribanos.' } },
  { clave: 'fTordesillas', datos: { titulo: 'Tratado de Tordesillas', categoria: 'Registros institucionales', tipo: 'Actas, acuerdos, resoluciones', autor: 'Coronas de Castilla y Portugal', anio: '1494', ubicacion: 'Archivo General de Indias / Torre do Tombo (Lisboa)', transcripcion: 'Reparto del Atlántico entre Castilla y Portugal mediante un meridiano a 370 leguas al oeste de Cabo Verde.' } },
  { clave: 'fCronica', datos: { titulo: 'Crónica de los Reyes Católicos', categoria: 'Registros personales y narrativos', tipo: 'Crónicas', autor: 'Fernando del Pulgar', anio: '1482', ubicacion: 'Manuscritos dispersos; ediciones desde 1780', transcripcion: 'Relato oficialista del reinado hasta 1482; Pulgar firma con una prosa que ya es retrato de caracteres.' } },
  { clave: 'fClaros', datos: { titulo: 'Claros varones de Castilla', categoria: 'Bibliografía', tipo: 'Libros', autor: 'Fernando del Pulgar', anio: '1486', ubicacion: 'Impreso en Sevilla (Ungut y Polonio)', transcripcion: 'Galería biográfica de nobles y prelados: la prosopografía castellana del XV en estado puro.' } },
  { clave: 'fCartaColon', datos: { titulo: 'Carta de Colón a Luis de Santángel', categoria: 'Registros institucionales', tipo: 'Comunicaciones', autor: 'Cristóbal Colón', anio: '1493', ubicacion: 'Archivo General de Indias (copias)', transcripcion: 'Primer relato impreso del descubrimiento, dirigido al escribano de ración que había sostenido la empresa ante la reina.' } },
  { clave: 'fTestamento', datos: { titulo: 'Testamento de Isabel la Católica', categoria: 'Registros notariales', tipo: 'Testamentos', autor: 'Isabel I de Castilla', anio: '1504', ubicacion: 'Archivo General de Simancas', referencia: 'AGS, Patronato Real, leg. 53', transcripcion: 'Disposiciones finales de la reina: sucesión de Juana, gobierno de Fernando y encargo de buen trato a los naturales de las Indias.' } },
];

/* [tipoOrigen, claveOrigen, tipo, tipoDestino, claveDestino, desde, hasta, notas] */
const RELACIONES = [
  ['persona', 'isabel', 'Matrimonio', 'persona', 'fernando', '1469', '1504', 'Boda en Valladolid (19 de octubre de 1469); unión dinástica de las dos Coronas.'],
  ['persona', 'isabel', 'Cargo/Dignidad', 'institucion', 'coronaCastilla', '1474', '1504', 'Reina propietaria.'],
  ['persona', 'fernando', 'Cargo/Dignidad', 'institucion', 'coronaCastilla', '1475', '1504', 'Rey consorte, gobernador y administrador.'],
  ['persona', 'fernando', 'Cargo/Dignidad', 'institucion', 'coronaAragon', '1479', '1516', 'Rey de Aragón, Valencia, Mallorca, Sicilia y Nápoles.'],
  ['persona', 'mendoza', 'Cargo/Dignidad', 'institucion', 'arzobispado', '1482', '1495', 'Arzobispo primado de Toledo.'],
  ['persona', 'mendoza', 'Membresía', 'institucion', 'coronaCastilla', '1474', '1495', 'Consejero real y canciller mayor.'],
  ['persona', 'cisneros', 'Cargo/Dignidad', 'institucion', 'arzobispado', '1495', '1517', 'Arzobispo primado de Toledo.'],
  ['persona', 'cisneros', 'Confianza/Servicio', 'persona', 'isabel', '1492', '1504', 'Confesor real.'],
  ['persona', 'cisneros', 'Patronazgo', 'institucion', 'univAlcala', '1499', '1508', 'Fundador y dotador de la universidad.'],
  ['persona', 'cisneros', 'Sucesión/Heredero', 'persona', 'mendoza', '1495', '', 'Sucesor de Mendoza en el arzobispado de Toledo.'],
  ['persona', 'bobadilla', 'Matrimonio', 'persona', 'cabrera', 'c. 1461', '', 'Enlace de las casas de Bobadilla y Cabrera.'],
  ['persona', 'bobadilla', 'Confianza/Servicio', 'persona', 'isabel', '1474', '1504', 'Camarera mayor y confidente de la reina.'],
  ['persona', 'cabrera', 'Membresía', 'institucion', 'consejoReal', '1480', '1509', 'Consejero real.'],
  ['persona', 'zuniga', 'Patronazgo', 'persona', 'juana', '1475', '1476', 'Apoyo dinástico a la Beltraneja en la guerra de sucesión.'],
  ['persona', 'zuniga', 'Conflicto', 'persona', 'isabel', '1476', '', 'Rebelión, asedio de su palacio y reconciliación negociada.'],
  ['persona', 'zuniga', 'Propiedad', 'patrimonio', 'patZuniga', '1476', '1488', 'Titular del mayorazgo y señor de Plasencia.'],
  ['persona', 'juana', 'Parentesco', 'persona', 'isabel', '1474', '1504', 'Sobrina y rival al trono de Castilla.'],
  ['persona', 'juana', 'Conflicto', 'institucion', 'coronaCastilla', '1474', '1479', 'Pretendiente al trono en la guerra de sucesión.'],
  ['persona', 'gonzalo', 'Cargo/Dignidad', 'institucion', 'coronaCastilla', '1482', '1492', 'Capitán general en la guerra de Granada.'],
  ['persona', 'gonzalo', 'Conquista', 'lugar', 'granada', '1492', '', 'Participó en la toma de la ciudad.'],
  ['persona', 'poncedeleon', 'Conquista', 'lugar', 'granada', '1485', '1492', 'Campañas de la vega de Granada.'],
  ['persona', 'poncedeleon', 'Membresía', 'institucion', 'coronaCastilla', '1474', '1492', 'Al servicio de la Corona como capitán fronterizo.'],
  ['persona', 'colon', 'Patronazgo', 'persona', 'isabel', '1486', '1504', 'Protección y mecenazgo de la empresa indiana.'],
  ['institucion', 'hermandad', 'Financiero', 'persona', 'colon', '1492', '', 'La tesorería de la Santa Hermandad costeó parte de la expedición.'],
  ['persona', 'santangel', 'Financiero', 'persona', 'colon', '1489', '1492', 'Aval financiero y gestión personal ante la reina.'],
  ['persona', 'colon', 'Correspondencia', 'persona', 'santangel', '1493', '', 'Destinatario de la primera carta del descubrimiento.'],
  ['persona', 'santangel', 'Cargo/Dignidad', 'institucion', 'coronaAragon', '1463', '1492', 'Escribano de ración del reino de Aragón.'],
  ['persona', 'pulgar', 'Cargo/Dignidad', 'institucion', 'coronaCastilla', '1482', '1492', 'Cronista real.'],
  ['persona', 'pulgar', 'Clientela', 'persona', 'mendoza', '1450', '1495', 'Criado y protegido del cardenal.'],
  ['persona', 'galindo', 'Tutoría/Maestría', 'persona', 'isabel', '1489', '1504', 'Preceptora de latín de la reina.'],
  ['persona', 'galindo', 'Formación', 'institucion', 'univSalamanca', '1476', '1486', 'Vinculada a la universidad salmantina.'],
  ['persona', 'galindo', 'Vecindad', 'lugar', 'madrid', '1501', '', 'Fundó el hospital de la Santa Cruz, «de la Latina».'],
  ['persona', 'isabel', 'Proclamación', 'lugar', 'segovia', '1474', '', 'Jurada y proclamada reina propietaria.'],
  ['persona', 'fernando', 'Boda', 'lugar', 'valladolid', '1469', '', 'Matrimonio con Isabel en Valladolid.'],
  ['persona', 'isabel', 'Conquista', 'lugar', 'granada', '1492', '', 'Toma de la ciudad; fin de la guerra de Granada.'],
  ['persona', 'colon', 'Capitulación', 'lugar', 'santafe', '1492', '', 'Firma de las Capitulaciones de Santa Fe.'],
  ['persona', 'fernando', 'Tratado', 'lugar', 'tordesillas', '1494', '', 'Reparto del Atlántico con Portugal.'],
  ['persona', 'mendoza', 'Fundador', 'patrimonio', 'patSantaCruz', '1486', '1491', 'Fundación y dotación del colegio.'],
  ['persona', 'isabel', 'Patronazgo', 'patrimonio', 'patCapillaReal', '1504', '', 'Dispuso por testamento la construcción de la capilla.'],
  ['persona', 'cisneros', 'Fundador', 'patrimonio', 'patSanIldefonso', '1499', '', 'Fundación del colegio mayor de San Ildefonso.'],
  ['institucion', 'arzobispado', 'Jurisdicción', 'lugar', 'toledo', '', '', 'Sede primada.'],
];

/* ---------------- Ejecución ---------------- */

async function main() {
  const destino = cfg.motor === 'sqlite'
    ? `SQLite en ${cfg.ruta}`
    : `MySQL en ${cfg.host}:${cfg.port} (base «${cfg.database}», usuario «${cfg.user}»)`; 
  console.log(`Conectando a ${destino}…`);
  await db.conectar(cfg);
  console.log('Conexión establecida y esquema verificado.\n');

  const proyectos = await db.listarProyectos();
  const existente = proyectos.find((p) => p.nombre === PROYECTO.nombre);
  if (existente) {
    console.log('El proyecto de ejemplo ya existe: se recrea desde cero.');
    await db.eliminarProyecto(existente.id);
  }

  const proyecto = await db.crearProyecto(PROYECTO);
  const pid = proyecto.id;
  console.log(`Proyecto creado (id ${pid}): «${proyecto.nombre}»\n`);

  const ids = { persona: {}, institucion: {}, lugar: {}, patrimonio: {}, fuente: {} };

  const crear = async (tipo, lista) => {
    const RENOMBRAR = {
      fecha_nacimiento: 'anio_nacimiento',
      fecha_defuncion: 'anio_defuncion',
      fecha_fundacion: 'anio_fundacion',
      fecha_disolucion: 'anio_disolucion',
      anio: 'anio_inicio',
    };
    const anyo = (v) => {
      const m = String(v ?? '').match(/-?\d{3,4}/);
      return m ? Number(m[0]) : null;
    };
    for (const item of lista) {
      const datos = { ...item.datos };
      for (const [vieja, nueva] of Object.entries(RENOMBRAR)) {
        if (datos[vieja] !== undefined) {
          datos[nueva] = anyo(datos[vieja]);
          delete datos[vieja];
        }
      }
      // resolver lugar_id, guardado como clave temporal
      if (typeof datos.lugar_id === 'string') datos.lugar_id = ids.lugar[datos.lugar_id];
      const fila = await db.crearEntidad(tipo, pid, datos);
      ids[tipo][item.clave] = fila.id;
      const etiqueta = fila.nombre || fila.titulo;
      console.log(`  + ${tipo.padEnd(11)} ${etiqueta}`);
    }
  };

  console.log('Creando registros:');
  await crear('lugar', LUGARES);
  await crear('persona', PERSONAS);
  await crear('institucion', INSTITUCIONES);
  await crear('patrimonio', PATRIMONIOS);
  await crear('fuente', FUENTES);

  console.log('\nCreando relaciones:');
  const anyoRel = (v) => {
    const m = String(v ?? '').match(/-?\d{3,4}/);
    return m ? Number(m[0]) : null;
  };
  for (const [tipoO, claveO, tipoRel, tipoD, claveD, desde, hasta, notas] of RELACIONES) {
    await db.crearRelacion({
      proyecto_id: pid,
      origen_tipo: tipoO,
      origen_id: ids[tipoO][claveO],
      destino_tipo: tipoD,
      destino_id: ids[tipoD][claveD],
      tipo: tipoRel,
      anio_inicio: anyoRel(desde),
      anio_fin: anyoRel(hasta),
      notas: notas || null,
    });
    const nombreO = ids[tipoO][claveO], nombreD = ids[tipoD][claveD];
    console.log(`  + ${tipoRel.padEnd(18)} [${tipoO}:${nombreO}] → [${tipoD}:${nombreD}]`);
  }

  const resumen = await db.obtenerProyecto(pid);
  console.log('\nProyecto de ejemplo cargado con éxito.');
  console.log(`  Personas:      ${resumen.estadisticas.personas}`);
  console.log(`  Instituciones: ${resumen.estadisticas.instituciones}`);
  console.log(`  Lugares:       ${resumen.estadisticas.lugares} (georreferenciados: ${LUGARES.length})`);
  console.log(`  Patrimonios:   ${resumen.estadisticas.patrimonios}`);
  console.log(`  Fuentes:       ${resumen.estadisticas.fuentes}`);
  console.log(`  Relaciones:    ${resumen.estadisticas.relaciones}`);
  console.log('\nAbre la aplicación (npm start) y selecciona «Abrir proyecto» para verlo.');

  await db.pool.end();
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  console.error('Comprueba la configuración de la base de datos de H-IMAGO:');
  console.error('- SQLite: revisa la ruta del archivo y sus permisos.');
  console.error('- MySQL/MariaDB: revisa que el servidor esté en marcha, el usuario exista');
  console.error('  y tenga permisos sobre la base de datos.');
  console.error('También puedes pasar los datos de conexión MySQL como argumentos:');
  console.error('  node scripts/semilla-ejemplo.js host puerto usuario contraseña base');
  process.exit(1);
});
