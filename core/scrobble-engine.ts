import type { TrackInfo } from './types';

export interface EngineConfig {
  minDurationSec: number;
  maxDurationSec: number | null;
}

// all timestamps `at` are epoch milliseconds
export type EngineEvent =
  | { type: 'TRACK_CHANGED'; track: TrackInfo; at: number }
  | { type: 'PLAYBACK_STATE'; playing: boolean; positionSec: number; at: number }
  | { type: 'TRACK_ENDED'; at: number }
  | { type: 'TICK'; at: number }
  | { type: 'RESET' }; // scrobbling disabled, tab closed, etc.

export type EngineAction =
  | { type: 'NOW_PLAYING'; track: TrackInfo }
  | { type: 'SCROBBLE'; track: TrackInfo; startedAt: number };

export interface Session {
  track: TrackInfo;
  startedAt: number | null; // set on first play
  playing: boolean;
  playingSince: number | null;
  accumulatedMs: number;
  scrobbled: boolean;
}

const MAX_THRESHOLD_MS = 240_000;
const RESTART_WINDOW_SEC = 5;

export const scrobbleThresholdMs = (t: TrackInfo) =>
  Math.min((t.durationSec * 1000) / 2, MAX_THRESHOLD_MS);


export class ScrobbleEngine {
  private s: Session | null;

  constructor(private cfg: EngineConfig, initial: Session | null = null) {
    this.s = initial;
  }

  setConfig(cfg: EngineConfig) {
    this.cfg = cfg;
  }

  /** Serializable state, so the background can persist it across restarts. */
  snapshot(): Session | null {
    return this.s ? { ...this.s } : null;
  }

  /** ms until the current track becomes scrobble-eligible (null if not counting). */
  msUntilScrobble(at: number): number | null {
    const s = this.s;
    if (!s || s.scrobbled || !s.playing) return null;
    return Math.max(0, this.thresholdMs(s.track) - this.playedMs(s, at));
  }

  handle(e: EngineEvent): EngineAction[] {
    switch (e.type) {
      case 'TRACK_CHANGED':
        return this.start(e.track, e.at);
      case 'PLAYBACK_STATE':
        return this.onPlayback(e.playing, e.positionSec, e.at);
      case 'TRACK_ENDED':
        return this.onEnded(e.at);
      case 'TICK':
        return this.s ? this.check(this.s, e.at) : [];
      case 'RESET':
        this.s = null;
        return [];
    }
  }

  // --- internals ---

  private start(track: TrackInfo, at: number): EngineAction[] {
    const actions = this.finalize(at); // previous track may have just qualified
    this.s = this.isScrobblable(track)
      ? { track, startedAt: null, playing: false, playingSince: null, accumulatedMs: 0, scrobbled: false }
      : null;
    return actions;
  }

  private onPlayback(playing: boolean, positionSec: number, at: number): EngineAction[] {
    if (!this.s) return [];
    const actions: EngineAction[] = [];

    // replay of an already-scrobbled track (repeat-one, or seek back to start)
    if (this.s.scrobbled && playing && positionSec < RESTART_WINDOW_SEC) {
      actions.push(...this.start(this.s.track, at));
    }

    const s = this.s;
    if (!s) return actions;

    if (playing && !s.playing) {
      s.playing = true;
      s.playingSince = at;
      if (s.startedAt === null) {
        s.startedAt = at;
        actions.push({ type: 'NOW_PLAYING', track: s.track });
      }
    } else if (!playing && s.playing) {
      this.pause(s, at);
    }

    actions.push(...this.check(s, at));
    return actions;
  }

  private onEnded(at: number): EngineAction[] {
    return this.finalize(at);
  }

  private finalize(at: number): EngineAction[] {
    const s = this.s;
    if (!s) return [];
    this.pause(s, at);
    return this.check(s, at);
  }

  private pause(s: Session, at: number) {
    if (s.playing && s.playingSince !== null) {
      s.accumulatedMs += at - s.playingSince;
    }
    s.playing = false;
    s.playingSince = null;
  }

  private check(s: Session, at: number): EngineAction[] {
    if (s.scrobbled || s.startedAt === null) return [];
    if (this.playedMs(s, at) < this.thresholdMs(s.track)) return [];
    s.scrobbled = true;
    return [{ type: 'SCROBBLE', track: s.track, startedAt: s.startedAt }];
  }

  private playedMs(s: Session, at: number): number {
    return s.accumulatedMs + (s.playing && s.playingSince !== null ? at - s.playingSince : 0);
  }

  
  private thresholdMs(track: TrackInfo): number {
    return scrobbleThresholdMs(track);
  }

  private isScrobblable(t: TrackInfo): boolean {
    if (!t.title || !t.artist) return false;
    if (!Number.isFinite(t.durationSec)) return false; // live streams report Infinity
    if (t.durationSec < this.cfg.minDurationSec) return false;
    if (this.cfg.maxDurationSec !== null && t.durationSec > this.cfg.maxDurationSec) return false;
    return true;
  }
}
