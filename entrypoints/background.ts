import { storage } from 'wxt/utils/storage';
import { createMutex } from '../core/mutex';
import {
  ScrobbleEngine,
  type EngineAction,
  type EngineEvent,
  type Session,
} from '../core/scrobble-engine';
import type { ContentMessage, Settings } from '../core/types';
import { beginAuth, completeAuthWithToken, logout, sessionItem } from '../lastfm/auth';
import { CALLBACK_URL, updateNowPlaying } from '../lastfm/client';
import { enqueue, flushQueue } from '../lastfm/queue';
import { settingsItem } from '../storage/settings';
import { scrobbleThresholdMs } from '../core/scrobble-engine';
import type { SiteId } from '../core/types';
import { nowPlayingItem } from '../storage/nowPlaying';

const authHandlers = { AUTH_BEGIN: beginAuth, AUTH_LOGOUT: logout } as const;
const CONTENT_TYPES = new Set(['TRACK_CHANGED', 'PLAYBACK_STATE', 'TRACK_ENDED', 'TICK']);

const run = createMutex();
const sessionKey = (tabId: number) => `session:tab-${tabId}` as const;
const engineCfg = (s: Settings) => ({
  minDurationSec: s.minDurationSec,
  maxDurationSec: s.maxDurationSec,
});

async function execute(actions: EngineAction[]) {
  if (actions.length === 0) return;
  const session = await sessionItem.getValue();

  for (const a of actions) {
    if (a.type === 'NOW_PLAYING') {
      console.log('[scrobbler] now playing:', a.track.artist, '-', a.track.title);
      if (session) {
        updateNowPlaying(session.key, a.track).catch((e) =>
          console.warn('[scrobbler] now playing failed', e),
        );
      }
    } else {
      console.log('[scrobbler] scrobble queued:', a.track.artist, '-', a.track.title);
      await enqueue({ track: a.track, timestamp: Math.floor(a.startedAt / 1000) });
    }
  }

  if (actions.some((a) => a.type === 'SCROBBLE')) {
    flushQueue().catch((e) => console.error('[scrobbler]', e));
  }
}

async function publishNowPlaying(tabId: number, site: SiteId, snap: Session) {
  const cur = await nowPlayingItem.getValue();
  // a paused tab must not replace the card of a different tab that is playing
  if (!snap.playing && cur && cur.tabId !== tabId && cur.playing) return;
  await nowPlayingItem.setValue({
    tabId,
    site,
    track: snap.track,
    playing: snap.playing,
    scrobbled: snap.scrobbled,
    accumulatedMs: snap.accumulatedMs,
    playingSince: snap.playingSince,
    thresholdMs: scrobbleThresholdMs(snap.track),
  });
}

async function clearNowPlaying(tabId: number) {
  const cur = await nowPlayingItem.getValue();
  if (cur?.tabId === tabId) await nowPlayingItem.setValue(null);
}

async function handleContent(msg: ContentMessage, tabId: number) {
  const key = sessionKey(tabId);
  const settings = await settingsItem.getValue();

  // the background enforces the toggles too, so a stale tab can't leak a scrobble
  if (!settings.enabled || !settings.sites[msg.site]) {
    await storage.removeItem(key);
    await clearNowPlaying(tabId);
    return;
  }

  const saved = await storage.getItem<Session | null>(key);
  const engine = new ScrobbleEngine(engineCfg(settings), saved ?? null);

  const { site: _site, ...event } = msg;
  const actions = engine.handle(event as EngineEvent);

  const snap = engine.snapshot();
  if (snap) {
    await storage.setItem(key, snap);
    await publishNowPlaying(tabId, msg.site, snap);
  } else {
    await storage.removeItem(key);
    await clearNowPlaying(tabId);
  }
  await execute(actions);
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (CONTENT_TYPES.has(msg?.type) && sender.tab?.id !== undefined) {
      const tabId = sender.tab.id;
      run(() => handleContent(msg as ContentMessage, tabId)).catch((e) =>
        console.error('[scrobbler]', e),
      );
      return;
    }

    const handler = authHandlers[msg?.type as keyof typeof authHandlers];
    if (!handler) return;
    handler().then(
      () => sendResponse({ ok: true }),
      (e) => sendResponse({ ok: false, error: e?.message ?? String(e) }),
    );
    return true;
  });

  // Last.fm redirects here after the user clicks Allow
  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (!info.url?.startsWith(CALLBACK_URL)) return;
    const token = new URL(info.url).searchParams.get('token');
    browser.tabs.remove(tabId);
    if (!token) return;
    completeAuthWithToken(token).catch((e) => console.error('[scrobbler] auth failed', e));
  });

  // closing a tab finalizes its track (it may have just qualified), then forgets it
  browser.tabs.onRemoved.addListener((tabId) => {
    run(async () => {
      await clearNowPlaying(tabId);
      const key = sessionKey(tabId);
      const saved = await storage.getItem<Session | null>(key);
      if (!saved) return;
      const settings = await settingsItem.getValue();
      const engine = new ScrobbleEngine(engineCfg(settings), saved);
      const actions = engine.handle({ type: 'TRACK_ENDED', at: Date.now() });
      await storage.removeItem(key);
      await execute(actions);
    }).catch((e) => console.error('[scrobbler]', e));
  });

  // retry anything left in the queue, and flush right after the user connects
  browser.alarms.create('flush-queue', { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((a) => {
    if (a.name === 'flush-queue') flushQueue().catch((e) => console.error('[scrobbler]', e));
  });
  sessionItem.watch((s) => {
    if (s) flushQueue().catch((e) => console.error('[scrobbler]', e));
  });
});
