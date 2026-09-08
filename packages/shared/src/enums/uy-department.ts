/**
 * Departamentos de Uruguay y su agrupación en regiones.
 *
 * El departamento se carga en el formulario (Sección 1) y la región es lo que se
 * grafica en el dashboard (RF-7.2 / RF-7.10). Las regiones siguen el frame
 * «Dashboard principal» del diseño: Montevideo, Sur, Este y Norte.
 */
export const UyDepartment = {
  Artigas: "artigas",
  Canelones: "canelones",
  CerroLargo: "cerro_largo",
  Colonia: "colonia",
  Durazno: "durazno",
  Flores: "flores",
  Florida: "florida",
  Lavalleja: "lavalleja",
  Maldonado: "maldonado",
  Montevideo: "montevideo",
  Paysandu: "paysandu",
  RioNegro: "rio_negro",
  Rivera: "rivera",
  Rocha: "rocha",
  Salto: "salto",
  SanJose: "san_jose",
  Soriano: "soriano",
  Tacuarembo: "tacuarembo",
  TreintaYTres: "treinta_y_tres",
} as const;

export type UyDepartment = (typeof UyDepartment)[keyof typeof UyDepartment];

export const UY_DEPARTMENTS = Object.values(UyDepartment);

export const UY_DEPARTMENT_LABELS: Record<UyDepartment, string> = {
  [UyDepartment.Artigas]: "Artigas",
  [UyDepartment.Canelones]: "Canelones",
  [UyDepartment.CerroLargo]: "Cerro Largo",
  [UyDepartment.Colonia]: "Colonia",
  [UyDepartment.Durazno]: "Durazno",
  [UyDepartment.Flores]: "Flores",
  [UyDepartment.Florida]: "Florida",
  [UyDepartment.Lavalleja]: "Lavalleja",
  [UyDepartment.Maldonado]: "Maldonado",
  [UyDepartment.Montevideo]: "Montevideo",
  [UyDepartment.Paysandu]: "Paysandú",
  [UyDepartment.RioNegro]: "Río Negro",
  [UyDepartment.Rivera]: "Rivera",
  [UyDepartment.Rocha]: "Rocha",
  [UyDepartment.Salto]: "Salto",
  [UyDepartment.SanJose]: "San José",
  [UyDepartment.Soriano]: "Soriano",
  [UyDepartment.Tacuarembo]: "Tacuarembó",
  [UyDepartment.TreintaYTres]: "Treinta y Tres",
};

export const UyRegion = {
  Montevideo: "montevideo",
  Sur: "sur",
  Este: "este",
  Norte: "norte",
} as const;

export type UyRegion = (typeof UyRegion)[keyof typeof UyRegion];

export const UY_REGIONS = Object.values(UyRegion);

export const UY_REGION_LABELS: Record<UyRegion, string> = {
  [UyRegion.Montevideo]: "Montevideo",
  [UyRegion.Sur]: "Sur",
  [UyRegion.Este]: "Este",
  [UyRegion.Norte]: "Norte",
};

const DEPARTMENT_REGION: Record<UyDepartment, UyRegion> = {
  [UyDepartment.Montevideo]: UyRegion.Montevideo,

  [UyDepartment.Canelones]: UyRegion.Sur,
  [UyDepartment.SanJose]: UyRegion.Sur,
  [UyDepartment.Colonia]: UyRegion.Sur,
  [UyDepartment.Florida]: UyRegion.Sur,
  [UyDepartment.Flores]: UyRegion.Sur,
  [UyDepartment.Durazno]: UyRegion.Sur,
  [UyDepartment.Lavalleja]: UyRegion.Sur,

  [UyDepartment.Maldonado]: UyRegion.Este,
  [UyDepartment.Rocha]: UyRegion.Este,
  [UyDepartment.TreintaYTres]: UyRegion.Este,
  [UyDepartment.CerroLargo]: UyRegion.Este,

  [UyDepartment.Artigas]: UyRegion.Norte,
  [UyDepartment.Salto]: UyRegion.Norte,
  [UyDepartment.Paysandu]: UyRegion.Norte,
  [UyDepartment.RioNegro]: UyRegion.Norte,
  [UyDepartment.Rivera]: UyRegion.Norte,
  [UyDepartment.Soriano]: UyRegion.Norte,
  [UyDepartment.Tacuarembo]: UyRegion.Norte,
};

export function regionOfDepartment(department: UyDepartment): UyRegion {
  return DEPARTMENT_REGION[department];
}

export function isUyDepartment(value: unknown): value is UyDepartment {
  return typeof value === "string" && (UY_DEPARTMENTS as readonly string[]).includes(value);
}
