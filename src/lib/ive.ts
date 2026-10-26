// Motor del Índice de Vinculación del Egresado (IVE) y de los indicadores institucionales.
// Se usa igual en el servidor (al guardar una llamada) y en el navegador (simulación de pesos del tablero).

import type { EstatusLaboral, Nivel } from './catalogos';

export interface EntradaIVE {
  estatus: EstatusLaboral;
  /** Días desde la última actualización de datos; null = nunca actualizado. */
  diasActualizacion: number | null;
  /** Participaciones en actividades institucionales en los últimos 12 meses. */
  participaciones: number;
  interesPosgrado: boolean;
  /** Número de tipos de aportación a la comunidad (mentoría, donación, oferta de empleo…). */
  aportaciones: number;
  /** Recomendación 0–10; null = no respondió. */
  nps: number | null;
}

export const COMPONENTES = [
  { id: 'laboral', etiqueta: 'Situación laboral', peso: 25, ayuda: 'Empleo o emprendimiento actual = 100; posgrado = 80; buscando empleo = 25' },
  { id: 'actualizacion', etiqueta: 'Datos al día', peso: 15, ayuda: '≤ 12 meses = 100; ≤ 24 meses = 50; más antiguo = 10' },
  { id: 'participacion', etiqueta: 'Participación', peso: 20, ayuda: '3 o más actividades en el último año = 100 (proporcional)' },
  { id: 'posgrado', etiqueta: 'Interés en posgrado', peso: 10, ayuda: 'Manifestó interés en educación continua o posgrado' },
  { id: 'comunidad', etiqueta: 'Aportación a la comunidad', peso: 15, ayuda: '2 o más tipos de aportación = 100 (proporcional)' },
  { id: 'recomendacion', etiqueta: 'Recomendación (NPS)', peso: 15, ayuda: 'Calificación 0–10 escalada a 0–100' },
] as const;
export type ComponenteId = (typeof COMPONENTES)[number]['id'];
export type Pesos = Record<ComponenteId, number>;

export const PESOS_BASE: Pesos = Object.fromEntries(COMPONENTES.map((c) => [c.id, c.peso])) as Pesos;

const LABORAL: Record<EstatusLaboral, number> = { empleado: 1, autoempleo: 1, estudiando: 0.8, desempleado: 0.25, sin_dato: 0 };

export function componentes(e: EntradaIVE): Record<ComponenteId, number> {
  const d = e.diasActualizacion;
  return {
    laboral: LABORAL[e.estatus] ?? 0,
    actualizacion: d == null ? 0 : d <= 365 ? 1 : d <= 730 ? 0.5 : 0.1,
    participacion: Math.min(e.participaciones / 3, 1),
    posgrado: e.interesPosgrado ? 1 : 0,
    comunidad: Math.min(e.aportaciones / 2, 1),
    recomendacion: e.nps == null ? 0 : e.nps / 10,
  };
}

export function calcularIVE(e: EntradaIVE, pesos: Pesos = PESOS_BASE): number {
  const c = componentes(e);
  let suma = 0;
  let total = 0;
  for (const k of Object.keys(pesos) as ComponenteId[]) {
    suma += c[k] * pesos[k];
    total += pesos[k];
  }
  return total ? Math.round((suma / total) * 1000) / 10 : 0;
}

export const UMBRALES_NIVEL = { ocasional: 30, activo: 58, embajador: 76 };

export function nivelDe(ive: number): Nivel {
  if (ive >= UMBRALES_NIVEL.embajador) return 'embajador';
  if (ive >= UMBRALES_NIVEL.activo) return 'activo';
  if (ive >= UMBRALES_NIVEL.ocasional) return 'ocasional';
  return 'desconectado';
}

// ─── Indicadores institucionales con metas y semáforo ──────────────────────

export const METAS = [
  { id: 'cobertura', etiqueta: 'Cobertura', meta: 90, unidad: '%', def: 'Egresados del censo con al menos un contacto efectivo' },
  { id: 'actualizacion', etiqueta: 'Actualización', meta: 80, unidad: '%', def: 'Egresados con datos actualizados en los últimos 12 meses' },
  { id: 'participacion', etiqueta: 'Participación', meta: 50, unidad: '%', def: 'Egresados contactados que participaron en ≥ 1 actividad en el año' },
  { id: 'retencion', etiqueta: 'Retención', meta: 40, unidad: '%', def: 'Egresados contactados en nivel Activo o Embajador' },
  { id: 'nps', etiqueta: 'Recomendación', meta: 60, unidad: 'NPS', def: '% promotores (9–10) menos % detractores (0–6)' },
] as const;
export type MetaId = (typeof METAS)[number]['id'];
export type Semaforo = 'verde' | 'amarillo' | 'rojo';

export const SEMAFORO_COLOR: Record<Semaforo, string> = { verde: '#22c55e', amarillo: '#eab308', rojo: '#ef4444' };

/** Verde: cumple la meta. Amarillo: a ≤ 15 % de alcanzarla (NPS: a ≤ 15 puntos). Rojo: por debajo. */
export function semaforo(id: MetaId, valor: number): Semaforo {
  const m = METAS.find((x) => x.id === id)!.meta;
  if (id === 'nps') return valor > m ? 'verde' : valor >= m - 15 ? 'amarillo' : 'rojo';
  return valor >= m ? 'verde' : valor >= m * 0.85 ? 'amarillo' : 'rojo';
}
