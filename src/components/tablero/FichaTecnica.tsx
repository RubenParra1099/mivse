'use client';
import { useEffect, useState } from 'react';
import { ESTATUS_INFO, NIVEL_INFO, RESULTADOS, nombreCarrera } from '@/lib/catalogos';
import { COMPONENTES, PESOS_BASE, componentes } from '@/lib/ive';
import { fechaCorta, haceCuanto, telFormato } from '@/lib/formato';
import type { EgresadoResumen, ExpedienteCompleto } from '@/lib/tipos';
import { Icono } from '../ui/Icono';
import { MedidorIVE, NivelBadge } from '../ui/Nivel';

const DIA = 86_400_000;

/** Ficha técnica del egresado: panel lateral que se despliega sobre el mapa (misma pantalla), al estilo de vialidad. */
export function FichaTecnica({ matricula, onCerrar }: { matricula: string; onCerrar: () => void }) {
  const [exp, setExp] = useState<ExpedienteCompleto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setExp(null);
    setError(null);
    (async () => {
      const r = await fetch(`/api/buscar?q=${encodeURIComponent(matricula)}`).then((x) => x.json());
      const res = (r.resultados as EgresadoResumen[]).find((x) => x.matricula === matricula);
      if (!res) throw new Error('No se encontró el egresado.');
      const e = await fetch(`/api/egresados/${res.id}`);
      if (!e.ok) throw new Error('No se pudo cargar la ficha.');
      const datos = (await e.json()) as ExpedienteCompleto;
      if (vivo) setExp(datos);
    })().catch((err: Error) => vivo && setError(err.message));
    return () => { vivo = false; };
  }, [matricula]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  return (
    <aside className="ficha-tec" role="dialog" aria-label="Ficha técnica del egresado" onClick={(e) => e.stopPropagation()}>
      <div className="ficha-tec-h">
        <div className="eyebrow">Ficha técnica · {matricula}</div>
        <button className="btn ghost sm" onClick={onCerrar} aria-label="Cerrar ficha técnica"><Icono n="x" s={16} /></button>
      </div>
      <div className="scroll" style={{ flex: 1, padding: '0 16px 16px' }}>
        {error ? <div className="vacio">{error}</div> : !exp ? <div className="vacio">Cargando ficha técnica…</div> : <Contenido exp={exp} />}
      </div>
      <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
        <a href={`/callcenter?q=${matricula}`} className="btn sm primary" style={{ width: '100%', justifyContent: 'center', color: '#fff' }}>Abrir expediente en Call Center</a>
      </div>
    </aside>
  );
}

