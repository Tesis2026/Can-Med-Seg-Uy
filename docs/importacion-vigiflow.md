# Importación de VigiFlow

Los investigadores acceden a **Importar reportes** desde el inicio o el menú.
El flujo es seleccionar XLSX → analizar → revisar observaciones → confirmar.
Se importan únicamente los reportes sin errores y no existentes, en estado
`aprobado_local` («Aprobado para análisis»). No pasan por la bandeja de revisión.
El archivo adjunto de referencia contiene un reporte, un medicamento y una reacción.

## Mapeo

| VigiFlow | Campo del sistema / tratamiento |
| --- | --- |
| Número de identificación único mundial; Id del reporte de seguridad | Identificador externo; también enlaza las tres hojas. Se usa el ID de seguridad si no hay ID mundial. |
| Iniciales, Sexo, Fecha de nacimiento, Edad al comienzo de la reacción, Peso (kg) | Campos del paciente; edad solo cuando está expresada en años enteros. |
| Altura (cm) | Talla en metros, dividiendo entre 100. |
| Caso narrativo; Comentarios del notificador | Descripción del evento; comentarios adicionales. |
| Fecha de recepción inicial | Fecha de notificación, conservando el día original. La hora se fija a las 12 UTC porque la fuente no la informa. |
| Reacciones: LLT (o PT si LLT está vacío), fechas, Grave, criterios, Resultado | Eventos adversos repetibles. Se traducen categorías reconocidas a los valores del sistema. |
| Medicamentos: Sospechoso / Interacción / Interactuante | Medicamentos implicados. No se aplica un filtro automático por cannabis. |
| Medicamentos: Concomitante | Tratamientos concomitantes; nombre y fechas. |
| Nombre WHODrug (o nombre original), laboratorio, lote | Nombre del medicamento, compañía y lote. |
| Dosis (número y unidad), Dosis, Intervalo de dosificación | Texto de dosis conservando las tres fuentes; no se infieren gotas ni tomas diarias. |
| Forma farmacéutica y vía, preferentemente EDQM | Presentación y vía, cuando tienen equivalencia explícita. |
| Inicio/fin de administración, indicación, acción tomada | Campos correspondientes del medicamento. |
| Duración (en días enteros) | Duración del evento, medicamento o concomitante. Otras unidades permanecen en el original. |
| Organización (Notificador primario), Profesión del notificador | Establecimiento y profesión cuando no es ambigua. |

Las fechas completas `AAAAMMDD`, `AAAA-MM-DD` y `DD/MM/AAAA` se convierten a
`DD/MM/AAAA`. Fechas parciales o imposibles permanecen solo en el original y
generan una observación; sin fecha de recepción inicial válida no se importa.

No se deduce el departamento del paciente ni el país del evento de la dirección
del notificador. No se asume que un número de identificación sea una cédula.
Una concentración genérica (por ejemplo «10 %» de Cannabis sativa) no se asigna
automáticamente a THC o CBD. Tampoco se infieren causalidad, gravedad OMS,
enfermedades previas, email o teléfono. Los datos ausentes permanecen vacíos.
La gravedad desconocida se conserva como nula en la base y «Sin dato» en análisis.

Cada importación conserva las filas originales de las tres hojas, las advertencias,
el nombre y hash del archivo, el investigador y la fecha de importación. El detalle
del reporte muestra la procedencia y los datos originales, incluidos los campos
que no tienen equivalente en el formulario.

## Validación y duplicados

- Máximo 5 MB y 10.000 filas por hoja. Se limita también el tamaño
  declarado del contenido ZIP descomprimido y la cantidad de elementos.
- Deben existir las tres hojas y sus columnas identificatorias y principales.
- Se rechazan fórmulas, filas huérfanas y asociaciones de identificadores ambiguas.
- IDs repetidos en Reportes, roles desconocidos de medicamento o ausencia de
  reacciones/medicamentos implicados impiden importar el reporte afectado.
- La restricción única `(import_source, external_report_id)` evita duplicados,
  incluso con confirmaciones simultáneas. Una nueva versión de un reporte ya
  importado se omite; no reemplaza datos existentes.
- Confirmar vuelve a analizar el archivo en la API. No confía en los datos
  mapeados del navegador. Todos los nuevos reportes se guardan en una transacción.

## Pruebas

Los casos y resultados de la suite ampliada están en [Pruebas de importación](pruebas-importacion-vigiflow.md).

Desde la raíz: `node --import tsx --test apps/api/src/imports/vigiflow.test.ts`.
La prueba `import.integration.test.ts` requiere `IMPORT_TEST_DB=1` y una base local
migrada. Crea datos sintéticos, prueba permisos, concurrencia, detalle, estadísticas
y exportación, y elimina únicamente esos datos al terminar.
