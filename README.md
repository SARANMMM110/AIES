# AI Enterprise Studio (Client 5DF)

Centralized platform for independent AI agency products, with administrator-defined bundles.

**Stage 1** delivers the technical foundation only: project structure, database schema, authentication, roles, product/module model, access-control structure, API skeleton, admin foundation, and environment configuration. The 10 agency templates, marketplace UI, and advanced AI features are intentionally out of scope.

## Project structure

```
ai-enterprise-studio/
├── apps/
│   ├── api/                 # Express + TypeScript REST API
│   └── web/                 # Next.js frontend
├── packages/
│   ├── database/            # Prisma schema, migrations, seed, client
│   └── shared/              # Shared constants & types
├── docker-compose.yml       # Optional PostgreSQL (if Docker is available)
├── .env.example             # Environment template
└── README.md
```

### Architecture intent

- Each future agency is a **Product** record (plus resources/workflows), not a hard-coded module in the core app.
- **Bundles** are many-to-many collections of products via `BundleItem`.
- **ProductAccess** / **BundleAccess** grant per-user access so a user can own one product without unlocking all ten.
- Admin role gates management APIs; full CRUD UIs expand in later stages.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 10+
- PostgreSQL 14+ (local install or Docker)

## Install dependencies

From the repository root:

```bash
pnpm install
```

## Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set at least:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signing secret (min 32 characters) |
| `API_PORT` / `API_URL` | API listen port and public URL |
| `CORS_ORIGIN` / `APP_URL` | Frontend origin |
| `NEXT_PUBLIC_API_URL` | Browser-facing API base URL |
| `SEED_ADMIN_*` / `SEED_USER_*` | Optional seed credentials |

Never commit `.env`. Production must use strong unique secrets.

## Configure the database

1. Create an empty database (example):

```sql
CREATE DATABASE ai_enterprise_studio;
```

2. Point `DATABASE_URL` at that database.

3. Generate the Prisma client, run migrations, and seed:

```bash
pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed
```

For production deploys use `pnpm db:migrate` (`prisma migrate deploy`).

Optional Docker Postgres:

```bash
docker compose up -d
```

## Run the application

Development (API on `:4000`, web on `:3000`):

```bash
pnpm dev
```

Or separately:

```bash
pnpm dev:api
pnpm dev:web
```

