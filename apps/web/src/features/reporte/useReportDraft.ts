import { useCallback, useRef, useState } from "react";
import {
  createEmptyReportDraft,
  adverseEventReportDraftSchema,
  type AdverseEventReportDraft,
} from "@canmedseg/shared";

import { DRAFT_STORAGE_KEY } from "./options";

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

export function useReportDraft() {
  const [draft, setDraft] = useState<AdverseEventReportDraft>(() => loadDraft());
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const updateDraft = useCallback(
    (updater: (prev: AdverseEventReportDraft) => AdverseEventReportDraft) => {
      setDraft((prev) => {
        const next = updater(prev);
        draftRef.current = next;
        try {
          sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore quota / private mode
        }
        return next;
      });
    },
    [],
  );

  const clearDraft = useCallback(() => {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    const empty = createEmptyReportDraft();
    draftRef.current = empty;
    setDraft(empty);
  }, []);

  return { draft, draftRef, updateDraft, clearDraft };
}
