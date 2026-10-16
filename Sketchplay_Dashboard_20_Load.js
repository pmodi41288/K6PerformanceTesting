import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ───────────────────────────────────────────────────────────
// Slow rate (>1500ms) per API
const calendarGamesSlowRate      = new Rate('calendar_games_slow_rate');
const calendarEventsSlowRate     = new Rate('calendar_events_slow_rate');
const calendarTournamentsSlowRate= new Rate('calendar_tournaments_slow_rate');
const campListSlowRate           = new Rate('camp_list_slow_rate');
const clinicListSlowRate         = new Rate('clinic_list_slow_rate');
const dailyTrainingSlowRate      = new Rate('daily_training_slow_rate');
const tournamentListSlowRate     = new Rate('tournament_list_slow_rate');
const meSlowRate                 = new Rate('me_slow_rate');

// Fast rate (<1000ms) per API — needed for distribution table
const calendarGamesFastRate      = new Rate('calendar_games_fast_rate');
const calendarEventsFastRate     = new Rate('calendar_events_fast_rate');
const calendarTournamentsFastRate= new Rate('calendar_tournaments_fast_rate');
const campListFastRate           = new Rate('camp_list_fast_rate');
const clinicListFastRate         = new Rate('clinic_list_fast_rate');
const dailyTrainingFastRate      = new Rate('daily_training_fast_rate');
const tournamentListFastRate     = new Rate('tournament_list_fast_rate');
const meFastRate                 = new Rate('me_fast_rate');

// Failure rate per API
const calendarGamesFailRate      = new Rate('calendar_games_fail_rate');
const calendarEventsFailRate     = new Rate('calendar_events_fail_rate');
const calendarTournamentsFailRate= new Rate('calendar_tournaments_fail_rate');
const campListFailRate           = new Rate('camp_list_fail_rate');
const clinicListFailRate         = new Rate('clinic_list_fail_rate');
const dailyTrainingFailRate      = new Rate('daily_training_fail_rate');
const tournamentListFailRate     = new Rate('tournament_list_fail_rate');
const meFailRate                 = new Rate('me_fail_rate');

// Per-API Trend (for avg/median/p90/p95/max in handleSummary)
const calendarGamesTrend         = new Trend('calendar_games_duration', true);
const calendarEventsTrend        = new Trend('calendar_events_duration', true);
const calendarTournamentsTrend   = new Trend('calendar_tournaments_duration', true);
const campListTrend              = new Trend('camp_list_duration', true);
const clinicListTrend            = new Trend('clinic_list_duration', true);
const dailyTrainingTrend         = new Trend('daily_training_duration', true);
const tournamentListTrend        = new Trend('tournament_list_duration', true);
const meTrend                    = new Trend('me_duration', true);

// Per-API request counter
const calendarGamesCount         = new Counter('calendar_games_count');
const calendarEventsCount        = new Counter('calendar_events_count');
const calendarTournamentsCount   = new Counter('calendar_tournaments_count');
const campListCount              = new Counter('camp_list_count');
const clinicListCount            = new Counter('clinic_list_count');
const dailyTrainingCount         = new Counter('daily_training_count');
const tournamentListCount        = new Counter('tournament_list_count');
const meCount                    = new Counter('me_count');

// ─── Test Options ─────────────────────────────────────────────────────────────
export const options = {
  vus: 20,
  duration: '5m',
  thresholds: {
    'http_req_duration{name:CalendarGames}':      ['p(95)<1500'],
    'http_req_duration{name:CalendarEvents}':     ['p(95)<1500'],
    'http_req_duration{name:CalendarTournaments}':['p(95)<1500'],
    'http_req_duration{name:CampList}':           ['p(95)<1500'],
    'http_req_duration{name:ClinicList}':         ['p(95)<1500'],
    'http_req_duration{name:DailyTrainingList}':  ['p(95)<1500'],
    'http_req_duration{name:TournamentList}':     ['p(95)<1500'],
    'http_req_duration{name:Me}':                 ['p(95)<1500'],
    http_req_failed:                              ['rate<0.01'],
  },
};

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL     = 'https://api.sketchplayqa.com';
const ACCESS_TOKEN = __ENV.TOKEN || __ENV.ACCESS_TOKEN || '';

