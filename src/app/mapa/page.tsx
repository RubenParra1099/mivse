import { Suspense } from 'react';
import { MapaCompleto } from '@/components/mapa/MapaCompleto';

export const metadata = { title: 'Mapa · MIVSE' };

export default function Page() {
  return (
    <Suspense>
      <MapaCompleto />
    </Suspense>
  );
}
