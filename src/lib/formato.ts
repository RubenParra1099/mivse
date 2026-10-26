const nf = new Intl.NumberFormat('es-MX');
export const fmtN = (n: number) => nf.format(n);
export const fmtP = (n: number, d = 1) => `${n.toFixed(d)}%`;

export function haceCuanto(isoFecha: string | null | undefined): string {
  if (!isoFecha) return 'nunca';
  const s = (Date.now() - Date.parse(isoFecha)) / 1000;
  if (s < 0) {
    const d = Math.ceil(-s / 86400);
    return d <= 1 ? 'mañana' : `en ${d} días`;
  }
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d < 31) return `hace ${d} día${d === 1 ? '' : 's'}`;
  const m = Math.floor(d / 30.4);
  if (m < 12) return `hace ${m} mes${m === 1 ? '' : 'es'}`;
  const a = Math.floor(d / 365);
  return `hace ${a} año${a === 1 ? '' : 's'}`;
}

export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const iniciales = (nombre: string) =>
  nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export const telFormato = (t: string) => (t.length === 10 ? `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}` : t);
