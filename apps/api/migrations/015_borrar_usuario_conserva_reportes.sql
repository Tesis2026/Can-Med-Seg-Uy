-- Borrar una cuenta no puede llevarse los datos del análisis. Los reportes
-- enviados (cargados o importados) y el registro de exportaciones se conservan
-- sin usuario asociado. Los borradores sin enviar eran trabajo privado de esa
-- persona: se eliminan en la misma transacción que borra la cuenta.

CREATE OR REPLACE FUNCTION delete_drafts_of_deleted_user() RETURNS trigger AS $$
BEGIN
  DELETE FROM reports WHERE notifier_user_id = OLD.id AND status = 'en_progreso';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_delete_drafts ON users;
CREATE TRIGGER users_delete_drafts
  BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION delete_drafts_of_deleted_user();

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_notifier_user_id_fkey;
ALTER TABLE reports
  ADD CONSTRAINT reports_notifier_user_id_fkey
  FOREIGN KEY (notifier_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE export_logs ALTER COLUMN requested_by DROP NOT NULL;
ALTER TABLE export_logs DROP CONSTRAINT IF EXISTS export_logs_requested_by_fkey;
ALTER TABLE export_logs
  ADD CONSTRAINT export_logs_requested_by_fkey
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
