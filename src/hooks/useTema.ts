'use client';
import { useEffect, useState } from 'react';

export type Tema = 'dark' | 'light';

/** Tema actual (atributo data-theme de <html>) y tokens de color leídos del CSS. */
export function useTema() {
  const [tema, setTema] = useState<Tema>('dark');
  useEffect(() => {
    const el = document.documentElement;
    const leer = () => setTema((el.dataset.theme as Tema) || 'dark');
    leer();
    const mo = new MutationObserver(leer);
    mo.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return tema;
}

export function tokens() {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return { fg: v('--fg'), fg2: v('--fg-2'), muted: v('--muted'), line: v('--line'), panel: v('--panel'), panel2: v('--panel-2'), accent: v('--accent'), accent2: v('--accent-2') };
}
