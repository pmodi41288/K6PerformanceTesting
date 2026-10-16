import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ───────────────────────────────────────────────────────────
const tournamentListSlowRate  = new Rate('tournament_list_slow_rate');
const clientTypeSlowRate      = new Rate('client_type_slow_rate');
const countryStatesSlowRate   = new Rate('country_states_slow_rate');

const tournamentListFastRate  = new Rate('tournament_list_fast_rate');
const clientTypeFastRate      = new Rate('client_type_fast_rate');
const countryStatesFastRate   = new Rate('country_states_fast_rate');

const tournamentListFailRate  = new Rate('tournament_list_fail_rate');
const clientTypeFailRate      = new Rate('client_type_fail_rate');
const countryStatesFailRate   = new Rate('country_states_fail_rate');

const tournamentListTrend     = new Trend('tournament_list_duration', true);
const clientTypeTrend         = new Trend('client_type_duration', true);
const countryStatesTrend      = new Trend('country_states_duration', true);

const tournamentListCount     = new Counter('tournament_list_count');
const clientTypeCount         = new Counter('client_type_count');
const countryStatesCount      = new Counter('country_states_count');

// ─── Test Options ─────────────────────────────────────────────────────────────
export const options = {
  vus: 20,
  duration: '5m',
  thresholds: {
    'http_req_duration{name:TournamentList}':  ['p(95)<1500'],
    'http_req_duration{name:ClientType}':      ['p(95)<1500'],
    'http_req_duration{name:CountryStates}':   ['p(95)<1500'],
    http_req_failed:                           ['rate<0.01'],
  },
};

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL     = 'https://api.sketchplayqa.com';
const ACCESS_TOKEN = __ENV.TOKEN || __ENV.ACCESS_TOKEN || '';

const DATE     = __ENV.DATE     || '2026-09-08';
const TIME     = __ENV.TIME     || '04:55%20PM';
const TIMEZONE = __ENV.TIMEZONE || 'Asia/Calcutta';

const HEADERS = {
  Accept:            'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection:        'keep-alive',
  Origin:            'https://web.sketchplayqa.com',
  Referer:           'https://web.sketchplayqa.com/',
  'Sec-Fetch-Dest':  'empty',
  'Sec-Fetch-Mode':  'cors',
  'Sec-Fetch-Site':  'same-site',
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  'sec-ch-ua':       '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
  'sec-ch-ua-mobile':'?0',
  'sec-ch-ua-platform': '"Windows"',
  Cookie:            `access_token=${ACCESS_TOKEN}`,
};

function p(name) { return { headers: HEADERS, tags: { name } }; }

