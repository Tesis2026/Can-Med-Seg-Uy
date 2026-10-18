-- Los reportes los cargan investigadores, sin bandeja de revisión de por medio:
-- los enviados con el formulario quedan aprobados para análisis, igual que los
-- importados. Se alinean los que ya estaban enviados.

UPDATE reports
   SET status = 'aprobado_local',
       updated_at = now()
 WHERE status = 'en_revision';
