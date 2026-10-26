// Crea el esquema en Neon y carga el censo inicial de 7,000 egresados + historial de llamadas.
//   npm run db:setup   → crea tablas y carga datos sólo si la tabla está vacía
//   npm run db:reset   → borra todo y vuelve a cargar
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { CARRERAS } from '../src/lib/catalogos';
import { generarCenso } from '../src/lib/generador';
import { textoBusqueda } from '../src/lib/busqueda';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL en .env');
  process.exit(1);
}
const reset = process.argv.includes('--reset');

async function main() {
  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await db.connect();
  if (reset) {
    console.log('Eliminando tablas…');
    await db.query('drop table if exists llamadas, egresados, carreras cascade');
    // Tablas heredadas del MIVSE anterior (Prisma)
    await db.query(
      `drop table if exists _prisma_migrations, capturas_campo, interacciones_historicas, ive_historial,
         nucleo_familiar, trayectoria_laboral, webhook_eventos cascade`,
    );
  }
  await db.query(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  const { rows } = await db.query('select count(*)::int as n from egresados');
  if (rows[0].n > 0) {
    console.log(`La base ya tiene ${rows[0].n} egresados. Usa npm run db:reset para recargar.`);
    await db.end();
    return;
  }

  for (const c of CARRERAS) {
    await db.query('insert into carreras (clave, nombre, area) values ($1,$2,$3) on conflict do nothing', [c.clave, c.nombre, c.area]);
  }

  const { egresados, llamadas } = generarCenso();
  console.log(`Cargando ${egresados.length} egresados…`);
  const LOTE = 500;
  for (let i = 0; i < egresados.length; i += LOTE) {
    const lote = egresados.slice(i, i + LOTE);
    const valores: unknown[] = [];
    const filas = lote.map((e, j) => {
      const v = [e.id, e.matricula, e.nombre, e.apellidoPaterno, e.apellidoMaterno, e.genero, e.carrera, e.generacion, e.telefono,
        e.email, e.municipio, e.estado, e.lat, e.lng, e.geoOrigen, e.estatus, e.sector, e.empresa, e.puesto, e.rangoIngreso,
        e.interesPosgrado, e.aportaciones, e.participaciones, e.nps, e.contactado, e.ultimaActualizacion, e.ultimoContacto,
        e.proximoContacto, e.ive, e.nivel, textoBusqueda(e)];
      valores.push(...v);
      return `(${v.map((_, k) => `$${j * v.length + k + 1}`).join(',')})`;
    });
    await db.query(
      `insert into egresados (id, matricula, nombre, apellido_paterno, apellido_materno, genero, carrera, generacion, telefono,
        email, municipio, estado, lat, lng, geo_origen, estatus_laboral, sector, empresa, puesto, rango_ingreso,
        interes_posgrado, aportaciones, participaciones, nps, contactado, ultima_actualizacion, ultimo_contacto,
        proximo_contacto, ive, nivel, busqueda) values ${filas.join(',')}`,
      valores,
    );
    process.stdout.write(`  ${Math.min(i + LOTE, egresados.length)}\r`);
  }
  await db.query(`select setval('egresados_id_seq', (select max(id) from egresados))`);

  console.log(`\nCargando ${llamadas.length} llamadas…`);
  const LOTE_L = 1000;
  for (let i = 0; i < llamadas.length; i += LOTE_L) {
    const lote = llamadas.slice(i, i + LOTE_L);
    const valores: unknown[] = [];
    const filas = lote.map((l, j) => {
      const v = [l.egresadoId, l.agente, l.canal, l.resultado, l.notas, l.iveAntes, l.iveDespues, l.nivelAntes, l.nivelDespues, l.fecha];
      valores.push(...v);
      return `(${v.map((_, k) => `$${j * v.length + k + 1}`).join(',')})`;
    });
    await db.query(
      `insert into llamadas (egresado_id, agente, canal, resultado, notas, ive_antes, ive_despues, nivel_antes, nivel_despues, created_at)
       values ${filas.join(',')}`,
      valores,
    );
  }
  await db.query('analyze egresados; analyze llamadas;');
  console.log('Listo ✔');
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
