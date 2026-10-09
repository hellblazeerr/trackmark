import SparkMD5 from 'spark-md5';
import { z } from 'zod';
import type { TrackInfo } from '../core/types';

const API = 'https://ws.audioscrobbler.com/2.0/';
export const API_KEY = import.meta.env.WXT_LASTFM_API_KEY as string;
const SECRET = import.meta.env.WXT_LASTFM_API_SECRET as string;

export class LastfmError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
  /** session is dead: ask the user to reconnect */
  get needsReauth() { return this.code === 9; }
  /** worth retrying later */
  get retryable() { return [11, 16, 29].includes(this.code); }
}

// md5(sorted "name+value" pairs + secret); `format` and `callback` are excluded
function sign(params: Record<string, string>): string {
  const str =
    Object.keys(params)
      .filter((k) => k !== 'format' && k !== 'callback')
      .sort()
      .map((k) => k + params[k])
      .join('') + SECRET;
  return SparkMD5.hash(str); // spark-md5 hashes strings as UTF-8
}

async function call(method: string, params: Record<string, string>, write = false) {
  const all = { ...params, method, api_key: API_KEY };
  const body = new URLSearchParams({ ...all, api_sig: sign(all), format: 'json' });
  const res = write
    ? await fetch(API, { method: 'POST', body })
    : await fetch(`${API}?${body}`);
  const json = await res.json();
  if (json.error) throw new LastfmError(json.error, json.message);
  return json;
}

const tokenSchema = z.object({ token: z.string() });
const sessionSchema = z.object({ session: z.object({ name: z.string(), key: z.string() }) });

export const CALLBACK_URL = 'https://scrobbler.invalid/lastfm-callback';

export const authUrl = () =>
  `https://www.last.fm/api/auth/?api_key=${API_KEY}&cb=${encodeURIComponent(CALLBACK_URL)}`;

export async function getToken() {
  return tokenSchema.parse(await call('auth.getToken', {})).token;
}

export async function getSession(token: string) {
  return sessionSchema.parse(await call('auth.getSession', { token })).session;
}

export function updateNowPlaying(sk: string, t: TrackInfo) {
  return call('track.updateNowPlaying', {
    sk,
    artist: t.artist,
    track: t.title,
    ...(t.album ? { album: t.album } : {}),
    duration: String(Math.round(t.durationSec)),
  }, true);
}

export interface ScrobbleItem { track: TrackInfo; timestamp: number } // timestamp in unix seconds

export function scrobble(sk: string, items: ScrobbleItem[]) {
  const params: Record<string, string> = { sk };
  items.slice(0, 50).forEach(({ track: t, timestamp }, i) => {
    params[`artist[${i}]`] = t.artist;
    params[`track[${i}]`] = t.title;
    params[`timestamp[${i}]`] = String(timestamp);
    if (t.album) params[`album[${i}]`] = t.album;
    params[`duration[${i}]`] = String(Math.round(t.durationSec));
  });
  return call('track.scrobble', params, true);
}