const DATE       = __ENV.DATE       || '2026-09-07';
const START_DATE = __ENV.START_DATE || '2026-09-01';
const END_DATE   = __ENV.END_DATE   || '2026-09-30';
const TIME       = __ENV.TIME       || '06:33%20PM';
const TIMEZONE   = __ENV.TIMEZONE   || 'Asia/Calcutta';
const ORG_ID     = __ENV.ORG_ID     || '';

const HEADERS = {
  Accept:            'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection:        'keep-alive',
  Origin:            'https://web.sketchplayqa.com',
  Referer:           'https://web.sketchplayqa.com/',
  'Sec-Fetch-Dest':  'empty',
  'Sec-Fetch-Mode':  'cors',
  'Sec-Fetch-Site':  'same-site',
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Cookie:            `access_token=${ACCESS_TOKEN}`,
};

const calSuffix =
  `&isRegisterEvent=false&startDate=${START_DATE}&isCheckDateRange=true` +
  `&isFromDashboard=true&endDate=${END_DATE}&date=${DATE}&time=${TIME}&timeZone=${TIMEZONE}`;

const evtSuffix =
  `&skip=0&limit=50&startDate=${DATE}&isFromDashboard=true` +
  `&date=${DATE}&time=${TIME}&timeZone=${TIMEZONE}`;

function p(name) { return { headers: HEADERS, tags: { name } }; }

// ─── Default function ─────────────────────────────────────────────────────────
export default function () {
  const res = http.batch({
    CalendarGames: {
      method: 'GET',
      url: `${BASE_URL}/tournament/list/games/for/calendar?orgId=${ORG_ID}&classTypes=game${calSuffix}`,
      params: p('CalendarGames'),
    },
    CalendarEvents: {
      method: 'GET',
      url: `${BASE_URL}/event/for/calendar?orgId=${ORG_ID}&classTypes=${calSuffix}`,
      params: p('CalendarEvents'),
    },
    CalendarTournaments: {
      method: 'GET',
      url: `${BASE_URL}/tournament/list/for/calendar?orgId=${ORG_ID}&classTypes=tournament${calSuffix}`,
      params: p('CalendarTournaments'),
    },
    CampList: {
      method: 'GET',
      url: `${BASE_URL}/event/list?classTypes=camp${evtSuffix}`,
      params: p('CampList'),
    },
    ClinicList: {
      method: 'GET',
      url: `${BASE_URL}/event/list?classTypes=clinic${evtSuffix}`,
      params: p('ClinicList'),
    },
    DailyTrainingList: {
      method: 'GET',
      url: `${BASE_URL}/event/list?classTypes=dailytraining${evtSuffix}`,
      params: p('DailyTrainingList'),
    },
    TournamentList: {
      method: 'GET',
      url: `${BASE_URL}/tournament/list?skip=0&limit=50&isPast=false&isFromDashboard=true&date=${DATE}&time=${TIME}&timeZone=${TIMEZONE}`,
      params: p('TournamentList'),
    },
    Me: {
      method: 'GET',
      url: `${BASE_URL}/me`,
      params: p('Me'),
    },
  });

  // Record metrics for each API
  recordMetrics('CalendarGames',      res.CalendarGames,      calendarGamesTrend,      calendarGamesSlowRate,      calendarGamesFastRate,      calendarGamesFailRate,      calendarGamesCount);
  recordMetrics('CalendarEvents',     res.CalendarEvents,     calendarEventsTrend,     calendarEventsSlowRate,     calendarEventsFastRate,     calendarEventsFailRate,     calendarEventsCount);
  recordMetrics('CalendarTournaments',res.CalendarTournaments,calendarTournamentsTrend,calendarTournamentsSlowRate,calendarTournamentsFastRate,calendarTournamentsFailRate,calendarTournamentsCount);
  recordMetrics('CampList',           res.CampList,           campListTrend,           campListSlowRate,           campListFastRate,           campListFailRate,           campListCount);
  recordMetrics('ClinicList',         res.ClinicList,         clinicListTrend,         clinicListSlowRate,         clinicListFastRate,         clinicListFailRate,         clinicListCount);
  recordMetrics('DailyTrainingList',  res.DailyTrainingList,  dailyTrainingTrend,      dailyTrainingSlowRate,      dailyTrainingFastRate,      dailyTrainingFailRate,      dailyTrainingCount);
  recordMetrics('TournamentList',     res.TournamentList,     tournamentListTrend,     tournamentListSlowRate,     tournamentListFastRate,     tournamentListFailRate,     tournamentListCount);
  recordMetrics('Me',                 res.Me,                 meTrend,                 meSlowRate,                 meFastRate,                 meFailRate,                 meCount);

  sleep(1);
}

