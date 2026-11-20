'use strict';

/* H-IMAGO · Ajustes puntuales de formularios de bloques
   Se aplican DESPUÉS del esquema generado (formularios-bloques.js) y ANTES del
   renderizador. Así las personalizaciones sobreviven a la regeneración. */

(function () {
  const formularios = window.FORMULARIOS_BLOQUES;
  if (!formularios) return;

  /** Aplica a todos los roles de personas el diseño en dos líneas, con
      institución como texto y línea de empleo repetible. */
  function aplicarRolesConEmpleo(formulario) {
    for (const bloque of formulario.bloques) {
      if (bloque.tipo !== 'personas') continue;
      bloque.disposicion = 'dos-lineas';
      bloque.institucionTexto = true;
    }
  }

  /** Reorganiza el bloque REGISTRO: TÍTULO + SIGNATURA en la primera línea
      y el resto en filas alineadas. Variante para formularios con rango de fechas. */
  function reorganizarRegistro(formulario) {
    const indice = formulario.bloques.findIndex(
      (b) => b.tipo === 'seccion' && b.titulo === 'REGISTRO'
    );
    if (indice < 0) return;

    const filasOriginales = [];
    let j = indice + 1;
    while (j < formulario.bloques.length && formulario.bloques[j].tipo === 'campos') {
      filasOriginales.push(formulario.bloques[j]);
      j++;
    }
    if (!filasOriginales.length) return;

    const campos = filasOriginales.flatMap((fila) => fila.campos);
    const buscar = (nombre) => campos.find((c) => c.nombre === nombre);
    const fechas = campos.filter((c) => c.nombre.startsWith('FECHA EXACTA'));

    const titulo = buscar('TÍTULO');
    const signatura = buscar('SIGNATURA');
    const lugar = buscar('LUGAR');
    const institucion = buscar('INSTITUCIÓN');
    const parroquia = buscar('PARROQUIA');
    const tipo = buscar('TIPO');
    const anio = buscar('AÑO');
    const desde = buscar('DESDE');
    const hasta = buscar('HASTA');
    const fechaDesde = fechas.find((c) => /desde|desde\)/i.test(c.nombre)) || fechas[0];
    const fechaHasta = fechas.find((c) => /hasta/i.test(c.nombre)) || fechas[1] || null;

    const nuevas = [];
    const usados = new Set();

    if (titulo) {
      if (signatura) {
        titulo.ancho = 10;
        signatura.ancho = 2;
        nuevas.push({ tipo: 'campos', campos: [titulo, signatura] });
        usados.add(titulo);
        usados.add(signatura);
      } else {
        titulo.ancho = 12;
        nuevas.push({ tipo: 'campos', campos: [titulo] });
        usados.add(titulo);
      }
    }

    if (desde || hasta) {
      const filaA = [lugar, institucion, tipo, desde].filter(Boolean);
      filaA.forEach((campo) => { campo.ancho = 3; usados.add(campo); });
      if (filaA.length) nuevas.push({ tipo: 'campos', campos: filaA });

      const filaB = [fechaDesde, hasta, fechaHasta].filter(Boolean);
      filaB.forEach((campo) => { campo.ancho = 4; usados.add(campo); });
      if (filaB.length) nuevas.push({ tipo: 'campos', campos: filaB });
    } else {
      const fila = [lugar, institucion, parroquia, anio, fechaDesde].filter(Boolean);
      const ancho = fila.length >= 5 ? 2 : fila.length === 4 ? 3 : fila.length === 3 ? 4 : 6;
      fila.forEach((campo) => { campo.ancho = ancho; usados.add(campo); });
      if (fila.length) nuevas.push({ tipo: 'campos', campos: fila });

      if (tipo) {
        tipo.ancho = 4;
        nuevas.push({ tipo: 'campos', campos: [tipo] });
        usados.add(tipo);
      }
    }

    const restantes = campos.filter((campo) => !usados.has(campo));
    if (restantes.length) {
      restantes.forEach((campo) => { campo.ancho = campo.ancho || 4; });
      nuevas.push({ tipo: 'campos', campos: restantes });
    }

    formulario.bloques.splice(indice + 1, filasOriginales.length, ...nuevas);
  }

  /** Elimina filas de campos que duplican una persona ya convertida en bloque.
      El ODS de Legados testamentarios repite la ficha del legatario. */
  function quitarCamposPersonaDuplicados(formulario) {
    const patrones = [
      ['TRATAMIENTO/TÍTULO', 'NOMBRES', 'APELLIDOS'],
      ['EMPLEO/OFICIO', 'INSTITUCIÓN'],
    ];
    formulario.bloques = formulario.bloques.filter((bloque) => {
      if (bloque.tipo !== 'campos') return true;
      const nombres = bloque.campos.map((campo) => campo.nombre);
      return !patrones.some((patron) => patron.length === nombres.length
        && patron.every((nombre, i) => nombre === nombres[i]));
    });
  }

  /** Convierte una sección de inventario (INVENTARIO, DEBE, HABER) en un grupo
      repetible por categoría, con ítems repetibles, subtotales y totales. */
  function ajustarInventario(formulario, tituloSeccion = 'INVENTARIO', sufijo = 'inventario') {
    const indice = formulario.bloques.findIndex(
      (b) => b.tipo === 'seccion' && b.titulo === tituloSeccion
    );
    if (indice < 0) return;
    const filas = [];
    let j = indice + 1;
    while (j < formulario.bloques.length && formulario.bloques[j].tipo === 'campos') {
      filas.push(formulario.bloques[j]);
      j++;
    }
    const campos = filas.flatMap((fila) => fila.campos);
    const buscar = (nombre) => campos.find((c) => c.nombre === nombre);
    const materias = campos.filter((c) => c.nombre === 'MATERIA');
    const categoria = materias[0];
    const materiaFinal = materias[1];
    const notas = buscar('NOTAS');
    const anio = buscar('AÑO');
    const fecha = buscar('FECHA EXACTA');
    const item = buscar('ÍTEM');
    const cantidad = buscar('CANTIDAD');
    const monto = buscar('MONTO');
    const subtotalCantidad = buscar('SUBTOTAL CANTIDAD');
    const subtotalMonto = buscar('SUBTOTAL MONTO');
    const totalCantidad = buscar('TOTAL SUBTOTALES CANTIDAD');
    const totalMonto = buscar('TOTAL SUBTOTALES MONTO');
    if (!(categoria && anio && fecha && item && cantidad && monto
        && subtotalCantidad && subtotalMonto && totalCantidad && totalMonto)) return;
    const idMonto = monto.id;
    const idSubtotalMonto = subtotalMonto.id;
    const idTotalMonto = totalMonto.id;
    monto.nombre = 'PESO';
    monto.tipo = 'entero';
    monto.ancho = 2;
    const peso = monto;
    const reales = {
      nombre: 'REALES', tipo: 'select', opciones: ['0', '1', '2', '3', '4', '5', '6', '7', '8'],
      pista: '', id: `${idMonto}_reales`, ancho: 2,
    };
    const cuartillos = {
      nombre: 'CUARTILLOS', tipo: 'select', opciones: ['', '1/4', '1/2', '3/4'],
      pista: '', id: `${idMonto}_cuartillos`, ancho: 2,
    };
    const subtotalPeso = { ...subtotalMonto, nombre: 'SUBTOTAL PESO', tipo: 'entero', ancho: 2 };
    const subtotalReales = {
      ...subtotalMonto, nombre: 'SUBTOTAL REALES', tipo: 'entero',
      id: `${idSubtotalMonto}_reales`, ancho: 2,
    };
    const subtotalCuartillos = {
      ...subtotalMonto, nombre: 'SUBTOTAL CUARTILLOS', tipo: 'texto',
      id: `${idSubtotalMonto}_cuartillos`, ancho: 2,
    };
    const totalPeso = { ...totalMonto, nombre: 'TOTAL SUBTOTALES PESO', tipo: 'entero', ancho: 2 };
    const totalReales = {
      ...totalMonto, nombre: 'TOTAL SUBTOTALES REALES', tipo: 'entero',
      id: `${idTotalMonto}_reales`, ancho: 2,
    };
    const totalCuartillos = {
      ...totalMonto, nombre: 'TOTAL SUBTOTALES CUARTILLOS', tipo: 'texto',
      id: `${idTotalMonto}_cuartillos`, ancho: 2,
    };
    categoria.nombre = 'CATEGORÍAS';
    categoria.tipo = 'texto';
    categoria.ancho = 12;
    const idGrupo = sufijo === 'inventario' ? 'g-inventario' : `g-inventario-${sufijo}`;
    const idItems = sufijo === 'inventario' ? 'items-inventario' : `items-inventario-${sufijo}`;
    const idTotales = sufijo === 'inventario' ? 'totales-inventario' : `totales-inventario-${sufijo}`;
    const reemplazo = [
      {
        tipo: 'grupo',
        id: idGrupo,
        titulo: 'CATEGORÍA',
        repetible: true,
        bloques: [
          { tipo: 'campos', campos: [categoria] },
          {
            tipo: 'items-inventario',
            id: idItems,
            titulo: 'AÑADIR/ELIMINAR ÍTEM',
            campos: {
              anio,
              fecha,
              item,
              cantidad,
              peso,
              reales,
              cuartillos,
              monto,
              subtotalCantidad,
              subtotalPeso,
              subtotalReales,
              subtotalCuartillos,
              subtotalMonto,
            },
          },
        ],
      },
      {
        tipo: 'totales-inventario',
        id: idTotales,
        campos: {
          totalCantidad,
          totalPeso,
          totalReales,
          totalCuartillos,
          totalMonto,
        },
      },
    ];
    if (materiaFinal) reemplazo.push({ tipo: 'campos', campos: [materiaFinal] });
    if (notas) reemplazo.push({ tipo: 'campos', campos: [notas] });
    formulario.bloques.splice(indice + 1, filas.length, ...reemplazo);
  }

  /* ACTAS, ACUERDOS Y RESOLUCIONES
     · TÍTULO + SIGNATURA en la primera línea.
     · LUGAR e INSTITUCIÓN pasan a la línea del AÑO (a su izquierda) y la
       FECHA EXACTA se mantiene a la derecha.
     · Los cuatro roles usan el diseño de dos líneas con empleo repetible. */
  const actas = formularios['Actas, acuerdos y resoluciones'];
  if (actas) {
    const indiceRegistro = actas.bloques.findIndex(
      (b) => b.tipo === 'seccion' && b.titulo === 'REGISTRO'
    );
    if (indiceRegistro >= 0) {
      const fila1 = actas.bloques[indiceRegistro + 1];
      const fila2 = actas.bloques[indiceRegistro + 2];
      if (fila1?.tipo === 'campos' && fila2?.tipo === 'campos') {
        const buscar = (campo) => fila1.campos.concat(fila2.campos).find((c) => c.nombre === campo);
        const titulo = buscar('TÍTULO');
        const signatura = buscar('SIGNATURA');
        const lugar = buscar('LUGAR');
        const institucion = buscar('INSTITUCIÓN');
        const anio = buscar('AÑO');
        const fecha = buscar('FECHA EXACTA');
        if (titulo && lugar && institucion && anio && fecha) {
          titulo.ancho = signatura ? 10 : 12;
          if (signatura) signatura.ancho = 2;
          lugar.ancho = 3;
          institucion.ancho = 3;
          anio.ancho = 3;
          fecha.ancho = 3;
          actas.bloques.splice(
            indiceRegistro + 1,
            2,
            { tipo: 'campos', campos: signatura ? [titulo, signatura] : [titulo] },
            { tipo: 'campos', campos: [lugar, institucion, anio, fecha] }
          );
        }
      }
    }
    aplicarRolesConEmpleo(actas);
  }

  /* ARRIENDO
     · Mismo sistema que ACTAS: TÍTULO + SIGNATURA en la primera línea; LUGAR, AÑO y FECHA
       EXACTA en la línea siguiente.
     · Todos los roles de personas (escribano, testigos, arrendador,
       arrendatario y fiador/aval) usan el diseño de dos líneas con empleo
       repetible e institución de texto. */
  const arriendo = formularios['Arriendo'];
  if (arriendo) {
    reorganizarRegistro(arriendo);
    aplicarRolesConEmpleo(arriendo);
  }

  /* RESTO DE BLOQUES DE REGISTRO
     · Mismo sistema que ACTAS: TÍTULO + SIGNATURA en la primera línea y LUGAR/INSTITUCIÓN
       (o PARROQUIA en las actas vitales)/AÑO/FECHA EXACTA en la línea
       siguiente.
     · Todos los roles de personas en dos líneas con empleo repetible e
       institución de texto. */
  const formulariosRestantes = [
    'Compra/Venta',
    'Diezmos',
    'Donación',
    'Fianza',
    'Hipoteca',
    'Inventarios de bienes',
    'Legados testamentarios',
    'Obligación',
    'Testamentos',
    'Cuenta personal',
    'Actas de bautismo',
    'Actas de defunción',
    'Actas de matrimonio',
  ];
  for (const nombre of formulariosRestantes) {
    const formulario = formularios[nombre];
    if (!formulario) continue;
    reorganizarRegistro(formulario);
    aplicarRolesConEmpleo(formulario);
  }
  if (formularios['Legados testamentarios']) {
    quitarCamposPersonaDuplicados(formularios['Legados testamentarios']);
  }

  /* INVENTARIOS DE BIENES, TESTAMENTOS, LEGADOS Y CUENTA PERSONAL
     · Misma sección de inventario: grupo repetible por categoría, ítems
       repetibles, subtotales por categoría y totales generales.
     · En Cuenta personal, DEBE y HABER son secciones independientes. */
  for (const nombre of ['Inventarios de bienes', 'Testamentos', 'Legados testamentarios']) {
    const formulario = formularios[nombre];
    if (formulario) ajustarInventario(formulario);
  }
  const cuentaPersonal = formularios['Cuenta personal'];
  if (cuentaPersonal) {
    ajustarInventario(cuentaPersonal, 'DEBE', 'debe');
    ajustarInventario(cuentaPersonal, 'HABER', 'haber');
  }

  /* COMUNICACIONES
     · REGISTRO: TÍTULO + SIGNATURA en la primera línea; LUGAR, INSTITUCIÓN,
       AÑO y FECHA EXACTA en la línea siguiente; TIPO en su propia línea.
     · Los tres roles (REMITENTE, DESTINATARIO, ESCRIBANO/NOTARIO) usan el
       diseño de dos líneas con empleo repetible. */
  const comunicaciones = formularios['Comunicaciones'];
  if (comunicaciones) {
    const indiceRegistro = comunicaciones.bloques.findIndex(
      (b) => b.tipo === 'seccion' && b.titulo === 'REGISTRO'
    );
    if (indiceRegistro >= 0) {
      const fila1 = comunicaciones.bloques[indiceRegistro + 1];
      const fila2 = comunicaciones.bloques[indiceRegistro + 2];
      if (fila1?.tipo === 'campos' && fila2?.tipo === 'campos') {
        const buscar = (campo) => fila1.campos.concat(fila2.campos).find((c) => c.nombre === campo);
        const titulo = buscar('TÍTULO');
        const signatura = buscar('SIGNATURA');
        const lugar = buscar('LUGAR');
        const institucion = buscar('INSTITUCIÓN');
        const anio = buscar('AÑO');
        const fecha = buscar('FECHA EXACTA');
        const tipo = buscar('TIPO');
        if (titulo && lugar && institucion && anio && fecha) {
          titulo.ancho = signatura ? 10 : 12;
          if (signatura) signatura.ancho = 2;
          lugar.ancho = 3;
          institucion.ancho = 3;
          anio.ancho = 3;
          fecha.ancho = 3;
          if (tipo) tipo.ancho = 4;
          const nuevasFilas = [
            { tipo: 'campos', campos: signatura ? [titulo, signatura] : [titulo] },
            { tipo: 'campos', campos: [lugar, institucion, anio, fecha] },
          ];
          if (tipo) nuevasFilas.push({ tipo: 'campos', campos: [tipo] });
          comunicaciones.bloques.splice(indiceRegistro + 1, 2, ...nuevasFilas);
        }
      }
    }
    const campoTipoComunicaciones = comunicaciones.bloques
      .filter((b) => b.tipo === 'campos')
      .flatMap((b) => b.campos)
      .find((c) => c.nombre === 'TIPO');
    if (campoTipoComunicaciones) {
      campoTipoComunicaciones.tipo = 'select';
      campoTipoComunicaciones.opciones = ['Oficio', 'Memorándum', 'Nota', 'Informe'];
    }
    aplicarRolesConEmpleo(comunicaciones);
  }

  /* Resto de formularios institucionales / personales seleccionados:
     mismo tratamiento de REGISTRO y de los roles de personas. */
  const formulariosEstandar = [
    'Leyes, decretos, ordenanzas, reglamentos',
    'Elecciones',
    'Nombramientos y designaciones',
    'Títulos',
    'Poder',
    'Procesos judiciales',
    'Epístolas',
  ];
  for (const nombre of formulariosEstandar) {
    const formulario = formularios[nombre];
    if (!formulario) continue;
    reorganizarRegistro(formulario);
    aplicarRolesConEmpleo(formulario);
  }

  /* PROCESOS JUDICIALES · interior de los grupos repetibles
     · TIPO en su línea; AÑO/FECHA EXACTA/LUGAR en la siguiente.
     · PRODUCTOR y DESTINATARIO como roles de personas con el sistema
       completo (dos líneas, institución de texto, empleo repetible).
     · MATERIA del grupo a ancho completo.
     · Se eliminan los MATERIA exteriores que quedaban entre grupos. */
  const procesos = formularios['Procesos judiciales'];
  if (procesos) {
    const gruposObjetivo = {
      'ESCRITOS DE LAS PARTES': 'escritos',
      'RESOLUCIONES JUDICIALES': 'resoluciones',
      'ACTAS Y REGISTROS JUDICIALES': 'actas',
    };
    for (const grupo of procesos.bloques.filter((b) => b.tipo === 'grupo')) {
      const slug = gruposObjetivo[grupo.titulo];
      if (!slug) continue;

      const nuevosHijos = [];
      let i = 0;
      let personasEncontradas = 0;
      while (i < grupo.bloques.length) {
        const bloque = grupo.bloques[i];
        if (bloque.tipo === 'campos') {
          const nombres = bloque.campos.map((c) => c.nombre);
          if (nombres.length === 1 && nombres[0] === 'MATERIA') {
            bloque.campos[0].ancho = 12;
            nuevosHijos.push(bloque);
            i++;
            continue;
          }
          const esLineaPersona = nombres.includes('TRATAMIENTO/TÍTULO') && nombres.includes('NOMBRES');
          const siguiente = grupo.bloques[i + 1];
          if (esLineaPersona && siguiente?.tipo === 'campos'
              && siguiente.campos.some((c) => c.nombre === 'EMPLEO/OFICIO')) {
            const rol = personasEncontradas === 0 ? 'PRODUCTOR' : 'DESTINATARIO';
            nuevosHijos.push({
              tipo: 'personas',
              id: `p-${slug}-${rol.toLowerCase()}`,
              titulo: rol,
              disposicion: 'dos-lineas',
              institucionTexto: true,
            });
            personasEncontradas++;
            i += 2;
            continue;
          }
          bloque.campos.forEach((campo) => { campo.ancho = 4; });
          nuevosHijos.push(bloque);
          i++;
          continue;
        }
        nuevosHijos.push(bloque);
        i++;
      }
      grupo.bloques = nuevosHijos;
    }

    for (let i = 0; i < procesos.bloques.length; i++) {
      const actual = procesos.bloques[i];
      const posibleMateria = procesos.bloques[i + 1];
      const siguiente = procesos.bloques[i + 2];
      if (actual?.tipo === 'grupo'
          && posibleMateria?.tipo === 'campos'
          && posibleMateria.campos.length === 1
          && posibleMateria.campos[0].nombre === 'MATERIA'
          && siguiente?.tipo === 'grupo') {
        procesos.bloques.splice(i + 1, 1);
        i--;
      }
    }
  }

  /* HOJAS DE SERVICIO
     · REGISTRO: TÍTULO + SIGNATURA en la primera línea; LUGAR/INSTITUCIÓN/AÑO/FECHA en la
       siguiente.
     · AUTORIDAD EMISORA: modelo de personas con empleo repetible.
     · SOLDADO: persona con campos extra, sin botones de línea y sólo con
       VINCULAR PERSONA / ＋ Crear persona.
     · SERVICIOS: INICIO/AÑOS/MESES/DÍAS en una línea y totales alineados.
     · CUERPOS Y CAMPAÑAS: bloque de instituciones y CAMPAÑAS Y ACCIONES como
       área de texto (mismo tamaño que NOTAS). */
  const hojas = formularios['Hojas de servicio'];
  if (hojas) {
    let fechaRegistroId = null;
    const indiceRegistro = hojas.bloques.findIndex(
      (b) => b.tipo === 'seccion' && b.titulo === 'REGISTRO'
    );
    if (indiceRegistro >= 0) {
      const fila1 = hojas.bloques[indiceRegistro + 1];
      const fila2 = hojas.bloques[indiceRegistro + 2];
      if (fila1?.tipo === 'campos' && fila2?.tipo === 'campos') {
        const buscar = (n) => fila1.campos.concat(fila2.campos).find((c) => c.nombre === n);
        const titulo = buscar('TÍTULO');
        const signatura = buscar('SIGNATURA');
        const lugar = buscar('LUGAR');
        const institucion = buscar('INSTITUCIÓN');
        const anio = buscar('AÑO');
        const fecha = buscar('FECHA EXACTA');
        if (titulo && lugar && institucion && anio && fecha) {
          fechaRegistroId = fecha.id;
          titulo.ancho = signatura ? 10 : 12;
          if (signatura) signatura.ancho = 2;
          lugar.ancho = 3;
          institucion.ancho = 3;
          anio.ancho = 3;
          fecha.ancho = 3;
          hojas.bloques.splice(
            indiceRegistro + 1,
            2,
            { tipo: 'campos', campos: signatura ? [titulo, signatura] : [titulo] },
            { tipo: 'campos', campos: [lugar, institucion, anio, fecha] }
          );
        }
      }
    }

    const autoridad = hojas.bloques.find(
      (b) => b.tipo === 'personas' && b.titulo === 'AUTORIDAD EMISORA'
    );
    if (autoridad) {
      autoridad.disposicion = 'dos-lineas';
      autoridad.institucionTexto = true;
    }

    const indiceSoldado = hojas.bloques.findIndex(
      (b) => b.tipo === 'seccion' && b.titulo === 'SOLDADO'
    );
    if (indiceSoldado >= 0) {
      const fila1 = hojas.bloques[indiceSoldado + 1];
      const fila2 = hojas.bloques[indiceSoldado + 2];
      const campos = [...(fila1?.campos || []), ...(fila2?.campos || [])];
      const extras = campos
        .filter((c) => !['TRATAMIENTO/TÍTULO', 'NOMBRES', 'APELLIDOS'].includes(c.nombre))
        .map((c) => ({
          clave: c.nombre.toLowerCase().normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, ''),
          nombre: c.nombre,
          tipo: c.tipo === 'lugar' ? 'lugar' : 'texto',
        }));
      hojas.bloques.splice(indiceSoldado, 3, {
        tipo: 'personas',
        id: 'p-soldado',
        titulo: 'SOLDADO',
        disposicion: 'dos-lineas',
        sinEmpleo: true,
        sinBotones: true,
        soloVinculos: true,
        extras,
      });
    }

    const indiceServicios = hojas.bloques.findIndex(
      (b) => b.tipo === 'seccion' && b.titulo === 'SERVICIOS'
    );
    if (indiceServicios >= 0) {
      const filaServicios = hojas.bloques[indiceServicios + 1];
      const filaTotales = hojas.bloques[indiceServicios + 2];
      if (filaServicios?.tipo === 'campos' && filaTotales?.tipo === 'campos') {
        hojas.bloques.splice(indiceServicios + 1, 2, {
          tipo: 'servicios',
          id: 'serv-hojas-servicio',
          campoFechaCierre: fechaRegistroId,
        });
      }
    }

    const indiceCuerpos = hojas.bloques.findIndex(
      (b) => b.tipo === 'seccion' && b.titulo === 'CUERPOS Y CAMPAÑAS'
    );
    if (indiceCuerpos >= 0) {
      const filaInstitucion = hojas.bloques[indiceCuerpos + 1];
      if (filaInstitucion?.tipo === 'campos' && filaInstitucion.campos.length === 1
          && filaInstitucion.campos[0].nombre === 'INSTITUCIÓN') {
        hojas.bloques.splice(indiceCuerpos + 1, 1, {
          tipo: 'instituciones',
          id: 'inst-hojas-servicio',
        });
      }
      const filaCampanas = hojas.bloques[indiceCuerpos + 2];
      if (filaCampanas?.tipo === 'campos') {
        const campanas = filaCampanas.campos.find((c) => c.nombre === 'CAMPAÑAS Y ACCIONES');
        if (campanas) {
          campanas.tipo = 'area';
          campanas.ancho = 12;
          campanas.filas = 3;
        }
      }
    }
  }

  /* HIPOTECAS ASOCIADAS A LA PERSONA
     Los formularios notariales traían dos bloques independientes titulados
     HIPOTECA (uno tras el rol principal y otro tras el fiador/aval). Se
     integran dentro de la sección de la persona que les precede, debajo de
     sus vínculos, y se titulan con el nombre de ese rol para evitar
     duplicados y ambigüedad. El bloque conserva su id (p4, p5, p6…), pero
     sus datos pasan a guardarse dentro de cada fila de persona. */
  function anidarHipotecas(formulario) {
    const bloques = formulario.bloques;
    for (let i = bloques.length - 1; i >= 0; i--) {
      const hipoteca = bloques[i];
      if (hipoteca.tipo !== 'patrimonios' || hipoteca.titulo !== 'HIPOTECA') continue;
      let j = i - 1;
      while (j >= 0 && bloques[j].tipo !== 'personas') j--;
      if (j < 0) continue;
      const persona = bloques[j];
      hipoteca.titulo = `HIPOTECA ${persona.titulo}`;
      delete hipoteca.nivel;
      persona.bloques = Array.isArray(persona.bloques) ? persona.bloques : [];
      persona.bloques.push(hipoteca);
      bloques.splice(i, 1);
    }
  }

  for (const nombre of [
    'Arriendo',
    'Compra/Venta',
    'Diezmos',
    'Fianza',
    'Hipoteca',
    'Obligación',
  ]) {
    const formulario = formularios[nombre];
    if (formulario) anidarHipotecas(formulario);
  }

  /* LEGADOS TESTAMENTARIOS · ALBACEAS
     La sección HEREDEROS se duplica como ALBACEAS, con su propia lista de
     personas y vínculos, inmediatamente después de HEREDEROS. */
  const legados = formularios['Legados testamentarios'];
  if (legados) {
    const herederos = legados.bloques.find(
      (b) => b.tipo === 'personas' && b.titulo === 'HEREDEROS'
    );
    const yaExiste = legados.bloques.some(
      (b) => b.tipo === 'personas' && b.titulo === 'ALBACEAS'
    );
    if (herederos && !yaExiste) {
      const albaceas = JSON.parse(JSON.stringify(herederos));
      albaceas.id = 'p14';
      albaceas.titulo = 'ALBACEAS';
      const indice = legados.bloques.indexOf(herederos);
      legados.bloques.splice(indice + 1, 0, albaceas);
    }

    /* PATRIMONIOS: bloque repetible de bienes vinculados al inventario,
       situado justo después de sus totales. */
    const yaPatrimonios = legados.bloques.some(
      (b) => b.tipo === 'patrimonios' && b.titulo === 'PATRIMONIOS'
    );
    if (!yaPatrimonios) {
      const totales = legados.bloques.find((b) => b.tipo === 'totales-inventario');
      const patrimonio = {
        tipo: 'patrimonios',
        id: 'p15',
        titulo: 'PATRIMONIOS',
        nivel: 'seccion',
      };
      if (totales) {
        legados.bloques.splice(legados.bloques.indexOf(totales) + 1, 0, patrimonio);
      } else {
        legados.bloques.push(patrimonio);
      }
    }
  }

  /* TESTAMENTOS
     Ya incluye una sección ALBACEAS (p12) idéntica a HEREDEROS, por lo que
     no se duplica. Se añade PATRIMONIOS tras los totales del INVENTARIO. */
  const testamentos = formularios['Testamentos'];
  if (testamentos) {
    const yaPatrimonios = testamentos.bloques.some(
      (b) => b.tipo === 'patrimonios' && b.titulo === 'PATRIMONIOS'
    );
    if (!yaPatrimonios) {
      const totales = testamentos.bloques.find((b) => b.tipo === 'totales-inventario');
      const patrimonio = {
        tipo: 'patrimonios',
        id: 'p14',
        titulo: 'PATRIMONIOS',
        nivel: 'seccion',
      };
      if (totales) {
        testamentos.bloques.splice(testamentos.bloques.indexOf(totales) + 1, 0, patrimonio);
      } else {
        testamentos.bloques.push(patrimonio);
      }
    }
  }

  /* EPÍSTOLAS · sin sección ESCRIBANO/NOTARIO */
  const epistolas = formularios['Epístolas'];
  if (epistolas) {
    const indiceEscribano = epistolas.bloques.findIndex(
      (b) => b.tipo === 'personas' && b.titulo === 'ESCRIBANO/NOTARIO'
    );
    if (indiceEscribano >= 0) epistolas.bloques.splice(indiceEscribano, 1);
  }

  /* ACTAS VITALES · CONDICIÓN como lista desplegable */
  const opcionesCondicion = [
    'Legítimo',
    'Natural',
    'Padres no conocidos',
    'Padre no conocido',
    'Madre no conocida',
    'No informada',
  ];
  function aplicarCondicionSelect(formulario) {
    if (!formulario) return;
    for (const bloque of formulario.bloques) {
      if (bloque.tipo !== 'campos' || !Array.isArray(bloque.campos)) continue;
      for (const campo of bloque.campos) {
        if (campo.nombre !== 'CONDICIÓN') continue;
        campo.tipo = 'select';
        campo.opciones = opcionesCondicion.slice();
      }
    }
  }
  aplicarCondicionSelect(formularios['Actas de matrimonio']);
  aplicarCondicionSelect(formularios['Actas de bautismo']);

  /* COMUNICACIONES · TIPO: opciones normalizadas y nuevo tipo INFORME. */
  const comunicacionesTipo = formularios['Comunicaciones'];
  if (comunicacionesTipo) {
    const opcionesTipo = ['Oficio', 'Memorándum', 'Nota', 'Informe'];
    for (const bloque of comunicacionesTipo.bloques) {
      if (bloque.tipo !== 'campos' || !Array.isArray(bloque.campos)) continue;
      for (const campo of bloque.campos) {
        if (campo.nombre !== 'TIPO') continue;
        campo.tipo = 'select';
        campo.opciones = opcionesTipo.slice();
      }
    }
  }


  /* MONTO en formularios de campos: PESO + REALES + CUARTILLOS. */
  function convertirMontoOctaval(formulario) {
    if (!formulario) return;
    for (const bloque of formulario.bloques) {
      if (bloque.tipo !== 'campos' || !Array.isArray(bloque.campos)) continue;
      const indice = bloque.campos.findIndex((campo) => campo.nombre === 'MONTO');
      if (indice < 0) continue;
      const base = { ...bloque.campos[indice] };
      base.nombre = 'PESO';
      base.tipo = 'entero';
      base.ancho = 2;
      const reales = {
        nombre: 'REALES', tipo: 'select',
        opciones: ['0', '1', '2', '3', '4', '5', '6', '7', '8'],
        pista: '', id: `${base.id}_reales`, ancho: 2,
      };
      const cuartillos = {
        nombre: 'CUARTILLOS', tipo: 'select', opciones: ['', '1/4', '1/2', '3/4'],
        pista: '', id: `${base.id}_cuartillos`, ancho: 2,
      };
      const anterior = bloque.campos[indice - 1];
      const siguiente = bloque.campos[indice + 1];
      if (anterior) anterior.ancho = 3;
      if (siguiente) siguiente.ancho = 3;
      bloque.campos.splice(indice, 1, base, reales, cuartillos);
      formulario.montosOctavales = formulario.montosOctavales || [];
      formulario.montosOctavales.push({
        base: base.id,
        reales: reales.id,
        cuartillos: cuartillos.id,
      });
    }
  }
  convertirMontoOctaval(formularios['Diezmos']);

  /* EDICTOS, BANDOS, PANFLETOS · clon de LEYES, DECRETOS, ORDENANZAS, REGLAMENTOS */
  const leyes = formularios['Leyes, decretos, ordenanzas, reglamentos'];
  if (leyes) {
    const edictos = JSON.parse(JSON.stringify(leyes));
    edictos.titulo = 'Edictos, bandos, panfletos';
    edictos.categoria = leyes.categoria || 'Registros institucionales';
    formularios['Edictos, bandos, panfletos'] = edictos;
  }

  window.HIMAGO_AJUSTES_BLOQUES = true;
})();

