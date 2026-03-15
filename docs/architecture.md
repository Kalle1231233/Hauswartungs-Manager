# Technisches Konzept: Hauswartungs-Manager

## 1. Zielbild

Der Hauswartungs-Manager ist als mandantenfaehige SaaS-Web-Anwendung fuer kleine Hausverwaltungen, Eigentuemer sowie Hausmeister-Services ausgelegt. Die Architektur priorisiert:

- klare Tenant-Isolation pro Organisation
- einfache Erweiterbarkeit durch modulare Fachbereiche
- mobile Nutzbarkeit fuer Techniker/Hausmeister
- nachvollziehbare Dokumentation fuer Haftungs- und Nachweisfaelle
- API-First-Aufbau fuer spaetere Integrationen

## 2. Architekturentscheidung

### Backend

- **Node.js + TypeScript + Express**
- **Prisma ORM** mit PostgreSQL
- JWT Access Tokens + Refresh-Token-Rotation

**Begruendung:** Express ist fuer einen gruene-Wiese-Start leichtgewichtig und sehr flexibel. Die gewaehlte Struktur trennt HTTP, Anwendungslogik und Infrastruktur trotzdem sauber. So bleibt ein spaeterer Wechsel auf NestJS oder eine modulare Extraktion einzelner Module moeglich, ohne das Domain-Modell neu bauen zu muessen.

### Frontend

- **React + Vite + TypeScript**
- React Router fuer App-Navigation
- TanStack Query fuer Server-State

**Begruendung gegen Next.js im MVP:** Die Anwendung ist primaer ein geschuetztes B2B-/Backoffice-System. SEO und SSR sind anfangs nicht kritisch. Eine SPA mit separater API reduziert Komplexitaet, beschleunigt die Entwicklung und passt gut zur spaeteren mobilen Optimierung.

### Infrastruktur

- Lokale Entwicklung mit Docker Compose und PostgreSQL
- Dateiuploads zunaechst lokal als austauschbarer Storage-Adapter
- Architektur vorbereitet fuer spaetere Cloud-Deployments (z. B. EU/DE-Cloud mit Objekt-Storage, Managed PostgreSQL und Reverse Proxy)

## 3. Monorepo-Struktur

```text
apps/
  api/        Express-API, Prisma, Business-Logik
  web/        React-Frontend
packages/
  shared/     gemeinsame Enums, DTOs, Zod-Schemas, UI-nahe Typen
docs/
  architecture.md
```

## 4. Fachliche Kernbausteine

### Mandant / Organisation

Eine **Organisation** ist die zentrale Tenant-Grenze. Sie besitzt:

- Nutzer
- Immobilien/Objekte
- Tickets
- Wartungsplaene
- Dokumente
- Checklisten und Zeiteintraege

### Rollenmodell

- **SUPER_ADMIN**: SaaS-Anbieter, tenant-uebergreifend
- **ORG_ADMIN**: Kundenadministrator innerhalb genau einer Organisation
- **TECHNICIAN**: Hausmeister / Techniker
- **RESIDENT**: Bewohner / Mieter mit stark eingeschraenkten Rechten
- **SERVICE_PROVIDER**: externer Dienstleister mit Sicht nur auf zugewiesene Vorgaenge

## 5. Fachmodell (MVP)

### Stammdaten

- `Organization`
- `User`
- `Invitation`
- `Property`
- `Unit`
- `PropertyContact`
- `PropertyDocument`
- `ResidentAssignment`

### Operatives Arbeiten

- `Ticket`
- `TicketActivity`
- `TicketAttachment`
- `TimeEntry`

### Pruefpflichten / Wiederkehrer

- `MaintenancePlan`
- `MaintenanceOccurrence`

### Checklisten / Nachweise

- `ChecklistTemplate`
- `ChecklistTemplateItem`
- `ChecklistInstance`
- `ChecklistResponse`
- `ChecklistAttachment`

### Sicherheit / Audit

- `RefreshSession`
- `PasswordResetToken`
- `AuditLog`

## 6. Schichtenmodell

### Domain Layer

- Enums und Kernregeln, z. B. Ticket-Statusuebergaenge
- Tenant-Grenzen und Rollenregeln

### Application Layer

- Use-Cases wie:
  - Organisation registrieren
  - Nutzer einladen
  - Ticket anlegen / zuweisen / Status aendern
  - Wartungsinstanzen generieren
  - Checkliste abschliessen

### Infrastructure Layer

- Prisma-Zugriff
- JWT / Passwort-Hashing
- lokaler Dateispeicher
- Audit-Logging

### API Layer

- Express-Router
- Request-Validierung mit Zod
- Auth-/RBAC-Middleware

## 7. Tenant-Isolation

Tenant-Isolation wird auf mehreren Ebenen durchgesetzt:

1. JWT enthaelt `organizationId` und `role`
2. jeder schreibende und lesende Use-Case validiert die Organisationszugehoerigkeit
3. alle fachlichen Tabellen enthalten eine direkte `organizationId`
4. Rollenlogik begrenzt Sichtbarkeit zusaetzlich

Beispiele:

- `ORG_ADMIN` sieht alle Objekte und Tickets der eigenen Organisation
- `TECHNICIAN` sieht primär zugewiesene Tickets und relevante Wartungen
- `RESIDENT` darf nur Tickets fuer zugewiesene Einheiten/Objekte anlegen und eigene Vorgänge sehen

## 8. Sicherheitsgrundsaetze

- Passwort-Hashing mit bcrypt
- Access- und Refresh-Token getrennt
- Refresh-Token werden nur gehasht gespeichert
- Audit-Logging fuer Login, Rollenwechsel, Einladungen, Passwort-Reset und Statuswechsel
- Nutzer koennen deaktiviert werden
- Personenbezogene Daten bleiben auf wenige notwendige Felder begrenzt

## 9. Erweiterbarkeit nach MVP

Die Architektur ist bewusst auf Module ausgelegt, die spaeter sauber erweiterbar sind:

- OCR fuer Zaehlerstaende / Dokumentenerkennung
- Entsorger- und Kalender-Integrationen
- Push-/E-Mail-Benachrichtigungen
- Mobile App / PWA
- SLA- und Eskalationsregeln
- Angebots-/Abrechnungsfunktionen fuer Dienstleister

## 10. Umsetzungsreihenfolge

1. Monorepo + gemeinsame Typen
2. Authentifizierung + Organisationen + Rollen
3. Property- und Unit-Verwaltung
4. Ticketsystem inkl. Verlauf und Uploads
5. Wartungsplaene und Generierung faelliger Aufgaben
6. Checklisten / Protokolle
7. Uebersichten, Zeiterfassung und Grundtests
