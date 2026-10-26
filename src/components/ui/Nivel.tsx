import { NIVEL_INFO, type Nivel } from '@/lib/catalogos';

export function NivelBadge({ nivel, corto }: { nivel: Nivel; corto?: boolean }) {
  const i = NIVEL_INFO[nivel];
  return (
    <span className="badge" style={{ '--c': i.color } as React.CSSProperties}>
      {corto ? nivel[0].toUpperCase() + nivel.slice(1) : i.etiqueta}
    </span>
  );
}

/** Medidor radial del IVE con marcas en los umbrales de nivel. */
export function MedidorIVE({ valor, tam = 120, grosor = 10, etiqueta = 'IVE' }: { valor: number; tam?: number; grosor?: number; etiqueta?: string }) {
  const r = (tam - grosor) / 2;
  const c = tam / 2;
  const arco = 0.75; // 270°
  const L = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, valor));
  const color = v >= 76 ? NIVEL_INFO.embajador.color : v >= 58 ? NIVEL_INFO.activo.color : v >= 30 ? NIVEL_INFO.ocasional.color : NIVEL_INFO.desconectado.color;
  const id = `g${Math.round(v * 10)}${tam}`;
  return (
    <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} role="img" aria-label={`${etiqueta} ${v.toFixed(1)}`}>
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="1" y2="0">
          <stop offset="0" stopColor={color} stopOpacity=".55" />
          <stop offset="1" stopColor={color} />
        </linearGradient>
      </defs>
      <g transform={`rotate(135 ${c} ${c})`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--panel-3)" strokeWidth={grosor} strokeDasharray={`${L * arco} ${L}`} strokeLinecap="round" />
        <circle cx={c} cy={c} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={grosor} strokeDasharray={`${(L * arco * v) / 100} ${L}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray .6s ease' }} />
      </g>
      <text x={c} y={c + tam * 0.04} textAnchor="middle" fontSize={tam * 0.25} fontWeight={800} fill="var(--fg)" className="num">{v.toFixed(1)}</text>
      <text x={c} y={c + tam * 0.2} textAnchor="middle" fontSize={tam * 0.095} fontWeight={700} fill="var(--muted)" letterSpacing=".08em">{etiqueta}</text>
    </svg>
  );
}
