import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

import styles from "./FormFields.module.css";

type FieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: FieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required ? <span className={styles.req}> *</span> : null}
      </label>
      {children}
      {hint && !error ? <p className={styles.hint}>{hint}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export function TextInput({ hasError, className, ...props }: TextInputProps) {
  return (
    <input
      className={[styles.input, hasError ? styles.inputError : "", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
  placeholder?: string;
};

export function SelectInput({
  hasError,
  placeholder = "Seleccionar",
  children,
  className,
  ...props
}: SelectInputProps) {
  return (
    <select
      className={[styles.select, hasError ? styles.inputError : "", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

type UnitInputProps = {
  id?: string;
  value: string;
  unit: string;
  type?: "text" | "number";
  placeholder?: string;
  hasError?: boolean;
  min?: number;
  max?: number;
  step?: string | number;
  readOnly?: boolean;
  onChange?: (value: string) => void;
};

export function UnitInput({
  id,
  value,
  unit,
  type = "number",
  placeholder,
  hasError,
  min,
  max,
  step,
  readOnly,
  onChange,
}: UnitInputProps) {
  return (
    <div className={styles.unitRow}>
      <input
        id={id}
        className={[styles.input, styles.unitInput, hasError ? styles.inputError : ""]
          .filter(Boolean)
          .join(" ")}
        type={type}
        value={value}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        readOnly={readOnly}
        onChange={
          readOnly || !onChange ? undefined : (e) => onChange(e.target.value)
        }
      />
      <span className={styles.unitBox}>{unit}</span>
    </div>
  );
}

type DateParts = { day: string; month: string; year: string };

export function parseDateParts(isoOrSlash: string): DateParts {
  if (!isoOrSlash) return { day: "", month: "", year: "" };
  // Partial or complete dd/mm/yyyy (empty segments allowed while typing)
  const slash = isoOrSlash.match(/^(\d{0,2})\/(\d{0,2})\/(\d{0,4})$/);
  if (slash) {
    return { day: slash[1], month: slash[2], year: slash[3] };
  }
  // Accept yyyy-mm-dd
  const iso = isoOrSlash.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return { day: iso[3], month: iso[2], year: iso[1] };
  }
  return { day: "", month: "", year: "" };
}

/** Año mínimo permitido en fechas del formulario. */
export const DATE_YEAR_MIN = 1900;

function startOfTodayLocal(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/** Año máximo = año corriente (fechas hasta hoy). */
export function dateYearMax(): number {
  return startOfTodayLocal().getFullYear();
}

/** Keep raw segments while typing — do not pad empty parts to "00". */
export function formatDateParts(parts: DateParts): string {
  const { day, month, year } = parts;
  if (!day && !month && !year) return "";
  return `${day}/${month}/${year}`;
}

/** Normaliza a dd/mm/aaaa cuando la fecha está completa y es válida. */
export function normalizeDateValue(value: string): string {
  const parts = parseDateParts(value.trim());
  if (!parts.day || !parts.month || parts.year.length !== 4) {
    return formatDateParts(parts);
  }
  const d = Number(parts.day);
  const m = Number(parts.month);
  const y = Number(parts.year);
  const maxYear = dateYearMax();
  if (y < DATE_YEAR_MIN || y > maxYear || m < 1 || m > 12 || d < 1 || d > 31) {
    return formatDateParts(parts);
  }
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return formatDateParts(parts);
  }
  if (date.getTime() > startOfTodayLocal().getTime()) {
    return formatDateParts(parts);
  }
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function isCompleteDate(value: string): boolean {
  return dateValidationError(value, { required: true }) === null;
}

/**
 * null = OK.
 * Distingue vacío / incompleto / inválida (ej. año fuera de 1900–hoy).
 */
export function dateValidationError(
  value: string,
  options: { required: boolean },
): string | null {
  const raw = (value ?? "").trim();
  if (!raw || raw === "//") {
    return options.required ? "Campo obligatorio (dd/mm/aaaa)" : null;
  }

  const parts = parseDateParts(raw);
  if (!parts.day || !parts.month || parts.year.length !== 4) {
    return "Complete la fecha en formato dd/mm/aaaa";
  }

  const d = Number(parts.day);
  const m = Number(parts.month);
  const y = Number(parts.year);
  const maxYear = dateYearMax();

  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return "Fecha inválida (revise día y mes)";
  }

  if (y < DATE_YEAR_MIN || y > maxYear) {
    return `Año inválido: use un año entre ${DATE_YEAR_MIN} y ${maxYear}`;
  }

  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return "Fecha inválida (día inexistente en ese mes)";
  }

  if (date.getTime() > startOfTodayLocal().getTime()) {
    return "La fecha no puede ser posterior a hoy";
  }

  return null;
}

/** Convierte dd/mm/aaaa válida a Date local (00:00). null si inválida. */
export function parseToDate(value: string): Date | null {
  if (dateValidationError(value, { required: true }) !== null) return null;
  const parts = parseDateParts(normalizeDateValue(value));
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

type DateTripleProps = {
  idPrefix: string;
  value: string;
  hasError?: boolean;
  onChange: (value: string) => void;
};

export function DateTriple({
  idPrefix,
  value,
  hasError,
  onChange,
}: DateTripleProps) {
  const parts = parseDateParts(value ?? "");

  function update(next: Partial<DateParts>) {
    const merged = { ...parts, ...next };
    onChange(formatDateParts(merged));
  }

  function handleBlur() {
    const normalized = normalizeDateValue(value ?? "");
    if (normalized && normalized !== value) {
      onChange(normalized);
    }
  }

  return (
    <div className={styles.dateRow} onBlur={handleBlur}>
      <input
        id={`${idPrefix}-dd`}
        className={[styles.input, styles.datePart, hasError ? styles.inputError : ""]
          .filter(Boolean)
          .join(" ")}
        inputMode="numeric"
        placeholder="dd"
        maxLength={2}
        value={parts.day}
        aria-label="Día"
        onChange={(e) =>
          update({ day: e.target.value.replace(/\D/g, "").slice(0, 2) })
        }
      />
      <input
        id={`${idPrefix}-mm`}
        className={[styles.input, styles.datePart, hasError ? styles.inputError : ""]
          .filter(Boolean)
          .join(" ")}
        inputMode="numeric"
        placeholder="mes"
        maxLength={2}
        value={parts.month}
        aria-label="Mes"
        onChange={(e) =>
          update({ month: e.target.value.replace(/\D/g, "").slice(0, 2) })
        }
      />
      <input
        id={`${idPrefix}-yyyy`}
        className={[styles.input, styles.dateYear, hasError ? styles.inputError : ""]
          .filter(Boolean)
          .join(" ")}
        inputMode="numeric"
        placeholder="aaaa"
        maxLength={4}
        value={parts.year}
        aria-label="Año"
        onChange={(e) =>
          update({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })
        }
      />
    </div>
  );
}

export function SubCard({
  title,
  hint,
  children,
  onRemove,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  onRemove?: () => void;
}) {
  return (
    <div className={styles.subCard}>
      <div className={styles.subCardHeader}>
        <div>
          <h3 className={styles.subTitle}>{title}</h3>
          {hint ? <p className={styles.hint}>{hint}</p> : null}
        </div>
        {onRemove ? (
          <button type="button" className={styles.removeBtn} onClick={onRemove}>
            Quitar
          </button>
        ) : null}
      </div>
      <div className={styles.subCardBody}>{children}</div>
    </div>
  );
}

export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.addBtn} onClick={onClick}>
      {children}
    </button>
  );
}

type SearchableSelectProps = {
  id?: string;
  options: readonly string[];
  value: string;
  placeholder?: string;
  hasError?: boolean;
  onChange: (value: string) => void;
};

/**
 * Combobox propio (reemplaza datalist nativo): alineado al input,
 * al reabrir con un valor elegido muestra todas las opciones.
 */
export function SearchableSelect({
  id,
  options,
  value,
  placeholder,
  hasError,
  onChange,
}: SearchableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Si el texto es exactamente el valor ya elegido, mostrar todo el listado
    if (!q || (value && query === value)) {
      return [...options];
    }
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query, value]);

  function selectOption(opt: string) {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
  }

  return (
    <div className={styles.combo} ref={rootRef}>
      <input
        id={id}
        className={[styles.input, hasError ? styles.inputError : ""]
          .filter(Boolean)
          .join(" ")}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          onChange(next);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery(value);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      {open ? (
        <ul id={listId} className={styles.comboList} role="listbox">
          {filtered.length === 0 ? (
            <li className={styles.comboEmpty} role="presentation">
              Sin coincidencias
            </li>
          ) : (
            filtered.map((opt) => (
              <li key={opt} role="option" aria-selected={opt === value}>
                <button
                  type="button"
                  className={[
                    styles.comboOption,
                    opt === value ? styles.comboOptionActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(opt)}
                >
                  {opt}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
