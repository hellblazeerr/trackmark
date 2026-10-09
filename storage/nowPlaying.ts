import { storage } from 'wxt/utils/storage';
import type { NowPlaying } from '../core/types';

// session storage: it's ephemeral, so there are no disk writes every few seconds
export const nowPlayingItem = storage.defineItem<NowPlaying | null>('session:nowPlaying', {
  fallback: null,
});
