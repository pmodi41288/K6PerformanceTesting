const fs = require('fs');

const DASHBOARD_JSON    = 'reports/dashboard-summary.json';
const TOURNAMENTS_JSON  = 'reports/tournaments-summary.json';
const CLIENT_REPORT     = 'reports/Sketchplay_Client_Report.html';
const DEV_REPORT        = 'reports/Sketchplay_Developer_Report.html';

// ─── API definitions per page ─────────────────────────────────────────────────
const DASHBOARD_APIS = [
  { key: 'CalendarGames',       label: 'Calendar Games',        trendKey: 'calendar_games_duration',       slowKey: 'calendar_games_slow_rate',       fastKey: 'calendar_games_fast_rate',       failKey: 'calendar_games_fail_rate',       countKey: 'calendar_games_count',       url: '/tournament/list/games/for/calendar' },
  { key: 'CalendarEvents',      label: 'Calendar Events',       trendKey: 'calendar_events_duration',      slowKey: 'calendar_events_slow_rate',      fastKey: 'calendar_events_fast_rate',      failKey: 'calendar_events_fail_rate',      countKey: 'calendar_events_count',      url: '/event/for/calendar' },
  { key: 'CalendarTournaments', label: 'Calendar Tournaments',  trendKey: 'calendar_tournaments_duration', slowKey: 'calendar_tournaments_slow_rate', fastKey: 'calendar_tournaments_fast_rate', failKey: 'calendar_tournaments_fail_rate', countKey: 'calendar_tournaments_count', url: '/tournament/list/for/calendar' },
  { key: 'CampList',            label: 'Camp List',             trendKey: 'camp_list_duration',            slowKey: 'camp_list_slow_rate',            fastKey: 'camp_list_fast_rate',            failKey: 'camp_list_fail_rate',            countKey: 'camp_list_count',            url: '/event/list?classTypes=camp' },
  { key: 'ClinicList',          label: 'Clinic List',           trendKey: 'clinic_list_duration',          slowKey: 'clinic_list_slow_rate',          fastKey: 'clinic_list_fast_rate',          failKey: 'clinic_list_fail_rate',          countKey: 'clinic_list_count',          url: '/event/list?classTypes=clinic' },
  { key: 'DailyTrainingList',   label: 'Daily Training List',   trendKey: 'daily_training_duration',       slowKey: 'daily_training_slow_rate',       fastKey: 'daily_training_fast_rate',       failKey: 'daily_training_fail_rate',       countKey: 'daily_training_count',       url: '/event/list?classTypes=dailytraining' },
  { key: 'TournamentList',      label: 'Tournament List',       trendKey: 'tournament_list_duration',      slowKey: 'tournament_list_slow_rate',      fastKey: 'tournament_list_fast_rate',      failKey: 'tournament_list_fail_rate',      countKey: 'tournament_list_count',      url: '/tournament/list' },
  { key: 'Me',                  label: 'User Profile (Me)',     trendKey: 'me_duration',                   slowKey: 'me_slow_rate',                   fastKey: 'me_fast_rate',                   failKey: 'me_fail_rate',                   countKey: 'me_count',                   url: '/me' },
];

const TOURNAMENTS_APIS = [
  { key: 'TournamentList', label: 'Tournament List', trendKey: 'tournament_list_duration', slowKey: 'tournament_list_slow_rate', fastKey: 'tournament_list_fast_rate', failKey: 'tournament_list_fail_rate', countKey: 'tournament_list_count', url: '/tournament/list' },
  { key: 'ClientType',     label: 'Client Type',     trendKey: 'client_type_duration',     slowKey: 'client_type_slow_rate',     fastKey: 'client_type_fast_rate',     failKey: 'client_type_fail_rate',     countKey: 'client_type_count',     url: '/client-type' },
  { key: 'CountryStates',  label: 'Country States',  trendKey: 'country_states_duration',  slowKey: 'country_states_slow_rate',  fastKey: 'country_states_fast_rate',  failKey: 'country_states_fail_rate',  countKey: 'country_states_count',  url: '/country/states' },
];

