import type { EstatusLaboral, Nivel, ResultadoId } from './catalogos';

export interface Egresado {
  id: number;
  matricula: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  genero: 'F' | 'M';
  carrera: string;
  generacion: number;
  telefono: string;
  email: string;
  municipio: string;
  estado: string;
  lat: number | null;
  lng: number | null;
  /** 'campo' = coordenada GPS capturada por la App de Campo (Módulo 1). */
  geoOrigen: 'campo' | 'domicilio' | null;
  /** Domicilio levantado en campo (Módulo 1). */
  domicilio?: string | null;
  colonia?: string | null;
  entreCalles?: string | null;
  estatus: EstatusLaboral;
  sector: string | null;
  empresa: string | null;
  puesto: string | null;
  rangoIngreso: string | null;
  interesPosgrado: boolean;
  aportaciones: string[];
  participaciones: number;
  nps: number | null;
  contactado: boolean;
  ultimaActualizacion: string | null;
  ultimoContacto: string | null;
  proximoContacto: string | null;
  ive: number;
  nivel: Nivel;
}

export interface Llamada {
  id: number;
  egresadoId: number;
  matricula?: string;
  nombreEgresado?: string;
  agente: string;
  canal: 'llamada' | 'whatsapp' | 'campo';
  resultado: ResultadoId;
  notas: string | null;
  iveAntes: number | null;
  iveDespues: number | null;
  nivelAntes: Nivel | null;
  nivelDespues: Nivel | null;
  fecha: string;
}

/** Fila ligera para el buscador y la cola de llamadas. */
export interface EgresadoResumen {
  id: number;
  matricula: string;
  nombreCompleto: string;
  carrera: string;
  generacion: number;
  municipio: string;
  estatus: EstatusLaboral;
  nivel: Nivel;
  ive: number;
  ultimoContacto: string | null;
  ultimaActualizacion: string | null;
  proximoContacto: string | null;
}

export interface ExpedienteCompleto {
  egresado: Egresado;
  llamadas: Llamada[];
}

/** Cambios capturados en el flujo guiado de la llamada. */
export interface ActualizacionLlamada {
  egresadoId: number;
  agente: string;
  canal: 'llamada' | 'whatsapp';
  resultado: ResultadoId;
  notas?: string;
  proximoContacto?: string | null;
  datos?: Partial<
    Pick<
      Egresado,
      | 'telefono'
      | 'email'
      | 'municipio'
      | 'estatus'
      | 'sector'
      | 'empresa'
      | 'puesto'
      | 'rangoIngreso'
      | 'interesPosgrado'
      | 'aportaciones'
      | 'participaciones'
      | 'nps'
    >
  >;
}

/** Conjunto columnar compacto que alimenta el tablero (filtrado cruzado en el navegador). */
export interface DatasetTablero {
  generado: string;
  modo: 'neon' | 'demo';
  total: number;
  dict: {
    carrera: string[];
    sector: string[];
    ingreso: string[];
    municipio: string[];
    estado: string[];
    estatus: string[];
    nivel: string[];
  };
  col: {
    matricula: string[];
    nombre: string[];
    gen: number[];
    car: number[];
    sec: number[];
    ing: number[];
    mun: number[];
    edo: number[];
    lab: number[];
    lat: (number | null)[];
    lng: (number | null)[];
    /** 0 = sin coordenada, 1 = GPS de campo, 2 = domicilio */
    geo: number[];
    /** días desde la última actualización, -1 = nunca */
    act: number[];
    con: number[];
    par: number[];
    pos: number[];
    apo: number[];
    /** -1 = sin respuesta */
    nps: number[];
  };
}

/** Captura levantada por la App de Campo (Módulo 1). Se guarda en el dispositivo y se sincroniza al haber conexión. */
export interface CapturaCampo {
  /** Generado en el dispositivo: hace idempotente la sincronización. */
  uuid: string;
  encuestador: string;
  capturadoEn: string;
  matricula: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  genero: 'F' | 'M';
  carrera: string;
  generacion: number;
  telefono: string;
  email: string;
  domicilio: string;
  colonia: string;
  entreCalles: string;
  municipio: string;
  lat: number | null;
  lng: number | null;
  precision: number | null;
  origenUbicacion: 'gps' | 'mapa' | 'busqueda' | null;
  estatus: EstatusLaboral;
  sector: string | null;
  empresa: string | null;
  puesto: string | null;
  rangoIngreso: string | null;
  interesPosgrado: boolean;
  aportaciones: string[];
  participaciones: number;
  nps: number | null;
  notas: string;
}

export interface CapturaRegistrada {
  uuid: string;
  egresadoId: number;
  matricula: string;
  nombreEgresado: string;
  encuestador: string;
  tipo: 'alta' | 'actualizacion';
  lat: number | null;
  lng: number | null;
  municipio: string | null;
  iveAntes: number | null;
  iveDespues: number;
  nivel: Nivel;
  capturadoEn: string;
}
