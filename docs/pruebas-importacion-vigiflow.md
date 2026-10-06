# Pruebas de importación VigiFlow

Ejecución: 6 de octubre de 2026, entorno local, Node.js 21.6.2 y PostgreSQL.
Resultado del ejecutor: **38 pruebas aprobadas, 0 fallos y 0 omitidas**.
El total incluye el caso de integración principal y sus 10 subcasos.
La comprobación de tipos de la API también pasó.

## Casos cubiertos

| Grupo | Casos y resultado esperado | Resultado |
| --- | --- | --- |
| Mapeo | Fechas, talla cm→m, sexo, presentación, resultado de reacción y datos originales | Aprobado |
| Datos desconocidos | No inferir THC/CBD, ubicación del paciente, gravedad ausente o edad en años a partir de meses | Aprobado |
| Módulos repetibles | Varias reacciones, medicamentos implicados y concomitantes vinculados al reporte correcto | Aprobado |
| Volumen | XLSX sintético con 1.001 reportes, cada uno con medicamento y reacción, sin límite de 1.000 | Aprobado (análisis, no carga masiva en DB) |
| Identificadores | ID mundial, ID de seguridad alternativo, aliases ambiguos, duplicados y filas huérfanas | Aprobado |
| Estructura | Hoja ausente, columna requerida ausente, encabezados duplicados y archivo sin reportes | Aprobado |
| Celdas | Texto enriquecido, fechas de Excel, coma decimal, tildes y mayúsculas; rechazo de fórmulas y errores Excel | Aprobado |
| Campos obligatorios | Recepción inválida, iniciales largas, reacción sin MedDRA, medicamento sin nombre, falta de sospechosos o reacciones | Aprobado |
| Categorías inesperadas | Valores desconocidos, incluidos nombres heredados de objetos JavaScript, generan observación sin interrumpir el análisis | Aprobado |
| Rangos numéricos | Edad y duración superiores al entero PostgreSQL se señalan como errores del reporte antes de guardar | Aprobado |
| Archivo inválido | ZIP truncado, contenido que no es XLSX, extensión incorrecta, base64 inválido, archivo vacío | Aprobado |
| Tamaño | Más de 5 MB, solicitud superior al límite HTTP y contenido descomprimido declarado superior a 50 MB | Aprobado |
| Permisos | Anónimo recibe 401; usuario común y administrador sin rol investigador reciben 403; investigador puede importar | Aprobado |
| Vista previa | Analizar no crea reportes en la base | Aprobado |
| Concurrencia | Dos confirmaciones simultáneas crean una sola copia | Aprobado |
| Reimportación | Un reporte existente se omite y conserva su contenido | Aprobado |
| Lote mixto | Nuevo válido se importa; duplicado y reporte con error se omiten | Aprobado |
| Persistencia | Estado aprobado_local, procedencia, dos reacciones, concomitante y gravedad desconocida nula | Aprobado |
| Consumo posterior | Consulta del detalle, tabla analítica y datos de exportación incluyen correctamente lo importado | Aprobado |

## Defectos encontrados y corregidos

1. La búsqueda de categorías accedía a propiedades heredadas de los objetos.
   Por ejemplo, «constructor» podía interrumpir el análisis. Ahora solo se
   aceptan claves propias del diccionario de equivalencias.
2. La edad y la duración podían superar el rango del entero PostgreSQL sin
   observación previa. Ahora generan errores por reporte antes de persistir,
   incluidos valores que JavaScript no puede representar como enteros válidos.

Ambas correcciones cuentan con pruebas de regresión.

## Repetir las pruebas

Pruebas del parser; el caso de integración se omite si no se habilita:

```powershell
npm run test:imports -w @canmedseg/api
```

Suite completa contra una base **local ya migrada**, usando el `.env` del proyecto:

```powershell
$env:IMPORT_TEST_DB = '1'
npm run test:imports -w @canmedseg/api
Remove-Item Env:IMPORT_TEST_DB
npm run typecheck -w @canmedseg/api
```

Los XLSX de prueba se generan en memoria con datos sintéticos. La integración
crea una cuenta temporal con identificador aleatorio y elimina sus reportes y
su cuenta en `finally`. No importa el archivo clínico original ni modifica
cuentas existentes.

## Alcance y limitaciones

Estas pruebas ejecutan el parser, las rutas HTTP de Fastify mediante `inject` y
la persistencia real en PostgreSQL. No sustituyen una prueba visual del navegador
ni una prueba de carga concurrente con muchos usuarios.

El XLSX original ya no estaba en su ruta temporal de Edge al intentar repetir su
análisis en esta ejecución. Por eso, los resultados de esta fecha corresponden a
los archivos sintéticos basados en la estructura que se inspeccionó anteriormente.
