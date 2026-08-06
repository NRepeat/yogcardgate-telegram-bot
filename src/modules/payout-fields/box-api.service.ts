import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

// Админка обменника (box). Курс направления задаётся парсером, привязанным к
// роуту, поэтому смена метода выплаты тянет за собой смену парсера:
// card -> USDT/CARDUAH, iban -> USDT/WIREUAH.
const BASE_URL =
  process.env.BOX_API_URL || 'https://www.globalpayout.club/service/api/v1';
const API_KEY = process.env.BOX_API_KEY || '';
const API_SECRET = process.env.BOX_API_SECRET || '';
const PARSER_NAME = process.env.BOX_PARSER_NAME || 'globalpayout';

export type BoxRoute = {
  _id: string;
  active?: boolean;
  to?: { currency?: { xml?: string } };
  from?: { currency?: { xml?: string } };
  rate?: { parsers?: { _id: string; route_name: string; rate_buy: number }[] };
};

/** Подпись запроса box: sha256(sha256(json(params)) + secret). */
export function boxHash(
  getParams: Record<string, unknown>,
  postParams: Record<string, unknown>,
  secret: string,
): string {
  const stringifiedGet: Record<string, unknown> = {};
  for (const key of Object.keys(getParams)) {
    const value = getParams[key];
    stringifiedGet[key] = Array.isArray(value)
      ? value.map((v) => String(v))
      : String(value);
  }
  const json = JSON.stringify({ ...stringifiedGet, ...postParams });
  const checksum = crypto.createHash('sha256').update(json, 'utf-8').digest('hex');
  return crypto
    .createHash('sha256')
    .update(checksum + secret, 'utf-8')
    .digest('hex');
}

const queryString = (params: Record<string, unknown>): string =>
  Object.entries(params)
    .map(([key, value]) =>
      Array.isArray(value)
        ? value
            .map((v) => `${encodeURIComponent(key)}[]=${encodeURIComponent(String(v))}`)
            .join('&')
        : `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join('&');

@Injectable()
export class BoxApiService {
  private readonly logger = new Logger(BoxApiService.name);

  get configured(): boolean {
    return Boolean(API_KEY && API_SECRET);
  }

  private async call<T>(
    method: string,
    getParams: Record<string, unknown> = {},
    postParams: Record<string, unknown> | null = null,
  ): Promise<T | null> {
    const [httpMethod, endpoint] = method.includes(':')
      ? method.split(':')
      : ['POST', method];
    const params = { ...getParams, time: Date.now() };
    const res = await fetch(`${BASE_URL}/${endpoint}?${queryString(params)}`, {
      method: httpMethod.toUpperCase(),
      headers: {
        'content-type': 'application/json',
        apikey: API_KEY,
        hash: boxHash(params, postParams || {}, API_SECRET),
      },
      ...(postParams ? { body: JSON.stringify(postParams) } : {}),
    });
    const body = (await res.json()) as { success?: boolean; data?: T; error?: { message?: string } };
    if (!res.ok || body?.success === false) {
      this.logger.error(`box ${method}: ${body?.error?.message || res.status}`);
      return null;
    }
    return (body?.data ?? null) as T | null;
  }

  /** id записи парсера по её имени (USDT/CARDUAH, USDT/WIREUAH). */
  async parserIdByRouteName(routeName: string): Promise<string | null> {
    const data = await this.call<{
      parser?: { rates?: { _id: string; route_name: string }[] };
    }>('GET:admin/parser/get', { parser: PARSER_NAME });
    const hit = data?.parser?.rates?.find((r) => r.route_name === routeName);
    return hit?._id ?? null;
  }

  /**
   * Ставит парсер `routeName` всем роутам, ведущим в указанные xml.
   * Ногу `<COIN>/USDT` у крипто-цепочек сохраняем, меняем только UAH-ногу.
   */
  async setParserForXmls(
    xmls: string[],
    routeName: string,
  ): Promise<{ ok: number; fail: number; skipped: number; error?: string }> {
    if (!this.configured) {
      return { ok: 0, fail: 0, skipped: 0, error: 'BOX_API_KEY/BOX_API_SECRET не заданы' };
    }
    const parserId = await this.parserIdByRouteName(routeName);
    if (!parserId) {
      return { ok: 0, fail: 0, skipped: 0, error: `парсер ${routeName} не найден` };
    }

    const data = await this.call<{ routes?: BoxRoute[] }>(
      'GET:admin/exchanger/route/get',
      { limit: 5000 },
    );
    const routes = (data?.routes || []).filter((r) =>
      xmls.includes(String(r.to?.currency?.xml || '')),
    );
    if (!routes.length) {
      return { ok: 0, fail: 0, skipped: 0, error: 'роуты не найдены' };
    }

    // Все UAH-парсеры направления взаимозаменяемы — подменяем любой из них.
    const uahLegs = new Set(
      (routes.flatMap((r) => r.rate?.parsers || []) || [])
        .filter((p) => /UAH/i.test(p.route_name))
        .map((p) => p._id),
    );

    let ok = 0;
    let fail = 0;
    let skipped = 0;
    for (const route of routes) {
      const ids = (route.rate?.parsers || []).map((p) => p._id);
      const next = [...new Set(ids.map((id) => (uahLegs.has(id) ? parserId : id)))];
      if (!next.includes(parserId)) next.push(parserId);
      if (next.length === ids.length && next.every((id, i) => id === ids[i])) {
        skipped++;
        continue;
      }
      const res = await this.call('PUT:admin/exchanger/route/edit', {}, {
        route_id: route._id,
        parserIds: next,
        enableParser: true,
      });
      if (res === null) fail++;
      else ok++;
    }
    return { ok, fail, skipped };
  }
}
