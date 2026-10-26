const P: Record<string, string> = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  headset: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2zm16 0a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2zm-3 4c0 2-2 3-5 3',
  tablero: 'M4 13h6V4H4zm10 7h6v-9h-6zM4 20h6v-4H4zm10-11h6V4h-6z',
  buscar: 'm21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z',
  tel: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  wa: 'M3 21l1.7-5A9 9 0 1 1 8 19.3zM9 8.5c0 3.5 3 6.5 6.5 6.5l1.2-1.6-2-1-1 .9A5 5 0 0 1 11 10.6l.9-1-1-2z',
  mail: 'M4 6h16v12H4zm0 0 8 7 8-7',
  sol: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-15v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  luna: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  descarga: 'M12 3v12m0 0-5-5m5 5 5-5M4 21h16',
  pdf: 'M6 3h9l5 5v13H6zM14 3v6h6M9 14h6M9 17h4',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M4 12.5 9 17.5 20 6.5',
  reloj: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  mapa: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zm0 0v14m6-12v14',
  capas: 'm12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5',
  filtro: 'M3 5h18l-7 8v6l-4 2v-8z',
  rayo: 'M13 2 4 14h7l-1 8 9-12h-7z',
  usuario: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
  pin: 'M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  maletin: 'M4 8h16v12H4zm5 0V5h6v3M4 13h16',
  estrella: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  cola: 'M4 6h16M4 12h16M4 18h10',
  flecha: 'M5 12h14m-6-6 6 6-6 6',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5',
  gps: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-6v3m0 14v3M2 12h3m14 0h3',
  calendario: 'M4 6h16v15H4zm0 4h16M8 3v4m8-4v4',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-6v-5m0-3v.01',
  sliders: 'M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0M14 4v4M8 10v4m8 2v4',
};

export function Icono({ n, s = 18, w = 1.8, className }: { n: keyof typeof P | string; s?: number; w?: number; className?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={P[n] ?? ''} />
    </svg>
  );
}
