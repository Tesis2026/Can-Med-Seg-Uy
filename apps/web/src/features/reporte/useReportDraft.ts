import { useCallback, useEffect, useRef, useState } from "react";
import {
  createEmptyReportDraft,
  adverseEventReportDraftSchema,
  type AdverseEventReportDraft,
} from "@canmedseg/shared";

import { ApiError } from "../../lib/api";
import { DRAFT_ID_STORAGE_KEY, DRAFT_STORAGE_KEY } from "./options";
import { createDraft, fetchDraft, updateDraft } from "./reportApi";

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
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
  draftIdRef: { current: string | null },
  report: AdverseEventReportDraft,
  options: { keepalive?: boolean },
) {
  if (!draftIdRef.current) return createDraft(report, options);
  try {
    return await updateDraft(draftIdRef.current, report, options);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    draftIdRef.current = null;
    writeStoredDraftId(null);
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
}: UseReportDraftOptions) {
  const [draft, setDraft] = useState<AdverseEventReportDraft>(() =>
    startFresh ? createEmptyReportDraft() : loadDraft(),
  );
  // La referencia la mantienen `updateDraftState`, el retomado y `clearDraft`;
  // no se reasigna en cada render para que nunca retroceda a un valor viejo.
  const draftRef = useRef(draft);

  const [draftId, setDraftId] = useState<string | null>(() =>
    startFresh ? null : readStoredDraftId(),
  );
  const draftIdRef = useRef(draftId);

  const [saveState, setSaveState] = useState<DraftSaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(Boolean(resumeId));
  const [resumeError, setResumeError] = useState<string | null>(null);
  const savingRef = useRef(false);

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
        const summary = await saveOrRecreate(draftIdRef, current, options);
        draftIdRef.current = summary.id;
        setDraftId(summary.id);
        writeStoredDraftId(summary.id);
        setSavedAt(new Date(summary.updatedAt));
        setSaveState("saved");
      } catch (error) {
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
    saveState,
    savedAt,
    saveError,
    resuming,
    resumeError,
  };
}
