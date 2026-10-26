'use client';
// Cola offline de la App de Campo: las capturas se guardan primero en el dispositivo y se envían en cuanto hay conexión.
// Cada captura lleva un uuid generado aquí, así que reenviarla nunca la duplica en el servidor.
import { useSyncExternalStore } from 'react';
import type { CapturaCampo, CapturaRegistrada } from './tipos';

export interface ItemCola {
  captura: CapturaCampo;
  estado: 'pendiente' | 'enviando' | 'sincronizada' | 'rechazada';
  intentos: number;
  error?: string;
  resultado?: CapturaRegistrada;
}

const K = 'mivse.campo.cola';
const MAX_HISTORIAL = 40;
const VACIA: ItemCola[] = [];
let cache: ItemCola[] | null = null;
const oyentes = new Set<() => void>();

function leer(): ItemCola[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(K) ?? '[]') as ItemCola[];
    // Un envío interrumpido (app cerrada) vuelve a quedar pendiente
    for (const x of cache) if (x.estado === 'enviando') x.estado = 'pendiente';
  } catch {
    cache = [];
  }
  return cache;
}

function escribir(xs: ItemCola[]) {
  // Se conservan todas las pendientes y sólo las últimas sincronizadas
  let sinc = 0;
  cache = xs.filter((x) => x.estado !== 'sincronizada' || ++sinc <= MAX_HISTORIAL);
  try {
    localStorage.setItem(K, JSON.stringify(cache));
  } catch {}
  oyentes.forEach((f) => f());
}

const actualizar = (uuid: string, cambio: Partial<ItemCola>) => escribir(leer().map((x) => (x.captura.uuid === uuid ? { ...x, ...cambio } : x)));

export function nuevoUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function encolar(c: CapturaCampo) {
  escribir([{ captura: c, estado: 'pendiente', intentos: 0 }, ...leer()]);
  void sincronizar();
}

export function descartar(uuid: string) {
  escribir(leer().filter((x) => x.captura.uuid !== uuid));
}

export function reintentar(uuid: string) {
  actualizar(uuid, { estado: 'pendiente', error: undefined });
  void sincronizar();
}

let enCurso: Promise<number> | null = null;

/** Envía las capturas pendientes, la más antigua primero. Devuelve cuántas se sincronizaron. */
export function sincronizar(): Promise<number> {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    let ok = 0;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
    const pendientes = leer().filter((x) => x.estado === 'pendiente').reverse();
    for (const it of pendientes) {
      actualizar(it.captura.uuid, { estado: 'enviando' });
      try {
        const r = await fetch('/api/capturas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(it.captura) });
        if (r.ok) {
          const { captura } = (await r.json()) as { captura: CapturaRegistrada };
          actualizar(it.captura.uuid, { estado: 'sincronizada', resultado: captura, error: undefined });
          ok++;
        } else if (r.status >= 400 && r.status < 500) {
          // Datos inválidos: no se reintenta automáticamente
          const e = await r.json().catch(() => ({}));
          actualizar(it.captura.uuid, { estado: 'rechazada', intentos: it.intentos + 1, error: e.error ?? `Error ${r.status}` });
        } else {
          actualizar(it.captura.uuid, { estado: 'pendiente', intentos: it.intentos + 1, error: `Servidor no disponible (${r.status})` });
          break;
        }
      } catch {
        // Sin red: queda pendiente para el siguiente intento
        actualizar(it.captura.uuid, { estado: 'pendiente', intentos: it.intentos + 1, error: 'Sin conexión' });
        break;
      }
    }
    return ok;
  })().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

/** Estado de la cola, reactivo entre componentes. */
export function useCola(): ItemCola[] {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      const otraPestana = (e: StorageEvent) => {
        if (e.key === K) {
          cache = null;
          f();
        }
      };
      window.addEventListener('storage', otraPestana);
      return () => {
        oyentes.delete(f);
        window.removeEventListener('storage', otraPestana);
      };
    },
    leer,
    () => VACIA,
  );
}

export function useEnLinea(): boolean {
  return useSyncExternalStore(
    (f) => {
      window.addEventListener('online', f);
      window.addEventListener('offline', f);
      return () => {
        window.removeEventListener('online', f);
        window.removeEventListener('offline', f);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
