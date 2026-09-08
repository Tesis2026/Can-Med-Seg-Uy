# Can-Med-Seg-Uy

Sistema de Farmacovigilancia de Cannabis Medicinal (Uruguay).

**Stack:** TypeScript · React (Vite) · Node.js (Fastify) · PostgreSQL

## Requisitos

- Node.js >= 20
- PostgreSQL con una base y un rol accesibles desde `DATABASE_URL`

### Crear la base de datos local

Con PostgreSQL instalado en Windows, abrir `psql` como administrador (ajustar la
versión de la ruta si corresponde):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres
```

Dentro de `psql`, crear el rol y la base. Estos comandos se ejecutan una sola vez:

```sql
CREATE ROLE canmedseg WITH LOGIN PASSWORD 'canmedseg';
CREATE DATABASE canmedseg OWNER canmedseg;
\q
```

La URL resultante coincide con el valor de desarrollo de `.env.example`:

```dotenv
DATABASE_URL=postgresql://canmedseg:canmedseg@localhost:5432/canmedseg
```

La creación del rol y la base prepara PostgreSQL; las tablas se crean y actualizan
después con `npm run db:migrate`.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # ajustar DATABASE_URL / PORT si hace falta
npm run db:migrate        # aplica apps/api/migrations en orden
npm run dev:api           # API en http://localhost:3000
npm run dev               # web en http://localhost:5173 (proxy /api y /mock-idp)
```

La web usa el proxy de Vite, así que en desarrollo todo queda en el mismo origen y
la cookie de sesión funciona sin configuración extra. Si la API corre en otro
puerto, definí `API_PROXY_TARGET` en el `.env`.

## Autenticación (GUB UY)

La app usa OIDC / Authorization Code Flow + PKCE. En desarrollo, `AUTH_PROVIDER=mock`
levanta un **IdP simulado** en `/mock-idp` con cuentas de prueba:

| Cuenta | Rol |
| --- | --- |
| María González | Usuario común |
| Diego Pereira | Profesional de la salud (médico) |
| Carlos Méndez | Investigador |
| Ana Rodríguez | Administrador |

Todas incluyen el rol de usuario común: cualquiera de ellas puede reportar, guardar
borradores y ver su historial, además de lo propio de su rol.

Los roles de la cuenta mock se siembran **solo en su primer ingreso**
(`MOCK_IDP_SEED_ROLES=true`); después los administra el administrador del sistema.

Para apuntar a GUB UY real no hay que tocar código: `AUTH_PROVIDER=gubuy` y las
variables `OIDC_*` del `.env`.

También se puede usar la app **sin iniciar sesión** (modo visitante): se puede
llenar y enviar un reporte, pero no hay borradores ni historial.

## Reportar sin sesión: CAPTCHA (RF-3.6)

Antes de enviar, un visitante debe resolver una **verificación de seguridad**. El
desafío lo genera y lo valida la API (`POST /api/captcha/challenge` y
`/api/captcha/verify`): la imagen se dibuja en el servidor y la respuesta nunca
viaja al navegador. Resolverlo devuelve un comprobante **de un solo uso** que se
adjunta al `POST /api/reports`; los usuarios logueados no lo necesitan.

Vencimientos y cantidad de intentos se configuran con las variables `CAPTCHA_*`
del `.env`. Cambiar a un proveedor externo (Turnstile, reCAPTCHA) solo afecta a
`apps/api/src/captcha/`.

## Borradores e historial

Con sesión iniciada, el formulario se guarda solo al pasar de sección: el reporte
queda en estado `en_progreso` y aparece en **Formularios en progreso**, desde
donde se retoma o se elimina. Al enviarlo, esa misma fila pasa a `en_revisión`,
así que el reporte conserva su identificador y aparece en el **Historial de
reportes enviados** con su estado.

Los borradores caducan por inactividad según `DRAFT_RETENTION_DAYS` (90 días por
defecto). Un visitante no tiene borradores ni historial: si cierra la pestaña sin
enviar, el formulario se descarta.

## Dashboard, exportaciones y reportes periódicos

Disponible para los roles **Investigador** y **MSP**.

- **Dashboard analítico** (`/dashboard`): los once gráficos del MVP sobre los
  reportes ya validados (`aprobado_local` y `enviado_msp`). Los filtros de la
  parte superior recalculan todos los gráficos, la tabla y la exportación, y
  quedan en la URL, así que una vista filtrada se puede compartir. Cada gráfico
  alterna entre la vista visual y la tabla de datos.
- **Exportaciones** (`/exportaciones`): descarga en XLSX o CSV de lo mismo que se
  está viendo. La cédula se reemplaza por un identificador estable por persona y
  el archivo no incluye nombre, apellido, correo ni teléfono. El XLSX trae una
  portada con los filtros y una hoja por módulo: reportes, eventos adversos,
  medicamentos y concomitantes. Cada descarga queda registrada en `export_logs`.
- **Reportes periódicos** (`/reportes-periodicos`): cada investigador elige la
  frecuencia (mensual, trimestral o semestral) y qué gráficos recibe. Sin
  configurar nada se envían todos.

El seudónimo se deriva de `PSEUDONYM_SECRET`: **cambiar esa variable rompe la
correspondencia** con los archivos ya exportados.

El planificador de envíos corre dentro de la API cada
`PERIODIC_REPORTS_INTERVAL_MINUTES`. Hoy deja el reporte armado en el log del
servidor; el envío por correo se conecta en Semana 8, en
`apps/api/src/periodic/periodicScheduler.ts`. El registro de envíos y el control
de duplicados por período ya funcionan.
