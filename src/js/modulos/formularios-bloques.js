'use strict';

/* H-IMAGO · Esquema declarativo de los BLOQUES DE REGISTRO
   Generado desde docs/formularios-bloques.ods (no editar a mano).
   Cada formulario declara secciones, campos, bloques de personas,
   patrimonios y grupos repetibles. */

const FORMULARIOS_BLOQUES = {
  "Actas, acuerdos y resoluciones": {
    "titulo": "Actas, acuerdos y resoluciones",
    "categoria": "Registros institucionales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f8",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          },
          {
            "nombre": "INSTITUCIÓN",
            "tipo": "institucion",
            "opciones": null,
            "pista": "",
            "id": "f3",
            "ancho": 4
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f4"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "AUTORIDAD EMISORA",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "VOCALES/CONSEJEROS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "FIRMANTES",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f6"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f7"
          }
        ]
      }
    ]
  },
  "Comunicaciones": {
    "titulo": "Comunicaciones",
    "categoria": "Registros institucionales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f9",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          },
          {
            "nombre": "INSTITUCIÓN",
            "tipo": "institucion",
            "opciones": null,
            "pista": "",
            "id": "f3",
            "ancho": 4
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f4"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f5"
          },
          {
            "nombre": "TIPO",
            "tipo": "select",
            "opciones": [
              "OFICIO",
              "MEMORÁNDUM",
              "NOTA"
            ],
            "pista": "",
            "id": "f6"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "REMITENTE",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "DESTINATARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f7"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f8"
          }
        ]
      }
    ]
  },
  "Leyes, decretos, ordenanzas, reglamentos": {
    "titulo": "Leyes, decretos, ordenanzas, reglamentos",
    "categoria": "Registros institucionales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f8",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          },
          {
            "nombre": "INSTITUCIÓN",
            "tipo": "institucion",
            "opciones": null,
            "pista": "",
            "id": "f3",
            "ancho": 4
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f4"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "AUTORIDAD EMISORA",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "VOCALES/CONSEJEROS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f6"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f7"
          }
        ]
      }
    ]
  },
  "Elecciones": {
    "titulo": "Elecciones",
    "categoria": "Registros institucionales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f8",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          },
          {
            "nombre": "INSTITUCIÓN",
            "tipo": "institucion",
            "opciones": null,
            "pista": "",
            "id": "f3",
            "ancho": 4
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f4"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "AUTORIDAD EMISORA",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "VOCALES/CONSEJEROS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "ELECTORES",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p5",
        "titulo": "ELEGIBLES",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p6",
        "titulo": "ELECTOS",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f6"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f7"
          }
        ]
      }
    ]
  },
  "Hojas de servicio": {
    "titulo": "Hojas de servicio",
    "categoria": "Registros institucionales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f30",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          },
          {
            "nombre": "INSTITUCIÓN",
            "tipo": "institucion",
            "opciones": null,
            "pista": "",
            "id": "f3",
            "ancho": 4
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f4"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "AUTORIDAD EMISORA",
        "nivel": "seccion"
      },
      {
        "tipo": "seccion",
        "titulo": "SOLDADO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TRATAMIENTO/TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f6"
          },
          {
            "nombre": "NOMBRES",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f7"
          },
          {
            "nombre": "APELLIDOS",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f8"
          },
          {
            "nombre": "PATRIA",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f9"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "GRADO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f10"
          },
          {
            "nombre": "EDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f11"
          },
          {
            "nombre": "CALIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f12"
          }
        ]
      },
      {
        "tipo": "seccion",
        "titulo": "CALIFICACIONES"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "SALUD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f13"
          },
          {
            "nombre": "VALOR",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f14"
          },
          {
            "nombre": "APLICACIÓN",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f15"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "CAPACIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f16"
          },
          {
            "nombre": "CONDUCTA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f17"
          },
          {
            "nombre": "ESTADO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f18"
          }
        ]
      },
      {
        "tipo": "seccion",
        "titulo": "SERVICIOS"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "EMPLEO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f19"
          },
          {
            "nombre": "INICIO",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f20"
          },
          {
            "nombre": "AÑOS",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f21"
          },
          {
            "nombre": "MESES",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f22"
          },
          {
            "nombre": "DÍAS",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f23"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TOTAL AÑOS",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f24"
          },
          {
            "nombre": "TOTAL MESES",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f25"
          },
          {
            "nombre": "TOTAL DÍAS",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f26"
          }
        ]
      },
      {
        "tipo": "seccion",
        "titulo": "CUERPOS Y CAMPAÑAS"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "INSTITUCIÓN",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f27"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "CAMPAÑAS Y ACCIONES",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f28"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f29"
          }
        ]
      }
    ]
  },
  "Nombramientos y designaciones": {
    "titulo": "Nombramientos y designaciones",
    "categoria": "Registros institucionales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f8",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          },
          {
            "nombre": "INSTITUCIÓN",
            "tipo": "institucion",
            "opciones": null,
            "pista": "",
            "id": "f3",
            "ancho": 4
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f4"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "AUTORIDAD EMISORA",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "SECRETARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "DESTINATARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f6"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f7"
          }
        ]
      }
    ]
  },
  "Títulos": {
    "titulo": "Títulos",
    "categoria": "Registros institucionales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f8",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          },
          {
            "nombre": "INSTITUCIÓN",
            "tipo": "institucion",
            "opciones": null,
            "pista": "",
            "id": "f3",
            "ancho": 4
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f4"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "AUTORIDAD EMISORA",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "SECRETARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "DESTINATARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f6"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f7"
          }
        ]
      }
    ]
  },
  "Arriendo": {
    "titulo": "Arriendo",
    "categoria": "Registros notariales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f7",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f3"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "TESTIGOS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "ARRENDADOR",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "ARRENDATARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p5",
        "titulo": "HIPOTECA",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p6",
        "titulo": "FIADOR/AVAL",
        "nivel": "seccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p7",
        "titulo": "HIPOTECA",
        "nivel": "subseccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p8",
        "titulo": "CONTRATO DE ARRIENDO",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f6"
          }
        ]
      }
    ]
  },
  "Compra/Venta": {
    "titulo": "Compra/Venta",
    "categoria": "Registros notariales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f7",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f3"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "TESTIGOS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "VENDEDOR",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "COMPRADOR",
        "nivel": "seccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p5",
        "titulo": "HIPOTECA",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p6",
        "titulo": "FIADOR/AVAL",
        "nivel": "seccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p7",
        "titulo": "HIPOTECA",
        "nivel": "subseccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p8",
        "titulo": "CONTRATO DE COMPRA/VENTA",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f6"
          }
        ]
      }
    ]
  },
  "Diezmos": {
    "titulo": "Diezmos",
    "categoria": "Registros notariales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f10",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f3"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "TESTIGOS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "DIEZMERO",
        "nivel": "seccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p4",
        "titulo": "HIPOTECA",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p5",
        "titulo": "FIADOR/AVAL",
        "nivel": "seccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p6",
        "titulo": "HIPOTECA",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p7",
        "titulo": "BENEFICIARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "seccion",
        "titulo": "CONTRATO DECIMAL"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "CURATO/DOCTRINA",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f5"
          },
          {
            "nombre": "MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f6"
          },
          {
            "nombre": "PERIODO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f7"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f8"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f9"
          }
        ]
      }
    ]
  },
  "Donación": {
    "titulo": "Donación",
    "categoria": "Registros notariales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f7",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f3"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "TESTIGOS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "DONADOR",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "DONATARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p5",
        "titulo": "CONTRATO DE DONACIÓN",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f6"
          }
        ]
      }
    ]
  },
  "Fianza": {
    "titulo": "Fianza",
    "categoria": "Registros notariales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f7",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f3"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "TESTIGOS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "FIADOR/AVAL",
        "nivel": "seccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p4",
        "titulo": "HIPOTECA",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p5",
        "titulo": "DEUDOR",
        "nivel": "seccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p6",
        "titulo": "HIPOTECA",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p7",
        "titulo": "ACREEDOR",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f6"
          }
        ]
      }
    ]
  },
  "Hipoteca": {
    "titulo": "Hipoteca",
    "categoria": "Registros notariales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f7",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f3"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "TESTIGOS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "FIADOR/AVAL",
        "nivel": "seccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p4",
        "titulo": "HIPOTECA",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p5",
        "titulo": "DEUDOR",
        "nivel": "seccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p6",
        "titulo": "HIPOTECA",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p7",
        "titulo": "ACREEDOR",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f6"
          }
        ]
      }
    ]
  },
  "Inventarios de bienes": {
    "titulo": "Inventarios de bienes",
    "categoria": "Registros notariales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f17",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f3"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "PROPIETARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "ADMINISTRADOR",
        "nivel": "seccion"
      },
      {
        "tipo": "seccion",
        "titulo": "INVENTARIO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f6"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f7"
          },
          {
            "nombre": "ÍTEM",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f8"
          },
          {
            "nombre": "CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f9"
          },
          {
            "nombre": "MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f10"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "SUBTOTAL CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f11"
          },
          {
            "nombre": "SUBTOTAL MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f12"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TOTAL SUBTOTALES CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f13"
          },
          {
            "nombre": "TOTAL SUBTOTALES MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f14"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f15"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f16"
          }
        ]
      }
    ]
  },
  "Obligación": {
    "titulo": "Obligación",
    "categoria": "Registros notariales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f7",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f3"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "TESTIGOS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "FIADOR/AVAL",
        "nivel": "seccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p4",
        "titulo": "HIPOTECA",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p5",
        "titulo": "DEUDOR",
        "nivel": "seccion"
      },
      {
        "tipo": "patrimonios",
        "id": "p6",
        "titulo": "HIPOTECA",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p7",
        "titulo": "ACREEDOR",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f6"
          }
        ]
      }
    ]
  },
  "Poder": {
    "titulo": "Poder",
    "categoria": "Registros notariales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f7",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f3"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "TESTIGOS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "OTORGANTE",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "APODERADO",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f6"
          }
        ]
      }
    ]
  },
  "Cuenta personal": {
    "titulo": "Cuenta personal",
    "categoria": "Registros personales y narrativos",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f27",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f3"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "ACREEDOR",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "DEUDOR",
        "nivel": "seccion"
      },
      {
        "tipo": "seccion",
        "titulo": "DEBE"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f6"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f7"
          },
          {
            "nombre": "ÍTEM",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f8"
          },
          {
            "nombre": "CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f9"
          },
          {
            "nombre": "MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f10"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "SUBTOTAL CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f11"
          },
          {
            "nombre": "SUBTOTAL MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f12"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TOTAL SUBTOTALES CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f13"
          },
          {
            "nombre": "TOTAL SUBTOTALES MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f14"
          }
        ]
      },
      {
        "tipo": "seccion",
        "titulo": "HABER"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f15"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f16"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f17"
          },
          {
            "nombre": "ÍTEM",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f18"
          },
          {
            "nombre": "CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f19"
          },
          {
            "nombre": "MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f20"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "SUBTOTAL CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f21"
          },
          {
            "nombre": "SUBTOTAL MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f22"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TOTAL SUBTOTALES CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f23"
          },
          {
            "nombre": "TOTAL SUBTOTALES MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f24"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f25"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f26"
          }
        ]
      }
    ]
  },
  "Epístolas": {
    "titulo": "Epístolas",
    "categoria": "Registros personales y narrativos",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f7",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f3"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "REMITENTE",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "DESTINATARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f6"
          }
        ]
      }
    ]
  },
  "Actas de bautismo": {
    "titulo": "Actas de bautismo",
    "categoria": "Registros vitales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f16",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          },
          {
            "nombre": "PARROQUIA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f3",
            "ancho": 4
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f4"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "OFICIANTE",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "BAUTIZADO",
        "nivel": "seccion"
      },
      {
        "tipo": "seccion",
        "titulo": "ANTECEDENTES VITALES"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑOS",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f6"
          },
          {
            "nombre": "MESES",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f7"
          },
          {
            "nombre": "DÍAS",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f8"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO DE NACIMIENTO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f9"
          },
          {
            "nombre": "FECHA DE NACIMIENTO",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f10"
          },
          {
            "nombre": "CONDICIÓN",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f11"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "CALIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f12"
          },
          {
            "nombre": "PATRIA",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f13"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "PADRE",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "MADRE",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p5",
        "titulo": "PADRINOS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p6",
        "titulo": "TESTIGOS",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f14"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f15"
          }
        ]
      }
    ]
  },
  "Actas de defunción": {
    "titulo": "Actas de defunción",
    "categoria": "Registros vitales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f12",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          },
          {
            "nombre": "PARROQUIA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f3",
            "ancho": 4
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f4"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "OFICIANTE",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "FINADO",
        "nivel": "seccion"
      },
      {
        "tipo": "seccion",
        "titulo": "ANTECEDENTES MORTUORIOS"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO DE DEFUNCIÓN",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f6"
          },
          {
            "nombre": "FECHA DE DEFUNCIÓN",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f7"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "EDAD AL MORIR",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f8"
          },
          {
            "nombre": "CAUSA DE MUERTE",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f9"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "CÓNYUGE",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "PADRE",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p5",
        "titulo": "MADRE",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f10"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f11"
          }
        ]
      }
    ]
  },
  "Actas de matrimonio": {
    "titulo": "Actas de matrimonio",
    "categoria": "Registros vitales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f14",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          },
          {
            "nombre": "PARROQUIA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f3",
            "ancho": 4
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f4"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "OFICIANTE",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "NOVIO",
        "nivel": "seccion"
      },
      {
        "tipo": "subseccion",
        "titulo": "ANTECEDENTES MATRIMONIALES"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "PATRIA",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f6"
          },
          {
            "nombre": "CONDICIÓN",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f7"
          },
          {
            "nombre": "CALIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f8"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "VIUDO DE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "PADRE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p5",
        "titulo": "MADRE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p6",
        "titulo": "NOVIA",
        "nivel": "seccion"
      },
      {
        "tipo": "subseccion",
        "titulo": "ANTECEDENTES MATRIMONIALES"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "PATRIA",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f9"
          },
          {
            "nombre": "CONDICIÓN",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f10"
          },
          {
            "nombre": "CALIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f11"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p7",
        "titulo": "VIUDA DE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p8",
        "titulo": "PADRE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p9",
        "titulo": "MADRE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p10",
        "titulo": "PADRINOS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p11",
        "titulo": "TESTIGOS",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f12"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f13"
          }
        ]
      }
    ]
  },
  "Testamentos": {
    "titulo": "Testamentos",
    "categoria": "Registros notariales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f17",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f3"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "TESTIGOS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "TESTADOR",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "PADRE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p5",
        "titulo": "MADRE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p6",
        "titulo": "CÓNYUGE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p7",
        "titulo": "VIUDO DE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p8",
        "titulo": "HIJOS LEGÍTIMOS",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p9",
        "titulo": "HIJOS NATURALES",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p10",
        "titulo": "DEUDORES",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p11",
        "titulo": "ACREEDORES",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p12",
        "titulo": "ALBACEAS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p13",
        "titulo": "HEREDEROS",
        "nivel": "seccion"
      },
      {
        "tipo": "seccion",
        "titulo": "INVENTARIO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f5"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f6"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f7"
          },
          {
            "nombre": "ÍTEM",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f8"
          },
          {
            "nombre": "CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f9"
          },
          {
            "nombre": "MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f10"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "SUBTOTAL CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f11"
          },
          {
            "nombre": "SUBTOTAL MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f12"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TOTAL SUBTOTALES CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f13"
          },
          {
            "nombre": "TOTAL SUBTOTALES MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f14"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f15"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f16"
          }
        ]
      }
    ]
  },
  "Legados testamentarios": {
    "titulo": "Legados testamentarios",
    "categoria": "Registros notariales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f22",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f3"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "ESCRIBANO/NOTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "TESTIGOS",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "TESTADOR",
        "nivel": "seccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "PADRE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p5",
        "titulo": "MADRE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p6",
        "titulo": "CÓNYUGE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p7",
        "titulo": "VIUDO DE",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p8",
        "titulo": "HIJOS LEGÍTIMOS",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p9",
        "titulo": "HIJOS NATURALES",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p10",
        "titulo": "DEUDORES",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p11",
        "titulo": "ACREEDORES",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p12",
        "titulo": "LEGATARIO TESTAMENTARIO",
        "nivel": "seccion"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TRATAMIENTO/TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f5"
          },
          {
            "nombre": "NOMBRES",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f6"
          },
          {
            "nombre": "APELLIDOS",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f7"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "EMPLEO/OFICIO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f8"
          },
          {
            "nombre": "INSTITUCIÓN",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f9"
          }
        ]
      },
      {
        "tipo": "personas",
        "id": "p13",
        "titulo": "HEREDEROS",
        "nivel": "seccion"
      },
      {
        "tipo": "seccion",
        "titulo": "INVENTARIO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f10"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "AÑO",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f11"
          },
          {
            "nombre": "FECHA EXACTA",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f12"
          },
          {
            "nombre": "ÍTEM",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f13"
          },
          {
            "nombre": "CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f14"
          },
          {
            "nombre": "MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f15"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "SUBTOTAL CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f16"
          },
          {
            "nombre": "SUBTOTAL MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f17"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TOTAL SUBTOTALES CANTIDAD",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f18"
          },
          {
            "nombre": "TOTAL SUBTOTALES MONTO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f19"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f20"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "NOTAS",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f21"
          }
        ]
      }
    ]
  },
  "Procesos judiciales": {
    "titulo": "Procesos judiciales",
    "categoria": "Registros judiciales",
    "bloques": [
      {
        "tipo": "seccion",
        "titulo": "REGISTRO"
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "TÍTULO",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f1",
            "ancho": 10
          },
          {
            "nombre": "SIGNATURA",
            "tipo": "texto",
            "opciones": null,
            "pista": "",
            "id": "f56",
            "ancho": 2
          },
          {
            "nombre": "LUGAR",
            "tipo": "lugar",
            "opciones": null,
            "pista": "",
            "id": "f2",
            "ancho": 2
          },
          {
            "nombre": "INSTITUCIÓN",
            "tipo": "institucion",
            "opciones": null,
            "pista": "",
            "id": "f3",
            "ancho": 4
          },
          {
            "nombre": "TIPO",
            "tipo": "select",
            "opciones": [
              "CAUSAS CIVILES",
              "CAUSAS CRIMINALES",
              "AUTOS",
              "PROBANZAS",
              "INFORMACIONES",
              "RESIDENCIAS",
              "VISITAS"
            ],
            "pista": "",
            "id": "f4"
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "DESDE",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f5"
          },
          {
            "nombre": "FECHA EXACTA (desde)",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f6"
          },
          {
            "nombre": "HASTA",
            "tipo": "anio",
            "opciones": null,
            "pista": "",
            "id": "f7"
          },
          {
            "nombre": "FECHA EXACTA (hasta)",
            "tipo": "fecha",
            "opciones": null,
            "pista": "",
            "id": "f8"
          }
        ]
      },
      {
        "tipo": "seccion",
        "titulo": "ACTORES"
      },
      {
        "tipo": "personas",
        "id": "p1",
        "titulo": "JUECES",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p2",
        "titulo": "DEMANDANTES",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p3",
        "titulo": "DEMANDADOS",
        "nivel": "subseccion"
      },
      {
        "tipo": "personas",
        "id": "p4",
        "titulo": "TERCEROS",
        "nivel": "subseccion"
      },
      {
        "tipo": "grupo",
        "id": "g1",
        "titulo": "ESCRITOS DE LAS PARTES",
        "repetible": true,
        "bloques": [
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "TIPO",
                "tipo": "select",
                "opciones": [
                  "DEMANDA",
                  "CONTESTACIÓN DE LA DEMANDA",
                  "IMPUGNACIÓN",
                  "OPOSICIÓN"
                ],
                "pista": "",
                "id": "f9"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "AÑO",
                "tipo": "anio",
                "opciones": null,
                "pista": "",
                "id": "f10"
              },
              {
                "nombre": "FECHA EXACTA",
                "tipo": "fecha",
                "opciones": null,
                "pista": "",
                "id": "f11"
              },
              {
                "nombre": "LUGAR",
                "tipo": "lugar",
                "opciones": null,
                "pista": "",
                "id": "f12"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "TRATAMIENTO/TÍTULO",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f13"
              },
              {
                "nombre": "NOMBRES",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f14"
              },
              {
                "nombre": "APELLIDOS",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f15"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "EMPLEO/OFICIO",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f16"
              },
              {
                "nombre": "INSTITUCIÓN",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f17"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "TRATAMIENTO/TÍTULO",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f18"
              },
              {
                "nombre": "NOMBRES",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f19"
              },
              {
                "nombre": "APELLIDOS",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f20"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "EMPLEO/OFICIO",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f21"
              },
              {
                "nombre": "INSTITUCIÓN",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f22"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "MATERIA",
                "tipo": "area",
                "opciones": null,
                "pista": "",
                "id": "f23"
              }
            ]
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f24"
          }
        ]
      },
      {
        "tipo": "grupo",
        "id": "g2",
        "titulo": "RESOLUCIONES JUDICIALES",
        "repetible": true,
        "bloques": [
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "TIPO",
                "tipo": "select",
                "opciones": [
                  "DECRETO",
                  "AUTO",
                  "SENTENCIA",
                  "DICTAMEN"
                ],
                "pista": "",
                "id": "f25"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "AÑO",
                "tipo": "anio",
                "opciones": null,
                "pista": "",
                "id": "f26"
              },
              {
                "nombre": "FECHA EXACTA",
                "tipo": "fecha",
                "opciones": null,
                "pista": "",
                "id": "f27"
              },
              {
                "nombre": "LUGAR",
                "tipo": "lugar",
                "opciones": null,
                "pista": "",
                "id": "f28"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "TRATAMIENTO/TÍTULO",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f29"
              },
              {
                "nombre": "NOMBRES",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f30"
              },
              {
                "nombre": "APELLIDOS",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f31"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "EMPLEO/OFICIO",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f32"
              },
              {
                "nombre": "INSTITUCIÓN",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f33"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "TRATAMIENTO/TÍTULO",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f34"
              },
              {
                "nombre": "NOMBRES",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f35"
              },
              {
                "nombre": "APELLIDOS",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f36"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "EMPLEO/OFICIO",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f37"
              },
              {
                "nombre": "INSTITUCIÓN",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f38"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "MATERIA",
                "tipo": "area",
                "opciones": null,
                "pista": "",
                "id": "f39"
              }
            ]
          }
        ]
      },
      {
        "tipo": "campos",
        "campos": [
          {
            "nombre": "MATERIA",
            "tipo": "area",
            "opciones": null,
            "pista": "",
            "id": "f40"
          }
        ]
      },
      {
        "tipo": "grupo",
        "id": "g3",
        "titulo": "ACTAS Y REGISTROS JUDICIALES",
        "repetible": true,
        "bloques": [
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "TIPO",
                "tipo": "select",
                "opciones": [
                  "ACTA",
                  "NOTIFICACIÓN"
                ],
                "pista": "",
                "id": "f41"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "AÑO",
                "tipo": "anio",
                "opciones": null,
                "pista": "",
                "id": "f42"
              },
              {
                "nombre": "FECHA EXACTA",
                "tipo": "fecha",
                "opciones": null,
                "pista": "",
                "id": "f43"
              },
              {
                "nombre": "LUGAR",
                "tipo": "lugar",
                "opciones": null,
                "pista": "",
                "id": "f44"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "TRATAMIENTO/TÍTULO",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f45"
              },
              {
                "nombre": "NOMBRES",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f46"
              },
              {
                "nombre": "APELLIDOS",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f47"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "EMPLEO/OFICIO",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f48"
              },
              {
                "nombre": "INSTITUCIÓN",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f49"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "TRATAMIENTO/TÍTULO",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f50"
              },
              {
                "nombre": "NOMBRES",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f51"
              },
              {
                "nombre": "APELLIDOS",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f52"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "EMPLEO/OFICIO",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f53"
              },
              {
                "nombre": "INSTITUCIÓN",
                "tipo": "texto",
                "opciones": null,
                "pista": "",
                "id": "f54"
              }
            ]
          },
          {
            "tipo": "campos",
            "campos": [
              {
                "nombre": "MATERIA",
                "tipo": "area",
                "opciones": null,
                "pista": "",
                "id": "f55"
              }
            ]
          }
        ]
      }
    ]
  }
};

window.FORMULARIOS_BLOQUES = FORMULARIOS_BLOQUES;