function Contenido({ exp }: { exp: ExpedienteCompleto }) {
  const e = exp.egresado;
  const empleado = e.estatus === 'empleado' || e.estatus === 'autoempleo';
  const comp = componentes({
    estatus: e.estatus,
    diasActualizacion: e.ultimaActualizacion ? Math.floor((Date.now() - Date.parse(e.ultimaActualizacion)) / DIA) : null,
    participaciones: e.participaciones,
    interesPosgrado: e.interesPosgrado,
    aportaciones: e.aportaciones.length,
    nps: e.nps,
  });
  const fila = (k: string, v: React.ReactNode) => (
    <>
      <dt>{k}</dt>
      <dd>{v ?? '—'}</dd>
    </>
  );

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 17, letterSpacing: '-0.01em' }}>{e.nombre} {e.apellidoPaterno} {e.apellidoMaterno}</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <NivelBadge nivel={e.nivel} corto />
            <span className="badge" style={{ '--c': ESTATUS_INFO[e.estatus].color } as React.CSSProperties}>{ESTATUS_INFO[e.estatus].etiqueta}</span>
          </div>
        </div>
        <MedidorIVE valor={e.ive} tam={84} grosor={8} />
      </div>

      <Seccion titulo="Datos académicos">
        {fila('Matrícula', <span className="num">{e.matricula}</span>)}
        {fila('Carrera', nombreCarrera(e.carrera))}
        {fila('Generación', e.generacion)}
        {fila('Género', e.genero === 'F' ? 'Femenino' : 'Masculino')}
      </Seccion>

      <Seccion titulo="Contacto">
        {fila('Teléfono', <a href={`tel:+52${e.telefono}`} className="num">{telFormato(e.telefono)}</a>)}
        {fila('Correo', <a href={`mailto:${e.email}`}>{e.email}</a>)}
        {fila('Último contacto', haceCuanto(e.ultimoContacto))}
        {fila('Próximo contacto', e.proximoContacto ? fechaCorta(e.proximoContacto) : null)}
        {fila('Datos actualizados', haceCuanto(e.ultimaActualizacion))}
      </Seccion>

      <Seccion titulo="Ubicación">
        {fila('Domicilio', e.domicilio ? `${e.domicilio}${e.colonia ? `, Col. ${e.colonia}` : ''}` : null)}
        {e.entreCalles && fila('Entre calles', e.entreCalles)}
        {fila('Municipio', `${e.municipio}, ${e.estado}`)}
        {fila('Coordenada', e.lat != null && e.lng != null ? <span className="num">{e.lat.toFixed(6)}, {e.lng.toFixed(6)}</span> : null)}
        {fila('Origen', e.geoOrigen === 'campo' ? <span style={{ color: 'var(--ok)' }}>GPS capturado en campo</span> : e.geoOrigen === 'domicilio' ? <span style={{ color: 'var(--warn)' }}>Estimada por domicilio</span> : 'Sin coordenada')}
      </Seccion>

      <Seccion titulo="Situación laboral">
        {fila('Estatus', ESTATUS_INFO[e.estatus].etiqueta)}
        {empleado && fila('Empresa', e.empresa)}
        {empleado && fila('Puesto', e.puesto)}
        {empleado && fila('Sector', e.sector)}
        {fila('Ingreso mensual', e.rangoIngreso)}
      </Seccion>

      <Seccion titulo="Vinculación">
        {fila('Participaciones', `${e.participaciones} / año`)}
        {fila('Aportaciones', e.aportaciones.length ? e.aportaciones.join(', ') : 'Ninguna')}
        {fila('Interés en posgrado', e.interesPosgrado ? 'Sí' : 'No')}
        {fila('Recomendación (NPS)', e.nps != null ? `${e.nps}/10` : null)}
        {fila('Nivel', <span style={{ color: NIVEL_INFO[e.nivel].color, fontWeight: 700 }}>{NIVEL_INFO[e.nivel].etiqueta}</span>)}
      </Seccion>

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Composición del IVE</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {COMPONENTES.map((c) => (
            <div key={c.id} title={c.ayuda}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span>{c.etiqueta} <span className="muted">· {PESOS_BASE[c.id]}%</span></span>
                <b className="num">{(comp[c.id] * PESOS_BASE[c.id]).toFixed(1)}</b>
              </div>
              <div style={{ height: 5, borderRadius: 9, background: 'var(--panel-3)', overflow: 'hidden' }}>
                <div style={{ width: `${comp[c.id] * 100}%`, height: '100%', borderRadius: 9, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Historial de contacto · {exp.llamadas.length}</div>
        {exp.llamadas.length === 0 ? (
          <div className="muted" style={{ fontSize: 12.5 }}>Sin intentos de contacto previos.</div>
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {exp.llamadas.slice(0, 5).map((l) => (
              <li key={l.id} style={{ fontSize: 12.5 }}>
                <b>{RESULTADOS.find((x) => x.id === l.resultado)?.etiqueta}</b>
                <div className="muted" style={{ fontSize: 11.5 }}>{fechaCorta(l.fecha)} · {l.agente}{l.canal !== 'llamada' ? ` · ${l.canal === 'whatsapp' ? 'WhatsApp' : 'Visita de campo'}` : ''}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{titulo}</div>
      <dl className="ficha-tec-dl">{children}</dl>
    </div>
  );
}
