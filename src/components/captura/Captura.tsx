'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  APORTACIONES, CARRERAS, ENCUESTADORES, ESTATUS_INFO, ESTATUS_LABORAL, MUNICIPIOS, NIVEL_INFO, RANGOS_INGRESO, SECTORES,
} from '@/lib/catalogos';
import { calcularIVE, nivelDe } from '@/lib/ive';
import { callesCercanas, buscarDireccion, direccionDe, leerGPS, municipioCercano, type Sugerencia } from '@/lib/geo-campo';
import { descartar, encolar, nuevoUuid, reintentar, sincronizar, useCola, useEnLinea, type ItemCola } from '@/lib/cola-campo';
import { fmtN, haceCuanto } from '@/lib/formato';
import type { CapturaCampo, Egresado, EgresadoResumen } from '@/lib/tipos';
import type { ResumenCampo } from '@/lib/repo';
import { Icono } from '../ui/Icono';
import { BotonPantallaCompleta } from '../ui/BotonPantallaCompleta';
import { NivelBadge } from '../ui/Nivel';
import type { PuntoCaptura } from './MapaCaptura';

const MapaCaptura = dynamic(() => import('./MapaCaptura').then((m) => m.MapaCaptura), { ssr: false });

type Form = Omit<CapturaCampo, 'uuid' | 'encuestador' | 'capturadoEn'>;
const ANIO = new Date().getFullYear();

const VACIO: Form = {
  matricula: '', nombre: '', apellidoPaterno: '', apellidoMaterno: '', genero: 'F', carrera: '', generacion: ANIO - 1,
  telefono: '', email: '', domicilio: '', colonia: '', entreCalles: '', municipio: 'Torreón',
  lat: null, lng: null, precision: null, origenUbicacion: null,
  estatus: 'sin_dato', sector: null, empresa: '', puesto: '', rangoIngreso: null,
  interesPosgrado: false, aportaciones: [], participaciones: 0, nps: null, notas: '',
};

const deEgresado = (e: Egresado): Form => ({
  matricula: e.matricula, nombre: e.nombre, apellidoPaterno: e.apellidoPaterno, apellidoMaterno: e.apellidoMaterno, genero: e.genero,
  carrera: e.carrera, generacion: e.generacion, telefono: e.telefono, email: e.email, domicilio: e.domicilio ?? '', colonia: e.colonia ?? '',
  entreCalles: e.entreCalles ?? '', municipio: MUNICIPIOS.some((m) => m.nombre === e.municipio) ? e.municipio : 'Torreón',
  // La coordenada se vuelve a levantar en la visita; la previa sólo se usa como referencia en el mapa
  lat: null, lng: null, precision: null, origenUbicacion: null,
  estatus: e.estatus, sector: e.sector, empresa: e.empresa ?? '', puesto: e.puesto ?? '', rangoIngreso: e.rangoIngreso,
  interesPosgrado: e.interesPosgrado, aportaciones: [...e.aportaciones], participaciones: e.participaciones, nps: e.nps, notas: '',
});

const K_BORRADOR = 'mivse.campo.borrador';
const K_ENCUESTADOR = 'mivse.campo.encuestador';
const COLOR_ESTADO: Record<ItemCola['estado'], string> = { pendiente: 'var(--warn)', enviando: 'var(--accent)', sincronizada: 'var(--ok)', rechazada: 'var(--bad)' };
const ETQ_ESTADO: Record<ItemCola['estado'], string> = { pendiente: 'Pendiente', enviando: 'Enviando…', sincronizada: 'Sincronizada', rechazada: 'Rechazada' };
const HEX_ESTADO: Record<ItemCola['estado'], string> = { pendiente: '#eab308', enviando: '#818cf8', sincronizada: '#22c55e', rechazada: '#f43f5e' };

