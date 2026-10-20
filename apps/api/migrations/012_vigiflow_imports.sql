ALTER TABLE reports
  ADD COLUMN import_source text,
  ADD COLUMN external_report_id text;

CREATE UNIQUE INDEX reports_external_source_id_idx
  ON reports (import_source, external_report_id);

-- Los reportes externos pueden omitir datos exigidos por el formulario local.
-- Se conserva la ausencia del dato en lugar de inventar valores.
ALTER TABLE reports DROP CONSTRAINT reports_submitted_is_complete;
ALTER TABLE reports ADD CONSTRAINT reports_submitted_is_complete CHECK (
  status = 'en_progreso' OR (
    submitted_at IS NOT NULL AND (
      (COALESCE(import_source = 'vigiflow', false) AND external_report_id IS NOT NULL) OR (
        patient_initials IS NOT NULL AND patient_sex IS NOT NULL
        AND patient_birth_date IS NOT NULL AND patient_age_at_event_start IS NOT NULL
        AND patient_country_of_event_start IS NOT NULL
        AND adverse_event_description IS NOT NULL AND contact_profession IS NOT NULL
        AND contact_email IS NOT NULL AND contact_phone IS NOT NULL
      )
    )
  )
);
ALTER TABLE report_adverse_events ALTER COLUMN is_serious DROP NOT NULL;
-- Las narrativas externas no tienen el límite del formulario manual.
ALTER TABLE reports ALTER COLUMN adverse_event_description TYPE text,
  ALTER COLUMN additional_comments TYPE text;

CREATE TABLE report_import_details (
  report_id uuid PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
  imported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  filename text NOT NULL,
  file_sha256 text NOT NULL,
  mapping_version integer NOT NULL DEFAULT 1,
  source_data jsonb NOT NULL,
  warnings jsonb NOT NULL
);
