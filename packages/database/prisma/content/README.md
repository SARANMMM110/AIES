# Content source of truth (Stage 3B)

## Layout

| File | Role |
|------|------|
| `agency-catalog.ts` | 10 agencies, 99 approved services, workflow **targets**, builder field slots |
| `workflow-catalog.ts` | Generates **306** original AES guided workflows (purpose, inputs, instructions, review, next) |
| `resource-content.ts` | Operator Guides, Business Strategy, Sales Pages, Sales Copy, Positioning, shared Wiki |

## Principles

- Content is **original AI Enterprise Studio** material based on approved concepts — not vendor imports.
- Do not invent new service names outside `agency-catalog.ts`.
- Workflow counts must match Stage 3A targets exactly (validate with `pnpm db:validate`).
- Keep edits in these modules; seed reads them and upserts the database.

## Commands

```bash
pnpm db:seed
pnpm db:validate
```
