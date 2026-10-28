// Descarga de OpenStreetMap (Overpass) la red vial de las ciudades donde radican egresados fuera de la Comarca Lagunera
// y la guarda en public/data/red-vial/<ciudad>.txt con el mismo formato que red-vial.txt. El mapa las carga al acercarse.
//   npm run red-vial              → genera las ciudades que falten
//   npm run red-vial -- --todas   → vuelve a descargarlas todas
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { MUNICIPIOS } from '../src/lib/catalogos';

const DIR = 'public/data/red-vial';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
// Cobertura de public/data/red-vial.txt (Comarca Lagunera); las ciudades dentro ya tienen calles
const LAGUNA = { s: 25.31, n: 26.1, w: -103.72, e: -102.87 };
// Jerarquía 0–4, igual que el mapa base: vías rápidas, primarias, secundarias, terciarias y calles locales
const CLASE: Record<string, number> = {
  motorway: 0, motorway_link: 0, trunk: 0, trunk_link: 0,
  primary: 1, primary_link: 1,
  secondary: 2, secondary_link: 2,
  tertiary: 3, tertiary_link: 3,
  residential: 4, unclassified: 4, living_street: 4,
};

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '-');

interface Via { tags?: { highway?: string; name?: string }; geometry?: { lat: number; lon: number }[] }

/** Douglas-Peucker sobre enteros ×1e5; tolerancia en las mismas unidades (≈ 1 m). */
function simplificar(p: [number, number][], tol: number): [number, number][] {
  if (p.length < 3) return p;
  const marca = new Uint8Array(p.length);
  marca[0] = marca[p.length - 1] = 1;
  const pila: [number, number][] = [[0, p.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop()!;
    const [ax, ay] = p[a], [bx, by] = p[b];
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
    let max = 0, k = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (p[i][0] - ax) - dx * (p[i][1] - ay)) / l;
      if (d > max) { max = d; k = i; }
    }
    if (max > tol) { marca[k] = 1; pila.push([a, k], [k, b]); }
  }
  return p.filter((_, i) => marca[i]);
}

async function consultar(q: string): Promise<Via[]> {
  for (let intento = 1; ; intento++) {
    const r = await fetch(OVERPASS, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'mivse-red-vial/1.0' },
      body: 'data=' + encodeURIComponent(q),
    });
    if (r.ok) return ((await r.json()) as { elements: Via[] }).elements;
    if (intento >= 4) throw new Error(`Overpass respondió ${r.status}`);
    console.log(`  Overpass ${r.status}, reintento en ${intento * 20} s…`);
    await new Promise((ok) => setTimeout(ok, intento * 20_000));
  }
}

async function main() {
  const todas = process.argv.includes('--todas');
  mkdirSync(DIR, { recursive: true });
  const indice: { id: string; nombre: string; bbox: [number, number, number, number] }[] = [];

  for (const m of MUNICIPIOS) {
    if (m.lat >= LAGUNA.s && m.lat <= LAGUNA.n && m.lng >= LAGUNA.w && m.lng <= LAGUNA.e) continue;
    // Los egresados se generan con dispersión normal r (lat) y 1.15·r (lng): 3σ cubre prácticamente a todos
    const dLat = Math.max(0.05, 3 * m.r), dLng = Math.max(0.06, 3 * m.r * 1.15);
    const bbox: [number, number, number, number] = [+(m.lat - dLat).toFixed(4), +(m.lng - dLng).toFixed(4), +(m.lat + dLat).toFixed(4), +(m.lng + dLng).toFixed(4)];
    const id = slug(m.nombre);
    indice.push({ id, nombre: m.nombre, bbox });
    const archivo = `${DIR}/${id}.txt`;
    if (!todas && existsSync(archivo)) { console.log(`${m.nombre}: ya existe`); continue; }

    console.log(`${m.nombre}: descargando…`);
    const vias = await consultar(`[out:json][timeout:180];way[highway~"^(${Object.keys(CLASE).join('|')})$"](${bbox.join(',')});out tags geom;`);
    const nombres = new Map<string, number>();
    const lineas: string[] = [];
    for (const v of vias) {
      const c = CLASE[v.tags?.highway ?? ''];
      if (c == null || !v.geometry || v.geometry.length < 2) continue;
      const pts = simplificar(v.geometry.map((g) => [Math.round(g.lon * 1e5), Math.round(g.lat * 1e5)]), 1.5);
      // Igual que la red de La Laguna, sólo las vías principales (0–3) llevan nombre para el resaltado al pasar el cursor
      const nm = c < 4 ? v.tags?.name?.trim() : undefined;
      let ni = 0;
      if (nm) {
        if (!nombres.has(nm)) nombres.set(nm, nombres.size + 1);
        ni = nombres.get(nm)!;
      }
      const d: number[] = [pts[0][0], pts[0][1]];
      for (let i = 1; i < pts.length; i++) d.push(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lineas.push(`${c}|${ni}|${d.join(',')}`);
    }
    lineas.sort((a, b) => +a[0] - +b[0]);
    writeFileSync(archivo, JSON.stringify([...nombres.keys()]) + '\n' + lineas.join('\n') + '\n');
    console.log(`  ${lineas.length.toLocaleString('es-MX')} vialidades`);
    await new Promise((ok) => setTimeout(ok, 5_000)); // respetar el límite de uso de Overpass
  }

  writeFileSync(`${DIR}/indice.json`, JSON.stringify(indice));
  console.log(`Índice con ${indice.length} ciudades en ${DIR}/indice.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
