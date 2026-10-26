import { Pool } from 'pg';
import { CARRERAS, ESTATUS_LABORAL, MUNICIPIOS, NIVELES, RANGOS_INGRESO, RESULTADOS, SECTORES } from './catalogos';
import { generarCenso } from './generador';
import { calcularIVE, nivelDe } from './ive';
import { textoBusqueda, tokens } from './busqueda';
import type { ActualizacionLlamada, DatasetTablero, Egresado, EgresadoResumen, ExpedienteCompleto, Llamada } from './tipos';

const DIA = 86_400_000;

// ─── Conexión ──────────────────────────────────────────────────────────────

const g = globalThis as unknown as { __mivsePool?: Pool | null; __mivseDemo?: ReturnType<typeof generarCenso> };

function pool(): Pool | null {
  if (g.__mivsePool !== undefined) return g.__mivsePool;
  const url = process.env.DATABASE_URL;
  g.__mivsePool = url ? new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000, ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false } }) : null;
  return g.__mivsePool;
}

export const modo = (): 'neon' | 'demo' => (pool() ? 'neon' : 'demo');

function demo() {
  if (!g.__mivseDemo) g.__mivseDemo = generarCenso();
  return g.__mivseDemo;
}

// ─── Mapeo de filas ────────────────────────────────────────────────────────

const COLS = `id, matricula, nombre, apellido_paterno, apellido_materno, genero, carrera, generacion, telefono, email,
  municipio, estado, lat, lng, geo_origen, estatus_laboral, sector, empresa, puesto, rango_ingreso, interes_posgrado,
  aportaciones, participaciones, nps, contactado, ultima_actualizacion, ultimo_contacto, proximo_contacto, ive, nivel`;

type Fila = Record<string, unknown>;
const iso = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());

function aEgresado(f: Fila): Egresado {
  return {
    id: f.id as number,
    matricula: f.matricula as string,
    nombre: f.nombre as string,
    apellidoPaterno: f.apellido_paterno as string,
    apellidoMaterno: f.apellido_materno as string,
    genero: f.genero as 'F' | 'M',
    carrera: f.carrera as string,
    generacion: f.generacion as number,
    telefono: (f.telefono as string) ?? '',
    email: (f.email as string) ?? '',
    municipio: f.municipio as string,
    estado: f.estado as string,
    lat: f.lat as number | null,
    lng: f.lng as number | null,
    geoOrigen: f.geo_origen as Egresado['geoOrigen'],
    estatus: f.estatus_laboral as Egresado['estatus'],
    sector: f.sector as string | null,
    empresa: f.empresa as string | null,
    puesto: f.puesto as string | null,
    rangoIngreso: f.rango_ingreso as string | null,
    interesPosgrado: f.interes_posgrado as boolean,
    aportaciones: (f.aportaciones as string[]) ?? [],
    participaciones: f.participaciones as number,
    nps: f.nps as number | null,
    contactado: f.contactado as boolean,
    ultimaActualizacion: iso(f.ultima_actualizacion),
    ultimoContacto: iso(f.ultimo_contacto),
    proximoContacto: iso(f.proximo_contacto),
    ive: Number(f.ive),
    nivel: f.nivel as Egresado['nivel'],
  };
}

function aLlamada(f: Fila): Llamada {
  return {
    id: Number(f.id),
    egresadoId: f.egresado_id as number,
    matricula: f.matricula as string | undefined,
    nombreEgresado: f.nombre_egresado as string | undefined,
    agente: f.agente as string,
    canal: f.canal as Llamada['canal'],
    resultado: f.resultado as Llamada['resultado'],
    notas: f.notas as string | null,
    iveAntes: f.ive_antes == null ? null : Number(f.ive_antes),
    iveDespues: f.ive_despues == null ? null : Number(f.ive_despues),
    nivelAntes: f.nivel_antes as Llamada['nivelAntes'],
    nivelDespues: f.nivel_despues as Llamada['nivelDespues'],
    fecha: iso(f.created_at)!,
  };
}

