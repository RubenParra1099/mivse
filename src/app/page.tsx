import Link from 'next/link';
import { NIVELES, NIVEL_INFO } from '@/lib/catalogos';
import { METAS, PESOS_BASE, SEMAFORO_COLOR, semaforo } from '@/lib/ive';
import { calcularTodo, indicadores } from '@/lib/tablero-calculo';
import { datasetTablero } from '@/lib/repo';
import { fmtN } from '@/lib/formato';
import { Icono } from '@/components/ui/Icono';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const d = await datasetTablero();
  const calc = calcularTodo(d, PESOS_BASE);
  const k = indicadores(d, calc, Array.from({ length: d.total }, (_, i) => i));

  return (
    <div style={{ padding: '36px 40px', maxWidth: 1240, margin: '0 auto', display: 'grid', gap: 26 }}>
      <header style={{ display: 'grid', gap: 10 }}>
        <span className="eyebrow">Modelo Integral de Vinculación y Seguimiento de Egresados</span>
        <h1 style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.035em', margin: 0, fontWeight: 800, maxWidth: 820 }}>
          Cada egresado, <span className="grad-text">localizado, contactado y vinculado.</span>
        </h1>
        <p className="muted" style={{ fontSize: 15.5, maxWidth: 700, margin: 0 }}>
          App de Campo con geolocalización, plataforma web de Call Center y Tablero de Control analítico sobre el censo de {fmtN(d.total)} egresados,
          con el cálculo automatizado del Índice de Vinculación del Egresado (IVE).
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center' }}>
          {d.modo === 'neon'
            ? <span className="badge" style={{ '--c': 'var(--ok)' } as React.CSSProperties}>Conectado a Postgres · Neon</span>
            : <span className="badge" style={{ '--c': 'var(--warn)' } as React.CSSProperties}>Modo demo · datos simulados en memoria</span>}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <Modulo href="/captura" n="1" icono="gps" titulo="App de Campo"
          puntos={['Captura con GPS del dispositivo y pin ajustable sobre la red vial', 'Calle y entre calles detectadas automáticamente', 'Funciona sin señal: guarda en el teléfono y sincroniza sola', 'Instalable en Android e iOS desde el navegador']} />
        <Modulo href="/callcenter" n="2" icono="headset" titulo="Plataforma Web de Call Center"
          puntos={['Buscador indexado por matrícula, nombre, carrera o estatus', 'Expediente único optimizado para escritorio', 'Llamada con un clic y WhatsApp con mensaje institucional', 'Flujo guiado que recalcula el nivel de vinculación al instante']} />
        <Modulo href="/tablero" n="3" icono="tablero" titulo="Tablero de Control y Analítica"
          puntos={['Motor del IVE con fórmula ponderada en tiempo real', 'Semáforos de metas: cobertura, actualización, participación, retención y NPS', 'Mapas de calor geoespaciales con coordenadas de campo', 'Filtros cruzados y exportación a PDF y CSV']} />
      </div>

      <section className="panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Estado del censo</h3>
          <Link href="/tablero" className="btn sm">Ver tablero completo <Icono n="flecha" s={14} /></Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <Dato etiqueta="IVE promedio" valor={k.ive.toFixed(1)} color="var(--accent)" />
          {METAS.map((m) => {
            const v = k.valores[m.id];
            return <Dato key={m.id} etiqueta={`${m.etiqueta} · meta ${m.id === 'nps' ? '>' : ''}${m.meta}${m.unidad === '%' ? '%' : ''}`} valor={m.id === 'nps' ? v.toFixed(0) : `${v.toFixed(1)}%`} color={SEMAFORO_COLOR[semaforo(m.id, v)]} />;
          })}
        </div>
        <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', marginTop: 18 }}>
          {k.niveles.map((n, i) => <div key={i} style={{ width: `${(n / k.n) * 100}%`, background: NIVEL_INFO[NIVELES[i]].color }} />)}
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 8, fontSize: 12 }}>
          {k.niveles.map((n, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="dot" style={{ '--c': NIVEL_INFO[NIVELES[i]].color } as React.CSSProperties} />
              {NIVEL_INFO[NIVELES[i]].etiqueta} <b className="num">{fmtN(n)}</b>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function Modulo({ href, n, icono, titulo, puntos }: { href: string; n: string; icono: string; titulo: string; puntos: string[] }) {
  return (
    <Link href={href} className="panel" style={{ padding: 24, display: 'grid', gap: 14, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: '#fff' }}><Icono n={icono} s={22} /></span>
        <div>
          <div className="eyebrow">Módulo {n}</div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.015em' }}>{titulo}</div>
        </div>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 7 }}>
        {puntos.map((p) => (
          <li key={p} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--fg-2)' }}><span style={{ color: 'var(--accent)' }}><Icono n="check" s={16} w={2.2} /></span>{p}</li>
        ))}
      </ul>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontWeight: 700, fontSize: 13 }}>Entrar <Icono n="flecha" s={15} /></span>
    </Link>
  );
}

function Dato({ etiqueta, valor, color }: { etiqueta: string; valor: string; color: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
      <div className="num" style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: '-0.02em' }}>{valor}</div>
      <div className="muted" style={{ fontSize: 11.5, fontWeight: 600 }}>{etiqueta}</div>
    </div>
  );
}
