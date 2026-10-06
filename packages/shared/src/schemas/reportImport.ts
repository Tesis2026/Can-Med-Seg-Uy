import type { AdverseEventReportDraft } from './report';

export type ReportImportRow = {
  externalId: string;
  rowNumber: number;
  report: AdverseEventReportDraft;
  submittedAt: string | null;
  warnings: string[];
  errors: string[];
  duplicate: boolean;
};
export type ReportImportPreview = { rows: ReportImportRow[]; filename: string };
export type ReportImportResult = { imported: number; skipped: number; ids: string[] };