export const resumen = (e: Egresado): EgresadoResumen => ({
  id: e.id,
  matricula: e.matricula,
  nombreCompleto: `${e.nombre} ${e.apellidoPaterno} ${e.apellidoMaterno}`.trim(),
  carrera: e.carrera,
  generacion: e.generacion,
  municipio: e.municipio,
  estatus: e.estatus,
  nivel: e.nivel,
  ive: e.ive,
  ultimoContacto: e.ultimoContacto,
  ultimaActualizacion: e.ultimaActualizacion,
  proximoContacto: e.proximoContacto,
});

// ─── Buscador ──────────────────────────────────────────────────────────────

export async function buscar(q: string, limite = 40): Promise<EgresadoResumen[]> {
  const ts = tokens(q);
  if (!ts.length) return [];
  const p = pool();
  if (!p) {
    const out: EgresadoResumen[] = [];
    for (const e of demo().egresados) {
      const t = textoBusqueda(e);
      if (ts.every((x) => t.includes(x))) {
        out.push(resumen(e));
        if (out.length >= limite) break;
      }
    }
    return out;
  }
  const where = ts.map((_, i) => `busqueda like $${i + 1}`).join(' and ');
  const { rows } = await p.query(
    `select ${COLS} from egresados where ${where} order by (matricula = $${ts.length + 1}) desc, apellido_paterno, nombre limit ${limite}`,
    [...ts.map((t) => `%${t}%`), ts[0]],
  );
  return rows.map((r) => resumen(aEgresado(r)));
}

// ─── Cola de llamadas priorizada ───────────────────────────────────────────

export async function colaLlamadas(limite = 60): Promise<EgresadoResumen[]> {
  const p = pool();
  const ahora = Date.now();
  if (!p) {
    const lista = demo().egresados.filter((e) => {
      const reciente = e.ultimoContacto && ahora - Date.parse(e.ultimoContacto) < 3 * DIA;
      const vencido = e.ultimaActualizacion == null || ahora - Date.parse(e.ultimaActualizacion) > 365 * DIA;
      return (e.proximoContacto && Date.parse(e.proximoContacto) <= ahora + DIA) || (vencido && !reciente);
    });
    lista.sort(
      (a, b) =>
        (a.proximoContacto ? 0 : 1) - (b.proximoContacto ? 0 : 1) ||
        (a.ultimaActualizacion ?? '').localeCompare(b.ultimaActualizacion ?? '') ||
        b.generacion - a.generacion,
    );
    return lista.slice(0, limite).map(resumen);
  }
  const { rows } = await p.query(
    `select ${COLS} from egresados
      where (proximo_contacto is not null and proximo_contacto <= now() + interval '1 day')
         or ((ultima_actualizacion is null or ultima_actualizacion < now() - interval '365 days')
             and (ultimo_contacto is null or ultimo_contacto < now() - interval '3 days'))
      order by proximo_contacto nulls last, ultima_actualizacion nulls first, generacion desc
      limit $1`,
    [limite],
  );
  return rows.map((r) => resumen(aEgresado(r)));
}

// ─── Expediente único ──────────────────────────────────────────────────────

