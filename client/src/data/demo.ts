// ============================================================
// AgroMatch COMEX — Datos de demostración (todos ficticios)
// Ninguna empresa, cifra ni registro corresponde a datos reales.
// ============================================================

export type Rol = "productor" | "comprador" | "exportador";

export const ROLES: { id: Rol; label: string; descripcion: string }[] = [
  { id: "productor", label: "Productor / Molino", descripcion: "Ofrece lotes y gestiona su producción" },
  { id: "comprador", label: "Comprador / Importador", descripcion: "Busca producto y solicita cotizaciones" },
  { id: "exportador", label: "Exportador / Admin COMEX", descripcion: "Gestiona operaciones de exportación" },
];

export interface Producto {
  id: string;
  nombre: string;
  tipoArroz: string;
  variedad: string;
  empresa: string;
  provincia: string;
  pais: string;
  cantidadTn: number;
  quebradoPct: number;
  humedadPct: number;
  presentacion: string;
  precioTnUsd?: number;
  estado: "Disponible" | "Reservado" | "Agotado";
  certificaciones: string[];
  documentos: string[];
  gradoElaboracion: string;
  propio?: boolean;
}

export interface SolicitudCompra {
  id: string;
  comprador: string;
  paisDestino: string;
  producto: string;
  tipoArroz: string;
  variedad: string;
  volumenTn: number;
  quebradoMaxPct: number;
  humedadMaxPct: number;
  presentacion: string;
  incoterm: string;
  fechaRequerida: string;
  certificaciones: string[];
  estado: "Activa" | "En negociación" | "Cerrada";
  observaciones?: string;
}

export type EstadoCotizacion = "Borrador" | "Enviada" | "En negociación" | "Aceptada" | "Rechazada";

export interface Cotizacion {
  id: string;
  vendedor: string;
  comprador: string;
  producto: string;
  calidad: string;
  cantidadTn: number;
  precioTnUsd: number;
  incoterm: string;
  lugarDesignado: string;
  paisDestino: string;
  presentacion: string;
  fecha: string;
  moneda: string;
  condiciones: string;
  validezDias: number;
  estado: EstadoCotizacion;
  margenPct: number;
}

export interface Operacion {
  id: string;
  comprador: string;
  vendedor: string;
  producto: string;
  cantidadContratadaTn: number;
  cantidadEmbarcadaTn: number;
  precioPactadoTnUsd: number;
  valorFacturadoUsd: number;
  incoterm: string;
  fechaProgramada: string;
  puertoSalida: string;
  puertoDestino: string;
  permisoEmbarque?: string;
  estadoDocumental: string;
  estadoLogistico: string;
  estadoFinanciero: string;
  hitoActual: number; // 1..7
}

export interface DocumentoRequerido {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  responsable: string;
  estado: "Pendiente" | "En preparación" | "Presentado" | "Verificado" | "Observado" | "No aplica";
  fechaLimite?: string;
  costoEstimadoUsd?: number;
  fuente: string;
  ultimaVerificacion?: string;
  adjunto?: string;
}

export interface Conciliacion {
  id: string;
  operacionId: string;
  facturaUsd: number;
  valorEmbarcadoUsd: number;
  ordenPagoUsd: number;
  cobroBrutoUsd: number;
  comisionesDeclaradasUsd: number;
  cobroNetoUsd: number;
  anticiposUsd: number;
  estado: "Conciliada" | "Con diferencias" | "Documentos faltantes" | "Próxima a revisar";
  observacion: string;
}

