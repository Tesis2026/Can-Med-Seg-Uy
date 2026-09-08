import { useCallback, useEffect, useRef, useState } from "react";
import {
  createEmptyReportDraft,
  adverseEventReportDraftSchema,
  type AdverseEventReportDraft,
} from "@canmedseg/shared";

import { CONSENT_INICIO_STORAGE_KEY } from "../../components/consent";
import { ApiError } from "../../lib/api";
import {
  DRAFT_ID_STORAGE_KEY,
  DRAFT_OWNER_STORAGE_KEY,
  DRAFT_STORAGE_KEY,
} from "./options";
import { createDraft, fetchDraft, updateDraft } from "./reportApi";

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** Identidad del dueño del borrador; un visitante también es un dueño distinto. */
function ownerKey(userId: string | null): string {
  return userId ?? "visitante";
}

/**
 * Borra el borrador de la pestaña, su id en el servidor y el consentimiento
 * aceptado. Se usa al cerrar sesión y al detectar que lo guardado es de otra
 * persona: nadie debe ver ni continuar el formulario de otro usuario.
 */
export function clearReportDraftStorage(): void {
  for (const key of [
    DRAFT_STORAGE_KEY,
    DRAFT_ID_STORAGE_KEY,
    DRAFT_OWNER_STORAGE_KEY,
    CONSENT_INICIO_STORAGE_KEY,
  ]) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore quota / private mode
    }
  }
}

/**
 * Descarta lo guardado si pertenece a otra sesión. Es síncrono a propósito: corre
 * en el inicializador del estado, antes de que el formulario dibuje nada.
 */
function discardDraftOfOtherOwner(userId: string | null): void {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(DRAFT_OWNER_STORAGE_KEY);
  } catch {
    return;
  }
  if (stored !== null && stored === ownerKey(userId)) return;
  if (stored !== null) clearReportDraftStorage();
  try {
    sessionStorage.setItem(DRAFT_OWNER_STORAGE_KEY, ownerKey(userId));
  } catch {
    // ignore quota / private mode
  }
}

function loadDraft(): AdverseEventReportDraft {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return createEmptyReportDraft();
    const parsed: unknown = JSON.parse(raw);
    return adverseEventReportDraftSchema.parse(parsed);
  } catch {
    return createEmptyReportDraft();
  }
}