// ─── Default function ─────────────────────────────────────────────────────────
export default function () {
  const res = http.batch({
    TournamentList: {
      method: 'GET',
      url: `${BASE_URL}/tournament/list?skip=0&limit=12&isPast=false&date=${DATE}&time=${TIME}&timeZone=${TIMEZONE}`,
      params: p('TournamentList'),
    },
    ClientType: {
      method: 'GET',
      url: `${BASE_URL}/client-type?skip=0&limit=5000`,
      params: p('ClientType'),
    },
    CountryStates: {
      method: 'GET',
      url: `${BASE_URL}/country/states`,
      params: p('CountryStates'),
    },
  });

  recordMetrics('TournamentList', res.TournamentList, tournamentListTrend, tournamentListSlowRate, tournamentListFastRate, tournamentListFailRate, tournamentListCount);
  recordMetrics('ClientType',     res.ClientType,     clientTypeTrend,     clientTypeSlowRate,     clientTypeFastRate,     clientTypeFailRate,     clientTypeCount);
  recordMetrics('CountryStates',  res.CountryStates,  countryStatesTrend,  countryStatesSlowRate,  countryStatesFastRate,  countryStatesFailRate,  countryStatesCount);

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

  // ── Per-API definitions ───────────────────────────────────────────────────
  const APIS = [
    {
      key: 'TournamentList', label: 'Tournament List',
      trendKey: 'tournament_list_duration', slowKey: 'tournament_list_slow_rate',
      fastKey: 'tournament_list_fast_rate', failKey: 'tournament_list_fail_rate',
      countKey: 'tournament_list_count', url: '/tournament/list',
    },
    {
      key: 'ClientType', label: 'Client Type',
      trendKey: 'client_type_duration', slowKey: 'client_type_slow_rate',
      fastKey: 'client_type_fast_rate', failKey: 'client_type_fail_rate',
      countKey: 'client_type_count', url: '/client-type',
    },
    {
      key: 'CountryStates', label: 'Country States',
      trendKey: 'country_states_duration', slowKey: 'country_states_slow_rate',
      fastKey: 'country_states_fast_rate', failKey: 'country_states_fail_rate',
      countKey: 'country_states_count', url: '/country/states',
    },
  ];

  const apiData = APIS.map(api => {
    const trend     = tv(api.trendKey);
    const slowVals  = tv(api.slowKey);
    const fastVals  = tv(api.fastKey);
    const failVals  = tv(api.failKey);
    const countVals = tv(api.countKey);

    const avg   = trend ? trend.avg         : null;
    const med   = trend ? trend.med         : null;
    const p90   = trend ? trend['p(90)']    : null;
    const p95   = trend ? trend['p(95)']    : null;
    const max   = trend ? trend.max         : null;
    const slowR = slowVals  ? slowVals.rate  : 0;
    const fastR = fastVals  ? fastVals.rate  : 0;
    const failR = failVals  ? failVals.rate  : 0;
    const count = countVals ? countVals.count: 0;
    const acceptR = Math.max(0, 1 - slowR - fastR);

    let status = 'PASS';
    if (failR >= 0.01)                         status = 'FAIL';
    else if (p95 !== null && p95 > 3000)       status = 'CRITICAL';
    else if (p95 !== null && p95 >= 1500)      status = 'SLOW';
    else if (slowR > 0.10)                     status = 'WARNING';

    return { ...api, avg, med, p90, p95, max, slowR, fastR, acceptR, failR, count, status };
  });

  // ── Overall stats ─────────────────────────────────────────────────────────
  const totalReqs    = apiData.reduce((s, a) => s + a.count, 0);
  const overallFail  = tv('http_req_failed');
  const overallFailR = overallFail ? overallFail.rate : 0;
  const overallDur   = tv('http_req_duration');
  const overallP95   = overallDur ? overallDur['p(95)'] : null;
  const overallSlowR = totalReqs > 0
    ? apiData.reduce((s, a) => s + a.slowR * a.count, 0) / totalReqs : 0;

  const vus      = m['vus_max']    ? m['vus_max'].values.max       : 20;
  const testDate = new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'medium' });

  const passCount = apiData.filter(a => a.status === 'PASS').length;
  const warnCount = apiData.filter(a => a.status === 'WARNING').length;
  const slowCount = apiData.filter(a => a.status === 'SLOW' || a.status === 'CRITICAL').length;
  const failCount = apiData.filter(a => a.status === 'FAIL').length;
  const problemAPIs = apiData.filter(a => a.status !== 'PASS');

  let overallStatus = 'PASS';
  if (failCount > 0 || overallFailR >= 0.01)           overallStatus = 'FAIL';
  else if (apiData.some(a => a.status === 'CRITICAL')) overallStatus = 'CRITICAL';
  else if (slowCount > 0)                              overallStatus = 'SLOW';
  else if (warnCount > 0 || overallSlowR >= 0.10)     overallStatus = 'WARNING';

  let overallRating = 'EXCELLENT';
  if (failCount > 0 || apiData.some(a => a.p95 > 3000))                overallRating = 'POOR';
  else if (apiData.some(a => a.p95 >= 1500) || overallSlowR >= 0.10)  overallRating = 'NEEDS IMPROVEMENT';
  else if (slowCount <= 1 && overallSlowR < 0.10)                      overallRating = 'GOOD';

  // ── Terminal summary ──────────────────────────────────────────────────────
  const termSummary = `
============================================================
  SKETCHPLAY TOURNAMENTS — PERFORMANCE TEST COMPLETED
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
    'reports/tournaments-summary.json': JSON.stringify(data, null, 2),
    stdout: termSummary,
  };
}
