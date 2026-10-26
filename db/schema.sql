-- MIVSE · Esquema Postgres (Neon)
create extension if not exists pg_trgm;

create table if not exists carreras (
  clave  text primary key,
  nombre text not null,
  area   text not null
);

create table if not exists egresados (
  id                   serial primary key,
  matricula            text not null unique,
  nombre               text not null,
  apellido_paterno     text not null,
  apellido_materno     text not null default '',
  genero               char(1) not null,
  carrera              text not null references carreras(clave),
  generacion           smallint not null,
  telefono             text,
  email                text,
  municipio            text not null,
  estado               text not null,
  lat                  double precision,
  lng                  double precision,
  geo_origen           text check (geo_origen in ('campo', 'domicilio')),
  estatus_laboral      text not null default 'sin_dato',
  sector               text,
  empresa              text,
  puesto               text,
  rango_ingreso        text,
  interes_posgrado     boolean not null default false,
  aportaciones         text[] not null default '{}',
  participaciones      smallint not null default 0,
  nps                  smallint check (nps between 0 and 10),
  contactado           boolean not null default false,
  ultima_actualizacion timestamptz,
  ultimo_contacto      timestamptz,
  proximo_contacto     timestamptz,
  ive                  numeric(5,1) not null default 0,
  nivel                text not null default 'desconectado',
  busqueda             text not null default '',
  updated_at           timestamptz not null default now()
);

-- Buscador de alta velocidad: índice de trigramas sobre el texto normalizado
create index if not exists egresados_busqueda_trgm on egresados using gin (busqueda gin_trgm_ops);
create index if not exists egresados_cola on egresados (proximo_contacto nulls last, ultima_actualizacion nulls first);
create index if not exists egresados_carrera_gen on egresados (carrera, generacion);

create table if not exists llamadas (
  id            bigserial primary key,
  egresado_id   integer not null references egresados(id) on delete cascade,
  agente        text not null,
  canal         text not null default 'llamada',
  resultado     text not null,
  notas         text,
  ive_antes     numeric(5,1),
  ive_despues   numeric(5,1),
  nivel_antes   text,
  nivel_despues text,
  created_at    timestamptz not null default now()
);
create index if not exists llamadas_egresado on llamadas (egresado_id, created_at desc);
create index if not exists llamadas_fecha on llamadas (created_at desc);
