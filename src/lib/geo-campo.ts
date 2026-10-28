'use client';
// Geolocalización de la App de Campo: GPS del dispositivo, calle y entre calles a partir de la red vial local
// (funciona sin conexión) y, con conexión, colonia y búsqueda de direcciones con Nominatim (OpenStreetMap).
import { MUNICIPIOS } from './catalogos';
import { cargarRed } from './mapa-base';
import { normalizar } from './busqueda';

type P = [number, number]; // [lat, lng]
type Seg = [string, P, P];

const G = 0.002; // celda de ~200 m
let indice: Promise<Map<string, Seg[]>> | null = null;

function cargarIndice() {
  if (!indice) {
    indice = cargarRed().then((R) => {
      const malla = new Map<string, Seg[]>();
      for (const [, nm, pts] of R.nombradas) {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i];
          for (let x = Math.floor(Math.min(a[1], b[1]) / G); x <= Math.floor(Math.max(a[1], b[1]) / G); x++)
            for (let y = Math.floor(Math.min(a[0], b[0]) / G); y <= Math.floor(Math.max(a[0], b[0]) / G); y++) {
              const k = x + ',' + y;
              let cl = malla.get(k);
              if (!cl) malla.set(k, (cl = []));
              cl.push([nm, a, b]);
            }
        }
      }
      return malla;
    });
  }
  return indice;
}

export interface CallesCercanas {
  /** Vialidad con nombre más cercana (≤ 120 m). */
  calle: string | null;
  /** Hasta dos cruces, uno a cada lado sobre la calle. */
  entre: string[];
  distancia: number | null;
}

/** Calle sobre la que está el punto y sus dos cruces más cercanos (uno hacia cada sentido). */
export async function callesCercanas(lat: number, lng: number): Promise<CallesCercanas> {
  const malla = await cargarIndice();
  // Proyección local en metros alrededor del punto
  const kx = Math.cos((lat * Math.PI) / 180) * 111320, ky = 110540;
  const m = (q: P): [number, number] => [(q[1] - lng) * kx, (q[0] - lat) * ky];

  const cx = Math.floor(lng / G), cy = Math.floor(lat / G);
  const segs: [string, [number, number], [number, number]][] = [];
  const vistos = new Set<Seg>();
  for (let x = cx - 3; x <= cx + 3; x++)
    for (let y = cy - 3; y <= cy + 3; y++)
      for (const s of malla.get(x + ',' + y) ?? []) {
        if (vistos.has(s)) continue;
        vistos.add(s);
        segs.push([s[0], m(s[1]), m(s[2])]);
      }

  // 1. Calle más cercana y su dirección en ese punto
  let calle: string | null = null, bd = 120, t: [number, number] = [1, 0];
  for (const [nm, a, b] of segs) {
    const d = distOrigen(a, b);
    if (d < bd) {
      bd = d;
      calle = nm;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    }
  }
  if (!calle) return { calle: null, entre: [], distancia: null };

  // 2. Cruces: otras calles que intersectan a la calle; se elige el más cercano a cada lado del punto
  const propios = segs.filter((s) => s[0] === calle);
  const mejor = { pos: [Infinity, ''] as [number, string], neg: [Infinity, ''] as [number, string] };
  for (const [nm, a, b] of segs) {
    if (nm === calle || normalizar(nm) === normalizar(calle)) continue;
    for (const [, c, d] of propios) {
      const X = cruce(a, b, c, d);
      if (!X) continue;
      const s = X[0] * t[0] + X[1] * t[1];
      if (Math.abs(s) < 4) continue; // el punto está justo en la esquina
      const lado = s > 0 ? mejor.pos : mejor.neg;
      if (Math.abs(s) < lado[0]) { lado[0] = Math.abs(s); lado[1] = nm; }
    }
  }
  const entre = [mejor.neg[1], mejor.pos[1]].filter((x) => x && x !== calle);
  return { calle, entre: [...new Set(entre)], distancia: Math.round(bd) };
}

