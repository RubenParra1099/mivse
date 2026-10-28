'use client';
import { useEffect, useMemo, useState } from 'react';
import { APORTACIONES, ESTATUS_INFO, ESTATUS_LABORAL, MUNICIPIOS, NIVEL_INFO, RANGOS_INGRESO, RESULTADOS, SECTORES, type EstatusLaboral, type ResultadoId } from '@/lib/catalogos';
import { calcularIVE, nivelDe } from '@/lib/ive';
import type { ActualizacionLlamada, Egresado } from '@/lib/tipos';
import { Icono } from '../ui/Icono';
import { NivelBadge } from '../ui/Nivel';

const DIA = 86_400_000;
const ICONO_RES: Record<ResultadoId, string> = {
  actualizado: 'check', no_contesto: 'tel', buzon: 'mail', reagendar: 'calendario', whatsapp: 'wa', numero_equivocado: 'x', no_desea: 'x',
};
const TONO: Record<string, string> = { ok: 'var(--ok)', neutro: 'var(--muted)', aviso: 'var(--warn)', info: '#16a34a', mal: 'var(--bad)' };

type Datos = NonNullable<ActualizacionLlamada['datos']> & { estatus: EstatusLaboral; aportaciones: string[]; participaciones: number; interesPosgrado: boolean };

const datosDe = (e: Egresado): Datos => ({
  estatus: e.estatus,
  sector: e.sector,
  empresa: e.empresa ?? '',
  puesto: e.puesto ?? '',
  rangoIngreso: e.rangoIngreso,
  interesPosgrado: e.interesPosgrado,
  aportaciones: [...e.aportaciones],
  participaciones: e.participaciones,
  nps: e.nps,
  telefono: e.telefono,
  email: e.email,
  municipio: e.municipio,
});

