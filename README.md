# Hauswartungs-Manager

Technische Basis fuer eine mandantenfaehige SaaS-Web-App zur Verwaltung von Immobilien, Tickets, Wartungen und Nachweisdokumentation.

## Struktur

- `docs/architecture.md` - Architekturuebersicht und Begruendungen
- `apps/api` - Backend-API mit Prisma und PostgreSQL
- `apps/web` - React-Frontend
- `packages/shared` - gemeinsame Typen und Validierung

## Lokaler Start (nach Installation)

1. PostgreSQL starten:

   ```bash
   docker compose up -d
   ```

2. Abhaengigkeiten installieren:

   ```bash
   pnpm install
   ```

3. API-Umgebungsvariablen setzen:

   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

4. Prisma Client generieren:

   ```bash
   pnpm db:generate
   ```

5. Entwicklungsserver starten:

   ```bash
   pnpm dev
   ```