/** Distancia del origen (el punto capturado) al segmento a-b, en metros. */
function distOrigen(a: [number, number], b: [number, number]) {
  const bx = b[0] - a[0], by = b[1] - a[1];
  const u = Math.max(0, Math.min(1, (-a[0] * bx - a[1] * by) / (bx * bx + by * by || 1)));
  return Math.hypot(a[0] + u * bx, a[1] + u * by);
}

/** Intersección de dos segmentos (o unión en un extremo, tolerancia 3 m). */
function cruce(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): [number, number] | null {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) > 1e-9) {
    const u = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
    const v = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    if (u >= -0.001 && u <= 1.001 && v >= -0.001 && v <= 1.001) return [a[0] + u * r[0], a[1] + u * r[1]];
  }
  for (const p of [a, b]) for (const q of [c, d]) if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 3) return p;
  return null;
}

/** Municipio del catálogo más cercano al punto. */
export function municipioCercano(lat: number, lng: number): string {
  let mejor: string = MUNICIPIOS[0].nombre, bd = Infinity;
  for (const m of MUNICIPIOS) {
    const d = Math.hypot((m.lat - lat) * 111, (m.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180));
    if (d < bd) { bd = d; mejor = m.nombre; }
  }
  return mejor;
}

/** Municipio del catálogo cuyo nombre coincide con el texto de Nominatim. */
function municipioPorNombre(...nombres: (string | undefined)[]): string | null {
  for (const n of nombres) {
    if (!n) continue;
    const k = normalizar(n);
    const m = MUNICIPIOS.find((x) => normalizar(x.nombre) === k);
    if (m) return m.nombre;
  }
  return null;
}