export async function expediente(id: number): Promise<ExpedienteCompleto | null> {
  const p = pool();
  if (!p) {
    const e = demo().egresados.find((x) => x.id === id);
    if (!e) return null;
    const llamadas = demo().llamadas.filter((l) => l.egresadoId === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
    return { egresado: e, llamadas };
  }
  const [eg, ll] = await Promise.all([
    p.query(`select ${COLS} from egresados where id = $1`, [id]),
    p.query(`select * from llamadas where egresado_id = $1 order by created_at desc limit 50`, [id]),
  ]);
  if (!eg.rows[0]) return null;
  return { egresado: aEgresado(eg.rows[0]), llamadas: ll.rows.map(aLlamada) };
}

// ─── Registro del resultado de la llamada (flujo guiado) ───────────────────

export function aplicarActualizacion(e: Egresado, a: ActualizacionLlamada, ahora = new Date()): Egresado {
  const r = RESULTADOS.find((x) => x.id === a.resultado)!;
  const n: Egresado = { ...e, ultimoContacto: ahora.toISOString(), proximoContacto: null };
  if (r.efectivo) n.contactado = true;
  if (a.resultado === 'actualizado' && a.datos) {
    Object.assign(n, a.datos);
    if (n.estatus !== 'empleado' && n.estatus !== 'autoempleo') {
      n.sector = null;
      n.empresa = null;
      n.puesto = null;
      n.rangoIngreso = null;
    }
    const m = MUNICIPIOS.find((x) => x.nombre === n.municipio);
    if (m && m.nombre !== e.municipio) n.estado = m.estado;
    n.ultimaActualizacion = ahora.toISOString();
  }
  if (a.resultado === 'reagendar') n.proximoContacto = a.proximoContacto ?? new Date(ahora.getTime() + DIA).toISOString();
  const dias = n.ultimaActualizacion ? Math.floor((ahora.getTime() - Date.parse(n.ultimaActualizacion)) / DIA) : null;
  n.ive = calcularIVE({
    estatus: n.estatus,
    diasActualizacion: dias,
    participaciones: n.participaciones,
    interesPosgrado: n.interesPosgrado,
    aportaciones: n.aportaciones.length,
    nps: n.nps,
  });
  n.nivel = nivelDe(n.ive);
  return n;
}

export async function registrarLlamada(a: ActualizacionLlamada): Promise<{ egresado: Egresado; llamada: Llamada } | null> {
  const p = pool();
  const ahora = new Date();
  if (!p) {
    const d = demo();
    const idx = d.egresados.findIndex((x) => x.id === a.egresadoId);
    if (idx < 0) return null;
    const antes = d.egresados[idx];
    const nuevo = aplicarActualizacion(antes, a, ahora);
    d.egresados[idx] = nuevo;
    const llamada: Llamada = {
      id: d.llamadas.length + 1,
      egresadoId: nuevo.id,
      matricula: nuevo.matricula,
      nombreEgresado: `${nuevo.nombre} ${nuevo.apellidoPaterno}`,
      agente: a.agente,
      canal: a.canal,
      resultado: a.resultado,
      notas: a.notas ?? null,
      iveAntes: antes.ive,
      iveDespues: nuevo.ive,
      nivelAntes: antes.nivel,
      nivelDespues: nuevo.nivel,
      fecha: ahora.toISOString(),
    };
    d.llamadas.push(llamada);
    return { egresado: nuevo, llamada };
  }

  const c = await p.connect();
  try {
    await c.query('begin');
    const { rows } = await c.query(`select ${COLS} from egresados where id = $1 for update`, [a.egresadoId]);
    if (!rows[0]) {
      await c.query('rollback');
      return null;
    }
    const antes = aEgresado(rows[0]);
    const n = aplicarActualizacion(antes, a, ahora);
    await c.query(
      `update egresados set telefono=$2, email=$3, municipio=$4, estatus_laboral=$5, sector=$6, empresa=$7, puesto=$8,
         rango_ingreso=$9, interes_posgrado=$10, aportaciones=$11, participaciones=$12, nps=$13, contactado=$14,
         ultima_actualizacion=$15, ultimo_contacto=$16, proximo_contacto=$17, ive=$18, nivel=$19, busqueda=$20, updated_at=now()
       where id=$1`,
      [n.id, n.telefono, n.email, n.municipio, n.estatus, n.sector, n.empresa, n.puesto, n.rangoIngreso, n.interesPosgrado,
        n.aportaciones, n.participaciones, n.nps, n.contactado, n.ultimaActualizacion, n.ultimoContacto, n.proximoContacto,
        n.ive, n.nivel, textoBusqueda(n)],
    );
    const ins = await c.query(
      `insert into llamadas (egresado_id, agente, canal, resultado, notas, ive_antes, ive_despues, nivel_antes, nivel_despues, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [n.id, a.agente, a.canal, a.resultado, a.notas ?? null, antes.ive, n.ive, antes.nivel, n.nivel, ahora],
    );
    await c.query('commit');
    return { egresado: n, llamada: { ...aLlamada(ins.rows[0]), matricula: n.matricula, nombreEgresado: `${n.nombre} ${n.apellidoPaterno}` } };
  } catch (err) {
    await c.query('rollback');
    throw err;
  } finally {
    c.release();
  }
}

// ─── Actividad en vivo del Call Center ─────────────────────────────────────

export interface Actividad {
  llamadas: Llamada[];
  hoy: { total: number; efectivas: number; actualizados: number; whatsapp: number; porAgente: { agente: string; total: number; actualizados: number }[] };
}

const EFECTIVOS = new Set<string>(RESULTADOS.filter((r) => r.efectivo).map((r) => r.id));

function resumirHoy(ls: Pick<Llamada, 'agente' | 'resultado'>[]): Actividad['hoy'] {
  const ag = new Map<string, { agente: string; total: number; actualizados: number }>();
  let efectivas = 0, actualizados = 0, whatsapp = 0;
  for (const l of ls) {
    const a = ag.get(l.agente) ?? { agente: l.agente, total: 0, actualizados: 0 };
    a.total++;
    if (l.resultado === 'actualizado') { a.actualizados++; actualizados++; }
    if (EFECTIVOS.has(l.resultado)) efectivas++;
    if (l.resultado === 'whatsapp') whatsapp++;
    ag.set(l.agente, a);
  }
  return { total: ls.length, efectivas, actualizados, whatsapp, porAgente: [...ag.values()].sort((a, b) => b.total - a.total) };
}

export async function actividad(): Promise<Actividad> {
  const p = pool();
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  if (!p) {
    const ls = demo().llamadas;
    const hoy = ls.filter((l) => Date.parse(l.fecha) >= inicio.getTime());
    return { llamadas: ls.slice(-30).reverse(), hoy: resumirHoy(hoy) };
  }
  const [ult, hoy] = await Promise.all([
    p.query(
      `select l.*, e.matricula, e.nombre || ' ' || e.apellido_paterno as nombre_egresado
         from llamadas l join egresados e on e.id = l.egresado_id order by l.created_at desc limit 30`,
    ),
    p.query(`select agente, resultado from llamadas where created_at >= $1`, [inicio]),
  ]);
  return { llamadas: ult.rows.map(aLlamada), hoy: resumirHoy(hoy.rows as Llamada[]) };
}

// ─── Dataset columnar del tablero ──────────────────────────────────────────

export async function datasetTablero(): Promise<DatasetTablero> {
  const p = pool();
  const egresados = p ? (await p.query(`select ${COLS} from egresados order by id`)).rows.map(aEgresado) : demo().egresados;
  const ahora = Date.now();

  const dict = {
    carrera: CARRERAS.map((c) => c.clave) as string[],
    sector: [...SECTORES, 'Sin dato'] as string[],
    ingreso: [...RANGOS_INGRESO, 'Sin dato'] as string[],
    municipio: [] as string[],
    estado: [] as string[],
    estatus: [...ESTATUS_LABORAL] as string[],
    nivel: [...NIVELES] as string[],
  };
  const idx = (arr: string[], v: string) => {
    let i = arr.indexOf(v);
    if (i < 0) i = arr.push(v) - 1;
    return i;
  };
  const col: DatasetTablero['col'] = {
    matricula: [], nombre: [], gen: [], car: [], sec: [], ing: [], mun: [], edo: [], lab: [],
    lat: [], lng: [], geo: [], act: [], con: [], par: [], pos: [], apo: [], nps: [],
  };
  for (const e of egresados) {
    col.matricula.push(e.matricula);
    col.nombre.push(`${e.nombre} ${e.apellidoPaterno} ${e.apellidoMaterno}`.trim());
    col.gen.push(e.generacion);
    col.car.push(idx(dict.carrera, e.carrera));
    col.sec.push(idx(dict.sector, e.sector ?? 'Sin dato'));
    col.ing.push(idx(dict.ingreso, e.rangoIngreso ?? 'Sin dato'));
    col.mun.push(idx(dict.municipio, e.municipio));
    col.edo.push(idx(dict.estado, e.estado));
    col.lab.push(idx(dict.estatus, e.estatus));
    col.lat.push(e.lat);
    col.lng.push(e.lng);
    col.geo.push(e.geoOrigen === 'campo' ? 1 : e.geoOrigen === 'domicilio' ? 2 : 0);
    col.act.push(e.ultimaActualizacion ? Math.floor((ahora - Date.parse(e.ultimaActualizacion)) / DIA) : -1);
    col.con.push(e.contactado ? 1 : 0);
    col.par.push(e.participaciones);
    col.pos.push(e.interesPosgrado ? 1 : 0);
    col.apo.push(e.aportaciones.length);
    col.nps.push(e.nps ?? -1);
  }
  return { generado: new Date().toISOString(), modo: p ? 'neon' : 'demo', total: egresados.length, dict, col };
}
