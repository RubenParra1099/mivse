# MIVSE · Call Center y Tablero de Control

Plataforma web de los **Módulos 2 y 3** del Modelo Integral de Vinculación y Seguimiento de Egresados.

| Ruta | Módulo |
|---|---|
| `/callcenter` | **Módulo 2 · Call Center**: buscador indexado (matrícula, nombre, carrera, estatus), expediente único, llamada `tel:` y WhatsApp Web con mensajes institucionales, flujo guiado de un toque que recalcula el nivel de vinculación (Desconectados, Ocasionales, Activos, Embajadores), cola priorizada y actividad en vivo. |
| `/tablero` | **Módulo 3 · Tablero de Control**: motor del IVE con pesos ajustables, semáforos de metas (Cobertura 90 %, Actualización 80 %, Participación 50 %, Retención 40 %, NPS > 60), mapa geoespacial (calor, clúster, puntos, municipios; escala municipal, regional y nacional), filtros cruzados y exportación a PDF/CSV. |

## Stack
Next.js 15 · React 19 · Postgres en **Neon** (`pg`) · Leaflet (+ markercluster, heat) con teselas CARTO · ECharts.

## Arranque local
```bash
npm install
npm run dev          # sin DATABASE_URL corre en MODO DEMO (7,000 egresados simulados en memoria)
```

## Base de datos (Neon)
1. Copia `.env.example` a `.env` y pon tu `DATABASE_URL` de Neon.
2. `npm run db:setup` crea el esquema (`db/schema.sql`) y carga el censo de 7,000 egresados más el historial de llamadas.
   `npm run db:reset` borra las tablas y vuelve a cargar todo.

Tablas: `carreras`, `egresados` (con índice de trigramas `pg_trgm` para el buscador) y `llamadas`.

## Despliegue en Vercel
Define `DATABASE_URL` (cadena *pooled* de Neon) en las variables del proyecto y despliega. No requiere un comando de build especial.