export const PRODUCTOS_INICIALES: Producto[] = [
  {
    id: "LOTE-A",
    nombre: "Arroz blanco largo fino — Lote A (Demo)",
    tipoArroz: "Blanco",
    variedad: "Largo fino",
    empresa: "Arrocera del Litoral S.A. (ficticia)",
    provincia: "Chaco",
    pais: "Argentina",
    cantidadTn: 80,
    quebradoPct: 7,
    humedadPct: 13,
    presentacion: "Bolsas de 25 kg",
    precioTnUsd: 520,
    estado: "Disponible",
    certificaciones: ["Análisis de calidad"],
    documentos: ["Análisis de laboratorio", "Constancia de depósito"],
    gradoElaboracion: "Blanqueado",
  },
  {
    id: "LOTE-B",
    nombre: "Arroz blanco largo fino — Lote B (Demo)",
    tipoArroz: "Blanco",
    variedad: "Largo fino",
    empresa: "Molino Costa Norte S.R.L. (ficticia)",
    provincia: "Corrientes",
    pais: "Argentina",
    cantidadTn: 60,
    quebradoPct: 3,
    humedadPct: 12.5,
    presentacion: "Bolsas de 25 kg",
    precioTnUsd: 560,
    estado: "Disponible",
    certificaciones: ["Análisis de calidad", "Certificado fitosanitario"],
    documentos: ["Análisis de laboratorio", "Fitosanitario SENASA (demo)"],
    gradoElaboracion: "Blanqueado",
  },
  {
    id: "LOTE-C",
    nombre: "Arroz jazmín — Lote C (Demo)",
    tipoArroz: "Aromático",
    variedad: "Jazmín",
    empresa: "Graneros del Sur Coop. (ficticia)",
    provincia: "Entre Ríos",
    pais: "Argentina",
    cantidadTn: 25,
    quebradoPct: 4,
    humedadPct: 13,
    presentacion: "Envases de 1 kg",
    precioTnUsd: 890,
    estado: "Disponible",
    certificaciones: ["Análisis de calidad"],
    documentos: ["Análisis de laboratorio"],
    gradoElaboracion: "Blanqueado",
  },
  {
    id: "LOTE-D",
    nombre: "Arroz integral largo — Lote D (Demo)",
    tipoArroz: "Integral",
    variedad: "Largo fino",
    empresa: "Arrocera del Litoral S.A. (ficticia)",
    provincia: "Chaco",
    pais: "Argentina",
    cantidadTn: 40,
    quebradoPct: 5,
    humedadPct: 13.5,
    presentacion: "Big bags de 1.000 kg",
    estado: "Reservado",
    certificaciones: [],
    documentos: ["Constancia de depósito"],
    gradoElaboracion: "Cargo",
  },
];

export const SOLICITUDES_INICIALES: SolicitudCompra[] = [
  {
    id: "SOL-001",
    comprador: "Distribuidora Caribe Ltda. (ficticia)",
    paisDestino: "República Dominicana",
    producto: "Arroz",
    tipoArroz: "Blanco",
    variedad: "Largo fino",
    volumenTn: 40,
    quebradoMaxPct: 5,
    humedadMaxPct: 14,
    presentacion: "Bolsas de 25 kg",
    incoterm: "FOB",
    fechaRequerida: "2026-11-30",
    certificaciones: ["Certificado fitosanitario"],
    estado: "Activa",
    observaciones: "Primera compra de prueba con posibilidad de contrato anual.",
  },
  {
    id: "SOL-002",
    comprador: "Alimentos Andinos SpA (ficticia)",
    paisDestino: "Chile",
    producto: "Arroz",
    tipoArroz: "Aromático",
    variedad: "Jazmín",
    volumenTn: 20,
    quebradoMaxPct: 5,
    humedadMaxPct: 14,
    presentacion: "Envases de 1 kg",
    incoterm: "CIF",
    fechaRequerida: "2026-12-15",
    certificaciones: ["Certificado de origen"],
    estado: "En negociación",
  },
  {
    id: "SOL-003",
    comprador: "Comercial Atlántico S.A. (ficticia)",
    paisDestino: "Brasil",
    producto: "Arroz",
    tipoArroz: "Blanco",
    variedad: "Largo fino",
    volumenTn: 100,
    quebradoMaxPct: 10,
    humedadMaxPct: 14,
    presentacion: "Big bags de 1.000 kg",
    incoterm: "FCA",
    fechaRequerida: "2027-01-20",
    certificaciones: [],
    estado: "Activa",
  },
];

export const COTIZACIONES_INICIALES: Cotizacion[] = [
  {
    id: "COT-2026-001",
    vendedor: "Molino Costa Norte S.R.L. (ficticia)",
    comprador: "Distribuidora Caribe Ltda. (ficticia)",
    producto: "Arroz blanco largo fino",
    calidad: "Quebrado 3% · Humedad 12,5%",
    cantidadTn: 40,
    precioTnUsd: 640,
    incoterm: "FOB",
    lugarDesignado: "Puerto de Buenos Aires, Argentina",
    paisDestino: "República Dominicana",
    presentacion: "Bolsas de 25 kg",
    fecha: "2026-10-10",
    moneda: "USD",
    condiciones: "Pago: carta de crédito a la vista. Embarque estimado: 30 días desde la aceptación.",
    validezDias: 15,
    estado: "Enviada",
    margenPct: 12,
  },
  {
    id: "COT-2026-002",
    vendedor: "Graneros del Sur Coop. (ficticia)",
    comprador: "Alimentos Andinos SpA (ficticia)",
    producto: "Arroz jazmín",
    calidad: "Quebrado 4% · Humedad 13%",
    cantidadTn: 20,
    precioTnUsd: 1150,
    incoterm: "CIF",
    lugarDesignado: "Puerto de Valparaíso, Chile",
    paisDestino: "Chile",
    presentacion: "Envases de 1 kg",
    fecha: "2026-10-05",
    moneda: "USD",
    condiciones: "Pago: 30% anticipo, saldo contra documentos.",
    validezDias: 10,
    estado: "En negociación",
    margenPct: 15,
  },
];