export function Captura() {
  const [encuestador, setEncuestador] = useState(ENCUESTADORES[0]);
  const [f, setF] = useState<Form>(VACIO);
  const [base, setBase] = useState<Egresado | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [errores, setErrores] = useState<Partial<Record<keyof Form, string>>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [enfoque, setEnfoque] = useState(0);
  const cola = useCola();
  const enLinea = useEnLinea();
  const [servidor, setServidor] = useState<ResumenCampo | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrores((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };
  const avisar = (m: string) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? null : t)), 2600);
  };

  // ── Persistencia local: encuestador y borrador (sobrevive a cerrar la app en campo) ──
  const listo = useRef(false);
  useEffect(() => {
    try {
      const a = localStorage.getItem(K_ENCUESTADOR);
      if (a) setEncuestador(a);
      const b = JSON.parse(localStorage.getItem(K_BORRADOR) ?? 'null');
      if (b?.f) {
        setF({ ...VACIO, ...b.f });
        setBase(b.base ?? null);
        setNuevo(!!b.nuevo);
      }
    } catch {}
    listo.current = true;
  }, []);
  useEffect(() => {
    if (!listo.current) return;
    try { localStorage.setItem(K_BORRADOR, JSON.stringify({ f, base, nuevo })); } catch {}
  }, [f, base, nuevo]);

  // ── Sincronización automática + app instalable / offline ──
  const refrescarServidor = useCallback(async () => {
    try {
      const r = await fetch('/api/capturas', { cache: 'no-store' });
      if (r.ok) setServidor(await r.json());
    } catch {}
  }, []);
  useEffect(() => {
    const sync = () => sincronizar().then(refrescarServidor);
    sync();
    window.addEventListener('online', sync);
    const t = setInterval(sync, 20000);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(async () => {
        const sw = (await navigator.serviceWorker.ready).active;
        // Guarda en caché los recursos ya cargados para abrir la app sin conexión
        const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin) && !u.includes('/api/'));
        sw?.postMessage({ tipo: 'precache', urls: [...urls, location.pathname] });
      }).catch(() => {});
    }
    return () => {
      window.removeEventListener('online', sync);
      clearInterval(t);
    };
  }, [refrescarServidor]);
  const sincronizadas = cola.filter((x) => x.estado === 'sincronizada').length;
  useEffect(() => { if (sincronizadas) refrescarServidor(); }, [sincronizadas, refrescarServidor]);

  // ── Ubicación: GPS, calles detectadas y dirección ──
  const [gps, setGps] = useState<{ buscando: boolean; precision: number | null; error: string | null }>({ buscando: false, precision: null, error: null });
  const [detectado, setDetectado] = useState<{ calle: string | null; entre: string[]; colonia: string | null; numero: string | null } | null>(null);
  const auto = useRef({ domicilio: '', entreCalles: '', colonia: '' });
  const pararGps = useRef<() => void>(() => {});

  const ubicar = useCallback(async (lat: number, lng: number, origen: Form['origenUbicacion'], precision: number | null) => {
    setF((x) => ({ ...x, lat, lng, origenUbicacion: origen, precision, municipio: municipioCercano(lat, lng) }));
    setErrores((e) => ({ ...e, lat: undefined }));
    const c = await callesCercanas(lat, lng).catch(() => ({ calle: null, entre: [] as string[], distancia: null }));
    setDetectado({ calle: c.calle, entre: c.entre, colonia: null, numero: null });
    // Rellena sólo los campos vacíos o que se llenaron automáticamente (respeta lo que escribió el encuestador)
    const rellenar = (k: 'domicilio' | 'entreCalles' | 'colonia', v: string) =>
      setF((x) => {
        if (!v || (x[k] && x[k] !== auto.current[k])) return x;
        auto.current[k] = v;
        return { ...x, [k]: v };
      });
    if (c.calle) rellenar('domicilio', c.calle);
    if (c.entre.length) rellenar('entreCalles', c.entre.join(' y '));
    if (navigator.onLine) {
      const d = await direccionDe(lat, lng);
      if (d) {
        setDetectado({ calle: c.calle ?? d.calle, entre: c.entre, colonia: d.colonia, numero: d.numero });
        if (d.colonia) rellenar('colonia', d.colonia);
        const calle = c.calle ?? d.calle;
        if (calle) rellenar('domicilio', d.numero ? `${calle} ${d.numero}` : calle);
        if (d.municipio) setF((x) => ({ ...x, municipio: d.municipio! }));
      }
    }
  }, []);

  const usarGPS = () => {
    pararGps.current();
    setGps({ buscando: true, precision: null, error: null });
    let centrado = false;
    pararGps.current = leerGPS(
      ({ lat, lng, precision, final }) => {
        setGps({ buscando: !final, precision, error: null });
        setF((x) => ({ ...x, lat, lng, precision: Math.round(precision), origenUbicacion: 'gps' }));
        if (!centrado) { centrado = true; setEnfoque((n) => n + 1); }
        if (final) {
          ubicar(lat, lng, 'gps', Math.round(precision));
          setEnfoque((n) => n + 1);
        }
      },
      (error) => setGps({ buscando: false, precision: null, error }),
    );
  };
  useEffect(() => () => pararGps.current(), []);

  const [qDir, setQDir] = useState('');
  const [sugs, setSugs] = useState<Sugerencia[]>([]);
  useEffect(() => {
    if (qDir.trim().length < 4 || !enLinea) return setSugs([]);
    const ac = new AbortController();
    const t = setTimeout(() => buscarDireccion(qDir, ac.signal).then(setSugs).catch(() => {}), 450);
    return () => { clearTimeout(t); ac.abort(); };
  }, [qDir, enLinea]);

  // ── Egresado: buscar expediente existente o alta nueva ──
  const [q, setQ] = useState('');
  const [res, setRes] = useState<EgresadoResumen[]>([]);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2 || !enLinea) return setRes([]);
    const ac = new AbortController();
    setBuscando(true);
    const t = setTimeout(() => {
      fetch(`/api/buscar?q=${encodeURIComponent(q)}`, { signal: ac.signal })
        .then((r) => r.json())
        .then((d) => setRes(d.resultados.slice(0, 8)))
        .catch(() => {})
        .finally(() => setBuscando(false));
    }, 160);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q, enLinea]);

  const elegir = async (m: string) => {
    try {
      const r = await fetch(`/api/capturas?matricula=${encodeURIComponent(m)}`);
      if (!r.ok) throw new Error();
      const e: Egresado = await r.json();
      pararGps.current();
      auto.current = { domicilio: '', entreCalles: '', colonia: '' };
      setBase(e);
      setNuevo(false);
      setF(deEgresado(e));
      setErrores({});
      setDetectado(null);
      setQ('');
      setRes([]);
      setGps({ buscando: false, precision: null, error: null });
    } catch {
      avisar('No se pudo cargar el expediente');
    }
  };
  const altaNueva = () => {
    pararGps.current();
    auto.current = { domicilio: '', entreCalles: '', colonia: '' };
    setBase(null);
    setNuevo(true);
    setF({ ...VACIO, nombre: q && !/^\d+$/.test(q.trim()) ? q.trim() : '', matricula: /^\d+$/.test(q.trim()) ? q.trim() : '' });
    setErrores({});
    setDetectado(null);
    setQ('');
    setRes([]);
  };
  const cancelar = () => {
    pararGps.current();
    setBase(null);
    setNuevo(false);
    setF(VACIO);
    setErrores({});
    setDetectado(null);
    setGps({ buscando: false, precision: null, error: null });
  };
  const activo = nuevo || base != null;

  // ── IVE en vivo ──
  const empleado = f.estatus === 'empleado' || f.estatus === 'autoempleo';
  const ive = useMemo(() => {
    const v = calcularIVE({ estatus: f.estatus, diasActualizacion: 0, participaciones: f.participaciones, interesPosgrado: f.interesPosgrado, aportaciones: f.aportaciones.length, nps: f.nps });
    return { v, nivel: nivelDe(v) };
  }, [f.estatus, f.participaciones, f.interesPosgrado, f.aportaciones, f.nps]);

  // ── Guardar ──
  const guardar = () => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!/^[A-Za-z0-9-]{4,20}$/.test(f.matricula.trim())) e.matricula = 'Matrícula requerida';
    if (!f.nombre.trim()) e.nombre = 'Requerido';
    if (!f.apellidoPaterno.trim()) e.apellidoPaterno = 'Requerido';
    if (!f.carrera) e.carrera = 'Selecciona la carrera';
    if (!f.generacion || f.generacion < 1970 || f.generacion > ANIO) e.generacion = 'Año inválido';
    if (f.lat == null) e.lat = 'Captura la ubicación con el GPS o colocando el pin en el mapa';
    setErrores(e);
    if (Object.keys(e).length) {
      formRef.current?.querySelector('[data-error="1"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    pararGps.current();
    encolar({ ...f, matricula: f.matricula.trim().toUpperCase(), uuid: nuevoUuid(), encuestador, capturadoEn: new Date().toISOString() });
    avisar(enLinea ? 'Captura guardada · sincronizando…' : 'Guardada en el dispositivo · se enviará al recuperar la señal');
    cancelar();
    try { localStorage.removeItem(K_BORRADOR); } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pendientes = cola.filter((x) => x.estado === 'pendiente' || x.estado === 'enviando').length;
  const rechazadas = cola.filter((x) => x.estado === 'rechazada').length;

  const puntos = useMemo<PuntoCaptura[]>(() => {
    const xs: PuntoCaptura[] = cola
      .filter((x) => x.captura.lat != null && x.captura.lng != null)
      .map((x) => ({ lat: x.captura.lat!, lng: x.captura.lng!, color: HEX_ESTADO[x.estado], etiqueta: `${x.captura.nombre} ${x.captura.apellidoPaterno} · ${ETQ_ESTADO[x.estado]}` }));
    if (base?.lat != null && base.lng != null) xs.push({ lat: base.lat, lng: base.lng, color: '#94a3b8', etiqueta: 'Ubicación anterior registrada' });
    return xs;
  }, [cola, base]);

  const precisionColor = f.precision == null ? 'var(--muted)' : f.precision <= 20 ? 'var(--ok)' : f.precision <= 60 ? 'var(--warn)' : 'var(--bad)';

  return (
    <div className="captura">
      {/* Encabezado */}
      <header className="cap-head">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Módulo 1 · App de Campo</div>
          <h1 className="titulo">Captura con geolocalización</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge" style={{ '--c': enLinea ? 'var(--ok)' : 'var(--warn)' } as React.CSSProperties}>{enLinea ? 'En línea' : 'Sin conexión'}</span>
          {pendientes > 0 && <span className="badge" style={{ '--c': 'var(--warn)' } as React.CSSProperties}>{pendientes} por enviar</span>}
          <label className="campo" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icono n="usuario" s={16} />
            <select className="select" style={{ height: 34, width: 'auto' }} value={encuestador} onChange={(e) => { setEncuestador(e.target.value); try { localStorage.setItem(K_ENCUESTADOR, e.target.value); } catch {} }}>
              {ENCUESTADORES.map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="cap-grid">
        <div ref={formRef} style={{ display: 'grid', gap: 14, minWidth: 0, alignContent: 'start' }}>
          {/* Paso 1 — Egresado */}
          <section className="panel">
            <div className="panel-h"><h3><Paso n={1} />Egresado</h3>{activo && <button className="btn sm ghost" onClick={cancelar}><Icono n="x" s={14} /> Cambiar</button>}</div>
            <div className="panel-b">
              {!activo ? (
                <>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 11, color: 'var(--muted)' }}><Icono n="buscar" s={17} /></span>
                    <input className="input" style={{ paddingLeft: 38, height: 44 }} value={q} onChange={(e) => setQ(e.target.value)}
                      placeholder={enLinea ? 'Buscar por matrícula, nombre o carrera…' : 'Sin conexión: registra como nuevo con su matrícula'} />
                  </div>
                  {res.length > 0 && (
                    <div className="cap-lista">
                      {res.map((r) => (
                        <button key={r.id} onClick={() => elegir(r.matricula)}>
                          <div style={{ minWidth: 0 }}>
                            <b>{r.nombreCompleto}</b>
                            <div className="muted" style={{ fontSize: 12 }}>{r.matricula} · {r.carrera} · Gen {r.generacion} · {r.municipio}</div>
                          </div>
                          <NivelBadge nivel={r.nivel} corto />
                        </button>
                      ))}
                    </div>
                  )}
                  {q.trim().length >= 2 && !buscando && res.length === 0 && enLinea && <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Sin coincidencias en el censo.</div>}
                  <button className="btn" style={{ marginTop: 12, width: '100%', height: 42 }} onClick={altaNueva}>
                    <Icono n="usuario" s={16} /> Registrar egresado nuevo
                  </button>
                </>
              ) : (
                <>
                  <div className="cap-banner">
                    {base ? (
                      <>
                        <span className="muted">Actualizando expediente</span>
                        <NivelBadge nivel={base.nivel} corto />
                        <span className="muted num">IVE {base.ive.toFixed(1)} · actualizado {haceCuanto(base.ultimaActualizacion)}</span>
                      </>
                    ) : <span><b>Alta nueva</b> <span className="muted">· se agregará al censo al sincronizar</span></span>}
                  </div>
                  <div className="cap-campos">
                    <Campo etq="Matrícula" err={errores.matricula}>
                      <input className="input num" value={f.matricula} readOnly={!!base} onChange={(e) => set('matricula', e.target.value.toUpperCase())} inputMode="numeric" />
                    </Campo>
                    <Campo etq="Nombre(s)" err={errores.nombre}><input className="input" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} autoComplete="off" /></Campo>
                    <Campo etq="Apellido paterno" err={errores.apellidoPaterno}><input className="input" value={f.apellidoPaterno} onChange={(e) => set('apellidoPaterno', e.target.value)} autoComplete="off" /></Campo>
                    <Campo etq="Apellido materno"><input className="input" value={f.apellidoMaterno} onChange={(e) => set('apellidoMaterno', e.target.value)} autoComplete="off" /></Campo>
                    <Campo etq="Carrera" err={errores.carrera} ancho>
                      <select className="select" value={f.carrera} onChange={(e) => set('carrera', e.target.value)}>
                        <option value="">Selecciona…</option>
                        {CARRERAS.map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
                      </select>
                    </Campo>
                    <Campo etq="Generación (egreso)" err={errores.generacion}>
                      <input className="input num" type="number" min={1970} max={ANIO} value={f.generacion || ''} onChange={(e) => set('generacion', Number(e.target.value))} inputMode="numeric" />
                    </Campo>
                    <Campo etq="Género" grupo>
                      <div className="seg" style={{ width: '100%' }}>
                        <button className={f.genero === 'F' ? 'on' : ''} style={{ flex: 1 }} onClick={() => set('genero', 'F')}>Femenino</button>
                        <button className={f.genero === 'M' ? 'on' : ''} style={{ flex: 1 }} onClick={() => set('genero', 'M')}>Masculino</button>
                      </div>
                    </Campo>
                  </div>
                </>
              )}
            </div>
          </section>

          {activo && (
            <>
              {/* Paso 2 — Geolocalización */}
              <section className="panel" data-error={errores.lat ? 1 : undefined}>
                <div className="panel-h">
                  <h3><Paso n={2} />Ubicación y domicilio</h3>
                  {f.origenUbicacion && <span className="sub">{f.origenUbicacion === 'gps' ? 'GPS del dispositivo' : f.origenUbicacion === 'busqueda' ? 'Búsqueda de dirección' : 'Pin en el mapa'}</span>}
                </div>
                <div className="panel-b" style={{ display: 'grid', gap: 12 }}>
                  <div className="cap-gps">
                    <button className={`btn primary ${gps.buscando ? 'pulsando' : ''}`} style={{ height: 46, flex: '1 1 220px' }} onClick={usarGPS} disabled={gps.buscando && gps.precision == null}>
                      <Icono n="gps" s={18} w={2.2} />
                      {gps.buscando ? (gps.precision != null ? `Afinando señal… ±${Math.round(gps.precision)} m` : 'Buscando satélites…') : f.origenUbicacion === 'gps' ? 'Volver a leer GPS' : 'Capturar ubicación con GPS'}
                    </button>
                    <div style={{ position: 'relative', flex: '2 1 260px' }}>
                      <span style={{ position: 'absolute', left: 12, top: 13, color: 'var(--muted)' }}><Icono n="pin" s={17} /></span>
                      <input className="input" style={{ paddingLeft: 38, height: 46 }} value={qDir} onChange={(e) => setQDir(e.target.value)}
                        placeholder={enLinea ? 'Buscar dirección (ej. Av. Morelos 1050, Torreón)' : 'Búsqueda de direcciones sin conexión no disponible'} disabled={!enLinea} />
                      {sugs.length > 0 && (
                        <div className="cap-lista flotante">
                          {sugs.map((s, i) => (
                            <button key={i} onClick={() => { setQDir(''); setSugs([]); ubicar(s.lat, s.lng, 'busqueda', null); setEnfoque((n) => n + 1); }}>
                              <div style={{ minWidth: 0 }}><b>{s.titulo}</b><div className="muted" style={{ fontSize: 12 }}>{s.detalle}</div></div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {gps.error && <div className="cap-alerta"><Icono n="info" s={16} /> {gps.error}</div>}

                  <div className="cap-mapa">
                    <MapaCaptura punto={f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : null} precision={f.precision} puntos={puntos} enfoque={enfoque}
                      onPunto={(lat, lng) => { pararGps.current(); setGps({ buscando: false, precision: null, error: null }); ubicar(lat, lng, 'mapa', null); }} />
                    {f.lat != null && f.lng != null && (
                      <BotonPantallaCompleta href={`/mapa?${new URLSearchParams({ tipo: 'punto', lat: String(f.lat), lng: String(f.lng), titulo: 'Ubicación capturada' })}`} compacto />
                    )}
                    <div className="cap-coord">
                      {f.lat != null && f.lng != null ? (
                        <>
                          <span className="num"><b>{f.lat.toFixed(6)}, {f.lng!.toFixed(6)}</b></span>
                          {f.precision != null && <span className="num" style={{ color: precisionColor, fontWeight: 700 }}>±{f.precision} m</span>}
                        </>
                      ) : <span className="muted">Toca el mapa o usa el GPS para fijar la ubicación · arrastra el pin para ajustar</span>}
                    </div>
                  </div>
                  {errores.lat && <div className="cap-error">{errores.lat}</div>}

                  {detectado?.calle && (
                    <div className="cap-detectado">
                      <Icono n="mapa" s={16} />
                      <span>
                        <b>{detectado.calle}{detectado.numero ? ` ${detectado.numero}` : ''}</b>
                        {detectado.entre.length > 0 && <> entre <b>{detectado.entre.join(' y ')}</b></>}
                        {detectado.colonia && <> · Col. {detectado.colonia}</>}
                      </span>
                    </div>
                  )}

                  <div className="cap-campos">
                    <Campo etq="Calle y número" ancho><input className="input" value={f.domicilio} onChange={(e) => set('domicilio', e.target.value)} placeholder="Ej. Av. Morelos 1050 Pte." /></Campo>
                    <Campo etq="Entre calles" ancho><input className="input" value={f.entreCalles} onChange={(e) => set('entreCalles', e.target.value)} placeholder="Ej. Calle Cepeda y Calle Rodríguez" /></Campo>
                    <Campo etq="Colonia"><input className="input" value={f.colonia} onChange={(e) => set('colonia', e.target.value)} /></Campo>
                    <Campo etq="Municipio">
                      <select className="select" value={f.municipio} onChange={(e) => set('municipio', e.target.value)}>
                        {MUNICIPIOS.map((m) => <option key={m.nombre} value={m.nombre}>{m.nombre}, {m.estado}</option>)}
                      </select>
                    </Campo>
                  </div>
                </div>
              </section>

              {/* Paso 3 — Situación laboral */}
              <section className="panel">
                <div className="panel-h"><h3><Paso n={3} />Situación laboral</h3></div>
                <div className="panel-b">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ESTATUS_LABORAL.map((s) => (
                      <button key={s} className={`chip grande ${f.estatus === s ? 'on' : ''}`} onClick={() => set('estatus', s)}>
                        <span className="dot" style={{ '--c': ESTATUS_INFO[s].color } as React.CSSProperties} />
                        {ESTATUS_INFO[s].etiqueta}
                      </button>
                    ))}
                  </div>
                  {empleado && (
                    <div className="cap-campos" style={{ marginTop: 12 }}>
                      <Campo etq="Sector" ancho>
                        <select className="select" value={f.sector ?? ''} onChange={(e) => set('sector', e.target.value || null)}>
                          <option value="">Selecciona…</option>
                          {SECTORES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </Campo>
                      <Campo etq="Empresa"><input className="input" value={f.empresa ?? ''} onChange={(e) => set('empresa', e.target.value)} /></Campo>
                      <Campo etq="Puesto"><input className="input" value={f.puesto ?? ''} onChange={(e) => set('puesto', e.target.value)} /></Campo>
                      <Campo etq="Ingreso mensual" ancho grupo>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {RANGOS_INGRESO.map((r) => (
                            <button key={r} className={`chip ${f.rangoIngreso === r ? 'on' : ''}`} onClick={() => set('rangoIngreso', f.rangoIngreso === r ? null : r)}>{r}</button>
                          ))}
                        </div>
                      </Campo>
                    </div>
                  )}
                </div>
              </section>

              {/* Paso 4 — Vinculación */}
              <section className="panel">
                <div className="panel-h"><h3><Paso n={4} />Vinculación con la institución</h3></div>
                <div className="panel-b" style={{ display: 'grid', gap: 14 }}>
                  <div className="cap-fila">
                    <span>¿Interés en posgrado o educación continua?</span>
                    <div className="seg">
                      <button className={f.interesPosgrado ? 'on' : ''} onClick={() => set('interesPosgrado', true)}>Sí</button>
                      <button className={!f.interesPosgrado ? 'on' : ''} onClick={() => set('interesPosgrado', false)}>No</button>
                    </div>
                  </div>
                  <div className="cap-fila">
                    <span>Actividades institucionales en el último año</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button className="btn" style={{ width: 40, padding: 0 }} onClick={() => set('participaciones', Math.max(0, f.participaciones - 1))} aria-label="Menos">−</button>
                      <b className="num" style={{ width: 26, textAlign: 'center', fontSize: 17 }}>{f.participaciones}</b>
                      <button className="btn" style={{ width: 40, padding: 0 }} onClick={() => set('participaciones', Math.min(20, f.participaciones + 1))} aria-label="Más">+</button>
                    </div>
                  </div>
                  <div>
                    <div className="campo-t">Aportaciones a la comunidad</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {APORTACIONES.map((a) => {
                        const on = f.aportaciones.includes(a);
                        return (
                          <button key={a} className={`chip grande ${on ? 'on' : ''}`} onClick={() => set('aportaciones', on ? f.aportaciones.filter((x) => x !== a) : [...f.aportaciones, a])}>
                            {on && <Icono n="check" s={13} w={2.4} />}{a}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="campo-t">¿Qué tan probable es que recomiende la institución? (0–10)</div>
                    <div className="cap-nps">
                      {Array.from({ length: 11 }, (_, n) => {
                        const c = n <= 6 ? 'var(--bad)' : n <= 8 ? 'var(--warn)' : 'var(--ok)';
                        const on = f.nps === n;
                        return (
                          <button key={n} className="num" onClick={() => set('nps', on ? null : n)}
                            style={{ borderColor: on ? c : undefined, background: on ? c : undefined, color: on ? '#fff' : undefined }}>{n}</button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* Paso 5 — Contacto */}
              <section className="panel">
                <div className="panel-h"><h3><Paso n={5} />Contacto y observaciones</h3></div>
                <div className="panel-b cap-campos">
                  <Campo etq="Teléfono celular"><input className="input num" type="tel" inputMode="tel" value={f.telefono} onChange={(e) => set('telefono', e.target.value.replace(/[^\d]/g, '').slice(0, 12))} /></Campo>
                  <Campo etq="Correo electrónico"><input className="input" type="email" inputMode="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Campo>
                  <Campo etq="Observaciones de la visita" ancho><textarea className="input" rows={2} value={f.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Opcional" /></Campo>
                </div>
              </section>

              {/* Pie fijo: IVE en vivo y guardado */}
              <div className="cap-pie">
                <div style={{ minWidth: 0 }}>
                  <div className="eyebrow">IVE resultante</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <b className="num" style={{ fontSize: 22, color: NIVEL_INFO[ive.nivel].color, lineHeight: 1 }}>{ive.v.toFixed(1)}</b>
                    <NivelBadge nivel={ive.nivel} corto />
                    {base && <span className="num" style={{ fontSize: 12, fontWeight: 700, color: ive.v >= base.ive ? 'var(--ok)' : 'var(--bad)' }}>{ive.v >= base.ive ? '▲' : '▼'} {Math.abs(ive.v - base.ive).toFixed(1)}</span>}
                  </div>
                </div>
                <button className="btn primary" style={{ height: 48, padding: '0 22px', fontSize: 14.5 }} onClick={guardar}>
                  <Icono n="check" s={18} w={2.4} /> Guardar captura
                </button>
              </div>
            </>
          )}
        </div>

        {/* Columna lateral: sincronización y avance del día */}
        <aside style={{ display: 'grid', gap: 14, alignContent: 'start', minWidth: 0 }}>
          <section className="panel">
            <div className="panel-h">
              <h3>Capturas del dispositivo</h3>
              <button className="btn sm" onClick={() => sincronizar().then((n) => { refrescarServidor(); avisar(n ? `${n} captura${n > 1 ? 's' : ''} sincronizada${n > 1 ? 's' : ''}` : enLinea ? 'Todo está sincronizado' : 'Sin conexión'); })} disabled={!enLinea}>
                <Icono n="reset" s={14} /> Sincronizar
              </button>
            </div>
            <div className="panel-b">
              <div className="cap-kpis">
                <div><b className="num" style={{ color: 'var(--warn)' }}>{pendientes}</b><span>Por enviar</span></div>
                <div><b className="num" style={{ color: 'var(--ok)' }}>{sincronizadas}</b><span>Enviadas</span></div>
                <div><b className="num" style={{ color: rechazadas ? 'var(--bad)' : 'var(--muted)' }}>{rechazadas}</b><span>Con error</span></div>
              </div>
              {cola.length === 0 ? (
                <div className="vacio">Aún no hay capturas en este dispositivo. Se guardan aquí aunque no haya señal y se envían solas al recuperar la conexión.</div>
              ) : (
                <ol className="cap-cola scroll">
                  {cola.map((x) => (
                    <li key={x.captura.uuid}>
                      <span className="dot" style={{ '--c': COLOR_ESTADO[x.estado], marginTop: 5 } as React.CSSProperties} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 650, fontSize: 13 }}>{x.captura.nombre} {x.captura.apellidoPaterno}</div>
                        <div className="muted" style={{ fontSize: 11.5 }}>
                          {x.captura.matricula} · {haceCuanto(x.captura.capturadoEn)} · <span style={{ color: COLOR_ESTADO[x.estado], fontWeight: 700 }}>{ETQ_ESTADO[x.estado]}</span>
                          {x.resultado && <> · {x.resultado.tipo === 'alta' ? 'Alta' : 'Actualización'} · IVE {x.resultado.iveDespues.toFixed(1)}</>}
                        </div>
                        {x.error && x.estado !== 'sincronizada' && <div style={{ fontSize: 11.5, color: x.estado === 'rechazada' ? 'var(--bad)' : 'var(--muted)' }}>{x.error}</div>}
                        {x.estado === 'rechazada' && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                            <button className="btn sm" onClick={() => reintentar(x.captura.uuid)}>Reintentar</button>
                            <button className="btn sm ghost" onClick={() => descartar(x.captura.uuid)}>Descartar</button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-h"><h3>Hoy en campo</h3>{servidor && <span className="vivo">Equipo</span>}</div>
            <div className="panel-b">
              {!servidor ? (
                <div className="vacio">{enLinea ? 'Cargando…' : 'Disponible al recuperar la conexión.'}</div>
              ) : (
                <>
                  <div className="cap-kpis">
                    <div><b className="num">{fmtN(servidor.hoy.total)}</b><span>Visitas</span></div>
                    <div><b className="num">{fmtN(servidor.hoy.altas)}</b><span>Altas</span></div>
                    <div><b className="num">{servidor.hoy.total ? Math.round((servidor.hoy.conGps / servidor.hoy.total) * 100) : 0}%</b><span>Con GPS</span></div>
                  </div>
                  {servidor.hoy.porEncuestador.map((p) => (
                    <div key={p.encuestador} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, fontSize: 12.5, marginTop: 8 }}>
                      <span style={{ fontWeight: p.encuestador === encuestador ? 800 : 500 }}>{p.encuestador}</span>
                      <b className="num">{p.total}</b>
                      <div style={{ gridColumn: 'span 2', height: 5, borderRadius: 9, background: 'var(--panel-3)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(p.total / servidor.hoy.porEncuestador[0].total) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
                      </div>
                    </div>
                  ))}
                  {servidor.capturas.length > 0 && (
                    <>
                      <div className="eyebrow" style={{ marginTop: 16, marginBottom: 6 }}>Últimas del equipo</div>
                      {servidor.capturas.slice(0, 6).map((c) => (
                        <a key={c.uuid} href={`/callcenter?q=${encodeURIComponent(c.matricula)}`} className="cap-ult">
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>{c.nombreEgresado}</b> <span className="muted">· {c.encuestador.split(' ')[0]}</span></span>
                          <span className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{haceCuanto(c.capturadoEn)}</span>
                        </a>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </section>
        </aside>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Paso({ n }: { n: number }) {
  return <span className="paso num">{n}</span>;
}

function Campo({ etq, err, ancho, grupo, children }: { etq: string; err?: string; ancho?: boolean; grupo?: boolean; children: React.ReactNode }) {
  // Los grupos de botones van en <div>: dentro de <label> un clic en el texto activaría el primer botón
  const Tag = grupo ? 'div' : 'label';
  return (
    <Tag className={`campo ${err ? 'con-error' : ''}`} style={ancho ? { gridColumn: '1 / -1' } : undefined} data-error={err ? 1 : undefined}>
      {etq}
      {children}
      {err && <span className="cap-error">{err}</span>}
    </Tag>
  );
}