// ─── Load JSON summaries ──────────────────────────────────────────────────────
function loadSummary(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const dashData  = loadSummary(DASHBOARD_JSON);
const tourData  = loadSummary(TOURNAMENTS_JSON);

if (!dashData && !tourData) {
  console.error('No summary files found. Run k6 tests first.');
  process.exit(1);
}

// ─── Parse metrics from a k6 summary ─────────────────────────────────────────
function parseAPIs(summary, apiDefs) {
  if (!summary) return null;
  const m = summary.metrics || {};

  function tv(key) {
    const metric = m[key];
    return (metric && metric.values) ? metric.values : null;
  }

  return apiDefs.map(api => {
    const trend     = tv(api.trendKey);
    const slowVals  = tv(api.slowKey);
    const fastVals  = tv(api.fastKey);
    const failVals  = tv(api.failKey);
    const countVals = tv(api.countKey);

    const avg   = trend ? trend.avg        : null;
    const med   = trend ? trend.med        : null;
    const p90   = trend ? trend['p(90)']   : null;
    const p95   = trend ? trend['p(95)']   : null;
    const max   = trend ? trend.max        : null;
    const slowR = slowVals  ? slowVals.rate  : 0;
    const fastR = fastVals  ? fastVals.rate  : 0;
    const failR = failVals  ? failVals.rate  : 0;
    const count = countVals ? countVals.count: 0;
    const acceptR = Math.max(0, 1 - slowR - fastR);

    let status = 'PASS';
    if (failR >= 0.01)                        status = 'FAIL';
    else if (p95 !== null && p95 > 3000)      status = 'CRITICAL';
    else if (p95 !== null && p95 >= 1500)     status = 'SLOW';
    else if (slowR > 0.10)                    status = 'WARNING';

    return { ...api, avg, med, p90, p95, max, slowR, fastR, acceptR, failR, count, status };
  });
}

function sectionStats(apis) {
  if (!apis) return null;
  const total    = apis.reduce((s, a) => s + a.count, 0);
  const slowR    = total > 0 ? apis.reduce((s, a) => s + a.slowR * a.count, 0) / total : 0;
  const failR    = total > 0 ? apis.reduce((s, a) => s + a.failR * a.count, 0) / total : 0;
  const pass     = apis.filter(a => a.status === 'PASS').length;
  const warn     = apis.filter(a => a.status === 'WARNING').length;
  const slow     = apis.filter(a => a.status === 'SLOW' || a.status === 'CRITICAL').length;
  const fail     = apis.filter(a => a.status === 'FAIL').length;
  return { total, slowR, failR, pass, warn, slow, fail };
}

const dashAPIs  = parseAPIs(dashData,  DASHBOARD_APIS);
const tourAPIs  = parseAPIs(tourData,  TOURNAMENTS_APIS);
const dashStats = sectionStats(dashAPIs);
const tourStats = sectionStats(tourAPIs);

// ─── Overall across all pages ─────────────────────────────────────────────────
const allAPIs = [...(dashAPIs || []), ...(tourAPIs || [])];
const grandTotal = allAPIs.reduce((s, a) => s + a.count, 0);
const grandSlowR = grandTotal > 0 ? allAPIs.reduce((s, a) => s + a.slowR * a.count, 0) / grandTotal : 0;
const grandFailR = grandTotal > 0 ? allAPIs.reduce((s, a) => s + a.failR * a.count, 0) / grandTotal : 0;
const grandPass  = allAPIs.filter(a => a.status === 'PASS').length;
const grandWarn  = allAPIs.filter(a => a.status === 'WARNING').length;
const grandSlow  = allAPIs.filter(a => a.status === 'SLOW' || a.status === 'CRITICAL').length;
const grandFail  = allAPIs.filter(a => a.status === 'FAIL').length;

let overallRating = 'EXCELLENT';
if (grandFail > 0 || allAPIs.some(a => a.p95 > 3000))              overallRating = 'POOR';
else if (allAPIs.some(a => a.p95 >= 1500) || grandSlowR >= 0.10)   overallRating = 'NEEDS IMPROVEMENT';
else if (grandSlow <= 1 && grandSlowR < 0.10)                       overallRating = 'GOOD';

const testDate = new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'medium' });

