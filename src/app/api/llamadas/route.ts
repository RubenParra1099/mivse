import { NextResponse } from 'next/server';
import { APORTACIONES, ESTATUS_LABORAL, RANGOS_INGRESO, RESULTADOS, SECTORES } from '@/lib/catalogos';
import { registrarLlamada } from '@/lib/repo';
import type { ActualizacionLlamada } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

const enLista = (xs: readonly string[], v: unknown) => typeof v === 'string' && xs.includes(v);
const texto = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

function validar(b: Record<string, unknown>): ActualizacionLlamada | string {
  if (!Number.isInteger(b.egresadoId)) return 'egresadoId inválido';
  if (!enLista(RESULTADOS.map((r) => r.id), b.resultado)) return 'resultado inválido';
  const agente = texto(b.agente, 60);
  if (!agente) return 'agente requerido';
  const a: ActualizacionLlamada = {
    egresadoId: b.egresadoId as number,
    agente,
    canal: b.canal === 'whatsapp' ? 'whatsapp' : 'llamada',
    resultado: b.resultado as ActualizacionLlamada['resultado'],
    notas: texto(b.notas, 500),
    proximoContacto: typeof b.proximoContacto === 'string' && !Number.isNaN(Date.parse(b.proximoContacto)) ? b.proximoContacto : null,
  };
  const d = (b.datos ?? {}) as Record<string, unknown>;
  if (a.resultado === 'actualizado') {
    if (!enLista(ESTATUS_LABORAL, d.estatus)) return 'estatus laboral inválido';
    a.datos = {
      estatus: d.estatus as never,
      telefono: texto(d.telefono, 20),
      email: texto(d.email, 120),
      municipio: texto(d.municipio, 80),
      sector: enLista(SECTORES, d.sector) ? (d.sector as string) : null,
      empresa: texto(d.empresa) || null,
      puesto: texto(d.puesto) || null,
      rangoIngreso: enLista(RANGOS_INGRESO, d.rangoIngreso) ? (d.rangoIngreso as string) : null,
      interesPosgrado: d.interesPosgrado === true,
      aportaciones: Array.isArray(d.aportaciones) ? d.aportaciones.filter((x) => enLista(APORTACIONES, x)) : [],
      participaciones: Math.max(0, Math.min(20, Number(d.participaciones) || 0)),
      nps: d.nps == null ? null : Math.max(0, Math.min(10, Math.round(Number(d.nps)))),
    };
    for (const k of ['telefono', 'email', 'municipio'] as const) if (!a.datos[k]) delete a.datos[k];
  }
  return a;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  const a = validar(body);
  if (typeof a === 'string') return NextResponse.json({ error: a }, { status: 422 });
  const r = await registrarLlamada(a);
  if (!r) return NextResponse.json({ error: 'Egresado no encontrado' }, { status: 404 });
  return NextResponse.json(r);
}
