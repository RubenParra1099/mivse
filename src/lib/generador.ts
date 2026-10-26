// Generador determinista del censo inicial de 7,000 egresados (datos sintéticos realistas).
// Lo usa el script de carga a Neon y el modo demo cuando no hay DATABASE_URL.

import {
  AGENTES,
  APORTACIONES,
  CARRERAS,
  MUNICIPIOS,
  RANGOS_INGRESO,
  SECTORES,
  type EstatusLaboral,
  type ResultadoId,
} from './catalogos';
import { calcularIVE, nivelDe } from './ive';
import type { Egresado, Llamada } from './tipos';

const DIA = 86_400_000;

function prng(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMBRES_F = ['María', 'Fernanda', 'Daniela', 'Valeria', 'Sofía', 'Andrea', 'Mariana', 'Ximena', 'Paulina', 'Alejandra', 'Gabriela', 'Lucía', 'Camila', 'Regina', 'Natalia', 'Diana', 'Karen', 'Itzel', 'Renata', 'Jimena', 'Ana Laura', 'Claudia', 'Mónica', 'Brenda', 'Elena', 'Patricia', 'Verónica', 'Adriana', 'Sara', 'Isabel'];
const NOMBRES_M = ['José', 'Luis', 'Juan Carlos', 'Miguel Ángel', 'Alejandro', 'Diego', 'Carlos', 'Jorge', 'Eduardo', 'Fernando', 'Ricardo', 'Andrés', 'Rodrigo', 'Santiago', 'Emilio', 'Sebastián', 'Héctor', 'Arturo', 'Raúl', 'Óscar', 'Javier', 'Francisco', 'Iván', 'Mauricio', 'Roberto', 'Gerardo', 'Manuel', 'Daniel', 'Adrián', 'Pablo'];
const APELLIDOS = ['García', 'Martínez', 'Hernández', 'López', 'González', 'Rodríguez', 'Pérez', 'Sánchez', 'Ramírez', 'Flores', 'Gómez', 'Torres', 'Díaz', 'Vázquez', 'Cruz', 'Morales', 'Reyes', 'Gutiérrez', 'Ortiz', 'Ruiz', 'Castillo', 'Jiménez', 'Mendoza', 'Aguilar', 'Herrera', 'Medina', 'Castro', 'Vargas', 'Ríos', 'Salazar', 'De la Fuente', 'Villarreal', 'Garza', 'Treviño', 'Cárdenas', 'Rangel', 'Ibarra', 'Estrada', 'Escobedo', 'Saucedo', 'Arredondo', 'Valdés', 'Zamora', 'Luna', 'Barrera'];

const SECTOR_POR_CARRERA: Record<string, [number, number][]> = {
  // [índice en SECTORES, peso]
  IIN: [[0, 5], [9, 1], [10, 1], [5, 1], [8, 1]],
  ISC: [[1, 6], [6, 1], [0, 1], [9, 1]],
  IMT: [[0, 6], [10, 1], [1, 1]],
  ICV: [[7, 6], [4, 1], [10, 1]],
  ARQ: [[7, 5], [9, 1], [4, 1]],
  DGR: [[11, 5], [5, 1], [1, 1]],
  DER: [[9, 4], [4, 3], [6, 1]],
  CPF: [[6, 4], [9, 2], [4, 1], [5, 1], [0, 1]],
  ADM: [[5, 3], [0, 2], [6, 2], [8, 1]],
  MKT: [[5, 3], [11, 3], [1, 1]],
  PSI: [[2, 3], [3, 3], [9, 1]],
  MED: [[2, 8]],
  ENF: [[2, 8]],
  NUT: [[2, 4], [3, 1], [8, 1], [5, 1]],
};

const EMPRESAS: Record<number, string[]> = {
  0: ['Grupo Industrial Laguna', 'Metalúrgica del Norte', 'Autopartes Nazas', 'Ensambles del Bajío', 'Fundición Regional'],
  1: ['NovaSoft Labs', 'Datanorte', 'Cloudhaus MX', 'Kódigo Studio', 'Sistemas Integrales Lagunero'],
  2: ['Hospital Regional', 'Clínica San Ángel', 'Centro Médico Nazas', 'Laboratorio Biolab', 'IMSS Delegación'],
  3: ['Colegio Cervantes', 'Instituto Tecnológico Regional', 'Secretaría de Educación', 'Preparatoria Lagunera'],
  4: ['Ayuntamiento Municipal', 'Gobierno del Estado', 'Poder Judicial', 'Secretaría de Economía'],
  5: ['Comercializadora del Norte', 'Retail Laguna', 'Distribuidora Ágora', 'Tiendas Mirasol'],
  6: ['Banca Regional', 'Financiera Progreso', 'Aseguradora Atlas', 'Despacho Fiscal Integral'],
  7: ['Constructora Torreón', 'Inmobiliaria Las Villas', 'Infraestructura del Norte', 'Desarrollos Laguna'],
  8: ['Agroindustrias del Nazas', 'Lácteos de la Comarca', 'Viñedos del Desierto', 'Forrajes Unidos'],
  9: ['Consultores Asociados', 'Bufete Jurídico Integral', 'Strategos Consultoría', 'Auditores del Norte'],
  10: ['Minera Sierra Madre', 'Energía Solar Laguna', 'Gas Natural del Norte', 'Peñas Mining Services'],
  11: ['Estudio Creativo Ocre', 'Agencia Pulso', 'Medios del Norte', 'Producciones Desierto'],
};

const PUESTOS: Record<string, string[]> = {
  Ingenierías: ['Ingeniero de procesos', 'Líder de proyecto', 'Supervisor de producción', 'Desarrollador de software', 'Gerente de planta', 'Ingeniero de calidad'],
  Diseño: ['Diseñador sénior', 'Arquitecto de proyecto', 'Director creativo', 'Diseñador UX', 'Residente de obra'],
  Sociales: ['Abogado asociado', 'Asesor jurídico', 'Notario adscrito', 'Litigante'],
  Negocios: ['Analista financiero', 'Contador sénior', 'Gerente comercial', 'Coordinador de mercadotecnia', 'Auditor', 'Director de operaciones'],
  Salud: ['Médico residente', 'Médico general', 'Enfermera jefe de piso', 'Psicólogo clínico', 'Nutriólogo', 'Coordinador de servicio'],
};

function elegir<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)];
}
function ponderado<T>(r: () => number, pares: readonly (readonly [T, number])[]): T {
  const total = pares.reduce((s, p) => s + p[1], 0);
  let x = r() * total;
  for (const [v, w] of pares) if ((x -= w) <= 0) return v;
  return pares[pares.length - 1][0];
}
function normal(r: () => number) {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

export interface CensoGenerado {
  egresados: Egresado[];
  llamadas: Llamada[];
}

export function generarCenso(total = 7000, ahora = new Date(), semilla = 2026): CensoGenerado {
  const r = prng(semilla);
  const hoy = ahora.getTime();
  const egresados: Egresado[] = [];
  const llamadas: Llamada[] = [];
  const secuencia = new Map<number, number>();
  const municipios = MUNICIPIOS.map((m) => [m, m.peso] as const);
  let llamadaId = 1;

  for (let i = 1; i <= total; i++) {
    const genero: 'F' | 'M' = r() < 0.52 ? 'F' : 'M';
    const nombre = elegir(r, genero === 'F' ? NOMBRES_F : NOMBRES_M);
    const ap = elegir(r, APELLIDOS);
    const am = elegir(r, APELLIDOS);
    const carrera = elegir(r, CARRERAS);
    const generacion = 2010 + Math.min(15, Math.floor(Math.pow(r(), 0.8) * 16));
    const antiguedad = 2026 - generacion;
    const seq = (secuencia.get(generacion) ?? 0) + 1;
    secuencia.set(generacion, seq);
    const matricula = `${generacion}${String(seq).padStart(4, '0')}`;

    const mun = ponderado(r, municipios);
    const tieneGeo = r() < 0.93;
    const lat = tieneGeo ? +(mun.lat + normal(r) * mun.r).toFixed(5) : null;
    const lng = tieneGeo ? +(mun.lng + normal(r) * mun.r * 1.15).toFixed(5) : null;
    const geoOrigen = tieneGeo ? (r() < 0.76 ? 'campo' : 'domicilio') : null;
    const telefono = `${mun.lada}${String(Math.floor(r() * 10 ** (10 - mun.lada.length))).padStart(10 - mun.lada.length, '0')}`;
    const email = `${sinAcentos(nombre.split(' ')[0])}.${sinAcentos(ap)}${Math.floor(r() * 90 + 10)}@${elegir(r, ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com.mx'])}`;

    // Vinculación latente: ayuda a que participación, aportación y recomendación estén correlacionadas
    const z = normal(r) - antiguedad * 0.035;
    const contactado = r() < 0.92 - antiguedad * 0.011;

    let estatus: EstatusLaboral = 'sin_dato';
    let sectorIdx: number | null = null;
    let participaciones = 0;
    let aportaciones: string[] = [];
    let interesPosgrado = false;
    let nps: number | null = null;
    let ultimaActualizacion: string | null = null;
    let ultimoContacto: string | null = null;

    if (contactado) {
      estatus = ponderado(r, [['empleado', 68], ['autoempleo', 10], ['estudiando', antiguedad < 4 ? 12 : 5], ['desempleado', 9], ['sin_dato', 5]] as const);
      const dias = r() < 0.7 + z * 0.06 ? Math.floor(r() * 360) : 366 + Math.floor(r() * 900);
      ultimaActualizacion = new Date(hoy - dias * DIA - Math.floor(r() * DIA)).toISOString();
      ultimoContacto = ultimaActualizacion;
      const pp = 0.72 + z * 0.8;
      participaciones = Math.max(0, Math.min(6, Math.round(pp + normal(r) * 0.9)));
      const na = r() < 0.32 + z * 0.15 ? (r() < 0.4 + z * 0.1 ? 2 + Math.floor(r() * 2) : 1) : 0;
      const pool = [...APORTACIONES];
      aportaciones = Array.from({ length: Math.min(na, pool.length) }, () => pool.splice(Math.floor(r() * pool.length), 1)[0]);
      interesPosgrado = r() < 0.32 + z * 0.08;
      if (r() < 0.78) nps = Math.max(0, Math.min(10, Math.round(8.95 + z * 0.9 + normal(r) * 0.95)));
    } else if (r() < 0.12) {
      estatus = 'empleado';
    }
    if (estatus === 'empleado' || estatus === 'autoempleo') {
      sectorIdx = ponderado(r, SECTOR_POR_CARRERA[carrera.clave] as [number, number][]);
    }
    const empresa = sectorIdx == null ? null : estatus === 'autoempleo' ? 'Negocio propio' : elegir(r, EMPRESAS[sectorIdx]);
    const puesto = sectorIdx == null ? null : estatus === 'autoempleo' ? 'Fundador / Director' : elegir(r, PUESTOS[carrera.area]);
    const rangoIngreso =
      sectorIdx == null
        ? null
        : RANGOS_INGRESO[Math.max(0, Math.min(4, Math.floor(antiguedad / 3.2 + normal(r) * 0.9 + (carrera.area === 'Salud' || carrera.area === 'Ingenierías' ? 0.5 : 0))))];

    const diasAct = ultimaActualizacion ? Math.floor((hoy - Date.parse(ultimaActualizacion)) / DIA) : null;
    const ive = calcularIVE({ estatus, diasActualizacion: diasAct, participaciones, interesPosgrado, aportaciones: aportaciones.length, nps });

    const e: Egresado = {
      id: i,
      matricula,
      nombre,
      apellidoPaterno: ap,
      apellidoMaterno: am,
      genero,
      carrera: carrera.clave,
      generacion,
      telefono,
      email,
      municipio: mun.nombre,
      estado: mun.estado,
      lat,
      lng,
      geoOrigen,
      estatus,
      sector: sectorIdx == null ? null : SECTORES[sectorIdx],
      empresa,
      puesto,
      rangoIngreso,
      interesPosgrado,
      aportaciones,
      participaciones,
      nps,
      contactado,
      ultimaActualizacion,
      ultimoContacto,
      proximoContacto: null,
      ive,
      nivel: nivelDe(ive),
    };

    // Historial de contacto
    const intentos = contactado ? Math.floor(r() * 3) : Math.floor(r() * 3);
    const base = ultimoContacto ? Date.parse(ultimoContacto) : hoy - Math.floor(r() * 400) * DIA;
    for (let k = intentos; k >= 1; k--) {
      const fecha = new Date(base - k * (2 + Math.floor(r() * 20)) * DIA - Math.floor(r() * 8) * 3_600_000);
      const res: ResultadoId = ponderado(r, [['no_contesto', 6], ['buzon', 3], ['whatsapp', 2], ['numero_equivocado', contactado ? 0.2 : 1.5]] as const);
      llamadas.push(llamadaHist(llamadaId++, e, elegir(r, AGENTES), res, fecha, null));
      if (!contactado) e.ultimoContacto = fecha.toISOString();
    }
    if (contactado && ultimoContacto) {
      llamadas.push(llamadaHist(llamadaId++, e, elegir(r, AGENTES), 'actualizado', new Date(ultimoContacto), e));
    }
    if (contactado && r() < 0.03) e.proximoContacto = new Date(hoy + Math.floor(r() * 5) * DIA).toISOString();
    egresados.push(e);
  }

  // Actividad del día en curso para el feed en vivo del Call Center
  const inicioJornada = new Date(ahora);
  inicioJornada.setHours(8, 0, 0, 0);
  const minutos = Math.max(30, Math.floor((hoy - inicioJornada.getTime()) / 60_000));
  for (let k = 0; k < 46; k++) {
    const e = egresados[Math.floor(r() * egresados.length)];
    const fecha = new Date(hoy - Math.floor(r() * Math.min(minutos, 600)) * 60_000);
    const res: ResultadoId = ponderado(r, [['actualizado', 5], ['no_contesto', 4], ['buzon', 2], ['whatsapp', 2], ['reagendar', 1]] as const);
    llamadas.push(llamadaHist(llamadaId++, e, elegir(r, AGENTES), res, fecha, res === 'actualizado' ? e : null));
  }
  llamadas.sort((a, b) => a.fecha.localeCompare(b.fecha));
  llamadas.forEach((l, idx) => (l.id = idx + 1));
  return { egresados, llamadas };
}

function llamadaHist(id: number, e: Egresado, agente: string, resultado: ResultadoId, fecha: Date, actualizado: Egresado | null): Llamada {
  return {
    id,
    egresadoId: e.id,
    matricula: e.matricula,
    nombreEgresado: `${e.nombre} ${e.apellidoPaterno}`,
    agente,
    canal: resultado === 'whatsapp' ? 'whatsapp' : 'llamada',
    resultado,
    notas: null,
    iveAntes: actualizado ? Math.max(0, Math.round((actualizado.ive - 6) * 10) / 10) : null,
    iveDespues: actualizado ? actualizado.ive : null,
    nivelAntes: actualizado ? nivelDe(Math.max(0, actualizado.ive - 6)) : null,
    nivelDespues: actualizado ? actualizado.nivel : null,
    fecha: fecha.toISOString(),
  };
}
