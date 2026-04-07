# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Project: Agenda VitalFisio

Full-stack physiotherapy clinic management system (Brazilian Portuguese).

### Architecture
- **Frontend**: React + Vite, shadcn/ui, Tailwind CSS (teal palette), Wouter routing
  - Artifact: `artifacts/vitalfisio` (port 22415, preview path `/`)
- **Backend**: Express 5 + PostgreSQL + Drizzle ORM
  - Artifact: `artifacts/api-server`
- **Auth**: express-session (cookie-based), admin/admin credentials
- **API**: OpenAPI spec in `lib/api-spec/openapi.yaml`, hooks generated via Orval in `lib/api-client-react`

### Pages
- `/login` — authentication
- `/` — dashboard (today's summary + upcoming appointments)
- `/patients` — patient CRUD (cards, search, sessions counter)
- `/patients/:id/history` — full appointment history per patient
- `/therapists` — therapist CRUD
- `/agenda` — weekly visual schedule (40-min blocks: 08:00-11:20 & 13:30-16:50)
- `/reports` — 3-tab reports (daily attendance chart, absences list, remaining sessions per patient)

### Business Rules
- 7 appointment statuses: agendado, confirmado, presente, falta, cancelado, remarcado, encaixe
- Marking "presente" decrements remainingSessions; reverting increments it back
- Conflict detection prevents double-booking the same therapist (excludes cancelado/remarcado)
- Reschedule creates new appointment with remarcado status on original
