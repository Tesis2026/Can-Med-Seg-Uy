/**
 * Validaciones de formato para Uruguay (ámbito nacional Can-Med-Seg).
 */

/** Solo dígitos. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Dígito verificador de cédula uruguaya.
 * @see Algoritmo oficial (factores 2,9,8,7,6,3,4)
 */
export function uyCiValidationDigit(ciWithoutCheck: string): number {
  let ci = digitsOnly(ciWithoutCheck);
  while (ci.length < 7) ci = `0${ci}`;
  ci = ci.slice(-7);
  const factors = [2, 9, 8, 7, 6, 3, 4];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += (factors[i]! * Number(ci[i]!)) % 10;
  }
  return sum % 10 === 0 ? 0 : 10 - (sum % 10);
}

/** Valida cédula uruguaya (7–8 dígitos + dígito verificador). */
export function isValidUyCi(value: string): boolean {
  const ci = value.trim();
  if (!/^\d{8}$/.test(ci)) return false;
  const body = ci.slice(0, -1);
  const check = Number(ci.slice(-1));
  return uyCiValidationDigit(body) === check;
}

/**
 * Normaliza teléfono a dígitos nacionales (sin +598).
 * Ej: "+598 99 123 456" → "099123456"; "099 123 456" → "099123456"
 */
export function normalizeUyPhone(value: string): string {
  let d = digitsOnly(value);
  if (d.startsWith("598")) {
    d = d.slice(3);
    // Internacional móvil: 9XXXXXXXX → 09XXXXXXXX
    if (d.length === 8 && d.startsWith("9")) {
      d = `0${d}`;
    }
  }
  return d;
}

/**
 * Teléfono Uruguay:
 * - Móvil: 09X XXX XXX (9 dígitos, empieza con 09)
 * - Fijo Montevideo: 2XXX XXXX (8 dígitos, empieza con 2)
 * - Fijo interior: tipicamente 4XXX XXXX (8 dígitos, empieza con 4)
 * Acepta espacios, guiones y prefijo +598.
 */
export function isValidUyPhone(value: string): boolean {
  const d = normalizeUyPhone(value);
  if (/^09[1-9]\d{6}$/.test(d)) return true; // móvil
  if (/^2\d{7}$/.test(d)) return true; // Montevideo
  if (/^4\d{7}$/.test(d)) return true; // interior (amplio)
  return false;
}

export function uyPhoneError(value: string, required: boolean): string | null {
  const raw = value.trim();
  if (!raw) return required ? "Campo obligatorio" : null;
  if (!isValidUyPhone(raw)) {
    return "Teléfono uruguayo inválido (ej. 099 123 456 o +598 99 123 456)";
  }
  return null;
}

export function uyCiError(value: string, required: boolean): string | null {
  const raw = value.trim();
  if (!raw) return required ? "Campo obligatorio" : null;
  if (raw.length != 8) {
    return "La cédula debe tener 8 dígitos";
  }
  if (!isValidUyCi(raw)) {
    return "La cédula ingresada no es válida";
  }
  return null;
}

/** Email con formato razonable (no solo presencia de @). */
export function emailError(value: string, required: boolean): string | null {
  const raw = value.trim();
  if (!raw) return required ? "Campo obligatorio" : null;
  // RFC 5322 simplificado
  const re =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!re.test(raw) || raw.length > 254) {
    return "Ingrese un correo electrónico válido";
  }
  return null;
}

/** Iniciales: máx. 4 caracteres (diccionario var. 1.0). */
export function initialsError(value: string, required: boolean): string | null {
  const raw = value.trim();
  if (!raw) return required ? "Campo obligatorio" : null;
  if (raw.length > 4) return "Máximo 4 caracteres";
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ. ]{1,4}$/.test(raw)) {
    return "Use solo letras (ej. J.P. o JP)";
  }
  return null;
}

export function weightKgError(value: number | undefined): string | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value < 5 || value > 250) {
    return "El peso debe estar entre 5 y 250 kg";
  }
  return null;
}

export function heightMError(value: number | undefined): string | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value < 0.5 || value > 2.5) {
    return "Talla debe estar entre 50 y 250 cm";
  }
  return null;
}

export function ageError(value: number | undefined, required: boolean): string | null {
  if (value === undefined || Number.isNaN(value)) {
    return required ? "Campo obligatorio" : null;
  }
  if (!Number.isInteger(value) || value < 0 || value > 120) {
    return "Edad inválida (0–120 años)";
  }
  return null;
}
