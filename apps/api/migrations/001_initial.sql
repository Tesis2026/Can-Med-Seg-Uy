CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM (
    'en_progreso', 'en_revision', 'aprobado_local',
    'aprobado_msp', 'enviado_msp', 'rechazado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gub_sub text UNIQUE,
  email text UNIQUE,
  disabled_at timestamptz,
  consent_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status report_status NOT NULL DEFAULT 'en_revision',
  notifier_user_id uuid REFERENCES users(id),
  patient_initials varchar(4) NOT NULL,
  patient_national_id text,
  patient_sex text NOT NULL,
  patient_weight_kg numeric(6,2),
  patient_height_m numeric(4,2),
  patient_birth_date varchar(10) NOT NULL,
  patient_age_at_event_start integer NOT NULL,
  patient_country_of_event_start text NOT NULL,
  adverse_event_description varchar(500) NOT NULL,
  severity_grade text,
  investigator_causal_relation text,
  previous_diseases varchar(500),
  has_concomitant_treatments boolean,
  additional_comments varchar(500),
  contact_reporting_area varchar(500),
  contact_profession text NOT NULL,
  contact_first_name varchar(50),
  contact_last_name varchar(50),
  contact_health_facility varchar(100),
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  send_email_receipt boolean NOT NULL DEFAULT false,
  form_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reports_status_created_at_idx ON reports (status, created_at DESC);
CREATE INDEX reports_notifier_user_id_idx ON reports (notifier_user_id);

CREATE TABLE report_adverse_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  position integer NOT NULL,
  meddra_term text NOT NULL,
  start_date varchar(10) NOT NULL,
  end_date varchar(10),
  duration_days integer,
  outcome text,
  is_serious boolean NOT NULL,
  seriousness_criterion text,
  UNIQUE (report_id, position)
);

CREATE TABLE report_medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  position integer NOT NULL,
  name text NOT NULL,
  company text,
  batch_number text,
  access_form text,
  presentation text,
  dose text,
  thc_percent numeric(5,2),
  cbd_percent numeric(5,2),
  other_percent numeric(5,2),
  doses_per_day integer,
  amount_per_dose integer,
  administration_route text,
  administration_start_date varchar(10) NOT NULL,
  administration_end_date varchar(10),
  administration_duration_days integer,
  recent_product_change boolean,
  recent_product_change_detail varchar(100),
  indication_text text,
  indication_category text,
  action_taken text,
  UNIQUE (report_id, position)
);

CREATE TABLE report_concomitants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  position integer NOT NULL,
  name text NOT NULL,
  mg_per_dose numeric(10,2),
  doses_per_day integer,
  start_date varchar(10) NOT NULL,
  end_date varchar(10),
  duration_days integer,
  UNIQUE (report_id, position)
);

CREATE TABLE report_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  medicine_id uuid REFERENCES report_medicines(id) ON DELETE CASCADE,
  original_name text NOT NULL,
  object_key text,
  mime_type text,
  size_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
