'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AGENTES, NIVEL_INFO, RESULTADOS, nombreCarrera } from '@/lib/catalogos';
import { fmtN, haceCuanto, iniciales } from '@/lib/formato';
import type { ActualizacionLlamada, EgresadoResumen, ExpedienteCompleto, Llamada } from '@/lib/tipos';
import { Icono } from '../ui/Icono';
import { Expediente } from './Expediente';
import { FlujoLlamada } from './FlujoLlamada';

interface Actividad {
  llamadas: Llamada[];
  hoy: { total: number; efectivas: number; actualizados: number; whatsapp: number; porAgente: { agente: string; total: number; actualizados: number }[] };
}

export function CallCenter() {
  const [agente, setAgente] = useState(AGENTES[0]);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<EgresadoResumen[] | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [cola, setCola] = useState<EgresadoResumen[]>([]);
  const [tab, setTab] = useState<'cola' | 'busqueda'>('cola');
  const [sel, setSel] = useState<number | null>(null);
  const [exp, setExp] = useState<ExpedienteCompleto | null>(null);
  const [act, setAct] = useState<Actividad | null>(null);
  const [inicioLlamada, setInicioLlamada] = useState<number | null>(null);
  const [canal, setCanal] = useState<'llamada' | 'whatsapp'>('llamada');
  const [seg, setSeg] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const busca = useRef<HTMLInputElement>(null);
  const autoAbrir = useRef<string | null>(null);

  useEffect(() => {
    try { const a = localStorage.getItem('mivse.agente'); if (a) setAgente(a); } catch {}
    const inicial = new URLSearchParams(window.location.search).get('q');
    if (inicial) { setQ(inicial); autoAbrir.current = inicial; }
  }, []);
  const cambiarAgente = (a: string) => {
    setAgente(a);
    try { localStorage.setItem('mivse.agente', a); } catch {}
  };

  const cargarCola = useCallback(() => fetch('/api/cola').then((r) => r.json()).then((d) => setCola(d.cola)), []);
  const cargarAct = useCallback(() => fetch('/api/actividad').then((r) => r.json()).then(setAct).catch(() => {}), []);

  useEffect(() => {
    cargarCola();
    cargarAct();
    const t = setInterval(cargarAct, 8000);
    return () => clearInterval(t);
  }, [cargarCola, cargarAct]);

  // Atajo: "/" enfoca el buscador
  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      if (ev.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        ev.preventDefault();
        busca.current?.focus();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // Buscador con rebote
  useEffect(() => {
    if (!q.trim()) {
      setResultados(null);
      setTab('cola');
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/buscar?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d) => {
          setResultados(d.resultados);
          setMs(d.ms);
          setTab('busqueda');
          if (autoAbrir.current && d.resultados[0]?.matricula === autoAbrir.current) abrirRef.current(d.resultados[0].id);
          autoAbrir.current = null;
        })
        .catch(() => {});
    }, 140);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const abrir = useCallback((id: number) => {
    setSel(id);
    setInicioLlamada(null);
    setCanal('llamada');
    fetch(`/api/egresados/${id}`).then((r) => r.json()).then(setExp);
  }, []);

  const abrirRef = useRef(abrir);
  abrirRef.current = abrir;

  // Cronómetro de la llamada
  useEffect(() => {
    if (!inicioLlamada) return;
    const t = setInterval(() => setSeg(Math.floor((Date.now() - inicioLlamada) / 1000)), 1000);
    return () => clearInterval(t);
  }, [inicioLlamada]);

  const lista = tab === 'busqueda' && resultados ? resultados : cola;
  const siguiente = () => {
    const i = cola.findIndex((c) => c.id === sel);
    const n = cola[i + 1] ?? cola[0];
    if (n) abrir(n.id);
  };

  const guardar = async (a: Omit<ActualizacionLlamada, 'agente' | 'egresadoId'>) => {
    if (!exp) return;
    setGuardando(true);
    try {
      const r = await fetch('/api/llamadas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...a, agente, egresadoId: exp.egresado.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const antes = exp.egresado.nivel;
      setExp({ egresado: d.egresado, llamadas: [d.llamada, ...exp.llamadas] });
      const etiqueta = RESULTADOS.find((x) => x.id === a.resultado)?.etiqueta;
      setToast(
        d.egresado.nivel !== antes
          ? `${etiqueta} · Nivel: ${NIVEL_INFO[antes].etiqueta} → ${NIVEL_INFO[d.egresado.nivel as keyof typeof NIVEL_INFO].etiqueta}`
          : `${etiqueta} · IVE ${d.egresado.ive.toFixed(1)}`,
      );
      setTimeout(() => setToast(null), 3200);
      setInicioLlamada(null);
      setCola((c) => c.filter((x) => x.id !== exp.egresado.id || a.resultado === 'no_contesto' || a.resultado === 'buzon'));
      setResultados((rs) => rs?.map((x) => (x.id === d.egresado.id ? { ...x, nivel: d.egresado.nivel, ive: d.egresado.ive, ultimoContacto: d.egresado.ultimoContacto, ultimaActualizacion: d.egresado.ultimaActualizacion } : x)) ?? null);
      cargarAct();
    } catch (err) {
      setToast(`No se pudo guardar: ${(err as Error).message}`);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setGuardando(false);
    }
  };

  const h = act?.hoy;
  return (
    <div style={{ height: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr', minHeight: 640 }}>
      {/* Barra superior */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'color-mix(in srgb, var(--panel) 70%, transparent)', backdropFilter: 'blur(10px)' }}>
        <div>
          <div className="eyebrow">Módulo 2</div>
          <h1 className="titulo">Call Center <span className="grad-text">MIVSE</span></h1>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
          <Stat etiqueta="Llamadas hoy" valor={h?.total} />
          <Stat etiqueta="Efectivas" valor={h?.efectivas} color="var(--accent-2)" />
          <Stat etiqueta="Actualizados" valor={h?.actualizados} color="var(--ok)" />
          <Stat etiqueta="WhatsApp" valor={h?.whatsapp} color="#16a34a" />
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {act?.llamadas[0] && <Ticker l={act.llamadas[0]} />}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600 }} className="muted">
          <Icono n="usuario" s={16} />
          <select className="select" style={{ height: 34, width: 170 }} value={agente} onChange={(e) => cambiarAgente(e.target.value)} aria-label="Agente">
            {AGENTES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '350px minmax(0,1fr) 410px', gap: 14, padding: 14, minHeight: 0 }}>
        {/* Columna izquierda: buscador + cola (deck view) */}
        <aside className="panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--line)' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: 10 }} className="muted"><Icono n="buscar" s={17} /></span>
              <input ref={busca} className="input" style={{ paddingLeft: 36, paddingRight: 36, height: 40 }} placeholder="Matrícula, nombre, carrera o estatus" value={q} onChange={(e) => setQ(e.target.value)} />
              {q ? (
                <button onClick={() => setQ('')} className="btn ghost sm" style={{ position: 'absolute', right: 4, top: 5, height: 30, width: 30, padding: 0 }} aria-label="Limpiar"><Icono n="x" s={15} /></button>
              ) : (
                <kbd style={{ position: 'absolute', right: 10, top: 10, fontSize: 11, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--line-2)', color: 'var(--muted)' }}>/</kbd>
              )}
            </div>
            <div className="seg" style={{ display: 'flex', marginTop: 10 }}>
              <button className={tab === 'cola' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setTab('cola')}>Cola de llamadas <span className="muted num">{cola.length}</span></button>
              <button className={tab === 'busqueda' ? 'on' : ''} style={{ flex: 1 }} onClick={() => resultados && setTab('busqueda')} disabled={!resultados}>Resultados <span className="muted num">{resultados?.length ?? ''}</span></button>
            </div>
            {tab === 'busqueda' && ms != null && (
              <div className="muted" style={{ fontSize: 11.5, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icono n="rayo" s={13} /> {resultados?.length === 40 ? '40+ coincidencias' : `${resultados?.length} coincidencias`} en <b className="num" style={{ color: 'var(--ok)' }}>{ms} ms</b>
              </div>
            )}
            {tab === 'cola' && <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Reagendados primero, después egresados con datos de más de 12 meses.</div>}
          </div>
          <div className="scroll" style={{ flex: 1, padding: 8, display: 'grid', gap: 6, alignContent: 'start' }}>
            {lista.length === 0 && <div className="vacio">{tab === 'busqueda' ? 'Sin coincidencias' : 'Cargando cola…'}</div>}
            {lista.map((r) => <Tarjeta key={r.id} r={r} on={r.id === sel} onClick={() => abrir(r.id)} />)}
          </div>
        </aside>

        {/* Centro: expediente único */}
        <section className="scroll" style={{ minHeight: 0, paddingRight: 2 }}>
          {exp && exp.egresado.id === sel ? (
            <Expediente
              exp={exp}
              onLlamar={() => { setCanal('llamada'); setInicioLlamada(Date.now()); setSeg(0); }}
              onWhatsApp={() => setCanal('whatsapp')}
            />
          ) : sel ? (
            <div className="panel vacio">Cargando expediente…</div>
          ) : (
            <Bienvenida act={act} />
          )}
        </section>

        {/* Derecha: flujo guiado */}
        <aside className="panel" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {exp && exp.egresado.id === sel ? (
            <>
              <div style={{ flex: 1, minHeight: 0 }}>
                <FlujoLlamada egresado={exp.egresado} segundos={inicioLlamada ? seg : null} canalInicial={canal} guardando={guardando} onGuardar={guardar} />
              </div>
            </>
          ) : (
            <div className="vacio" style={{ margin: 'auto' }}>
              <Icono n="headset" s={36} w={1.4} />
              <p>Selecciona un egresado de la cola o búscalo para iniciar el flujo de llamada.</p>
            </div>
          )}
        </aside>
      </div>

      {exp && (
        <button className="btn no-print" onClick={siguiente} style={{ position: 'fixed', right: 444, bottom: 26, boxShadow: 'var(--shadow)', zIndex: 20 }}>
          Siguiente en cola <Icono n="flecha" s={15} />
        </button>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Stat({ etiqueta, valor, color }: { etiqueta: string; valor?: number; color?: string }) {
  return (
    <div style={{ padding: '6px 12px', borderRadius: 11, background: 'var(--panel)', border: '1px solid var(--line)', minWidth: 92 }}>
      <div className="num" style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.1, color: color ?? 'var(--fg)' }}>{valor == null ? '—' : fmtN(valor)}</div>
      <div className="muted" style={{ fontSize: 10.5, fontWeight: 600 }}>{etiqueta}</div>
    </div>
  );
}

function Ticker({ l }: { l: Llamada }) {
  const r = RESULTADOS.find((x) => x.id === l.resultado);
  return (
    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, animation: 'sube .4s ease', whiteSpace: 'nowrap' }}>
      <span className="vivo">EN VIVO</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <b>{l.agente}</b> <span className="muted">registró</span> <b>{r?.etiqueta}</b> <span className="muted">con</span> {l.nombreEgresado}
        <span className="muted"> · {haceCuanto(l.fecha)}</span>
      </span>
    </div>
  );
}

function Tarjeta({ r, on, onClick }: { r: EgresadoResumen; on: boolean; onClick: () => void }) {
  const c = NIVEL_INFO[r.nivel].color;
  const nota = r.proximoContacto
    ? { t: `Reagendado · ${haceCuanto(r.proximoContacto)}`, c: 'var(--warn)' }
    : !r.ultimaActualizacion
      ? { t: 'Nunca actualizado', c: 'var(--bad)' }
      : { t: `Actualizado ${haceCuanto(r.ultimaActualizacion)}`, c: Date.now() - Date.parse(r.ultimaActualizacion) > 365 * 864e5 ? 'var(--bad)' : 'var(--muted)' };
  return (
    <button
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '38px 1fr auto', gap: 10, alignItems: 'center', padding: '9px 10px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
        border: `1px solid ${on ? 'var(--accent)' : 'transparent'}`, background: on ? 'var(--accent-soft)' : 'var(--panel-2)', transition: '.12s',
      }}
    >
      <span style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, color: '#fff', background: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 55%, #000))` }}>
        {iniciales(r.nombreCompleto)}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 650, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombreCompleto}</span>
        <span className="muted" style={{ display: 'block', fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span className="num">{r.matricula}</span> · {nombreCarrera(r.carrera)}
        </span>
        <span style={{ display: 'block', fontSize: 11, color: nota.c, fontWeight: 600 }}>{nota.t}</span>
      </span>
      <span style={{ textAlign: 'right' }}>
        <span className="num" style={{ display: 'block', fontWeight: 800, color: c }}>{r.ive.toFixed(0)}</span>
        <span className="muted" style={{ fontSize: 10, fontWeight: 700 }}>IVE</span>
      </span>
    </button>
  );
}

function Bienvenida({ act }: { act: Actividad | null }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section className="panel" style={{ padding: 22, position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(500px 200px at 100% 0%, var(--accent-soft), transparent)' }} />
        <div className="eyebrow">Centro operativo</div>
        <h2 style={{ margin: '4px 0 6px', fontSize: 22, letterSpacing: '-0.02em' }}>Actualiza el censo llamada por llamada</h2>
        <p className="muted" style={{ margin: 0, maxWidth: 560 }}>
          Busca a cualquier egresado por matrícula, nombre, carrera o estatus (tecla <kbd>/</kbd>), abre su expediente único, llama con un clic o envía un WhatsApp institucional,
          y registra el resultado. El nivel de vinculación se recalcula en el momento.
        </p>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <section className="panel">
          <div className="panel-h"><h3>Actividad en vivo</h3><span className="vivo">Actualiza cada 8 s</span></div>
          <div className="panel-b scroll" style={{ maxHeight: 460 }}>
            {!act && <div className="vacio">Cargando…</div>}
            {act?.llamadas.map((l) => {
              const r = RESULTADOS.find((x) => x.id === l.resultado);
              return (
                <div key={l.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
                  <span className="dot" style={{ '--c': r?.tono === 'ok' ? 'var(--ok)' : r?.tono === 'mal' ? 'var(--bad)' : r?.tono === 'aviso' ? 'var(--warn)' : 'var(--muted)', marginTop: 5 } as React.CSSProperties} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{l.nombreEgresado}</b> <span className="muted num">· {l.matricula}</span>
                    <div className="muted" style={{ fontSize: 11.5 }}>{r?.etiqueta} · {l.agente}</div>
                  </div>
                  {l.nivelDespues && <span className="badge" style={{ '--c': NIVEL_INFO[l.nivelDespues].color, alignSelf: 'center' } as React.CSSProperties}>{NIVEL_INFO[l.nivelDespues].etiqueta}</span>}
                  <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap', alignSelf: 'center' }}>{haceCuanto(l.fecha)}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <div className="panel-h"><h3>Productividad del equipo · hoy</h3></div>
          <div className="panel-b" style={{ display: 'grid', gap: 10 }}>
            {act?.hoy.porAgente.map((a) => {
              const max = act.hoy.porAgente[0]?.total || 1;
              return (
                <div key={a.agente}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span style={{ fontWeight: 600 }}>{a.agente}</span>
                    <span className="num muted"><b style={{ color: 'var(--fg)' }}>{a.total}</b> llamadas · <b style={{ color: 'var(--ok)' }}>{a.actualizados}</b> act.</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 9, background: 'var(--panel-3)', marginTop: 5, display: 'flex', overflow: 'hidden' }}>
                    <div style={{ width: `${(a.actualizados / max) * 100}%`, background: 'var(--ok)' }} />
                    <div style={{ width: `${((a.total - a.actualizados) / max) * 100}%`, background: 'var(--accent)', opacity: .55 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
