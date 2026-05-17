# Contributing to SabScript

Thanks for contributing.

## Local Development

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy env vars and set DB/auth values:
   ```bash
   cp .env.example .env
   ```
4. Run migrations and seed:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
5. Start dev server:
   ```bash
   npm run dev
   ```

## Branch and Commit Guidelines

- Use focused branches: `feat/...`, `fix/...`, `chore/...`
- Keep commits small and descriptive.
- Reference issues in PR descriptions.

## Coding Standards

- TypeScript first, strict and explicit where needed.
- Prefer server-side validation for all write APIs.
- Keep Prisma schema and migrations in sync.
- Avoid breaking route contracts without updating consumers.

## Pull Requests

Include:

- What changed
- Why it changed
- How it was tested
- Screenshots/GIFs for UI changes

Checklist before opening PR:

- `npm run build` passes
- New migrations are included when schema changes
- No secrets in code or logs
- Docs updated when behavior changes

## Reporting Bugs

Please use the bug report template and include:

- Reproduction steps
- Expected vs actual behavior
- Environment (OS, Node version)
- Relevant logs/screenshots