Health check: [http://localhost:4000/api/health](http://localhost:4000/api/health)  
Web app: [http://localhost:3000](http://localhost:3000)

Default seed accounts (change after first login in real deployments):

- Admin: `admin@aies.local` / `Admin123!ChangeMe`
- User: `user@aies.local` / `User123!ChangeMe`

## Authentication

- **Register** → `POST /api/auth/register` (creates `USER` role)
- **Login** → `POST /api/auth/login` (returns JWT + creates server session)
- **Logout** → `POST /api/auth/logout` (revokes session)
- **Profile** → `GET /api/auth/me`

Passwords are hashed with **bcrypt**. Tokens are **JWTs** (`Authorization: Bearer <token>`). Sessions are stored hashed in `sessions` so logout/revocation works.

Roles:

- `ADMIN` — platform management, all products, admin dashboard
- `USER` — own profile, clients/projects, only granted products

Frontend stores the token in `localStorage` and protects routes via `Protected` + API middleware (`authenticate`, `requireAdmin`).

## Main database entities

| Entity | Role |
|---|---|
| `User` / `Session` | Accounts, roles, revocable auth |
| `Product` | Reusable agency product module |
| `ProductResource` | Services, guides, sales pages, copy, etc. |
| `WorkflowDefinition` | Product-scoped workflow templates |
| `Bundle` / `BundleItem` | Admin-defined product packs |
| `ProductAccess` / `BundleAccess` | Individual & bundle-based entitlements |
| `Client` / `Project` | Operator workspace foundation |
| `WorkflowProgress` / `WorkflowResult` | Progress + saved/generated outputs |

## Product / module architecture

Intended admin lifecycle (API ready; rich UI later):

1. **Create Product** (`POST /api/products`) — name, slug, pricing, draft status  
2. **Add resources** (`POST /api/products/:id/resources`) — services, workflows, operator guide, sales assets  
3. **Publish** (`POST /api/products/:id/publish`)  
4. Optionally place the product in one or more **bundles**  
5. Grant a user **direct** or **bundle** access without exposing unrelated products  

Agency implementations in Stage 2+ plug into this model; they are not hard-coded into the Stage 1 core.

## Stage 1 API surface

| Area | Base path |
|---|---|
| Health | `GET /api/health` |
| Auth | `/api/auth/*` |
| Users / profile | `/api/users/*` |
| Products | `/api/products/*` |
| Bundles | `/api/bundles/*` |
| Access control | `/api/access/*` |
| Clients | `/api/clients/*` |
| Projects | `/api/projects/*` |
| Workflows / results | `/api/workflows/*` |
| Admin foundation | `/api/admin/*` |

## Security foundation

- Password hashing (bcrypt)
- JWT + session revocation
- Auth middleware and role checks
- Zod input validation on write endpoints
- Helmet, CORS allowlist, JSON body limit
- Centralized API error handler
- Secrets via environment variables only

## Stage 2 — Central dashboard & product framework

Stage 2 adds:

- Access-scoped central user dashboard (`/dashboard`, `GET /api/dashboard/summary`)
- Admin console foundation with section navigation (`/admin/*`)
- Reusable product workspace (`/products/[slug]`) that dynamically renders services, workflows, and resources
- My Products list from `GET /api/products/available` (granted access only — not the full catalog)
- Product fields: `shortDescription`, `thumbnailUrl`, `icon`, `configuration`

Sample seed product: **Booking Flow Agency** (`booking-flow-agency`), published with demo services/workflows/resources and access granted to the demo user.

Stage 3 will populate the 10 real agency templates into this same framework without changing the core architecture.

## Stage 3A — Structured agency catalog

Stage 3A completes the **catalog and content architecture** (not full Agency Builder execution):

- 10 published agencies + **99** exact service names (`agency-catalog.ts`)
- Workflow **architecture + count targets** (no fabricated workflow bodies)
- Per-agency resources: Operator Guide, Client Sales Page, Sales Copy, Positioning, **Agency Business Strategy**
- Shared Agency Wiki (`/wiki`, `GET /api/shared/agency-wiki`)
- Agency Builder configuration field slots on each product
- Content status `STRUCTURE_READY` (AES original content authored in Stage 3B)

Validate: `pnpm db:validate`

Demo user access remains limited to: `booking-flow-agency`, `ai-advantage-agency`, `trust-builder-agency`.

Stage 3B builds the original AES Agency Business Builder & Operations Systems on this catalog.

## Stage 3B — Agency Builder & Operations Systems

Stage 3B turns the catalog into usable agency operating systems (original AES content — not vendor imports):

- Agency Setup (AI platform, niche, capacity, selected services) saved per user + product
- Enhanced client profiles linked to projects
- **306** original guided workflows with inputs, AI instructions, review gates, and next actions
- Reusable workflow engine: prepare instruction → external AI / paste output → human review → save
- Operator Guides, Business Strategy, Sales Pages, Sales Copy, Positioning, expanded shared Wiki
- Product workspace tabs: Overview / Setup / Services / Clients / Workflows / Resources / Results
- Workflow runner at `/products/[slug]/workflows/[workflowId]`

Content source of truth: `packages/database/prisma/content/` (see README there).

Validate: `pnpm db:validate` (exact 10 / 99 / 306 + non-empty resources)

Demo user access remains limited to: `booking-flow-agency`, `ai-advantage-agency`, `trust-builder-agency`.

## Stage 4 — Premium product UI + standalone HTML export

- Light/dark theme (`aes_theme`) with semantic design tokens; subtle per-product `configuration.accent`
- Reusable product shell (hero, setup, clients, services, workflow center, results, resources, wiki, help) — **no right sidebar**
- Workflow runner step rail + Copy / Open ChatGPT·Claude·Gemini (no API keys; no fake AI calls)
- Access-gated export: `GET /api/products/:slug/export/standalone` (`?format=html|json`)
- **Download HTML** / **Open in Browser** — offline single-file app with localStorage; one product’s workflows only

Export smoke (API running): `pnpm exec tsx scripts/smoke-stage4-export.ts`

