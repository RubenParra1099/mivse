// Cálculos del tablero en el navegador: IVE con pesos simulables, filtrado cruzado e indicadores.
import { calcularIVE, nivelDe, type MetaId, type Pesos } from './ive';
import { NIVELES, type EstatusLaboral } from './catalogos';
import type { DatasetTablero } from './tipos';

export const DIMS = ['gen', 'car', 'sec', 'ing', 'lab', 'niv', 'edo', 'mun'] as const;
export type Dim = (typeof DIMS)[number];
export type Filtros = Record<Dim, number[]>;
export const FILTROS_VACIOS: Filtros = { gen: [], car: [], sec: [], ing: [], lab: [], niv: [], edo: [], mun: [] };

export interface Calculado {
  ive: Float32Array;
  niv: Uint8Array;
}

export function calcularTodo(d: DatasetTablero, pesos: Pesos): Calculado {
  const n = d.total;
  const ive = new Float32Array(n);
  const niv = new Uint8Array(n);
  const c = d.col;
  for (let i = 0; i < n; i++) {
    const v = calcularIVE(
      {
        estatus: d.dict.estatus[c.lab[i]] as EstatusLaboral,
        diasActualizacion: c.act[i] < 0 ? null : c.act[i],
        participaciones: c.par[i],
        interesPosgrado: c.pos[i] === 1,
        aportaciones: c.apo[i],
        nps: c.nps[i] < 0 ? null : c.nps[i],
      },
      pesos,
    );
    ive[i] = v;
    niv[i] = NIVELES.indexOf(nivelDe(v));
  }
  return { ive, niv };
}

/** Valor de la dimensión para la fila i (generación se guarda como año). */
export function valorDim(d: DatasetTablero, calc: Calculado, dim: Dim, i: number): number {
  switch (dim) {
    case 'gen': return d.col.gen[i];
    case 'car': return d.col.car[i];
    case 'sec': return d.col.sec[i];
    case 'ing': return d.col.ing[i];
    case 'lab': return d.col.lab[i];
    case 'niv': return calc.niv[i];
    case 'edo': return d.col.edo[i];
    case 'mun': return d.col.mun[i];
  }
}

/** Índices que cumplen todos los filtros, opcionalmente ignorando una dimensión (para resaltar la selección propia). */
export function filtrar(d: DatasetTablero, calc: Calculado, f: Filtros, excepto: Dim | Dim[] = []): number[] {
  const ex = new Set<Dim>(Array.isArray(excepto) ? excepto : [excepto]);
  const activos = DIMS.filter((k) => !ex.has(k) && f[k].length).map((k) => [k, new Set(f[k])] as const);
  const out: number[] = [];
  for (let i = 0; i < d.total; i++) {
    let ok = true;
    for (const [k, s] of activos) {
      if (!s.has(valorDim(d, calc, k, i))) { ok = false; break; }
    }
    if (ok) out.push(i);
  }
  return out;
}

export interface Indicadores {
  n: number;
  contactados: number;
  ive: number;
  valores: Record<MetaId, number>;
  /** Egresados adicionales necesarios para alcanzar cada meta porcentual. */
  faltan: Partial<Record<MetaId, number>>;
  niveles: number[];
  gpsCampo: number;
  conGeo: number;
}

export function indicadores(d: DatasetTablero, calc: Calculado, idx: number[]): Indicadores {
  const c = d.col;
  let con = 0, act = 0, par = 0, ret = 0, pro = 0, det = 0, resp = 0, sIve = 0, gps = 0, geo = 0;
  const niveles = [0, 0, 0, 0];
  for (const i of idx) {
    sIve += calc.ive[i];
    niveles[calc.niv[i]]++;
    if (c.act[i] >= 0 && c.act[i] <= 365) act++;
    if (c.geo[i] === 1) gps++;
    if (c.geo[i] > 0) geo++;
    if (c.con[i]) {
      con++;
      if (c.par[i] > 0) par++;
      if (calc.niv[i] >= 2) ret++;
    }
    if (c.nps[i] >= 0) {
      resp++;
      if (c.nps[i] >= 9) pro++;
      else if (c.nps[i] <= 6) det++;
    }
  }
  const n = idx.length;
  const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
  const falta = (meta: number, a: number, b: number) => Math.max(0, Math.ceil((meta / 100) * b - a));
  return {
    n,
    contactados: con,
    ive: n ? sIve / n : 0,
    valores: {
      cobertura: pct(con, n),
      actualizacion: pct(act, n),
      participacion: pct(par, con),
      retencion: pct(ret, con),
      nps: resp ? ((pro - det) / resp) * 100 : 0,
    },
    faltan: {
      cobertura: falta(90, con, n),
      actualizacion: falta(80, act, n),
      participacion: falta(50, par, con),
      retencion: falta(40, ret, con),
    },
    niveles,
    gpsCampo: gps,
    conGeo: geo,
  };
}

/** Conteo y promedio de IVE agrupados por una dimensión. */
export function agrupar(d: DatasetTablero, calc: Calculado, idx: number[], dim: Dim) {
  const m = new Map<number, { n: number; ive: number; niveles: number[] }>();
  for (const i of idx) {
    const k = valorDim(d, calc, dim, i);
    let g = m.get(k);
    if (!g) m.set(k, (g = { n: 0, ive: 0, niveles: [0, 0, 0, 0] }));
    g.n++;
    g.ive += calc.ive[i];
    g.niveles[calc.niv[i]]++;
  }
  for (const g of m.values()) g.ive = g.n ? g.ive / g.n : 0;
  return m;
}
