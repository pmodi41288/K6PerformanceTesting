# tests/dashboard.ts

k6 load test for all APIs called when the SketchPlay dashboard loads. Uses `http.batch()` to fire all requests in parallel, matching real browser behaviour.

---

## What It Tests

| Key (tag name)      | Endpoint                                        | Purpose                          |
|---------------------|-------------------------------------------------|----------------------------------|
| `CalendarGames`     | `/tournament/list/games/for/calendar`           | Games shown on the calendar      |
| `CalendarEvents`    | `/event/for/calendar`                           | Events shown on the calendar     |
| `CalendarTournaments` | `/tournament/list/for/calendar`               | Tournaments on the calendar      |
| `CampList`          | `/event/list?classTypes=camp`                   | Camp events list                 |
| `ClinicList`        | `/event/list?classTypes=clinic`                 | Clinic events list               |
| `DailyTrainingList` | `/event/list?classTypes=dailytraining`          | Daily training list              |
| `TournamentList`    | `/tournament/list`                              | Tournament list panel            |
| `Me`                | `/me`                                           | Logged-in user profile           |

---

## Thresholds

Each endpoint has its own tagged threshold:

```
http_req_duration{name:<TagName>}: p(95) < 1500ms
http_req_failed: rate < 1%
```

The test **fails** if any endpoint's 95th percentile response time exceeds 1500ms or if more than 1% of requests return a non-2xx status.

---

## Authentication

The API uses cookie-based auth. The JWT is passed as an environment variable and injected into the `Cookie` header:

```
Cookie: access_token=<ACCESS_TOKEN>
```

Always pass the token at run time — never hardcode it in the file:

```powershell
k6 run -e ACCESS_TOKEN=eyJhbGci... dist/dashboard.js
```

---

## Query Parameters

Two shared query string fragments are composed once and reused across requests:

- `calendarSuffix` — used by all three calendar endpoints (`isRegisterEvent`, `startDate`, `endDate`, `date`, `time`, `timeZone`)
- `eventListSuffix` — used by CampList, ClinicList, DailyTrainingList (`skip`, `limit`, `startDate`, `date`, `time`, `timeZone`)

All date/time/org values are driven by `__ENV` variables with defaults so they can be overridden without editing the file.

---

## Summary Output

`handleSummary` writes `results/dashboard-summary.json` after every run. This file is the input for `report.js`.

---

## How to Add a New Endpoint

1. Add a new key to the `http.batch({})` object:

```typescript
NewEndpoint: {
  method: 'GET',
  url: `${BASE_URL}/your/new/path?param=value`,
  params: tag('NewEndpoint'),
},
```

2. Add a `check` call after the batch:

```typescript
check(responses.NewEndpoint as Response, { 'NewEndpoint - status 200': (r) => r.status === 200 });
```

3. Add a threshold in `options`:

```typescript
'http_req_duration{name:NewEndpoint}': ['p(95)<1500'],
```

4. Register it in `report.js` → `ENDPOINT_LABELS`:

```js
NewEndpoint: { label: 'Human Readable Name', url: '/your/new/path' },
```

5. Rebuild: `npm run build`

---

## How to Change Load Parameters

Edit the `options` export at the top of `dashboard.ts`:

```typescript
export const options: Options = {
  vus: 20,        // number of concurrent virtual users
  duration: '5m', // how long the test runs
  ...
};
```

Or override at run time (duration only):

```powershell
k6 run -e ACCESS_TOKEN=... --duration 30s dist/dashboard.js
```