export function FlujoLlamada({
  egresado, segundos, canalInicial, onGuardar, guardando,
}: {
  egresado: Egresado;
  segundos: number | null;
  canalInicial: 'llamada' | 'whatsapp';
  guardando: boolean;
  onGuardar: (a: Omit<ActualizacionLlamada, 'agente' | 'egresadoId'>) => void;
}) {
  const [resultado, setResultado] = useState<ResultadoId | null>(null);
  const [d, setD] = useState<Datos>(() => datosDe(egresado));
  const [notas, setNotas] = useState('');
  const [proximo, setProximo] = useState('');

  useEffect(() => {
    setResultado(null);
    setD(datosDe(egresado));
    setNotas('');
    setProximo(new Date(Date.now() + DIA).toISOString().slice(0, 16));
  }, [egresado.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (canalInicial === 'whatsapp' && !resultado) setResultado('whatsapp');
  }, [canalInicial]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Datos>(k: K, v: Datos[K]) => setD((x) => ({ ...x, [k]: v }));
  const empleado = d.estatus === 'empleado' || d.estatus === 'autoempleo';

  // Vista previa en vivo del nuevo IVE
  const previo = useMemo(() => {
    if (resultado !== 'actualizado') return null;
    const ive = calcularIVE({ estatus: d.estatus, diasActualizacion: 0, participaciones: d.participaciones, interesPosgrado: d.interesPosgrado, aportaciones: d.aportaciones.length, nps: d.nps ?? null });
    return { ive, nivel: nivelDe(ive) };
  }, [resultado, d]);

  const guardar = () => {
    if (!resultado) return;
    onGuardar({
      resultado,
      canal: resultado === 'whatsapp' ? 'whatsapp' : canalInicial,
      notas: notas.trim() || undefined,
      proximoContacto: resultado === 'reagendar' && proximo ? new Date(proximo).toISOString() : null,
      datos: resultado === 'actualizado' ? d : undefined,
    });
  };

  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') guardar();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const mm = segundos == null ? null : `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="eyebrow">Flujo guiado</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Resultado del contacto</div>
        </div>
        {mm && (
          <span className="num" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--ok) 14%, transparent)', color: 'var(--ok)', fontWeight: 800, fontSize: 13 }}>
            <Icono n="reloj" s={14} w={2.2} /> {mm}
          </span>
        )}
      </div>

      <div className="scroll" style={{ flex: 1, padding: '14px 18px', display: 'grid', gap: 16, alignContent: 'start' }}>
        {/* Paso 1 — un solo toque */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          {RESULTADOS.map((r) => {
            const on = resultado === r.id;
            const c = TONO[r.tono];
            return (
              <button
                key={r.id}
                onClick={() => setResultado(r.id)}
                style={{
                  gridColumn: r.id === 'actualizado' ? 'span 2' : undefined,
                  display: 'flex', alignItems: 'center', gap: 9, padding: r.id === 'actualizado' ? '12px 12px' : '9px 11px', borderRadius: 11, cursor: 'pointer', textAlign: 'left',
                  border: `1.5px solid ${on ? c : 'var(--line-2)'}`, background: on ? `color-mix(in srgb, ${c} 13%, var(--panel))` : 'var(--panel)',
                  fontWeight: 650, fontSize: r.id === 'actualizado' ? 14 : 12.5, transition: '.12s',
                }}
              >
                <span style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${c} 18%, transparent)`, color: c, flex: 'none' }}>
                  <Icono n={ICONO_RES[r.id]} s={14} w={2.2} />
                </span>
                {r.etiqueta}
              </button>
            );
          })}
        </div>

        {/* Paso 2 — actualización de datos */}
        {resultado === 'actualizado' && (
          <>
            <Bloque titulo="Estatus laboral actual">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ESTATUS_LABORAL.map((s) => (
                  <button key={s} className={`chip ${d.estatus === s ? 'on' : ''}`} onClick={() => set('estatus', s)}>
                    <span className="dot" style={{ '--c': ESTATUS_INFO[s].color } as React.CSSProperties} />
                    {ESTATUS_INFO[s].etiqueta}
                  </button>
                ))}
              </div>
              {empleado && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                  <label className="campo" style={{ gridColumn: 'span 2' }}>Sector
                    <select className="select" value={d.sector ?? ''} onChange={(ev) => set('sector', ev.target.value || null)}>
                      <option value="">Selecciona…</option>
                      {SECTORES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="campo">Empresa<input className="input" value={d.empresa ?? ''} onChange={(ev) => set('empresa', ev.target.value)} /></label>
                  <label className="campo">Puesto<input className="input" value={d.puesto ?? ''} onChange={(ev) => set('puesto', ev.target.value)} /></label>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div className="campo" style={{ marginBottom: 5 }}>Rango de ingreso mensual</div>
                    <div className="seg" style={{ display: 'flex', flexWrap: 'wrap' }}>
                      {RANGOS_INGRESO.map((r) => (
                        <button key={r} className={d.rangoIngreso === r ? 'on' : ''} onClick={() => set('rangoIngreso', r)}>{r.replace('Menos de ', '< ').replace('Más de ', '> ')}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Bloque>

            <Bloque titulo="Vinculación con la institución">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13 }}>¿Interés en posgrado o educación continua?</span>
                <div className="seg">
                  <button className={d.interesPosgrado ? 'on' : ''} onClick={() => set('interesPosgrado', true)}>Sí</button>
                  <button className={!d.interesPosgrado ? 'on' : ''} onClick={() => set('interesPosgrado', false)}>No</button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <span style={{ fontSize: 13 }}>Actividades en las que participó este año</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="btn sm" onClick={() => set('participaciones', Math.max(0, d.participaciones - 1))} aria-label="Menos">−</button>
                  <b className="num" style={{ width: 22, textAlign: 'center', fontSize: 15 }}>{d.participaciones}</b>
                  <button className="btn sm" onClick={() => set('participaciones', Math.min(20, d.participaciones + 1))} aria-label="Más">+</button>
                </div>
              </div>
              <div className="campo" style={{ margin: '12px 0 6px' }}>Aportaciones a la comunidad</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {APORTACIONES.map((a) => {
                  const on = d.aportaciones.includes(a);
                  return (
                    <button key={a} className={`chip ${on ? 'on' : ''}`} onClick={() => set('aportaciones', on ? d.aportaciones.filter((x) => x !== a) : [...d.aportaciones, a])}>
                      {on && <Icono n="check" s={13} w={2.4} />}{a}
                    </button>
                  );
                })}
              </div>
            </Bloque>

            <Bloque titulo="¿Qué tan probable es que nos recomiende? (0–10)">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 4 }}>
                {Array.from({ length: 11 }, (_, n) => {
                  const c = n <= 6 ? 'var(--bad)' : n <= 8 ? 'var(--warn)' : 'var(--ok)';
                  const on = d.nps === n;
                  return (
                    <button key={n} onClick={() => set('nps', on ? null : n)} className="num"
                      style={{ height: 34, borderRadius: 8, cursor: 'pointer', fontWeight: 700, border: `1.5px solid ${on ? c : 'var(--line-2)'}`, background: on ? c : 'var(--panel)', color: on ? '#fff' : 'var(--fg-2)' }}>
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                <span>Detractor</span><span>Pasivo</span><span>Promotor</span>
              </div>
            </Bloque>

            <Bloque titulo="Datos de contacto">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label className="campo">Teléfono<input className="input num" value={d.telefono ?? ''} onChange={(ev) => set('telefono', ev.target.value.replace(/[^\d]/g, '').slice(0, 12))} /></label>
                <label className="campo">Municipio
                  <select className="select" value={d.municipio ?? ''} onChange={(ev) => set('municipio', ev.target.value)}>
                    {MUNICIPIOS.map((m) => <option key={m.nombre}>{m.nombre}</option>)}
                  </select>
                </label>
                <label className="campo" style={{ gridColumn: 'span 2' }}>Correo<input className="input" type="email" value={d.email ?? ''} onChange={(ev) => set('email', ev.target.value)} /></label>
              </div>
            </Bloque>
          </>
        )}

        {resultado === 'reagendar' && (
          <Bloque titulo="Nueva fecha de llamada">
            <input className="input" type="datetime-local" value={proximo} onChange={(ev) => setProximo(ev.target.value)} />
          </Bloque>
        )}

        {resultado && (
          <label className="campo">Notas de la llamada
            <textarea className="input" rows={2} value={notas} onChange={(ev) => setNotas(ev.target.value)} placeholder="Opcional" />
          </label>
        )}

        {!resultado && (
          <div className="muted" style={{ fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Icono n="info" s={16} />
            <span>Elige el resultado con un solo toque. Si el egresado contestó, selecciona <b>Datos actualizados</b> para capturar su situación y recalcular su nivel de vinculación al instante.</span>
          </div>
        )}
      </div>

      {/* Pie: vista previa del IVE y guardado */}
      <div className="flujo-pie" style={{ borderTop: '1px solid var(--line)', padding: '12px 18px 16px', background: 'var(--panel-2)', borderRadius: '0 0 var(--radius) var(--radius)' }}>
        {previo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="eyebrow">Nivel de vinculación</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <NivelBadge nivel={egresado.nivel} corto />
                <Icono n="flecha" s={14} className="muted" />
                <NivelBadge nivel={previo.nivel} corto />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ fontSize: 24, fontWeight: 800, color: NIVEL_INFO[previo.nivel].color, lineHeight: 1 }}>{previo.ive.toFixed(1)}</div>
              <div className="num" style={{ fontSize: 11.5, fontWeight: 700, color: previo.ive >= egresado.ive ? 'var(--ok)' : 'var(--bad)' }}>
                {previo.ive >= egresado.ive ? '▲' : '▼'} {Math.abs(previo.ive - egresado.ive).toFixed(1)} IVE
              </div>
            </div>
          </div>
        )}
        <button className="btn primary" style={{ width: '100%', height: 42 }} disabled={!resultado || guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : <>Guardar resultado <span style={{ opacity: .7, fontSize: 11 }}>Ctrl ↵</span></>}
        </button>
      </div>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-2)' }}>{titulo}</div>
      {children}
    </section>
  );
}
