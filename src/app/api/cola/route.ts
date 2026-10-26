import { NextResponse } from 'next/server';
import { colaLlamadas } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ cola: await colaLlamadas() });
}
