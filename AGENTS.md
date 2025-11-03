# Repository Guidelines

## Project Structure & Module Organization
- Root: orchestrates both apps (`package.json` scripts).
- Backend (Express, CommonJS): `backend/src` (routes, controllers, services, repository, middleware), tests in `backend/tests/**`.
- Frontend (Next.js 14, React): `frontend/src/app/**` (app router), shared libs in `frontend/src/lib/**`, components in `frontend/src/components/**`.
- Docs/notes: various `*.md` in root.

## Build, Test, and Development Commands
- Install all: `npm run install:all`
- Run both apps (dev): `npm run dev`
- Backend only (dev): `npm run dev:backend`
- Frontend only (dev): `npm run dev:frontend`
- Build frontend: `npm run build`
- Start both (prod): `npm start`
- Tests (backend Jest): `npm test` or `cd backend && npm test`
- Coverage: `cd backend && npm run test:coverage`
- Lint (frontend): `npm run test:frontend` or `cd frontend && npm run lint`

## Coding Style & Naming Conventions
- Indentation: 2 spaces; keep file-local style consistent.
- Backend: CommonJS (`require`), single quotes, semicolons; filenames camelCase (e.g., `userService.js`).
- Frontend: ESM imports, Next.js conventions, JSX/TSX allowed; components PascalCase (e.g., `ProjectDetails.jsx`).
- Keep modules small: routes → controllers → services → repository.
- Use env vars; do not hardcode URLs/keys.

## Testing Guidelines
- Framework: Jest + Supertest (backend).
- Location: `backend/tests/**`; files end with `.test.js`.
- Run specific tests: `cd backend && npx jest path/to/file.test.js`.
- Aim for meaningful coverage on controllers, services, and routes.

## Commit & Pull Request Guidelines
- Commits: Prefer `[TICKET] type: short summary` (e.g., `[SCRUM-204] feat: add report filters`). Use imperative mood; keep subject ≤72 chars.
- PRs: include purpose, linked issue, test notes, and screenshots for UI changes. Describe any env/config changes.

## Security & Configuration Tips
- Required env: backend `.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SESSION_SECRET`, `PORT`); frontend uses `NEXT_PUBLIC_API_URL`.
- Never commit secrets. Strong `SESSION_SECRET` (≥32 chars) required in production.

## Agent-Specific Instructions
- Follow this file’s scope for all directories. Match existing patterns; avoid wide refactors. Prefer minimal, targeted changes with tests.