// ─── Formatters ───────────────────────────────────────────────────────────────
function ms(v)   { if (v === null || v === undefined) return 'N/A'; return v < 1000 ? `${Math.round(v)}ms` : `${(v/1000).toFixed(2)}s`; }
function pct(r)  { if (r === null || r === undefined) return '0.00%'; return `${(r*100).toFixed(2)}%`; }
function fmt(n)  { return Number(n||0).toLocaleString(); }

function statusColor(s) { return {PASS:'#2e7d32',WARNING:'#f57f17',SLOW:'#e65100',FAIL:'#b71c1c',CRITICAL:'#7b1fa2'}[s]||'#333'; }
function statusBg(s)    { return {PASS:'#e8f5e9',WARNING:'#fff9c4',SLOW:'#fff3e0',FAIL:'#ffebee',CRITICAL:'#f3e5f5'}[s]||'#f5f5f5'; }
function badge(s)       { return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:700;background:${statusBg(s)};color:${statusColor(s)}">${s}</span>`; }
function ratingColor(r) { return {EXCELLENT:'#1b5e20',GOOD:'#2e7d32','NEEDS IMPROVEMENT':'#e65100',POOR:'#b71c1c'}[r]||'#333'; }

function severity(api) {
  if (api.status === 'CRITICAL' || api.failR >= 0.01) return 'Critical';
  if (api.status === 'SLOW')    return 'High';
  if (api.status === 'WARNING') return 'Warning';
  return 'Low';
}

function fixHint(api) {
  const hints = [];
  if (api.failR >= 0.01)
    hints.push('Suggested investigation: Review application/server logs for HTTP errors, exceptions, timeouts, authentication failures, and connection exhaustion.');
  if (api.p95 !== null && api.p95 > 3000)
    hints.push('Suggested investigation: The API appears consistently slow. Review database query execution, indexing, payload size, and dependent services.');
  else if (api.p95 !== null && api.p95 >= 1500)
    hints.push(api.avg < 1000
      ? 'Suggested investigation: Intermittent latency detected. Review slow DB queries, locking, cache misses, and backend processing spikes.'
      : 'Suggested investigation: API appears consistently slow. Review DB execution, indexing, application processing, and payload size.');
  if (api.max > 3000 && api.p95 < 1500)
    hints.push('Suggested investigation: Occasional spikes detected. Review GC pressure, DB locks, connection pool, or cold-cache requests.');
  if (api.slowR > 0.10 && api.p95 < 1500)
    hints.push('Potential bottleneck: High slow-request rate despite acceptable p95. Review DB indexes and query plan.');
  return hints.length ? hints.join(' ') : 'Possible area to review: No threshold violations detected. Monitor under higher concurrency.';
}

function clientImpact(api, page) {
  if (api.failR >= 0.01 && api.p95 >= 1500) return `The ${page} page may load slowly or fail for some users.`;
  if (api.failR >= 0.01)  return `Some users may see errors on the ${page} page.`;
  if (api.p95 >= 1500)    return `Users may experience delayed loading on the ${page} page.`;
  return `Minor degradation may be noticeable under high load.`;
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────
const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f6fa;color:#222;font-size:14px}
  .page-header{padding:24px 40px 16px;color:#fff}
  .page-header h1{font-size:1.5rem;font-weight:700;margin-bottom:4px}
  .page-header p{opacity:.8;font-size:.88rem}
  main{padding:24px 40px;max-width:1200px;margin:0 auto}
  .section{margin-bottom:40px}
  .section-header{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:8px;border-bottom:3px solid}
  .section-header h2{font-size:1.1rem;font-weight:700}
  .section-badge{padding:4px 14px;border-radius:20px;font-size:.78rem;font-weight:700}
  .cards{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px}
  .card{background:#fff;border-radius:10px;padding:16px 20px;flex:1;min-width:120px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .card .lbl{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:#777;margin-bottom:3px}
  .card .val{font-size:1.6rem;font-weight:700}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:16px;font-size:.84rem}
  th{color:#fff;padding:11px 14px;text-align:left;font-size:.74rem;text-transform:uppercase;letter-spacing:.05em}
  td{padding:10px 14px;border-bottom:1px solid #f0f0f0;vertical-align:top}
  tr:last-child td{border-bottom:none}
  tr:nth-child(even) td{background:#fafafa}
  .mono{font-family:Consolas,monospace;font-size:.79rem;color:#1565c0}
  h3{font-size:.92rem;font-weight:700;margin:18px 0 10px;color:#555}
  .rating-box{text-align:center;padding:22px;background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:24px}
  .rating-box .rl{font-size:.82rem;color:#777;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em}
  .rating-box .rv{font-size:2rem;font-weight:800}
  .overall-cards{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}
  footer{text-align:center;font-size:.75rem;color:#aaa;padding:24px;margin-top:8px}
  .no-data{color:#999;font-style:italic;padding:16px;text-align:center}
`;

// ─── Section HTML builders ────────────────────────────────────────────────────
function devSection(apis, sectionLabel, thColor, borderColor) {
  if (!apis) return `<p class="no-data">${sectionLabel} — test not yet run</p>`;
  const stats = sectionStats(apis);
  const problemAPIs = apis.filter(a => a.status !== 'PASS');

  const rows = apis.map(a => `
    <tr>
      <td><strong>${a.label}</strong><br><span class="mono">${a.url}</span></td>
      <td>${fmt(a.count)}</td><td>${ms(a.avg)}</td><td>${ms(a.med)}</td>
      <td>${ms(a.p90)}</td><td>${ms(a.p95)}</td><td>${ms(a.max)}</td>
      <td>${pct(a.slowR)}</td><td>${pct(a.failR)}</td>
      <td style="color:${a.failR>=0.01?'#b71c1c':'#2e7d32'}">${a.failR>=0.01?'Mixed':'200'}</td>
      <td>${badge(a.status)}</td>
    </tr>`).join('');

  const problemRows = problemAPIs.length === 0
    ? `<tr><td colspan="6" style="text-align:center;color:#2e7d32;padding:16px">All APIs passed — no issues detected</td></tr>`
    : problemAPIs.map(a => `
      <tr>
        <td><strong>${a.label}</strong></td>
        <td>${a.p95 >= 1500 ? `High latency (P95 ${ms(a.p95)})` : a.slowR > 0.10 ? `High slow rate (${pct(a.slowR)})` : `Failure rate ${pct(a.failR)}`}</td>
        <td>${a.p95 !== null ? `P95 ${ms(a.p95)}, Slow ${pct(a.slowR)}, Fail ${pct(a.failR)}` : `Slow ${pct(a.slowR)}`}</td>
        <td>P95 &lt;1500ms / Slow &lt;10% / Fail &lt;1%</td>
        <td><strong style="color:${statusColor(severity(a)==='Critical'?'CRITICAL':severity(a)==='High'?'SLOW':'WARNING')}">${severity(a)}</strong></td>
        <td style="font-size:.81rem;color:#444">${fixHint(a)}</td>
      </tr>`).join('');

  const statusLabel = stats.fail > 0 ? 'FAIL' : stats.slow > 0 ? 'SLOW' : stats.warn > 0 ? 'WARNING' : 'PASS';

  return `
  <div class="section">
    <div class="section-header" style="border-color:${borderColor}">
      <h2 style="color:${borderColor}">${sectionLabel}</h2>
      <span class="section-badge" style="background:${statusBg(statusLabel)};color:${statusColor(statusLabel)}">${statusLabel}</span>
    </div>
    <div class="cards">
      <div class="card"><div class="lbl">APIs</div><div class="val">${apis.length}</div></div>
      <div class="card"><div class="lbl">Requests</div><div class="val">${fmt(stats.total)}</div></div>
      <div class="card"><div class="lbl">Passed</div><div class="val" style="color:#2e7d32">${stats.pass}</div></div>
      <div class="card"><div class="lbl">Warning</div><div class="val" style="color:#f57f17">${stats.warn}</div></div>
      <div class="card"><div class="lbl">Slow/Critical</div><div class="val" style="color:#e65100">${stats.slow}</div></div>
      <div class="card"><div class="lbl">Failed</div><div class="val" style="color:#b71c1c">${stats.fail}</div></div>
      <div class="card"><div class="lbl">Slow %</div><div class="val">${pct(stats.slowR)}</div></div>
      <div class="card"><div class="lbl">Fail %</div><div class="val">${pct(stats.failR)}</div></div>
    </div>

    <h3>API Performance Summary</h3>
    <table>
      <thead><tr style="background:${thColor}">
        <th>API / Endpoint</th><th>Requests</th><th>Avg</th><th>Median</th>
        <th>P90</th><th>P95</th><th>Max</th><th>Slow %</th><th>Failed %</th><th>HTTP</th><th>Result</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <h3>APIs Requiring Attention</h3>
    <table>
      <thead><tr style="background:${thColor}">
        <th>API</th><th>Problem</th><th>Observed</th><th>Expected</th><th>Severity</th><th>Investigation Hint</th>
      </tr></thead>
      <tbody>${problemRows}</tbody>
    </table>
  </div>`;
}

function clientSection(apis, sectionLabel, pageName, thColor, borderColor) {
  if (!apis) return `<p class="no-data">${sectionLabel} — test not yet run</p>`;
  const stats = sectionStats(apis);
  const problemAPIs = apis.filter(a => a.status !== 'PASS');
  const statusLabel = stats.fail > 0 ? 'FAIL' : stats.slow > 0 ? 'SLOW' : stats.warn > 0 ? 'WARNING' : 'PASS';

  const rows = apis.map(a => `
    <tr>
      <td><strong>${a.label}</strong></td>
      <td>${fmt(a.count)}</td><td>${ms(a.avg)}</td><td>${ms(a.p95)}</td>
      <td>${pct(a.slowR)}</td><td>${pct(a.failR)}</td>
      <td>${badge(a.status)}</td>
    </tr>`).join('');

  const problemRows = problemAPIs.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:#2e7d32;padding:16px">All APIs are performing within the defined targets</td></tr>`
    : problemAPIs.map(a => {
        const issues = [];
        if (a.p95 >= 1500) issues.push(`Response time above target (P95 ${ms(a.p95)})`);
        if (a.slowR > 0.10) issues.push(`${pct(a.slowR)} of requests are slow`);
        if (a.failR >= 0.01) issues.push(`${pct(a.failR)} failure rate`);
        return `<tr>
          <td><strong>${a.label}</strong></td>
          <td>${issues.join('; ') || 'Performance near threshold'}</td>
          <td>P95 ${ms(a.p95)} / Slow ${pct(a.slowR)}${a.failR>=0.01?' / Fail '+pct(a.failR):''}</td>
          <td>P95 &lt;1500ms / Fail &lt;1%</td>
          <td style="font-size:.84rem">${clientImpact(a, pageName)}</td>
        </tr>`;
      }).join('');

  const distRows = apis.map(a => {
    const fp = Math.round(a.fastR * 100);
    const sp = Math.round(a.slowR * 100);
    const ap = Math.max(0, 100 - fp - sp);
    const perf = a.slowR > 0.30 ? 'Poor' : a.slowR > 0.10 ? 'Needs Improvement' : a.slowR > 0.05 ? 'Acceptable' : 'Good';
    return `<tr>
      <td><strong>${a.label}</strong></td>
      <td style="color:#2e7d32"><strong>${fp}%</strong></td>
      <td style="color:#e65100"><strong>${ap}%</strong></td>
      <td style="color:#b71c1c"><strong>${sp}%</strong></td>
      <td>${perf}</td>
    </tr>`;
  }).join('');

  return `
  <div class="section">
    <div class="section-header" style="border-color:${borderColor}">
      <h2 style="color:${borderColor}">${sectionLabel}</h2>
      <span class="section-badge" style="background:${statusBg(statusLabel)};color:${statusColor(statusLabel)}">${statusLabel}</span>
    </div>
    <div class="cards">
      <div class="card"><div class="lbl">APIs Tested</div><div class="val">${apis.length}</div></div>
      <div class="card"><div class="lbl">Total Requests</div><div class="val">${fmt(stats.total)}</div></div>
      <div class="card"><div class="lbl">Passed</div><div class="val" style="color:#2e7d32">${stats.pass}</div></div>
      <div class="card"><div class="lbl">Slow / Issues</div><div class="val" style="color:#e65100">${stats.slow + stats.warn}</div></div>
      <div class="card"><div class="lbl">Failed</div><div class="val" style="color:#b71c1c">${stats.fail}</div></div>
      <div class="card"><div class="lbl">Slow %</div><div class="val">${pct(stats.slowR)}</div></div>
      <div class="card"><div class="lbl">Failure %</div><div class="val">${pct(stats.failR)}</div></div>
    </div>

    <h3>API Performance Results</h3>
    <table>
      <thead><tr style="background:${thColor}">
        <th>API / Feature</th><th>Total Requests</th><th>Avg Response</th>
        <th>P95 Response</th><th>Slow %</th><th>Failure %</th><th>Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <h3>APIs Requiring Improvement</h3>
    <table>
      <thead><tr style="background:${thColor}">
        <th>API / Feature</th><th>Issue</th><th>Current Performance</th><th>Target</th><th>User Impact</th>
      </tr></thead>
      <tbody>${problemRows}</tbody>
    </table>

    <h3>Request Speed Distribution</h3>
    <p style="font-size:.81rem;color:#777;margin-bottom:8px">Fast: &lt;1000ms &nbsp;|&nbsp; Acceptable: 1000–1500ms &nbsp;|&nbsp; Slow: &gt;1500ms</p>
    <table>
      <thead><tr style="background:${thColor}">
        <th>API / Feature</th><th>Fast %</th><th>Acceptable %</th><th>Slow %</th><th>Rating</th>
      </tr></thead>
      <tbody>${distRows}</tbody>
    </table>
  </div>`;
}

// ─── Conclusion ───────────────────────────────────────────────────────────────
function conclusion() {
  if (grandFail === 0 && grandSlow === 0 && grandSlowR < 0.05)
    return `All tested APIs remained stable under the simulated load of 20 concurrent users. APIs met the defined response-time targets with no significant failures observed.`;
  if (grandFail === 0)
    return `The tested APIs remained operational; however, ${grandSlow + grandWarn} of ${allAPIs.length} APIs exceeded the response-time target. Optimization is recommended before testing at higher concurrency.`;
  return `Performance degradation and request failures were observed. The affected APIs require optimization and retesting before the system is considered production-ready at higher concurrency.`;
}

// ─── Generate Developer Report ────────────────────────────────────────────────
const devHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Sketchplay — API Performance Developer Report</title>
<style>
  ${CSS}
  .page-header{background:#0d47a1}
  .cl-ref th{background:#37474f}
</style></head><body>

<div class="page-header">
  <h1>Sketchplay — API Performance Developer Technical Report</h1>
  <p>Generated: ${testDate} &nbsp;|&nbsp; Environment: QA &nbsp;|&nbsp; Base API: https://api.sketchplayqa.com &nbsp;|&nbsp; VUs: 20 &nbsp;|&nbsp; SLA: p95 &lt; 1500ms, Failure &lt; 1%</p>
</div>

<main>
  <h3 style="margin-bottom:14px;color:#0d47a1;font-size:1rem">Overall Summary</h3>
  <div class="overall-cards">
    <div class="card"><div class="lbl">Total APIs</div><div class="val">${allAPIs.length}</div></div>
    <div class="card"><div class="lbl">Total Requests</div><div class="val">${fmt(grandTotal)}</div></div>
    <div class="card"><div class="lbl">Passed</div><div class="val" style="color:#2e7d32">${grandPass}</div></div>
    <div class="card"><div class="lbl">Warning</div><div class="val" style="color:#f57f17">${grandWarn}</div></div>
    <div class="card"><div class="lbl">Slow / Critical</div><div class="val" style="color:#e65100">${grandSlow}</div></div>
    <div class="card"><div class="lbl">Failed</div><div class="val" style="color:#b71c1c">${grandFail}</div></div>
    <div class="card"><div class="lbl">Overall Slow %</div><div class="val">${pct(grandSlowR)}</div></div>
    <div class="card"><div class="lbl">Overall Fail %</div><div class="val">${pct(grandFailR)}</div></div>
  </div>

  ${devSection(dashAPIs,  '📊 Dashboard Page', '#1565c0', '#1976d2')}
  ${devSection(tourAPIs,  '🏆 Tournaments Page', '#6a1b9a', '#8e24aa')}

  <div class="section">
    <div class="section-header" style="border-color:#37474f">
      <h2 style="color:#37474f">Performance Classification Reference</h2>
    </div>
    <table class="cl-ref">
      <thead><tr><th>Status</th><th>Criteria</th></tr></thead>
      <tbody>
        <tr><td>${badge('PASS')}</td><td>p95 &lt; 1500ms, failure &lt; 1%, slow rate &le; 10%</td></tr>
        <tr><td>${badge('WARNING')}</td><td>p95 &lt; 1500ms but slow requests &gt; 10%</td></tr>
        <tr><td>${badge('SLOW')}</td><td>p95 &ge; 1500ms, failure &lt; 1%</td></tr>
        <tr><td>${badge('CRITICAL')}</td><td>p95 &gt; 3000ms</td></tr>
        <tr><td>${badge('FAIL')}</td><td>Failure rate &ge; 1%</td></tr>
      </tbody>
    </table>
  </div>
</main>
<footer>Sketchplay QA Performance Testing &nbsp;|&nbsp; ${testDate}</footer>
</body></html>`;

// ─── Generate Client Report ───────────────────────────────────────────────────
const clientHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Sketchplay — API Performance Report</title>
<style>
  ${CSS}
  .page-header{background:#1b5e20}
</style></head><body>

<div class="page-header">
  <h1>Sketchplay — API Performance Test Report</h1>
  <p>Generated: ${testDate} &nbsp;|&nbsp; Concurrent Users: 20 &nbsp;|&nbsp; Duration: 5 minutes per test</p>
</div>

<main>
  <div class="rating-box">
    <div class="rl">Overall Performance Rating</div>
    <div class="rv" style="color:${ratingColor(overallRating)}">${overallRating}</div>
  </div>

  <div class="overall-cards">
    <div class="card"><div class="lbl">Total APIs Tested</div><div class="val">${allAPIs.length}</div></div>
    <div class="card"><div class="lbl">Total Requests</div><div class="val">${fmt(grandTotal)}</div></div>
    <div class="card"><div class="lbl">Passed APIs</div><div class="val" style="color:#2e7d32">${grandPass}</div></div>
    <div class="card"><div class="lbl">Slow APIs</div><div class="val" style="color:#e65100">${grandSlow + grandWarn}</div></div>
    <div class="card"><div class="lbl">Failed APIs</div><div class="val" style="color:#b71c1c">${grandFail}</div></div>
    <div class="card"><div class="lbl">Overall Slow %</div><div class="val">${pct(grandSlowR)}</div></div>
    <div class="card"><div class="lbl">Overall Failure %</div><div class="val">${pct(grandFailR)}</div></div>
  </div>

  ${clientSection(dashAPIs,  '📊 Dashboard Page', 'Dashboard', '#1976d2', '#1976d2')}
  ${clientSection(tourAPIs,  '🏆 Tournaments Page', 'Tournaments', '#8e24aa', '#8e24aa')}

  <div class="section">
    <div class="section-header" style="border-color:#2e7d32">
      <h2 style="color:#2e7d32">Conclusion</h2>
    </div>
    <p style="line-height:1.75;background:#fff;padding:20px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08)">${conclusion()}</p>
  </div>
</main>
<footer>Sketchplay QA Performance Testing &nbsp;|&nbsp; ${testDate} &nbsp;|&nbsp; Confidential</footer>
</body></html>`;

// ─── Write files ──────────────────────────────────────────────────────────────
fs.writeFileSync(DEV_REPORT,    devHtml);
fs.writeFileSync(CLIENT_REPORT, clientHtml);

console.log(`Developer Report → ${DEV_REPORT}`);
console.log(`Client Report    → ${CLIENT_REPORT}`);
