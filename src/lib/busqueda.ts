import { ESTATUS_INFO, NIVEL_INFO, nombreCarrera } from './catalogos';
import type { Egresado } from './tipos';

export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Texto indexado: matrícula, nombre, carrera, estatus laboral, nivel de vinculación y municipio. */
export const textoBusqueda = (e: Egresado) =>
  normalizar(
    [
      e.matricula,
      e.nombre,
      e.apellidoPaterno,
      e.apellidoMaterno,
      e.carrera,
      nombreCarrera(e.carrera),
      ESTATUS_INFO[e.estatus].etiqueta,
      NIVEL_INFO[e.nivel].etiqueta,
      e.municipio,
      e.generacion,
    ].join(' '),
  );

export const tokens = (q: string) => normalizar(q).split(' ').filter((t) => t.length > 0).slice(0, 6);
