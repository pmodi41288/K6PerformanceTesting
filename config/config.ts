import http from 'k6/http';
import { check } from 'k6';
import type { Options } from 'k6/options';
import type { Params, RefinedResponse, ResponseType } from 'k6/http';

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const API_TOKEN = __ENV.API_TOKEN || '';
export const USERNAME = __ENV.USERNAME || 'load-test@example.com';
export const PASSWORD = __ENV.PASSWORD || 'change-me';

export const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

if (API_TOKEN) {
  defaultHeaders.Authorization = `Bearer ${API_TOKEN}`;
}

export const defaultOptions: Options = {
  vus: Number(__ENV.VUS || 1),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export function request(
  method: string,
  path: string,
  body: Record<string, string> | null = null,
  params: Params = {},
): RefinedResponse<ResponseType> {
  const url = `${BASE_URL}${path}`;
  const payload = body === null ? null : JSON.stringify(body);
  const { headers: requestHeaders = {}, ...requestOptions } = params;

  return http.request(method, url, payload, {
    headers: { ...defaultHeaders, ...requestHeaders },
    ...requestOptions,
  });
}

export function checkResponse(response: RefinedResponse<ResponseType>, name: string): boolean {
  return check(response, {
    [`${name} returns a successful status`]: (result) => result.status >= 200 && result.status < 300,
  });
}
