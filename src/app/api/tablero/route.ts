import { NextResponse } from 'next/server';
import { datasetTablero } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await datasetTablero(), { headers: { 'cache-control': 'no-store' } });
}
