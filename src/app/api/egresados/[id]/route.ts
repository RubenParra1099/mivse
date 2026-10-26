import { NextResponse } from 'next/server';
import { expediente } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exp = await expediente(Number(id));
  if (!exp) return NextResponse.json({ error: 'Egresado no encontrado' }, { status: 404 });
  return NextResponse.json(exp);
}
