import { storage } from 'wxt/utils/storage';
import { createMutex } from '../core/mutex';
import { sessionItem } from './auth';
import { LastfmError, scrobble, type ScrobbleItem } from './client';

const queueItem = storage.defineItem<ScrobbleItem[]>('local:scrobbleQueue', { fallback: [] });
const locked = createMutex();
const MAX_AGE_SEC = 14 * 24 * 3600; // Last.fm rejects older scrobbles
const MAX_QUEUE = 500;

export const enqueue = (item: ScrobbleItem) =>
  locked(async () => {
    const q = await queueItem.getValue();
    await queueItem.setValue([...q, item].slice(-MAX_QUEUE));
  });

export const flushQueue = () =>
  locked(async () => {
    const session = await sessionItem.getValue();
    if (!session) return; // keep the queue until the user connects

    for (;;) {
      const nowSec = Date.now() / 1000;
      const queue = (await queueItem.getValue()).filter(
        (i) => nowSec - i.timestamp < MAX_AGE_SEC,
      );
      if (queue.length === 0) {
        await queueItem.setValue([]);
        return;
      }
      const batch = queue.slice(0, 50);
      try {
        await scrobble(session.key, batch);
        await queueItem.setValue(queue.slice(batch.length));
        console.log(`[scrobbler] sent ${batch.length} scrobble(s)`);
      } catch (e) {
        if (e instanceof LastfmError && e.needsReauth) {
          await sessionItem.setValue(null); // popup flips to "Connect"
        } else if (e instanceof LastfmError && !e.retryable) {
          await queueItem.setValue(queue.slice(batch.length)); // unfixable batch: drop it
        }
        // network errors and retryable codes just stay queued for the next attempt
        console.warn('[scrobbler] flush failed', e);
        return;
      }
    }
  });