export interface Direccion {
  calle: string | null;
  numero: string | null;
  colonia: string | null;
  municipio: string | null;
  cp: string | null;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/** Geocodificación inversa (requiere conexión). */
export async function direccionDe(lat: number, lng: number, signal?: AbortSignal): Promise<Direccion | null> {
  try {
    const r = await fetch(`${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`, { signal });
    if (!r.ok) return null;
    const a = (await r.json()).address ?? {};
    return {
      calle: a.road ?? a.pedestrian ?? null,
      numero: a.house_number ?? null,
      colonia: a.neighbourhood ?? a.suburb ?? a.quarter ?? a.residential ?? null,
      municipio: municipioPorNombre(a.city, a.town, a.municipality, a.county, a.village),
      cp: a.postcode ?? null,
    };
  } catch {
    return null;
  }
}

export interface Sugerencia {
  titulo: string;
  detalle: string;
  lat: number;
  lng: number;
}

/** Municipio de referencia para orientar la búsqueda. */
export interface Cerca {
  nombre: string;
  estado: string;
  lat: number;
  lng: number;
  r: number;
}

const PHOTON = 'https://photon.komoot.io/api/';

// Abreviaturas comunes en direcciones mexicanas → nombre como aparece en OpenStreetMap
const ABREVIATURAS: [RegExp, string][] = [
  [/\b(?:av|ave|avda)\.?(?=\s)/gi, 'Avenida'],
  [/\b(?:blvd|blvr|blv|bulevar|bulevard)\.?(?=\s)/gi, 'Boulevard'],
  [/\bprol\.?(?=\s)/gi, 'Prolongación'],
  [/\bcarr\.?(?=\s)/gi, 'Carretera'],
  [/\bcalz\.?(?=\s)/gi, 'Calzada'],
  [/\bpriv\.?(?=\s)/gi, 'Privada'],
  [/\bc\.(?=\s)/gi, 'Calle'],
  [/\bgral\.?(?=\s)/gi, 'General'],
  [/\bfco\.?(?=\s)/gi, 'Francisco'],
];

/**
 * Separa lo que escribe el encuestador ("Av. Morelos #1050 Col. Centro, C.P. 27000, esquina con Falcón")
 * en calle, número y colonia: el geocodificador exige que coincidan todas las palabras, así que
 * la colonia, el CP y los cruces se buscan por separado.
 */
export function desglosarDireccion(q: string) {
  let s = ` ${q} `;
  s = s.replace(/\b(?:esquina|esq\.?|entre|cruce con|casi esquina)\b.*$/i, ' ');
  s = s.replace(/\b(?:c\.?\s?p\.?|código postal)\s*:?\s*\d{5}\b/gi, ' ').replace(/\b\d{5}\b/g, ' ');
  let colonia: string | null = null;
  s = s.replace(/\b(?:col\.?|colonia|fracc\.?|fraccionamiento|barrio|ejido)\s+([^,]+)/i, (_, c: string) => {
    colonia = c.trim();
    return ' ';
  });
  for (const [re, v] of ABREVIATURAS) s = s.replace(re, v);
  s = s.replace(/(?:#|\bno\.?\s*|\bnúm\.?\s*|\bnum\.?\s*)(?=\d)/gi, ' ');
  const numero = s.match(/\b\d+[a-z]?\b/i)?.[0] ?? null;
  const partes = s.split(',').map((x) => x.trim()).filter(Boolean);
  const calle = (partes[0] ?? '').replace(/\b\d+[a-z]?\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const resto = partes.slice(1).join(', ');
  return { calle, numero, colonia: colonia as string | null, resto };
}

// Quita el municipio y el estado del texto (con o sin acentos) para no repetirlos en la consulta
const VOCALES: Record<string, string> = { a: '[aá]', e: '[eé]', i: '[ií]', o: '[oó]', u: '[uúü]', n: '[nñ]' };
const quitarLugar = (s: string, c?: Cerca) => {
  if (!c) return s;
  let x = s;
  for (const n of [c.nombre, c.estado]) {
    const patron = normalizar(n).split('').map((ch) => VOCALES[ch] ?? ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    x = x.replace(new RegExp(`(^|[\\s,])${patron}(?=$|[\\s,])`, 'gi'), ' ');
  }
  return x.replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim();
};

async function nominatim(q: string, signal: AbortSignal | undefined, caja: string): Promise<Sugerencia[]> {
  const url = `${NOMINATIM}/search?format=json&addressdetails=1&limit=6&countrycodes=mx&accept-language=es&viewbox=${caja}&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { signal });
  if (!r.ok) return [];
  const xs = (await r.json()) as { display_name: string; lat: string; lon: string }[];
  return xs.map((x) => {
    const partes = x.display_name.split(', ');
    return { titulo: partes.slice(0, 2).join(', '), detalle: partes.slice(2, 5).join(', '), lat: +x.lat, lng: +x.lon };
  });
}

/** Photon tolera palabras de más o faltantes, y da prioridad a lo cercano al municipio. */
async function photon(q: string, signal: AbortSignal | undefined, c: { lat: number; lng: number }): Promise<Sugerencia[]> {
  const r = await fetch(`${PHOTON}?limit=6&lat=${c.lat}&lon=${c.lng}&q=${encodeURIComponent(q)}`, { signal });
  if (!r.ok) return [];
  const { features } = (await r.json()) as {
    features: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[];
  };
  return features
    .filter((f) => !f.properties.countrycode || f.properties.countrycode === 'MX')
    .map((f) => {
      const p = f.properties;
      const nombre = [p.name ?? p.street, p.housenumber].filter(Boolean).join(' ');
      return {
        titulo: [nombre, p.district ?? p.locality].filter(Boolean).join(', ') || (p.city ?? ''),
        detalle: [p.city ?? p.county, p.state].filter(Boolean).join(', '),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      };
    });
}

/**
 * Búsqueda de direcciones (requiere conexión). Combina Nominatim y Photon alrededor del municipio
 * elegido y, si no hay coincidencias, reintenta solo con la calle y después con la colonia.
 */
export async function buscarDireccion(q: string, signal?: AbortSignal, cerca?: Cerca): Promise<Sugerencia[]> {
  const d = cerca ? Math.max(cerca.r * 4, 0.12) : 0;
  const caja = cerca ? `${cerca.lng - d},${cerca.lat + d},${cerca.lng + d},${cerca.lat - d}` : '-103.75,25.85,-103.05,25.35';
  const centro = cerca ?? { lat: 25.5428, lng: -103.4068 };
  const lugar = cerca ? `${cerca.nombre}, ${cerca.estado}` : '';
  const { calle, numero, colonia, resto } = desglosarDireccion(q);
  // Con municipio elegido, la consulta estricta usa ese municipio; lo escrito tras la coma (colonia, ciudad) solo orienta a Photon
  const donde = cerca ? lugar : resto;
  const extra = quitarLugar(resto, cerca);
  const calleBase = quitarLugar(calle, cerca) || calle;

  const intentos: [string, string][] = [];
  if (calleBase) {
    intentos.push([[calleBase, numero].filter(Boolean).join(' ') + (donde ? `, ${donde}` : ''), [calleBase, numero, colonia ?? extra, lugar].filter(Boolean).join(' ')]);
    if (numero || colonia) intentos.push([`${calleBase}${donde ? `, ${donde}` : ''}`, [calleBase, lugar].filter(Boolean).join(' ')]);
  }
  if (colonia) intentos.push([`${colonia}${donde ? `, ${donde}` : ''}`, [colonia, lugar].filter(Boolean).join(' ')]);
  if (!intentos.length) intentos.push([q, q]);

  for (const [qn, qp] of intentos) {
    const [a, b] = await Promise.all([
      nominatim(qn, signal, caja).catch((e) => { if (signal?.aborted) throw e; return []; }),
      photon(qp, signal, centro).catch((e) => { if (signal?.aborted) throw e; return []; }),
    ]);
    // Primero lo que cae cerca del municipio; sin duplicados (misma calle a < ~50 m)
    const lejos = (s: Sugerencia) => Math.hypot(s.lat - centro.lat, s.lng - centro.lng) > Math.max(d, 0.4);
    const out: Sugerencia[] = [];
    for (const s of [...a, ...b].sort((x, y) => Number(lejos(x)) - Number(lejos(y)))) {
      if (out.some((o) => Math.abs(o.lat - s.lat) < 0.0005 && Math.abs(o.lng - s.lng) < 0.0005)) continue;
      out.push(s);
    }
    if (out.length) return out.slice(0, 8);
  }
  return [];
}

/** Lectura del GPS: se queda con la lectura más precisa durante unos segundos. */
export function leerGPS(
  onLectura: (l: { lat: number; lng: number; precision: number; final: boolean }) => void,
  onError: (msg: string) => void,
  { objetivo = 15, maxMs = 15000 } = {},
): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError('Este dispositivo no tiene GPS disponible.');
    return () => {};
  }
  let mejor: GeolocationPosition | null = null;
  let fin = false;
  const terminar = () => {
    if (fin) return;
    fin = true;
    navigator.geolocation.clearWatch(id);
    clearTimeout(to);
    if (mejor) onLectura({ lat: mejor.coords.latitude, lng: mejor.coords.longitude, precision: mejor.coords.accuracy, final: true });
    else onError('No se pudo obtener la señal GPS. Intenta al aire libre o coloca el pin en el mapa.');
  };
  const id = navigator.geolocation.watchPosition(
    (p) => {
      if (fin) return;
      if (!mejor || p.coords.accuracy < mejor.coords.accuracy) mejor = p;
      onLectura({ lat: mejor.coords.latitude, lng: mejor.coords.longitude, precision: mejor.coords.accuracy, final: false });
      if (mejor.coords.accuracy <= objetivo) terminar();
    },
    (e) => {
      if (fin) return;
      if (mejor) return terminar();
      fin = true;
      navigator.geolocation.clearWatch(id);
      clearTimeout(to);
      onError(e.code === 1 ? 'Permiso de ubicación denegado. Actívalo en el navegador para capturar con GPS.' : 'No se pudo obtener la señal GPS. Intenta al aire libre o coloca el pin en el mapa.');
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: maxMs },
  );
  const to = setTimeout(terminar, maxMs);
  return () => {
    fin = true;
    navigator.geolocation.clearWatch(id);
    clearTimeout(to);
  };
}
