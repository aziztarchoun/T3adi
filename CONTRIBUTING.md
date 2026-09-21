# Contributing to T3adi?

Thanks for considering contributing — this project is meant to be
approachable for first-time open-source contributors as well as solid
enough for experienced developers. Both kinds of contributions matter.

## Before you start

- Check open issues first — someone may already be working on it.
- For anything non-trivial (a new feature, a schema change, a new
  dependency), please open an issue to discuss the approach _before_
  writing code. This avoids wasted work.
- Small fixes (typos, docs, small bugs) can go straight to a pull request.

## Local setup

Follow the "Getting started" section in [`README.md`](README.md).

## Development workflow

1. Fork the repo and create a branch from `main`:
   `git checkout -b feat/short-description`
2. Make your changes.
3. Run checks locally before opening a PR:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run format:check
   ```
4. Commit with a clear message (we don't enforce a strict format, but
   describe _what_ and _why_, not just _what_).
5. Open a pull request using the template — link the issue it addresses.

## Code style

- TypeScript everywhere, `strict` mode — please don't add `any` without a
  comment explaining why it's unavoidable.
- Prettier handles formatting automatically (`npm run format`).
- Keep functions small and prefer explicit names over clever abbreviations
  — this project is meant to be readable by contributors seeing it for
  the first time.
- Business logic belongs in `src/services/`, not directly in route
  handlers — this keeps it testable and framework-independent.

## Tests

New backend logic (especially anything in `src/services/`, like the
report status/confidence algorithm) should have unit tests. We're not
chasing 100% coverage — we're chasing confidence that core logic behaves
as documented in `docs/PROJECT_PLAN.md`.

## Commit scope

Please keep pull requests focused on one thing. A PR that fixes a bug and
also reformats unrelated files is harder to review and more likely to be
delayed.

## Questions

Open a [Discussion](../../discussions) or comment on the relevant issue —
there's no such thing as a bad question here.
