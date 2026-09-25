# Gestión de usuarios con better-auth — diseño

Fecha: 2026-09-25 · Estado: pendiente de revisión

## Objetivo

El administrador puede **crear** usuarios con contraseña, **borrarlos**, **activarlos** y
**desactivarlos** desde la web. El ingreso pasa a ser **email + contraseña** con
[better-auth](https://better-auth.com). El login con GUB UY queda en el código sin cambios de
lógica, marcado como deprecado momentáneamente y oculto de la interfaz.

Cubre RF-11.1 (listado) y RF-11.3 (deshabilitar) de `requirements/requirements.md`, más alta,
baja y asignación de contraseña. RF-11.2 (solicitudes de rol) queda fuera.

## Restricciones

- **Nada pago.** better-auth es MIT, se ejecuta dentro de la API y persiste en nuestro Postgres.
  Telemetría desactivada (`telemetry: { enabled: false }`). Sin proveedores de email ni SaaS.
- **GUB UY intacto.** No se borra ni se modifica su lógica. Se agrega el comentario
  `Registro con GUB UY: deprecado momentáneamente.` en cada archivo y método relacionado, y se
  ocultan sus puntos de entrada en la web.
- **Estilos de la app.** Las pantallas nuevas reutilizan `Page.module.css`,
  `Revision.module.css`, `LoginPage.module.css` y `components/ui/Button`.
- Node >= 20, Fastify 5, `pg`, sin ORM (igual que hoy).

## Decisiones

| Tema | Decisión |
| --- | --- |
| Integración | better-auth core (`emailAndPassword`) + plugin `admin`, invocado desde rutas Fastify propias. |
| Tabla de usuarios | better-auth usa la tabla existente `users` (mapeo de campos); `reports`, `user_roles`, etc. siguen apuntando a ella. |
| Roles | Siguen en `user_roles` (multi-rol + subtipo). `users.role` es un espejo para el plugin admin: `admin` si tiene ese rol, si no `user`. |
| Sesiones | better-auth usa su propia tabla `auth_sessions` y su cookie. La tabla `sessions` de GUB UY no cambia. |
| Registro público | Deshabilitado (`disableSignUp: true`). Solo el admin crea cuentas. |
| Desactivar | `banUser` de better-auth (bloquea el login y revoca sesiones) + `users.disabled_at = now()`. Activar revierte ambos. |
| Borrar | Borrado físico en cascada de todo lo que pertenece al usuario (ver «Borrado»). |
| Primer admin | Script CLI `npm run admin:create`. |

## Base de datos — `apps/api/migrations/009_better_auth.sql`

### Columnas nuevas en `users`

| Columna | Tipo | Campo better-auth |
| --- | --- | --- |
| `display_name` (existente) | text | `name` |
| `email` (existente) | text | `email` |
| `email_verified` | boolean NOT NULL DEFAULT false | `emailVerified` |
| `image` | text | `image` |
| `created_at` / `updated_at` (existentes) | timestamptz | `createdAt` / `updatedAt` |
| `role` | text | `role` (plugin admin) |
| `banned` | boolean NOT NULL DEFAULT false | `banned` |
| `ban_reason` | text | `banReason` |
| `ban_expires` | timestamptz | `banExpires` |

`identity_provider` para cuentas locales: `'local'`. El índice único
`(identity_provider, gub_sub)` no se ve afectado porque `gub_sub` queda NULL.

`display_name` pasa a ser obligatorio solo desde la API de administración (validación Zod);
en la base sigue nullable para no romper filas de GUB UY.

### Tablas nuevas

- `auth_accounts` (modelo `account`): `id uuid`, `user_id → users ON DELETE CASCADE`,
  `account_id`, `provider_id`, `password` (hash scrypt de better-auth), tokens opcionales,
  `created_at`, `updated_at`.
- `auth_sessions` (modelo `session`): `id uuid`, `user_id → users ON DELETE CASCADE`,
  `token` único, `expires_at`, `ip_address`, `user_agent`, `impersonated_by`, timestamps.
- `auth_verifications` (modelo `verification`): la exige el core aunque no se use hoy.

Ids con `advanced.database.generateId: "uuid"` para respetar las PK `uuid` existentes.

### Borrado en cascada

**Datos propios del usuario → `ON DELETE CASCADE`**

- `reports.notifier_user_id` (arrastra `report_adverse_events`, `report_medicines`,
  `report_concomitants`, `report_images`, `report_review_events`, `msp_outbox`, que ya tienen
  cascade sobre `reports`). Incluye borradores `en_progreso`.
- `export_logs.requested_by`.
- Ya en cascade hoy: `user_roles`, `sessions`, `role_requests`,
  `periodic_report_preferences`, `periodic_report_deliveries`.

**Marcas del usuario sobre datos de otros → `ON DELETE SET NULL`** (la columna pasa a nullable)

- `reports.reviewed_by`
- `report_review_events.reviewer_user_id`
- `user_roles.granted_by`
- `role_requests.decided_by`

Así, borrar a un investigador no borra los reportes de terceros que revisó.

## API

### Configuración — `apps/api/src/auth/betterAuth.ts`

```ts
betterAuth({
  database: pool,                       // pg.Pool existente
  basePath: "/api/auth",
  baseURL: config.WEB_BASE_URL,
  secret: config.BETTER_AUTH_SECRET,
  trustedOrigins: CORS_ORIGIN,
  telemetry: { enabled: false },
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
  user: { modelName: "users", fields: { name: "display_name", emailVerified: "email_verified", ... } },
  session: { modelName: "auth_sessions", expiresIn: SESSION_TTL_HOURS * 3600, fields: { ... } },
  account: { modelName: "auth_accounts", fields: { ... } },
  verification: { modelName: "auth_verifications", fields: { ... } },
  advanced: { database: { generateId: "uuid" } },
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
});
```

Variable nueva en `config.ts` y `.env.example`: `BETTER_AUTH_SECRET` (string >= 32, con
default solo para desarrollo, igual que `PSEUDONYM_SECRET`).

### Montaje en Fastify

Ruta comodín `/api/auth/*` que convierte la request de Fastify en `Request` (Fetch API) y
delega en `auth.handler`. Las rutas explícitas existentes (`/api/auth/session`, `/login`,
`/callback`, `/logout`, `/consent`) tienen prioridad en el router de Fastify, así que no
chocan. La web usa solo `POST /api/auth/sign-in/email` y `POST /api/auth/sign-out` de
better-auth; el estado de sesión se sigue leyendo de `GET /api/auth/session`.

### Contexto de autenticación — `authContext.ts`

1. Intenta `auth.api.getSession({ headers })` (cookie de better-auth).
2. Si no hay, cae a la cookie de GUB UY (código actual, marcado como deprecado).
3. En ambos casos arma el mismo `AuthContext` con `findSessionUser`, que ya rechaza usuarios
   con `disabled_at`.

`sessionId`, `expiresAt` y `token` salen de la sesión que haya resuelto. `POST /api/auth/logout`
revoca las dos (better-auth vía `auth.api.signOut` y la legacy si existe) y limpia ambas cookies.
El resto de la API (guards, reportes, dashboard) no cambia.

### Rutas de administración — `apps/api/src/admin/userAdminRoutes.ts`

Todas con `requirePermission(Permission.UsersManage)` y pasando los headers del admin a
`auth.api.*` para que better-auth también valide.

| Método y ruta | Acción |
| --- | --- |
| `GET /api/admin/users` | Lista: id, nombre, email, roles, estado (activo/inactivo), origen (local/GUB UY), alta, último ingreso. |
| `POST /api/admin/users` | `auth.api.createUser` + inserta `user_roles` + `role` espejo, en una transacción lógica (si falla el insert de roles, se borra el usuario creado). |
| `POST /api/admin/users/:id/password` | `auth.api.setUserPassword`. |
| `POST /api/admin/users/:id/deactivate` | `auth.api.banUser` + `disabled_at = now()`. |
| `POST /api/admin/users/:id/activate` | `auth.api.unbanUser` + `disabled_at = NULL`. |
| `DELETE /api/admin/users/:id` | `auth.api.removeUser`; la base borra en cascada. |

**Reglas**

- Un admin no puede desactivarse ni borrarse a sí mismo (400).
- No se puede desactivar ni borrar al último admin activo (409).
- Email duplicado → 409 con mensaje en español.
- Contraseña: mínimo 8 caracteres (mismo valor en Zod y en better-auth).
- Roles al crear: siempre incluye `comun`; `profesional_salud` exige subtipo.

Contratos Zod nuevos en `packages/shared/src/schemas/adminUsers.ts`
(`adminUserSchema`, `createUserInputSchema`, `setPasswordInputSchema`), exportados desde
`packages/shared/src/index.ts`.

### Primer admin — `apps/api/src/scripts/createAdmin.ts`

`npm run admin:create -- --email admin@ejemplo.uy --name "Admin" --password "..."`: crea el
usuario con `auth.api.createUser` (sin headers, permitido en servidor) y le asigna los roles
`comun` + `admin`. Si el email ya existe, le agrega el rol admin y actualiza la contraseña.

## Web

### Login — `LoginPage.tsx`

Formulario email + contraseña dentro de la misma tarjeta (`LoginPage.module.css`), con
«Ingresar», mensaje de error en el `errBox` existente («Email o contraseña incorrectos»,
«Su cuenta está deshabilitada»), y los enlaces «Volver al inicio» / «Continuar como
visitante». Llama a `POST /api/auth/sign-in/email` con `fetch` (sin agregar el cliente de
better-auth, no hace falta) y luego `refresh()` del `SessionContext`.

El bloque del botón «Ingresar con GUB UY» queda comentado en el JSX con la leyenda de
deprecado, igual que los mensajes de error propios del callback OIDC.

### Menú — `AppShell.tsx`

- «Iniciar sesión con GUB UY» → «Iniciar sesión» (apunta al mismo `/login`). El texto viejo
  queda comentado.
- Ítem nuevo «Gestión de usuarios» visible con `Permission.UsersManage`.

### Página nueva — `/admin/usuarios` (`GestionUsuariosPage.tsx`)

- Redirige al login sin sesión y muestra «No tiene permisos» sin `users:manage` (mismo
  patrón que `RevisionPage`).
- Encabezado + botón «Crear usuario».
- Tabla: nombre, email, roles (etiquetas de `ROLE_LABELS`), estado (badge Activo/Inactivo),
  último ingreso, acciones.
- Acciones por fila: «Cambiar contraseña», «Desactivar»/«Activar», «Borrar». Las acciones
  sobre uno mismo quedan deshabilitadas.
- Modal de alta: nombre, email, contraseña, roles (checkboxes; subtipo si es profesional de
  la salud). Errores de validación en línea, como el wizard de reporte.
- Modal de confirmación para borrar que avisa que se eliminan también sus reportes y
  borradores.
- Cliente en `features/admin/adminUsersApi.ts` sobre `lib/api.ts`.

### Otras vistas con GUB UY

`LandingPage.tsx` y `ReporteWizardPage.tsx` mencionan GUB UY: se comenta ese texto/botón con
la leyenda y se deja el equivalente neutro («Iniciar sesión»).

## Marcado de GUB UY como deprecado

Comentario de cabecera en: `oidcClient.ts`, `mockIdpRoutes.ts`, `mockAccounts.ts`,
`loginStateRepository.ts`, `sessionRepository.ts`, `cookies.ts`, migración `004` (no se
edita; se documenta en la `009`), variables `OIDC_*` y `AUTH_PROVIDER` en `config.ts` y
`.env.example`.

Comentario de método en: `GET /auth/login`, `GET /auth/callback`, `upsertUserFromIdentity`,
`sanitizeSeedRoles`, la rama legacy de `authContext`, `loginUrl` en `authApi.ts`, y en
`crypto.ts` solo `base64UrlSha256` y `verifyHs256Jwt` (el archivo lo usa también el captcha).

El IdP mock sigue montándose con `AUTH_PROVIDER=mock`, pero sin enlace en la interfaz. La
sección «Autenticación (GUB UY)» del `README.md` se reemplaza por la de email + contraseña y
el comando `admin:create`, con una nota sobre GUB UY deprecado.

## Errores

- better-auth devuelve `APIError`; las rutas de admin lo traducen a `{ message }` en español
  con el status correspondiente (400/401/403/404/409).
- Login con usuario baneado: better-auth responde 403 con `bannedUserMessage` configurado en
  español («Su cuenta está deshabilitada. Comuníquese con el administrador del sistema.»).

## Verificación

No hay runner de tests en el repo. Se verifica con:

1. `npm run typecheck` (shared, api, web).
2. `npm run db:migrate` sobre la base local.
3. Smoke con `curl`: `admin:create` → login admin → crear usuario → login del usuario →
   desactivar → login falla y su sesión deja de valer → activar → login ok → cambiar
   contraseña → borrar usuario con un reporte y comprobar en SQL que desaparecieron reporte,
   roles y sesiones, y que los `reviewed_by` de terceros quedaron en NULL.
4. Recorrido manual de la UI en el navegador (login, menú, tabla, modales, estados).

## Fuera de alcance

Autoregistro, recuperación de contraseña por email, cambio de contraseña por el propio
usuario, verificación de email, solicitudes de rol (RF-11.2), edición de roles de usuarios
existentes.
