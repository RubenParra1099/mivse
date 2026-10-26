'use client';
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTema } from '@/hooks/useTema';

echarts.use([BarChart, HeatmapChart, PieChart, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

export type Opcion = echarts.EChartsCoreOption;

/** Envoltura de ECharts. `construir` recibe los tokens del tema para colorear ejes y textos. */
export function Grafica({
  construir, alto = 280, onClick, deps,
}: {
  construir: (t: { fg: string; muted: string; line: string; panel: string }) => Opcion;
  alto?: number;
  onClick?: (p: { name: string; dataIndex: number; seriesIndex?: number; value: unknown; data: unknown }) => void;
  deps: unknown[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const clic = useRef(onClick);
  clic.current = onClick;
  const tema = useTema();

  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chart.current = c;
    c.on('click', (p) => clic.current?.(p as never));
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    const v = (n: string) => s.getPropertyValue(n).trim();
    const t = { fg: v('--fg'), muted: v('--muted'), line: v('--line'), panel: v('--panel') };
    const base: Opcion = {
      textStyle: { fontFamily: 'inherit', color: t.fg },
      animationDuration: 500,
      tooltip: {
        backgroundColor: t.panel, borderColor: t.line, textStyle: { color: t.fg, fontSize: 12 },
        extraCssText: 'border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25)',
      },
    };
    const o = construir(t);
    chart.current?.setOption({ ...base, ...o, tooltip: { ...(base.tooltip as object), ...((o.tooltip as object) ?? {}) } }, true);
  }, [tema, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} style={{ height: alto, width: '100%' }} />;
}