function recordMetrics(name, response, trend, slowRate, fastRate, failRate, counter) {
  const dur = response.timings.duration;
  const ok  = response.status >= 200 && response.status < 300;

  trend.add(dur);
  slowRate.add(dur > 1500);
  fastRate.add(dur < 1000);
  failRate.add(!ok);
  counter.add(1);

  check(response, { [`${name} status 200`]: r => r.status === 200 });
}

// ─── handleSummary ────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const m = data.metrics || {};

  // ── Helper: extract metric values safely ──────────────────────────────────
  function tv(key) {
    const metric = m[key];
    if (!metric || !metric.values) return null;
    return metric.values;
  }

  function ms(val) {
    if (val === null || val === undefined) return 'N/A';
    return val < 1000 ? `${Math.round(val)}ms` : `${(val / 1000).toFixed(2)}s`;
  }

  function pct(rate) {
    if (rate === null || rate === undefined) return '0.00%';
    return `${(rate * 100).toFixed(2)}%`;
  }

  function fmt(n) {
    if (n === null || n === undefined) return '0';
    return Number(n).toLocaleString();
  }

  // ── Per-API data extraction ───────────────────────────────────────────────
  const APIS = [
    { key: 'CalendarGames',       label: 'Calendar Games',       trendKey: 'calendar_games_duration',       slowKey: 'calendar_games_slow_rate',       fastKey: 'calendar_games_fast_rate',       failKey: 'calendar_games_fail_rate',       countKey: 'calendar_games_count',       url: '/tournament/list/games/for/calendar' },
    { key: 'CalendarEvents',      label: 'Calendar Events',      trendKey: 'calendar_events_duration',      slowKey: 'calendar_events_slow_rate',      fastKey: 'calendar_events_fast_rate',      failKey: 'calendar_events_fail_rate',      countKey: 'calendar_events_count',      url: '/event/for/calendar' },
    { key: 'CalendarTournaments', label: 'Calendar Tournaments', trendKey: 'calendar_tournaments_duration', slowKey: 'calendar_tournaments_slow_rate', fastKey: 'calendar_tournaments_fast_rate', failKey: 'calendar_tournaments_fail_rate', countKey: 'calendar_tournaments_count', url: '/tournament/list/for/calendar' },
    { key: 'CampList',            label: 'Camp List',            trendKey: 'camp_list_duration',            slowKey: 'camp_list_slow_rate',            fastKey: 'camp_list_fast_rate',            failKey: 'camp_list_fail_rate',            countKey: 'camp_list_count',            url: '/event/list?classTypes=camp' },
    { key: 'ClinicList',          label: 'Clinic List',          trendKey: 'clinic_list_duration',          slowKey: 'clinic_list_slow_rate',          fastKey: 'clinic_list_fast_rate',          failKey: 'clinic_list_fail_rate',          countKey: 'clinic_list_count',          url: '/event/list?classTypes=clinic' },
    { key: 'DailyTrainingList',   label: 'Daily Training List',  trendKey: 'daily_training_duration',       slowKey: 'daily_training_slow_rate',       fastKey: 'daily_training_fast_rate',       failKey: 'daily_training_fail_rate',       countKey: 'daily_training_count',       url: '/event/list?classTypes=dailytraining' },
    { key: 'TournamentList',      label: 'Tournament List',      trendKey: 'tournament_list_duration',      slowKey: 'tournament_list_slow_rate',      fastKey: 'tournament_list_fast_rate',      failKey: 'tournament_list_fail_rate',      countKey: 'tournament_list_count',      url: '/tournament/list' },
    { key: 'Me',                  label: 'User Profile (Me)',    trendKey: 'me_duration',                   slowKey: 'me_slow_rate',                   fastKey: 'me_fast_rate',                   failKey: 'me_fail_rate',                   countKey: 'me_count',                   url: '/me' },
  ];

  const apiData = APIS.map(api => {
    const trend    = tv(api.trendKey);
    const slowVals = tv(api.slowKey);
    const fastVals = tv(api.fastKey);
    const failVals = tv(api.failKey);
    const countVals= tv(api.countKey);

    const avg    = trend ? trend.avg    : null;
    const med    = trend ? trend.med    : null;
    const p90    = trend ? trend['p(90)'] : null;
    const p95    = trend ? trend['p(95)'] : null;
    const max    = trend ? trend.max    : null;
    const slowR  = slowVals ? slowVals.rate  : 0;
    const fastR  = fastVals ? fastVals.rate  : 0;
    const failR  = failVals ? failVals.rate  : 0;
    const count  = countVals ? countVals.count : 0;

    const acceptR = Math.max(0, 1 - slowR - fastR);

    // Status classification
    let status = 'PASS';
    if (failR >= 0.01)           status = 'FAIL';
    else if (p95 !== null && p95 > 3000) status = 'CRITICAL';
    else if (p95 !== null && p95 >= 1500) status = 'SLOW';
    else if (slowR > 0.10)       status = 'WARNING';

    return {
      ...api,
      avg, med, p90, p95, max,
      slowR, fastR, acceptR, failR,
      count, status,
    };
  });

  // ── Overall stats ─────────────────────────────────────────────────────────
  const totalReqs     = apiData.reduce((s, a) => s + a.count, 0);
  const overallFail   = tv('http_req_failed');
  const overallFailR  = overallFail ? overallFail.rate : 0;
  const overallDur    = tv('http_req_duration');
  const overallP95    = overallDur ? overallDur['p(95)'] : null;

  // Weighted overall slow rate
  const overallSlowR = totalReqs > 0
    ? apiData.reduce((s, a) => s + a.slowR * a.count, 0) / totalReqs
    : 0;

  const vus        = m['vus_max'] ? m['vus_max'].values.max : 20;
  const iterations = m['iterations'] ? m['iterations'].values.count : 0;
  const testDate   = new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'medium' });

  const passCount    = apiData.filter(a => a.status === 'PASS').length;
  const warnCount    = apiData.filter(a => a.status === 'WARNING').length;
  const slowCount    = apiData.filter(a => a.status === 'SLOW' || a.status === 'CRITICAL').length;
  const failCount    = apiData.filter(a => a.status === 'FAIL').length;

  const problemAPIs = apiData.filter(a => a.status !== 'PASS');

  // ── Overall test status ───────────────────────────────────────────────────
  let overallStatus = 'PASS';
  if (failCount > 0 || overallFailR >= 0.01)                  overallStatus = 'FAIL';
  else if (apiData.some(a => a.status === 'CRITICAL'))        overallStatus = 'CRITICAL';
  else if (slowCount > 0)                                     overallStatus = 'SLOW';
  else if (warnCount > 0 || overallSlowR >= 0.10)            overallStatus = 'WARNING';

  // ── Overall rating (client) ───────────────────────────────────────────────
  let overallRating = 'EXCELLENT';
  if (failCount > 0 || apiData.some(a => a.p95 > 3000))                      overallRating = 'POOR';
  else if (apiData.some(a => a.p95 >= 1500) || overallSlowR >= 0.10)         overallRating = 'NEEDS IMPROVEMENT';
  else if (slowCount <= 1 && overallSlowR < 0.10)                            overallRating = 'GOOD';

  // ── Terminal summary ──────────────────────────────────────────────────────
  const termSummary = `
============================================================
  SKETCHPLAY DASHBOARD — PERFORMANCE TEST COMPLETED
============================================================

  APIs Tested       : ${APIS.length}
  Passed            : ${passCount}
  Warning           : ${warnCount}
  Slow              : ${slowCount}
  Failed            : ${failCount}

  Overall p95       : ${ms(overallP95)}
  Overall Slow %    : ${pct(overallSlowR)}
  Failure Rate      : ${pct(overallFailR)}
  Overall Status    : ${overallStatus}

  Run "npm run report" to generate combined reports.

============================================================
`;

  return {
    'reports/dashboard-summary.json': JSON.stringify(data, null, 2),
    stdout: termSummary,
  };
}
