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
- `/agenda` — dual-view schedule: **Semanal** (weekly grid, 40-min blocks) and **Diária** (daily timeline with per-slot detail, stats bar). Click any day header in weekly view to jump to daily view.
- `/confirmacoes` — Funil completo de confirmações (4 abas: Funil, Alertas, Encaixes, Dashboard)
- `/reports` — 3-tab reports (daily attendance chart, absences list, remaining sessions per patient)

### Confirmation Funnel (Confirmações)
- **Tab Funil**: all upcoming appointments with actions (WhatsApp 24h, WhatsApp 2ª tentativa 12h, Confirmar pela recepção, Não respondeu, Observação). Per-appointment expandable contact history.
- **Tab Alertas**: grouped by action-needed (Solicitaram Remarcação, Não Responderam, Aguardando Confirmação) with badges count
- **Tab Encaixes**: free time slots today/tomorrow + eligible patients (with remaining sessions) + WhatsApp oportunidade de encaixe template
- **Tab Dashboard**: operational metrics (total today, confirmed, waiting, no-response, rescheduling requests, absences, confirmation rate, free slots) + status distribution bar chart

### Business Rules
- 13 appointment statuses: agendado, mensagem_enviada, aguardando_confirmacao, confirmado, confirmado_recepcao, solicitou_remarcacao, nao_respondeu, presente, falta, cancelado, remarcado, encaixe, encaixe_preenchido
- Every status change auto-logs an entry in appointment_contacts table
- Marking "presente" decrements remainingSessions; reverting increments it back
- Conflict detection prevents double-booking the same therapist (excludes cancelado/remarcado)
- Reschedule creates new appointment with remarcado status on original
- Patient risk scoring: alto (>=3 faltas or >=40% falta+cancelado rate), medio (>=1 falta or >=20%), baixo
- patients.adhesionProfile column available for future use

### Additional Modules
- `/atestados` — Atestados e Declarações: create/print medical certificates and declarations (admin + fisioterapeuta). Tables: attestations, clinic_settings.
- `/aniversariantes` — Aniversariantes: birthday tracking with WhatsApp deeplink, discount dialog, CSV/PDF export, dashboard birthday alerts. Tables: birthday_actions, birthday_settings.
- `/planner` — Planner de Conteúdo: full content calendar with month/week/day/year views, task CRUD, AI assistant (OpenAI SSE streaming via Replit AI Integrations), Banco de Ideias, 8 content templates, stats dashboard. Tables: content_tasks, content_ideas, content_task_history. Dependency: @workspace/integrations-openai-ai-server.

### DB Tables
- appointments: core appointment table with all 13 statuses
- appointment_contacts: contact history per appointment (type, content, performedBy, createdAt)
- patients: includes adhesionProfile column
- user_sessions: PostgreSQL-backed express-session store (connect-pg-simple)
- attestations: medical certificates and declarations
- clinic_settings: clinic info for atestados
- birthday_actions: birthday contact/discount actions taken
- birthday_settings: birthday module configuration
- content_tasks: content planner tasks (tipo, objetivo, status, prioridade, canal, data, etc)
- content_ideas: idea bank for content
- content_task_history: audit log for content task changes

### Session Store
- connect-pg-simple, tableName: "user_sessions", createTableIfMissing: false (created via raw SQL)
