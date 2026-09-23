# T3adi?

![github_image_logo](docs\github.png)

An open-source, community-driven map for reporting dangerous road conditions
in Tunisia: flooding, potholes, blocked roads, and accidents or obstacles.

> **This project shows user-submitted, unverified reports.** It is not an
> official source of road-condition information and should never be the
> only thing you rely on when deciding whether a road is safe to drive on.

## Why this exists

Road infrastructure and weather conditions can make certain roads
dangerous or impassable with little warning — especially during heavy
rain, flooding, or winter weather. Official data isn't always available or
timely. This project lets drivers warn each other directly: report a
hazard, others confirm or dispute it, and reports fade out automatically
as they get stale so nobody relies on outdated information.

## How it works (short version)

1. Someone reports a hazard: type, severity, location.
2. It shows up on the map with a status color.
3. Other drivers confirm ("still there") or dispute ("it's clear now").
4. Reports automatically lose confidence over time and expire — a report
   from six hours ago is treated very differently from one confirmed five
   minutes ago.

Full design rationale, the freshness/decay algorithm, database schema, and
API design all live in [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md).

## Current status

The current MVP includes the interactive map, geolocation, multilingual search,
report creation, severity states, and an in-memory API. PostgreSQL/PostGIS,
authentication, moderation, and report verification are planned next and are
tracked in [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md).

## Tech stack

- **Frontend**: React + TypeScript + Vite + Leaflet + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database (planned)**: PostgreSQL + PostGIS
- **Auth (planned)**: Google OAuth (optional) + anonymous device-based reporting

## Getting started (local development)

### Prerequisites

- Node.js 20+
- Docker (for the local database)

### Setup

```bash
git clone https://github.com/aziztarchoun/T3adi.git
cd T3adi
npm install
cp .env.example .env      # then fill in any values you need (see comments)
docker compose up -d      # starts Postgres + PostGIS
```

Then, in separate terminals:

```bash
npm run dev:api   # starts the backend on http://localhost:4000
npm run dev:web   # starts the frontend on http://localhost:5173
```

Open http://localhost:5173 in your browser. For phone testing, use the LAN
address printed by Vite, for example `http://192.168.0.118:5173`.

See [`.env.example`](.env.example) for every environment variable and what
it's for.

## Share the MVP

The frontend is deployed automatically to GitHub Pages after pushes to
`main`:

<https://aziztarchoun.github.io/T3adi/>

GitHub Pages hosts the frontend only. To enable live reports and search on the
shared site, deploy the API separately and add a repository variable named
`VITE_API_BASE_URL` containing its public HTTPS URL. Local development uses
the Vite proxy and does not need this variable.

## Project structure

```
apps/web       React frontend
apps/api       Express backend
packages/shared   Types and validation schemas shared by both
docs/          Architecture, API, and database documentation
```

## Contributing

Contributions are very welcome, including from beginners. Please read
[`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request, and
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) for community expectations.

Good first places to look: open issues labeled `good first issue`, and the
milestone checklist in [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md#phase-10--development-roadmap).

## Security

Please see [`SECURITY.md`](SECURITY.md) for how to report a vulnerability
— do not open a public issue for security problems.

## License

[MIT](LICENSE)
