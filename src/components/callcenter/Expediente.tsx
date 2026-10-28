'use client';
import { useState } from 'react';
import { ESTATUS_INFO, NIVEL_INFO, PLANTILLAS_WHATSAPP, RESULTADOS, nombreCarrera } from '@/lib/catalogos';
import { COMPONENTES, PESOS_BASE, componentes } from '@/lib/ive';
import { fechaCorta, haceCuanto, iniciales, telFormato } from '@/lib/formato';
import type { ExpedienteCompleto } from '@/lib/tipos';
import { Icono } from '../ui/Icono';
import { MedidorIVE, NivelBadge } from '../ui/Nivel';
import { MiniMapa } from './MiniMapa';

const DIA = 86_400_000;

export function enlaceWhatsApp(telefono: string, texto: string) {
  const num = telefono.replace(/\D/g, '');
  return `https://wa.me/${num.length === 10 ? '52' + num : num}?text=${encodeURIComponent(texto)}`;
}

export function Expediente({ exp, onLlamar, onWhatsApp }: { exp: ExpedienteCompleto; onLlamar: () => void; onWhatsApp: () => void }) {
  const e = exp.egresado;
  const [menuWa, setMenuWa] = useState(false);
  const nombre = `${e.nombre} ${e.apellidoPaterno} ${e.apellidoMaterno}`;
  const color = NIVEL_INFO[e.nivel].color;
  const comp = componentes({
    estatus: e.estatus,
    diasActualizacion: e.ultimaActualizacion ? Math.floor((Date.now() - Date.parse(e.ultimaActualizacion)) / DIA) : null,
    participaciones: e.participaciones,
    interesPosgrado: e.interesPosgrado,
    aportaciones: e.aportaciones.length,
    nps: e.nps,
  });
  const empleado = e.estatus === 'empleado' || e.estatus === 'autoempleo';

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Encabezado del expediente */}
      <section className="panel" style={{ padding: 18, display: 'flex', gap: 18, alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(600px 160px at 0% 0%, color-mix(in srgb, ${color} 16%, transparent), transparent)` }} />
        <div style={{ width: 64, height: 64, borderRadius: 18, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 22, color: '#fff', background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 50%, #000))`, flex: 'none', position: 'relative' }}>
          {iniciales(`${e.nombre} ${e.apellidoPaterno}`)}
        </div>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div className="eyebrow">Expediente único · {e.matricula}</div>
          <h2 style={{ margin: '2px 0 6px', fontSize: 21, letterSpacing: '-0.02em' }}>{nombre}</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: 'var(--fg-2)' }}>
            <NivelBadge nivel={e.nivel} corto />
            <span className="badge" style={{ '--c': ESTATUS_INFO[e.estatus].color } as React.CSSProperties}>{ESTATUS_INFO[e.estatus].etiqueta}</span>
            <span>{nombreCarrera(e.carrera)}</span>·<span>Generación {e.generacion}</span>·<span>{e.municipio}, {e.estado}</span>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <MedidorIVE valor={e.ive} tam={112} />
        </div>
      </section>

      {/* Barra de contacto: telefonía nativa y WhatsApp Web */}
      <section className="panel" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <a className="btn primary" href={`tel:+52${e.telefono}`} onClick={onLlamar}>
          <Icono n="tel" s={16} /> Llamar <span className="num">{telFormato(e.telefono)}</span>
        </a>
        <div style={{ position: 'relative' }}>
          <button className="btn wa" onClick={() => setMenuWa((v) => !v)} aria-expanded={menuWa}>
            <Icono n="wa" s={16} /> WhatsApp
          </button>
          {menuWa && (
            <div className="panel" style={{ position: 'absolute', top: 42, left: 0, zIndex: 50, width: 330, padding: 6 }} onMouseLeave={() => setMenuWa(false)}>
              <div className="eyebrow" style={{ padding: '8px 10px 4px' }}>Mensaje institucional</div>
              {PLANTILLAS_WHATSAPP.map((p) => (
                <a
                  key={p.id}
                  href={enlaceWhatsApp(e.telefono, p.texto(e.nombre.split(' ')[0]))}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    setMenuWa(false);
                    onWhatsApp();
                  }}
                  style={{ display: 'block', padding: '8px 10px', borderRadius: 9, fontSize: 12.5 }}
                  onMouseEnter={(ev) => (ev.currentTarget.style.background = 'var(--panel-3)')}
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = '')}
                >
                  <b>{p.etiqueta}</b>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.texto(e.nombre.split(' ')[0])}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
        <a className="btn" href={`mailto:${e.email}`}>
          <Icono n="mail" s={16} /> {e.email}
        </a>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 12 }}>
          <span className="muted">Último contacto <b style={{ color: 'var(--fg)' }}>{haceCuanto(e.ultimoContacto)}</b></span>
          <span className="muted">Datos actualizados <b style={{ color: e.ultimaActualizacion && Date.now() - Date.parse(e.ultimaActualizacion) < 365 * DIA ? 'var(--ok)' : 'var(--bad)' }}>{haceCuanto(e.ultimaActualizacion)}</b></span>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 }}>
        {/* Situación laboral */}
        <section className="panel">
          <div className="panel-h"><h3>Situación laboral</h3><Icono n="maletin" s={16} className="muted" /></div>
          <div className="panel-b">
            {empleado ? (
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 14px', margin: 0, fontSize: 13 }}>
                <dt className="muted">Empresa</dt><dd style={{ margin: 0, fontWeight: 600 }}>{e.empresa}</dd>
                <dt className="muted">Puesto</dt><dd style={{ margin: 0 }}>{e.puesto}</dd>
                <dt className="muted">Sector</dt><dd style={{ margin: 0 }}>{e.sector}</dd>
                <dt className="muted">Ingreso</dt><dd style={{ margin: 0 }}>{e.rangoIngreso ?? '—'}</dd>
              </dl>
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>{e.estatus === 'sin_dato' ? 'Sin información laboral. Prioriza actualizar en esta llamada.' : ESTATUS_INFO[e.estatus].etiqueta}</div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {e.interesPosgrado && <span className="chip on" style={{ cursor: 'default' }}>Interés en posgrado</span>}
              {e.aportaciones.map((a) => <span key={a} className="chip" style={{ cursor: 'default' }}>{a}</span>)}
              <span className="chip" style={{ cursor: 'default' }}>{e.participaciones} participaciones / año</span>
              {e.nps != null && <span className="chip" style={{ cursor: 'default' }}>Recomendación <b>{e.nps}/10</b></span>}
            </div>
          </div>
        </section>

        {/* Desglose del IVE */}
        <section className="panel">
          <div className="panel-h"><h3>Composición del IVE</h3><span className="sub">ponderación institucional</span></div>
          <div className="panel-b" style={{ display: 'grid', gap: 9 }}>
            {COMPONENTES.map((c) => {
              const v = comp[c.id];
              return (
                <div key={c.id} title={c.ayuda}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span>{c.etiqueta} <span className="muted">· {PESOS_BASE[c.id]}%</span></span>
                    <b className="num">{(v * PESOS_BASE[c.id]).toFixed(1)}</b>
                  </div>
                  <div style={{ height: 6, borderRadius: 9, background: 'var(--panel-3)', overflow: 'hidden' }}>
                    <div style={{ width: `${v * 100}%`, height: '100%', borderRadius: 9, background: `linear-gradient(90deg, var(--accent), var(--accent-2))`, transition: 'width .5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Ubicación (coordenada capturada en campo) */}
        <section className="panel">
          <div className="panel-h">
            <h3>Ubicación</h3>
            {e.geoOrigen === 'campo' ? (
              <span className="badge" style={{ '--c': 'var(--ok)' } as React.CSSProperties}>GPS de campo</span>
            ) : e.geoOrigen === 'domicilio' ? (
              <span className="badge" style={{ '--c': 'var(--warn)' } as React.CSSProperties}>Por domicilio</span>
            ) : null}
          </div>
          <div className="panel-b">
            {e.lat != null && e.lng != null ? (
              <>
                <MiniMapa lat={e.lat} lng={e.lng} color={color} titulo={nombre} />
                {e.domicilio && (
                  <div style={{ fontSize: 12.5, marginTop: 8, fontWeight: 600 }}>
                    {e.domicilio}{e.colonia ? `, Col. ${e.colonia}` : ''}
                    {e.entreCalles && <span className="muted" style={{ fontWeight: 500 }}> · entre {e.entreCalles}</span>}
                  </div>
                )}
                <div className="muted num" style={{ fontSize: 11.5, marginTop: e.domicilio ? 2 : 8 }}>{e.municipio}, {e.estado} · {e.lat.toFixed(5)}, {e.lng.toFixed(5)}</div>
              </>
            ) : (
              <div className="vacio">Sin coordenada. Pendiente de visita de la App de Campo.</div>
            )}
          </div>
        </section>

        {/* Historial */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', maxHeight: 296 }}>
          <div className="panel-h"><h3>Historial de contacto</h3><span className="sub">{exp.llamadas.length} registros</span></div>
          <div className="panel-b scroll" style={{ flex: 1 }}>
            {exp.llamadas.length === 0 && <div className="vacio">Sin intentos de contacto previos.</div>}
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 0 }}>
              {exp.llamadas.map((l, i) => {
                const r = RESULTADOS.find((x) => x.id === l.resultado);
                const tono = r?.tono === 'ok' ? 'var(--ok)' : r?.tono === 'mal' ? 'var(--bad)' : r?.tono === 'aviso' ? 'var(--warn)' : r?.tono === 'info' ? '#16a34a' : 'var(--muted)';
                return (
                  <li key={l.id} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 10, paddingBottom: 12, position: 'relative' }}>
                    {i < exp.llamadas.length - 1 && <span style={{ position: 'absolute', left: 6, top: 14, bottom: 0, width: 2, background: 'var(--line)' }} />}
                    <span className="dot" style={{ '--c': tono, marginTop: 4, boxShadow: '0 0 0 3px var(--panel)' } as React.CSSProperties} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {r?.etiqueta} {l.canal === 'whatsapp' && <span className="muted">· WhatsApp</span>}{l.canal === 'campo' && <span className="muted">· Visita de campo</span>}
                        {l.nivelAntes && l.nivelDespues && l.nivelAntes !== l.nivelDespues && (
                          <span className="muted"> · {NIVEL_INFO[l.nivelAntes].etiqueta} → <b style={{ color: NIVEL_INFO[l.nivelDespues].color }}>{NIVEL_INFO[l.nivelDespues].etiqueta}</b></span>
                        )}
                      </div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{fechaCorta(l.fecha)} · {l.agente}</div>
                      {l.notas && <div style={{ fontSize: 12, marginTop: 3, color: 'var(--fg-2)' }}>“{l.notas}”</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