export const OPERACIONES_INICIALES: Operacion[] = [
  {
    id: "OP-2026-014",
    comprador: "Alimentos Andinos SpA (ficticia)",
    vendedor: "Arrocera del Litoral S.A. (ficticia)",
    producto: "Arroz blanco largo fino",
    cantidadContratadaTn: 50,
    cantidadEmbarcadaTn: 50,
    precioPactadoTnUsd: 600,
    valorFacturadoUsd: 30000,
    incoterm: "FOB",
    fechaProgramada: "2026-09-28",
    puertoSalida: "Buenos Aires, Argentina",
    puertoDestino: "San Antonio, Chile",
    permisoEmbarque: "PE-26001-DEMO",
    estadoDocumental: "Verificado",
    estadoLogistico: "Embarque realizado",
    estadoFinanciero: "Cobro recibido",
    hitoActual: 6,
  },
  {
    id: "OP-2026-017",
    comprador: "Comercial Atlántico S.A. (ficticia)",
    vendedor: "Molino Costa Norte S.R.L. (ficticia)",
    producto: "Arroz blanco largo fino",
    cantidadContratadaTn: 60,
    cantidadEmbarcadaTn: 0,
    precioPactadoTnUsd: 585,
    valorFacturadoUsd: 0,
    incoterm: "FCA",
    fechaProgramada: "2026-11-05",
    puertoSalida: "Rosario, Argentina",
    puertoDestino: "Santos, Brasil",
    estadoDocumental: "En preparación",
    estadoLogistico: "Mercadería en preparación",
    estadoFinanciero: "Pendiente de facturación",
    hitoActual: 2,
  },
];

export const DOCUMENTOS_POR_CATEGORIA: { categoria: string; documentos: Omit<DocumentoRequerido, "categoria">[] }[] = [
  {
    categoria: "A. Documentación comercial",
    documentos: [
      {
        id: "DOC-01",
        nombre: "Factura comercial",
        descripcion: "Documento de venta con datos de las partes, producto, cantidades y valores.",
        responsable: "Vendedor / Exportador",
        estado: "Verificado",
        fechaLimite: "2026-11-01",
        fuente: "Práctica comercial internacional",
        ultimaVerificacion: "2026-10-12",
        adjunto: "factura-comercial-demo.pdf",
      },
      {
        id: "DOC-02",
        nombre: "Packing list",
        descripcion: "Detalle de bultos, pesos y presentación de la mercadería.",
        responsable: "Vendedor / Exportador",
        estado: "En preparación",
        fechaLimite: "2026-11-01",
        fuente: "Práctica comercial internacional",
      },
    ],
  },
  {
    categoria: "B. Documentación aduanera argentina",
    documentos: [
      {
        id: "DOC-03",
        nombre: "Permiso de embarque",
        descripcion: "Declaración de exportación ante la aduana argentina.",
        responsable: "Despachante de aduana",
        estado: "Pendiente",
        fechaLimite: "2026-11-03",
        fuente: "ARCA / Aduana — requiere verificación normativa",
      },
      {
        id: "DOC-04",
        nombre: "Bill of Lading",
        descripcion: "Conocimiento de embarque emitido por la naviera.",
        responsable: "Naviera / Freight forwarder",
        estado: "Pendiente",
        fuente: "Naviera contratada",
      },
    ],
  },
  {
    categoria: "C. Documentación fitosanitaria",
    documentos: [
      {
        id: "DOC-05",
        nombre: "Certificado fitosanitario",
        descripcion: "Certifica la condición sanitaria del lote para exportación.",
        responsable: "SENASA",
        estado: "En preparación",
        fechaLimite: "2026-10-30",
        costoEstimadoUsd: 120,
        fuente: "SENASA — ejemplo, requiere validación",
      },
      {
        id: "DOC-06",
        nombre: "Análisis de calidad",
        descripcion: "Informe de laboratorio: quebrado, humedad, impurezas.",
        responsable: "Laboratorio habilitado",
        estado: "Verificado",
        costoEstimadoUsd: 90,
        fuente: "Laboratorio privado (demo)",
        ultimaVerificacion: "2026-10-08",
        adjunto: "analisis-calidad-demo.pdf",
      },
    ],
  },
  {
    categoria: "D. Requisitos del país importador",
    documentos: [
      {
        id: "DOC-07",
        nombre: "Certificado de origen",
        descripcion: "Acredita el origen argentino de la mercadería.",
        responsable: "Cámara de comercio",
        estado: "Pendiente",
        costoEstimadoUsd: 60,
        fuente: "Ejemplo — validar requisito según destino",
      },
      {
        id: "DOC-08",
        nombre: "Permiso de importación del comprador",
        descripcion: "Habilitación del importador en el país de destino, cuando corresponda.",
        responsable: "Comprador / Importador",
        estado: "Pendiente",
        fuente: "Ejemplo — validar requisito según destino",
      },
    ],
  },
  {
    categoria: "E. Certificaciones solicitadas por el comprador",
    documentos: [
      {
        id: "DOC-09",
        nombre: "Certificado kosher",
        descripcion: "Solo cuando el comprador lo solicite expresamente.",
        responsable: "Entidad certificadora",
        estado: "No aplica",
        fuente: "Solicitud del comprador",
      },
    ],
  },
  {
    categoria: "F. Documentación bancaria y financiera",
    documentos: [
      {
        id: "DOC-10",
        nombre: "Carta de crédito / orden de pago",
        descripcion: "Instrumento de pago acordado entre las partes.",
        responsable: "Banco del comprador",
        estado: "En preparación",
        fuente: "Entidad bancaria — demo sin conexión real",
      },
      {
        id: "DOC-11",
        nombre: "Seguimiento SECOEXPO",
        descripcion: "Seguimiento del estado documental y bancario de la exportación (demostrativo).",
        responsable: "Exportador",
        estado: "Pendiente",
        fuente: "Demo — sin conexión con BCRA ni bancos",
      },
    ],
  },
];

