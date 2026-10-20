-- El departamento del paciente alimenta el gráfico por región y los filtros
-- del dashboard. Se completa en los reportes enviados que solo lo tenían
-- dentro del formulario guardado.

UPDATE reports
   SET patient_department = form_data->'patient'->>'department'
 WHERE patient_department IS NULL
   AND status <> 'en_progreso'
   AND form_data->'patient'->>'department' IS NOT NULL;
