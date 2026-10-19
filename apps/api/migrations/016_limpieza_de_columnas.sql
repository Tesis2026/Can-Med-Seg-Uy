-- Columnas que el sistema ya no completa ni consulta. La clasificación de
-- gravedad y el pedido de resumen por correo siguen, si existen, dentro de
-- `form_data`. Quién importó y cuándo ya lo registran `reports.notifier_user_id`
-- y `reports.created_at`.

ALTER TABLE reports
  DROP COLUMN IF EXISTS severity_grade,
  DROP COLUMN IF EXISTS send_email_receipt;

ALTER TABLE report_import_details
  DROP COLUMN IF EXISTS imported_by,
  DROP COLUMN IF EXISTS imported_at,
  DROP COLUMN IF EXISTS mapping_version;

ALTER TABLE user_roles
  DROP COLUMN IF EXISTS granted_at;

-- Índices de la bandeja de revisión y del envío al MSP.
DROP INDEX IF EXISTS reports_review_queue_idx;
DROP INDEX IF EXISTS reports_msp_pending_idx;
