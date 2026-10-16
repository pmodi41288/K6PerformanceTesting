# k6 Performance Testing — Dashboard

Load testing suite for the SketchPlay QA dashboard using [k6](https://k6.io). Tests all APIs fired when the dashboard loads, runs them in parallel with `http.batch()`, and generates two HTML reports after the run.

---

## Project Structure

```
├── tests/
│   └── dashboard.ts        # k6 load test — all dashboard APIs
├── config/
│   └── config.ts           # Shared helpers (BASE_URL, defaultHeaders, etc.) — not used by dashboard test directly
├── dist/
│   └── dashboard.js        # Compiled output (auto-generated, do not edit)
├── results/
│   ├── dashboard-summary.json   # Raw k6 output (auto-generated after run)
│   ├── report-dev.html          # Developer report (auto-generated)
│   └── report-client.html       # Client report (auto-generated)
├── report.js               # Node script that generates the two HTML reports
├── k6.config.json          # Lists test files in the project
├── package.json            # Scripts: build, typecheck, report
└── tsconfig.json           # TypeScript config for k6 environment
```

---

## Prerequisites

- [k6](https://k6.io/docs/getting-started/installation/) installed globally
- Node.js (for report generation)
- Run `npm install` once to install dev dependencies

---

## Running the Test

### Step 1 — Build

Compiles `tests/dashboard.ts` → `dist/dashboard.js`.

```powershell
npm run build
```

### Step 2 — Run

Replace the token with a valid JWT from the app.

```powershell
k6 run -e ACCESS_TOKEN=<your_jwt_token> dist/dashboard.js
```

Optional overrides via `-e` flags:

| Variable      | Default        | Description                        |
|---------------|----------------|------------------------------------|
| `ACCESS_TOKEN`| *(required)*   | JWT from `access_token` cookie     |
| `DATE`        | `2026-09-07`   | Current date for query params      |
| `START_DATE`  | `2026-09-01`   | Calendar range start               |
| `END_DATE`    | `2026-09-30`   | Calendar range end                 |
| `TIME`        | `06:33%20PM`   | Time param (URL-encoded)           |
| `TIMEZONE`    | `Asia/Calcutta`| Timezone for API queries           |
| `ORG_ID`      | *(empty)*      | Organisation ID filter             |

After the run, `results/dashboard-summary.json` is created automatically.

### Step 3 — Generate Reports

```powershell
npm run report
```

Opens two files in `results/`:
- `report-dev.html` — technical report for developers
- `report-client.html` — plain-English report for the client

---

## Test Configuration

Defined in `tests/dashboard.ts`:

| Setting     | Value  |
|-------------|--------|
| Virtual Users (VUs) | 20 |
| Duration    | 5 minutes |
| p(95) threshold per endpoint | < 1500 ms |
| Error rate threshold | < 1% |

---

## Adding a New Endpoint

See [tests/DASHBOARD_TEST.md](tests/DASHBOARD_TEST.md) for step-by-step instructions.

---

## Updating the Reports

See [REPORT.md](REPORT.md) for how `report.js` works and how to customise the output.
