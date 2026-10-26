import { NextResponse } from 'next/server';
import { APORTACIONES, CARRERAS, ESTATUS_LABORAL, MUNICIPIOS, RANGOS_INGRESO, SECTORES } from '@/lib/catalogos';
import { capturasRecientes, porMatricula, registrarCaptura } from '@/lib/repo';
import type { CapturaCampo } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

const enLista = (xs: readonly string[], v: unknown) => typeof v === 'string' && xs.includes(v);
const texto = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const coord = (v: unknown, lim: number) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim ? v : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validar(b: Record<string, unknown>): CapturaCampo | string {
  if (typeof b.uuid !== 'string' || !UUID.test(b.uuid)) return 'uuid inválido';
  const matricula = texto(b.matricula, 20).toUpperCase();
  if (!/^[A-Z0-9-]{4,20}$/.test(matricula)) return 'matrícula inválida';
  const nombre = texto(b.nombre, 80), apellidoPaterno = texto(b.apellidoPaterno, 80);
  if (!nombre || !apellidoPaterno) return 'nombre y apellido paterno requeridos';
  if (!enLista(CARRERAS.map((c) => c.clave), b.carrera)) return 'carrera inválida';
  const generacion = Number(b.generacion);
  if (!Number.isInteger(generacion) || generacion < 1970 || generacion > new Date().getFullYear()) return 'generación inválida';
  if (!enLista(MUNICIPIOS.map((m) => m.nombre), b.municipio)) return 'municipio inválido';
  if (!enLista(ESTATUS_LABORAL, b.estatus)) return 'estatus laboral inválido';
  const encuestador = texto(b.encuestador, 60);
  if (!encuestador) return 'encuestador requerido';
  const capturadoEn = typeof b.capturadoEn === 'string' && !Number.isNaN(Date.parse(b.capturadoEn)) ? new Date(b.capturadoEn).toISOString() : new Date().toISOString();
  const lat = coord(b.lat, 90), lng = coord(b.lng, 180);
  const conGeo = lat != null && lng != null;
  return {
    uuid: b.uuid.toLowerCase(),
    encuestador,
    capturadoEn,
    matricula,
    nombre,
    apellidoPaterno,
    apellidoMaterno: texto(b.apellidoMaterno, 80),
    genero: b.genero === 'M' ? 'M' : 'F',
    carrera: b.carrera as string,
    generacion,
    telefono: texto(b.telefono, 20).replace(/[^\d]/g, ''),
    email: texto(b.email, 120),
    domicilio: texto(b.domicilio, 160),
    colonia: texto(b.colonia, 100),
    entreCalles: texto(b.entreCalles, 200),
    municipio: b.municipio as string,
    lat: conGeo ? lat : null,
    lng: conGeo ? lng : null,
    precision: conGeo && typeof b.precision === 'number' && b.precision >= 0 ? Math.round(b.precision) : null,
    origenUbicacion: conGeo && enLista(['gps', 'mapa', 'busqueda'], b.origenUbicacion) ? (b.origenUbicacion as CapturaCampo['origenUbicacion']) : null,
    estatus: b.estatus as CapturaCampo['estatus'],
    sector: enLista(SECTORES, b.sector) ? (b.sector as string) : null,
    empresa: texto(b.empresa) || null,
    puesto: texto(b.puesto) || null,
    rangoIngreso: enLista(RANGOS_INGRESO, b.rangoIngreso) ? (b.rangoIngreso as string) : null,
    interesPosgrado: b.interesPosgrado === true,
    aportaciones: Array.isArray(b.aportaciones) ? [...new Set(b.aportaciones.filter((x) => enLista(APORTACIONES, x)) as string[])] : [],
    participaciones: Math.max(0, Math.min(20, Math.round(Number(b.participaciones) || 0))),
    nps: b.nps == null || b.nps === '' ? null : Math.max(0, Math.min(10, Math.round(Number(b.nps)))),
    notas: texto(b.notas, 500),
  };
}

export async function GET(req: Request) {
  const m = new URL(req.url).searchParams.get('matricula');
  if (m) {
    const e = await porMatricula(m.trim().toUpperCase());
    return e ? NextResponse.json(e) : NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }
  return NextResponse.json(await capturasRecientes());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  const c = validar(body);
  if (typeof c === 'string') return NextResponse.json({ error: c }, { status: 422 });
  return NextResponse.json(await registrarCaptura(c));
}
