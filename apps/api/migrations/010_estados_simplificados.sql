-- Los estados del MSP se desactivan: lo aprobado queda como `aprobado_local`.
-- Los valores siguen en el enum `report_status` para poder reactivarlos sin
-- migraciones; `msp_outbox` y el historial de revisión quedan sin cambios.

UPDATE reports
   SET status = 'aprobado_local',
       updated_at = now()
 WHERE status IN ('aprobado_msp', 'enviado_msp');
