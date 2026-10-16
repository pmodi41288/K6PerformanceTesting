import http, { type Response } from 'k6/http';
import { check, sleep } from 'k6';
import type { Options } from 'k6/options';

export const options: Options = {
  vus: 20,
  duration: '5m',
  thresholds: {
    'http_req_duration{name:CalendarGames}': ['p(95)<1500'],
    'http_req_duration{name:CalendarEvents}': ['p(95)<1500'],
    'http_req_duration{name:CalendarTournaments}': ['p(95)<1500'],
    'http_req_duration{name:CampList}': ['p(95)<1500'],
    'http_req_duration{name:ClinicList}': ['p(95)<1500'],
    'http_req_duration{name:DailyTrainingList}': ['p(95)<1500'],
    'http_req_duration{name:TournamentList}': ['p(95)<1500'],
    'http_req_duration{name:Me}': ['p(95)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = 'https://api.sketchplayqa.com';

// Pass the JWT via: k6 run -e ACCESS_TOKEN=<token> tests/dashboard.ts
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || '';

const DATE = __ENV.DATE || '2026-09-07';
const START_DATE = __ENV.START_DATE || '2026-09-01';
const END_DATE = __ENV.END_DATE || '2026-09-30';
const TIME = __ENV.TIME || '06:33%20PM';
const TIMEZONE = __ENV.TIMEZONE || 'Asia/Calcutta';
const ORG_ID = __ENV.ORG_ID || '';

const headers = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive',
  Origin: 'https://web.sketchplayqa.com',
  Referer: 'https://web.sketchplayqa.com/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  Cookie: `access_token=${ACCESS_TOKEN}`,
};

const calendarSuffix =
  `&isRegisterEvent=false` +
  `&startDate=${START_DATE}` +
  `&isCheckDateRange=true` +
  `&isFromDashboard=true` +
  `&endDate=${END_DATE}` +
  `&date=${DATE}` +
  `&time=${TIME}` +
  `&timeZone=${TIMEZONE}`;

const eventListSuffix =
  `&skip=0` +
  `&limit=50` +
  `&startDate=${DATE}` +
  `&isFromDashboard=true` +
  `&date=${DATE}` +
  `&time=${TIME}` +
  `&timeZone=${TIMEZONE}`;

function tag(name: string) {
  return { headers, tags: { name } };
}

export default function (): void {
  const responses = http.batch({
    CalendarGames: {
      method: 'GET',
      url: `${BASE_URL}/tournament/list/games/for/calendar?orgId=${ORG_ID}&classTypes=game${calendarSuffix}`,
      params: tag('CalendarGames'),
    },
    CalendarEvents: {
      method: 'GET',
      url: `${BASE_URL}/event/for/calendar?orgId=${ORG_ID}&classTypes=${calendarSuffix}`,
      params: tag('CalendarEvents'),
    },
    CalendarTournaments: {
      method: 'GET',
      url: `${BASE_URL}/tournament/list/for/calendar?orgId=${ORG_ID}&classTypes=tournament${calendarSuffix}`,
      params: tag('CalendarTournaments'),
    },
    CampList: {
      method: 'GET',
      url: `${BASE_URL}/event/list?classTypes=camp${eventListSuffix}`,
      params: tag('CampList'),
    },
    ClinicList: {
      method: 'GET',
      url: `${BASE_URL}/event/list?classTypes=clinic${eventListSuffix}`,
      params: tag('ClinicList'),
    },
    DailyTrainingList: {
      method: 'GET',
      url: `${BASE_URL}/event/list?classTypes=dailytraining${eventListSuffix}`,
      params: tag('DailyTrainingList'),
    },
    TournamentList: {
      method: 'GET',
      url:
        `${BASE_URL}/tournament/list?skip=0&limit=50&isPast=false` +
        `&isFromDashboard=true&date=${DATE}&time=${TIME}&timeZone=${TIMEZONE}`,
      params: tag('TournamentList'),
    },
    Me: {
      method: 'GET',
      url: `${BASE_URL}/me`,
      params: tag('Me'),
    },
  });

  check(responses.CalendarGames as Response, { 'CalendarGames - status 200': (r) => r.status === 200 });
  check(responses.CalendarEvents as Response, { 'CalendarEvents - status 200': (r) => r.status === 200 });
  check(responses.CalendarTournaments as Response, { 'CalendarTournaments - status 200': (r) => r.status === 200 });
  check(responses.CampList as Response, { 'CampList - status 200': (r) => r.status === 200 });
  check(responses.ClinicList as Response, { 'ClinicList - status 200': (r) => r.status === 200 });
  check(responses.DailyTrainingList as Response, { 'DailyTrainingList - status 200': (r) => r.status === 200 });
  check(responses.TournamentList as Response, { 'TournamentList - status 200': (r) => r.status === 200 });
  check(responses.Me as Response, { 'Me - status 200': (r) => r.status === 200 });

  sleep(1);
}

export function handleSummary(data: Record<string, unknown>) {
  return {
    'results/dashboard-summary.json': JSON.stringify(data, null, 2),
  };
}
