import { NextResponse } from 'next/server';
import { buscar } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const t0 = performance.now();
  const resultados = await buscar(q);
  return NextResponse.json({ resultados, ms: Math.round(performance.now() - t0) });
}
