-- La composición declarada se puede cargar en porcentaje o en mililitros.
-- numeric(5,2) topeaba en 999,99, así que un volumen de 1000 ml o más hacía
-- fallar el envío del reporte. Se amplía a la misma precisión que el resto de
-- las cantidades del medicamento.
ALTER TABLE report_medicines
  ALTER COLUMN thc_percent TYPE numeric(10,2),
  ALTER COLUMN cbd_percent TYPE numeric(10,2),
  ALTER COLUMN other_percent TYPE numeric(10,2);
