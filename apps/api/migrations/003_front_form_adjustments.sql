ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS contact_reporting_area_other varchar(100);

ALTER TABLE report_medicines
  ADD COLUMN IF NOT EXISTS composition_unit text NOT NULL DEFAULT 'percent';

ALTER TABLE report_medicines
  ALTER COLUMN amount_per_dose TYPE numeric(10,2)
  USING amount_per_dose::numeric(10,2);
