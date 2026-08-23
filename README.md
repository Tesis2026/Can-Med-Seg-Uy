# Can-Med-Seg-Uy

Sistema de Farmacovigilancia de Cannabis Medicinal (Uruguay).

**Stack:** TypeScript · React (Vite) · Node.js (Fastify) · PostgreSQL

## Requisitos

- Node.js >= 20
- PostgreSQL con una base y un rol accesibles desde `DATABASE_URL`

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
