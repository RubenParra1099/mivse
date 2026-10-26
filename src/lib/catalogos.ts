// Catálogos compartidos por el Call Center, el Tablero y el generador del censo.

export const NIVELES = ['desconectado', 'ocasional', 'activo', 'embajador'] as const;
export type Nivel = (typeof NIVELES)[number];

export const NIVEL_INFO: Record<Nivel, { etiqueta: string; color: string; desc: string }> = {
  desconectado: { etiqueta: 'Desconectados', color: '#64748b', desc: 'Sin contacto ni participación reciente' },
  ocasional: { etiqueta: 'Ocasionales', color: '#38bdf8', desc: 'Contacto esporádico con la institución' },
  activo: { etiqueta: 'Activos', color: '#6366f1', desc: 'Participan y mantienen sus datos al día' },
  embajador: { etiqueta: 'Embajadores', color: '#d946ef', desc: 'Promueven, aportan y recomiendan a la institución' },
};

export const ESTATUS_LABORAL = ['empleado', 'autoempleo', 'estudiando', 'desempleado', 'sin_dato'] as const;
export type EstatusLaboral = (typeof ESTATUS_LABORAL)[number];

export const ESTATUS_INFO: Record<EstatusLaboral, { etiqueta: string; color: string }> = {
  empleado: { etiqueta: 'Empleado', color: '#22c55e' },
  autoempleo: { etiqueta: 'Emprendedor', color: '#14b8a6' },
  estudiando: { etiqueta: 'Estudiando posgrado', color: '#a78bfa' },
  desempleado: { etiqueta: 'Buscando empleo', color: '#f97316' },
  sin_dato: { etiqueta: 'Sin dato', color: '#94a3b8' },
};

export const CARRERAS = [
  { clave: 'IIN', nombre: 'Ingeniería Industrial', area: 'Ingenierías' },
  { clave: 'ISC', nombre: 'Ing. en Sistemas Computacionales', area: 'Ingenierías' },
  { clave: 'IMT', nombre: 'Ing. Mecatrónica', area: 'Ingenierías' },
  { clave: 'ICV', nombre: 'Ingeniería Civil', area: 'Ingenierías' },
  { clave: 'ARQ', nombre: 'Arquitectura', area: 'Diseño' },
  { clave: 'DGR', nombre: 'Diseño Gráfico', area: 'Diseño' },
  { clave: 'DER', nombre: 'Derecho', area: 'Sociales' },
  { clave: 'CPF', nombre: 'Contaduría y Finanzas', area: 'Negocios' },
  { clave: 'ADM', nombre: 'Administración de Empresas', area: 'Negocios' },
  { clave: 'MKT', nombre: 'Mercadotecnia', area: 'Negocios' },
  { clave: 'PSI', nombre: 'Psicología', area: 'Salud' },
  { clave: 'MED', nombre: 'Medicina', area: 'Salud' },
  { clave: 'ENF', nombre: 'Enfermería', area: 'Salud' },
  { clave: 'NUT', nombre: 'Nutrición', area: 'Salud' },
] as const;

export const SECTORES = [
  'Manufactura y automotriz',
  'Tecnologías de la información',
  'Salud',
  'Educación',
  'Gobierno',
  'Comercio y retail',
  'Servicios financieros',
  'Construcción e inmobiliario',
  'Agroindustria',
  'Consultoría y servicios profesionales',
  'Energía y minería',
  'Medios y creatividad',
] as const;

export const RANGOS_INGRESO = ['Menos de $10k', '$10k – $20k', '$20k – $35k', '$35k – $50k', 'Más de $50k'] as const;

export const APORTACIONES = ['Mentoría', 'Conferencista', 'Oferta de empleo', 'Donación', 'Voluntariado', 'Consejo consultivo'] as const;

/** Resultados del flujo guiado de llamada. `efectivo` = hubo conversación con el egresado. */
export const RESULTADOS = [
  { id: 'actualizado', etiqueta: 'Datos actualizados', efectivo: true, tono: 'ok' },
  { id: 'no_contesto', etiqueta: 'No contestó', efectivo: false, tono: 'neutro' },
  { id: 'buzon', etiqueta: 'Buzón de voz', efectivo: false, tono: 'neutro' },
  { id: 'reagendar', etiqueta: 'Reagendar llamada', efectivo: true, tono: 'aviso' },
  { id: 'whatsapp', etiqueta: 'WhatsApp enviado', efectivo: false, tono: 'info' },
  { id: 'numero_equivocado', etiqueta: 'Número equivocado', efectivo: false, tono: 'mal' },
  { id: 'no_desea', etiqueta: 'No desea contacto', efectivo: true, tono: 'mal' },
] as const;
export type ResultadoId = (typeof RESULTADOS)[number]['id'];

export const AGENTES = ['Ana Torres', 'Luis Méndez', 'Karla Ríos', 'Jorge Salas', 'Paola Núñez', 'Diego Herrera'];

/** Encuestadores de la App de Campo (Módulo 1). */
export const ENCUESTADORES = ['Mariana López', 'Ricardo Ibarra', 'Fernanda Castro', 'Héctor Villarreal', 'Sofía Garza', 'Andrés Cárdenas'];

