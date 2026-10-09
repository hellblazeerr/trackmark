export type SiteId = 'ytmusic' | 'soundcloud' | 'apple';

export interface TrackInfo {
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  artworkUrl?: string;
}
export type ContentMessage =
  | { type: 'TRACK_CHANGED'; site: SiteId; track: TrackInfo; at: number }
  | { type: 'PLAYBACK_STATE'; site: SiteId; playing: boolean; positionSec: number; at: number }
  | { type: 'TRACK_ENDED'; site: SiteId; at: number }
  | { type: 'TICK'; site: SiteId; at: number };

export interface Settings {
  enabled: boolean;                 // global switch
  sites: Record<SiteId, boolean>;   // per-site toggles
  minDurationSec: number;           // default 30
  maxDurationSec: number | null;    // e.g. 900, to skip podcasts and long videos
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  sites: { ytmusic: true, soundcloud: true, apple: true },
  minDurationSec: 30,
  maxDurationSec: null,
};

export interface NowPlaying {
  tabId: number;
  site: SiteId;
  track: TrackInfo;
  playing: boolean;
  scrobbled: boolean;
  accumulatedMs: number;
  playingSince: number | null;
  thresholdMs: number;
}