function readStoredDraftId(): string | null {
  try {
    return sessionStorage.getItem(DRAFT_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredDraftId(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(DRAFT_ID_STORAGE_KEY, id);
    else sessionStorage.removeItem(DRAFT_ID_STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Guarda el borrador. Si el id que tenía la pestaña ya no existe (se eliminó
 * desde otro dispositivo o caducó), se crea uno nuevo en vez de quedar en error.
 */
async function saveOrRecreate(
  targetId: string | null,
  report: AdverseEventReportDraft,
  options: { keepalive?: boolean },
) {
  if (!targetId) return createDraft(report, options);
  try {
    return await updateDraft(targetId, report, options);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    return createDraft(report, options);
  }
}

/** Evita crear borradores vacíos: solo se guarda lo que ya tiene algo cargado. */
function hasContent(draft: AdverseEventReportDraft): boolean {
  return draft.currentStep > 1 || draft.patient.initials.trim().length > 0;
}

export type DraftSaveState = "idle" | "saving" | "saved" | "error";

type UseReportDraftOptions = {
  /** El guardado parcial es solo para usuarios logueados (RF-4.1 / RF-4.4). */
  persist: boolean;
  /** Borrador a retomar desde «Formularios en progreso» (RF-4.5). */
  resumeId?: string | null;
  /** Descarta lo que haya en la pestaña y arranca un formulario vacío. */
  startFresh?: boolean;
  /** Usuario de la sesión; `null` para un visitante. Aísla el borrador por persona. */
  ownerId: string | null;
};

/**
 * Estado del asistente. La pestaña siempre conserva una copia de trabajo en
 * `sessionStorage`; con sesión iniciada además se persiste en el servidor como
 * reporte `en_progreso` al pasar de sección (RF-4.2).
 */
export function useReportDraft({
  persist,
  resumeId = null,
  startFresh = false,
  ownerId,
}: UseReportDraftOptions) {
  const [draft, setDraft] = useState<AdverseEventReportDraft>(() => {
    discardDraftOfOtherOwner(ownerId);
    return startFresh ? createEmptyReportDraft() : loadDraft();
  });
  // La referencia la mantienen `updateDraftState`, el retomado y `clearDraft`;
  // no se reasigna en cada render para que nunca retroceda a un valor viejo.
  const draftRef = useRef(draft);

  const [draftId, setDraftId] = useState<string | null>(() => {
    if (startFresh) return null;
    if (resumeId) {
      writeStoredDraftId(resumeId);
      return resumeId;
    }
    return readStoredDraftId();
  });
  const draftIdRef = useRef(draftId);

  const [saveState, setSaveState] = useState<DraftSaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(Boolean(resumeId));
  const [resumeError, setResumeError] = useState<string | null>(null);
  const savingRef = useRef(false);
  /** El formulario tiene cambios sin guardar en el servidor. */
  const dirtyRef = useRef(false);
  /**
   * El asistente sigue montado. Se reafirma en cada montaje: en desarrollo React
   * monta, desmonta y vuelve a montar, y si solo se marcara el desmontaje la
   * referencia quedaría en falso para siempre, impidiendo registrar el id del
   * borrador y creando uno nuevo en cada guardado.
   */
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!startFresh) return;
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore quota / private mode
    }
    writeStoredDraftId(null);
  }, [startFresh]);

  const persistLocally = useCallback((next: AdverseEventReportDraft) => {
    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota / private mode
    }
  }, []);

  /**
   * La referencia se actualiza de forma síncrona: `saveDraft()` se llama
   * inmediatamente después de cambiar de sección y necesita el borrador nuevo,
   * no el que React todavía no aplicó.
   */
  const updateDraftState = useCallback(
    (updater: (prev: AdverseEventReportDraft) => AdverseEventReportDraft) => {
      const next = updater(draftRef.current);
      draftRef.current = next;
      dirtyRef.current = true;
      persistLocally(next);
      setDraft(next);
    },
    [persistLocally],
  );

  useEffect(() => {
    if (!resumeId || !persist) {
      setResuming(false);
      return;
    }

    let cancelled = false;
    setResuming(true);
    setResumeError(null);

    void (async () => {
      try {
        const detail = await fetchDraft(resumeId);
        if (cancelled) return;
        const loaded = adverseEventReportDraftSchema.parse({
          ...detail.report,
          currentStep: detail.currentStep,
        });
        draftRef.current = loaded;
        setDraft(loaded);
        persistLocally(loaded);
        setDraftId(detail.id);
        draftIdRef.current = detail.id;
        writeStoredDraftId(detail.id);
        setSavedAt(new Date(detail.updatedAt));
        setSaveState("saved");
      } catch (error) {
        if (cancelled) return;
        // El borrador ya no está: la pestaña no debe seguir apuntándole.
        if (isNotFound(error)) {
          setDraftId(null);
          draftIdRef.current = null;
          writeStoredDraftId(null);
        }
        setResumeError(
          error instanceof Error ? error.message : "No se pudo abrir el borrador.",
        );
      } finally {
        if (!cancelled) setResuming(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resumeId, persist, persistLocally]);

  /** Autoguardado del borrador (RF-4.2). Sin sesión no hace nada (RF-4.4). */
  const saveDraft = useCallback(
    async (options: { keepalive?: boolean } = {}) => {
      const current = draftRef.current;
      if (!persist || savingRef.current) return;
      if (!draftIdRef.current && !hasContent(current)) return;

      savingRef.current = true;
      setSaveState("saving");
      setSaveError(null);
      try {
        const summary = await saveOrRecreate(draftIdRef.current, current, options);
        draftIdRef.current = summary.id;
        writeStoredDraftId(summary.id);
        dirtyRef.current = false;
        // Un guardado que termina después de cerrar el asistente persiste el
        // reporte, pero ya no toca el estado de la pantalla.
        if (!aliveRef.current) return;
        setDraftId(summary.id);
        setSavedAt(new Date(summary.updatedAt));
        setSaveState("saved");
      } catch (error) {
        if (!aliveRef.current) return;
        setSaveState("error");
        setSaveError(
          error instanceof Error ? error.message : "No se pudo guardar el borrador.",
        );
      } finally {
        savingRef.current = false;
      }
    },
    [persist],
  );

  /** Guarda al abandonar el asistente, solo si quedó algo sin guardar. */
  const saveIfDirty = useCallback(
    async (options: { keepalive?: boolean } = {}) => {
      if (!dirtyRef.current) return;
      await saveDraft(options);
    },
    [saveDraft],
  );

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore quota / private mode
    }
    writeStoredDraftId(null);
    const empty = createEmptyReportDraft();
    draftRef.current = empty;
    draftIdRef.current = null;
    dirtyRef.current = false;
    setDraftId(null);
    setDraft(empty);
    setSaveState("idle");
    setSavedAt(null);
  }, []);

  return {
    draft,
    draftRef,
    draftId,
    updateDraft: updateDraftState,
    clearDraft,
    saveDraft,
    saveIfDirty,
    saveState,
    savedAt,
    saveError,
    resuming,
    resumeError,
  };
}