/** Municipios donde radican los egresados. `peso` = proporción relativa en el censo; `r` = dispersión en grados. */
export const MUNICIPIOS = [
  { nombre: 'Torreón', estado: 'Coahuila', lat: 25.5428, lng: -103.4068, peso: 40, r: 0.035, lada: '871' },
  { nombre: 'Gómez Palacio', estado: 'Durango', lat: 25.5611, lng: -103.4983, peso: 14, r: 0.025, lada: '871' },
  { nombre: 'Lerdo', estado: 'Durango', lat: 25.5378, lng: -103.5243, peso: 5, r: 0.015, lada: '871' },
  { nombre: 'Matamoros', estado: 'Coahuila', lat: 25.5283, lng: -103.2283, peso: 3, r: 0.012, lada: '871' },
  { nombre: 'San Pedro', estado: 'Coahuila', lat: 25.7592, lng: -102.9827, peso: 2, r: 0.012, lada: '872' },
  { nombre: 'Francisco I. Madero', estado: 'Coahuila', lat: 25.7753, lng: -103.2731, peso: 1.5, r: 0.01, lada: '872' },
  { nombre: 'Saltillo', estado: 'Coahuila', lat: 25.4232, lng: -101.0053, peso: 5, r: 0.03, lada: '844' },
  { nombre: 'Monclova', estado: 'Coahuila', lat: 26.908, lng: -101.4215, peso: 1.5, r: 0.015, lada: '866' },
  { nombre: 'Monterrey', estado: 'Nuevo León', lat: 25.6866, lng: -100.3161, peso: 8, r: 0.05, lada: '81' },
  { nombre: 'Durango', estado: 'Durango', lat: 24.0277, lng: -104.6532, peso: 2.5, r: 0.02, lada: '618' },
  { nombre: 'Chihuahua', estado: 'Chihuahua', lat: 28.633, lng: -106.0691, peso: 2, r: 0.025, lada: '614' },
  { nombre: 'Ciudad Juárez', estado: 'Chihuahua', lat: 31.6904, lng: -106.4245, peso: 1, r: 0.03, lada: '656' },
  { nombre: 'Zacatecas', estado: 'Zacatecas', lat: 22.7709, lng: -102.5833, peso: 1, r: 0.015, lada: '492' },
  { nombre: 'Ciudad de México', estado: 'Ciudad de México', lat: 19.4326, lng: -99.1332, peso: 5, r: 0.06, lada: '55' },
  { nombre: 'Guadalajara', estado: 'Jalisco', lat: 20.6597, lng: -103.3496, peso: 2.5, r: 0.04, lada: '33' },
  { nombre: 'Querétaro', estado: 'Querétaro', lat: 20.5888, lng: -100.3899, peso: 2, r: 0.03, lada: '442' },
  { nombre: 'Tijuana', estado: 'Baja California', lat: 32.5149, lng: -117.0382, peso: 0.8, r: 0.03, lada: '664' },
  { nombre: 'Mérida', estado: 'Yucatán', lat: 20.9674, lng: -89.5926, peso: 0.5, r: 0.03, lada: '999' },
  { nombre: 'Cancún', estado: 'Quintana Roo', lat: 21.1619, lng: -86.8515, peso: 0.5, r: 0.02, lada: '998' },
  { nombre: 'Houston', estado: 'Extranjero', lat: 29.7604, lng: -95.3698, peso: 0.7, r: 0.05, lada: '871' },
] as const;

export const INSTITUCION = process.env.NEXT_PUBLIC_INSTITUCION || 'Universidad';
export const AREA_EGRESADOS = process.env.NEXT_PUBLIC_AREA_EGRESADOS || 'Coordinación de Egresados';

export const PLANTILLAS_WHATSAPP = [
  {
    id: 'actualizacion',
    etiqueta: 'Actualización de datos',
    texto: (n: string) =>
      `Hola ${n}, te saluda la ${AREA_EGRESADOS} de la ${INSTITUCION}. Estamos actualizando el censo de egresados: ¿nos regalas 2 minutos para confirmar tus datos laborales y de contacto?`,
  },
  {
    id: 'evento',
    etiqueta: 'Invitación a evento',
    texto: (n: string) =>
      `Hola ${n}, la ${INSTITUCION} te invita al próximo Encuentro de Egresados. Queremos verte de nuevo en casa. ¿Te reservamos un lugar?`,
  },
  {
    id: 'bolsa',
    etiqueta: 'Bolsa de trabajo',
    texto: (n: string) =>
      `Hola ${n}, tenemos nuevas vacantes en la Bolsa de Trabajo de la ${INSTITUCION} afines a tu perfil. ¿Te compartimos los detalles?`,
  },
  {
    id: 'nps',
    etiqueta: 'Encuesta de recomendación',
    texto: (n: string) =>
      `Hola ${n}, en una escala del 0 al 10, ¿qué tan probable es que recomiendes la ${INSTITUCION} a un familiar o amigo? Tu respuesta nos ayuda a mejorar.`,
  },
] as const;

export const nombreCarrera = (clave: string) => CARRERAS.find((c) => c.clave === clave)?.nombre ?? clave;
