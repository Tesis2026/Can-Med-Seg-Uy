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

| Cuenta | Roles |
| --- | --- |
| María González | usuario común |
| Diego Pereira | profesional de la salud (médico) |
| Laura Silva | profesional de la salud (químico/a farmacéutico/a) |
| Carlos Méndez | investigador |
| Valeria Techera | validador MSP |
| Sofía Barrios | profesional de la salud (médica) + investigadora |
| Ana Rodríguez | administrador |

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
