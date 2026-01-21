# Staff Review Application

This is a staff review application with secure authentication and role-based access controls.

## Security Features

- **OIDC Authentication**: Secure login via Casdoor or other OIDC providers
- **Role-Based Access Control**: Three-tier permission system (employee, CHT, ASM)
- **Secure Session Management**: JWT tokens in httpOnly cookies
- **Input Validation**: All API inputs validated with Zod schemas
- **SQL Injection Prevention**: Parameterized database queries
- **CSRF Protection**: State parameter in OAuth flows
- **Security Headers**: Automatic security headers via Hono middleware

## Architecture

- **Frontend**: Vue.js with Univer.js spreadsheets
- **Backend**: Hono.js API server
- **Database**: Gel (EdgeDB-compatible)
- **Authentication**: OIDC with Casdoor

## Security Best Practices

See [SECURITY.md](./SECURITY.md) for detailed security documentation.

## Quick Start

See individual README files in `frontend/` and `server/` directories.