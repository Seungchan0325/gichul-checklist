# Repository Guidelines

## Project Structure & Module Organization

This repository is a Vite-powered React 19 and TypeScript frontend styled with Tailwind CSS 4. Application code lives in `src/`:

- `src/main.tsx` mounts the React application.
- `src/App.tsx` currently contains page flows, shared UI, mock exam data, and OMR behavior.
- `src/index.css` defines Tailwind imports, theme tokens, and global styles.
- `src/lib/supabase.ts` creates the optional Supabase client.

Static entry markup is in `index.html`. Build configuration is in `vite.config.ts` and `tsconfig*.json`. Generated `dist/`, dependencies, and local environment files are ignored. No dedicated test or asset directories exist yet; place tests beside their modules as `*.test.tsx` and reusable static files in `public/`.

## Build, Test, and Development Commands

- `npm install` installs locked dependencies.
- `npm run dev` starts the Vite development server with hot reload.
- `npm run build` runs TypeScript project checks and creates the production bundle in `dist/`.
- `npm run preview` serves the production bundle locally.
- `npm run lint` is reserved for ESLint; add an ESLint configuration before relying on it in CI.

Run `npm run build` before submitting changes.

## Coding Style & Naming Conventions

Use TypeScript and functional React components. Follow the existing two-space indentation and single-quote convention. Name components and types in PascalCase (`ExamPage`), functions and state in camelCase (`questionCount`), and constants descriptively. Keep Tailwind utilities close to their elements and use the existing `cn()` helper for conditional classes. Extract focused components when a page section gains independent state or complex rendering.

## Testing Guidelines

No automated test framework or coverage threshold is configured. For now, verify production builds and manually test mobile, tablet, desktop, and dark mode behavior. When adding tests, prefer Vitest with React Testing Library and name files `ComponentName.test.tsx`.

## Commit & Pull Request Guidelines

The history contains only `first commit`, so no established convention exists. Use short imperative commits such as `Fix OMR table alignment`. Pull requests should explain user-visible behavior, list verification performed, link relevant issues, and include screenshots for responsive or visual changes.

## Security & Configuration

Copy `.env.example` to `.env.local` for Supabase credentials. Never commit `.env*` secrets or service-role keys; frontend code must use only the public anon key.
