# Olvidé mi contraseña — diseño

Fecha: 2026-09-25 · Estado: aprobado · Depende de: gestión de usuarios con better-auth

## Objetivo

Quien tiene una cuenta con email y contraseña puede recuperar el acceso por su cuenta:
pide un enlace desde el login, lo recibe por email y elige una contraseña nueva.

## Restricciones

- **Nada pago.** Envío por SMTP con nodemailer (MIT-0). Sirve cualquier SMTP gratuito
  (p. ej. Gmail con contraseña de aplicación) o el institucional.
- Sin SMTP configurado (desarrollo) el mail no se envía: se escribe en el log con el enlace.
- **Riesgo conocido:** las instancias gratuitas de Render pueden bloquear los puertos SMTP
  salientes. Verificarlo antes de desplegar; si ocurre, cambiar a un proveedor por HTTPS solo
  toca `apps/api/src/email/`.

## Envío de mails — `apps/api/src/email/mailer.ts`

`sendEmail({ to, subject, text, html })`, reutilizable por RF-12.

| Variable | Uso |
| --- | --- |
| `SMTP_HOST` | Si falta, modo log (desarrollo). |
| `SMTP_PORT` | Default 587. |
| `SMTP_SECURE` | `true` para TLS directo (465). Default `false` (STARTTLS). |
| `SMTP_USER` / `SMTP_PASS` | Credenciales; opcionales. |
| `EMAIL_FROM` | Remitente. Default `Farmacovigilancia MSP <no-responder@localhost>`. |

La plantilla del mail de recuperación vive en `apps/api/src/email/templates.ts` (texto plano y
HTML simple, en español).

## API

better-auth, en `emailAndPassword`:

- `sendResetPassword`: arma el enlace `WEB_BASE_URL/restablecer-contrasena?token=<token>` y lo
  envía. **No envía nada** si la cuenta está desactivada (`banned` o `disabled_at`).
- `resetPasswordTokenExpiresIn`: 1 hora. El token es de un solo uso.
- `revokeSessionsOnPasswordReset: true`.

La respuesta de `POST /api/auth/request-password-reset` es siempre la misma, exista o no el
email (better-auth ya lo hace así y simula el tiempo de búsqueda).

Rate limit de better-auth habilitado siempre (no solo en producción), con regla propia para
`/request-password-reset`: 3 pedidos por minuto por IP. Se agregan a los endpoints expuestos
`/auth/request-password-reset` y `/auth/reset-password`.

## Web

- Login: enlace «¿Olvidó su contraseña?» y aviso de éxito cuando se vuelve con `?restablecida=1`.
- `/olvide-contrasena`: campo de email. Al enviar muestra siempre «Si el email está registrado,
  le enviamos un enlace para restablecer la contraseña. Vence en 1 hora.».
- `/restablecer-contrasena?token=…`: nueva contraseña + confirmación, con la misma regla de
  largo que el alta. Enlace vencido, usado o ausente: mensaje y enlace para pedir otro. Éxito:
  redirige a `/login?restablecida=1`.
- Mismos estilos que el login (`LoginPage.module.css`).

Contratos nuevos en `packages/shared/src/schemas/adminUsers.ts`: `requestPasswordResetInputSchema`
y `resetPasswordInputSchema` (con confirmación).

## Verificación

1. `npm run typecheck`.
2. `curl`: pedir enlace → tomarlo del log → restablecer → login con la nueva; reusar el token
   falla; token inventado falla; cuenta desactivada no genera mail; las sesiones previas se
   cierran; el cuarto pedido en un minuto devuelve 429.
3. Recorrido de la UI con Playwright.

## Fuera de alcance

Cambio de contraseña desde el perfil, otros mails de RF-12, verificación de email.
