# report.js

Node.js script that reads `results/dashboard-summary.json` (produced by k6) and generates two standalone HTML reports.

---

## Output Files

| File                        | Audience   | Contents                                                              |
|-----------------------------|------------|-----------------------------------------------------------------------|
| `results/report-dev.html`   | Dev team   | API URLs, p(95) times, check pass/fail counts, failing conditions, fix recommendations |
| `results/report-client.html`| Client     | Plain-English feature names, speed labels, pass/fail status, impact descriptions |

---

## How to Run

```powershell
npm run report
```

Requires `results/dashboard-summary.json` to exist (produced by `k6 run`).

---

## How It Works

### 1. Parses the k6 JSON summary

Reads `metrics` (response times, error rates, thresholds) and `root_group` (check pass/fail counts) from the summary file.

### 2. Builds per-endpoint data

For each entry in `ENDPOINT_LABELS`, it looks up:
- `http_req_duration{name:<key>}` metric → extracts `p(95)` value
- Checks matching the endpoint key → sums `passes` and `fails`
- Evaluates failures: p(95) > 1500ms, or any check fails

### 3. Generates two HTML files

Both reports are self-contained HTML (no external dependencies) with inline CSS. They can be opened directly in any browser or emailed as attachments.

---

## ENDPOINT_LABELS

This object in `report.js` maps the k6 tag name to a human-readable label and URL path. It must stay in sync with the tags used in `tests/dashboard.ts`.

```js
const ENDPOINT_LABELS = {
  CalendarGames:      { label: 'Calendar – Games',          url: '/tournament/list/games/for/calendar' },
  CalendarEvents:     { label: 'Calendar – Events',         url: '/event/for/calendar' },
  CalendarTournaments:{ label: 'Calendar – Tournaments',    url: '/tournament/list/for/calendar' },
  CampList:           { label: 'Event List – Camps',        url: '/event/list?classTypes=camp' },
  ClinicList:         { label: 'Event List – Clinics',      url: '/event/list?classTypes=clinic' },
  DailyTrainingList:  { label: 'Event List – Daily Training',url: '/event/list?classTypes=dailytraining' },
  TournamentList:     { label: 'Tournament List',           url: '/tournament/list' },
  Me:                 { label: 'User Profile (Me)',         url: '/me' },
};
```

When you add a new endpoint to `dashboard.ts`, add a matching entry here.

---

## Speed Labels (Client Report)

Response times are translated to plain labels:

| p(95) value    | Label shown       |
|----------------|-------------------|
| < 500ms        | Fast              |
| 500ms – 1500ms | Acceptable        |
| > 1500ms       | Slow              |

---

## Failure Reasons

Two failure conditions are checked per endpoint:

| Condition              | Dev message                                              | Client message                                        |
|------------------------|----------------------------------------------------------|-------------------------------------------------------|
| p(95) > 1500ms         | Investigate slow DB queries or missing cache             | Users may experience delays on this section           |
| HTTP status !== 200    | Could be auth issues, server errors, or invalid data     | Some requests did not complete successfully           |

To add a new failure condition, extend the `failures` array inside `buildEndpoints()` and add a matching branch in `clientReason()`.

---

## Customising Report Appearance

Both reports use a shared `baseStyle` CSS string defined near the top of `report.js`. Colours, fonts, spacing, and layout are all in that one block — edit it to match your branding.

The dev report uses a blue header (`#0d47a1`), the client report uses green (`#1b5e20`).