export const CONCILIACIONES_INICIALES: Conciliacion[] = [
  {
    id: "CONC-001",
    operacionId: "OP-2026-014",
    facturaUsd: 30000,
    valorEmbarcadoUsd: 30000,
    ordenPagoUsd: 30000,
    cobroBrutoUsd: 30000,
    comisionesDeclaradasUsd: 150,
    cobroNetoUsd: 29850,
    anticiposUsd: 0,
    estado: "Con diferencias",
    observacion:
      "Diferencia de USD 150 entre factura y cobro neto. Corresponde a comisión bancaria del exterior: identificar el comprobante y verificar su tratamiento. No implica por sí sola un incumplimiento cambiario.",
  },
  {
    id: "CONC-002",
    operacionId: "OP-2026-017",
    facturaUsd: 0,
    valorEmbarcadoUsd: 0,
    ordenPagoUsd: 0,
    cobroBrutoUsd: 0,
    comisionesDeclaradasUsd: 0,
    cobroNetoUsd: 0,
    anticiposUsd: 0,
    estado: "Próxima a revisar",
    observacion: "Operación aún sin facturación. Se activará el seguimiento al emitirse la factura comercial.",
  },
];

export const HITOS_OPERACION = [
  "Cotización aceptada",
  "Documentación en preparación",
  "Mercadería preparada",
  "Embarque realizado",
  "Documentos presentados",
  "Pago recibido",
  "Conciliación realizada",
];

export const OPORTUNIDADES_POR_PAIS = [
  { pais: "Brasil", oportunidades: 6 },
  { pais: "Chile", oportunidades: 4 },
  { pais: "Rep. Dominicana", oportunidades: 3 },
  { pais: "Perú", oportunidades: 2 },
  { pais: "México", oportunidades: 2 },
  { pais: "Colombia", oportunidades: 1 },
];

export const PUERTOS_ARGENTINA = ["Buenos Aires", "Rosario", "Bahía Blanca", "Zárate", "Concepción del Uruguay"];
export const PUERTOS_DESTINO: Record<string, string[]> = {
  "República Dominicana": ["Caucedo", "Haina"],
  Chile: ["San Antonio", "Valparaíso"],
  Brasil: ["Santos", "Paranaguá", "Rio Grande"],
  Perú: ["Callao"],
  México: ["Veracruz", "Manzanillo"],
  Colombia: ["Buenaventura", "Cartagena"],
};
export const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
export const PROVINCIAS = ["Chaco", "Corrientes", "Entre Ríos", "Santa Fe", "Formosa", "Buenos Aires"];

export function fmtUsd(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: dec, minimumFractionDigits: dec });
}

export function fmtTn(n: number): string {
  return `${n.toLocaleString("es-AR")} tn`;
}
