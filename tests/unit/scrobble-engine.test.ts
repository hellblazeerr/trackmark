import { describe, expect, it } from 'vitest';
import { ScrobbleEngine, type EngineAction } from '../../core/scrobble-engine';
import type { TrackInfo } from '../../core/types';

const cfg = { minDurationSec: 30, maxDurationSec: null };
const track = (durationSec: number, title = 'Song'): TrackInfo => ({ title, artist: 'Artist', durationSec });
const sec = (n: number) => n * 1000;

function setup(t: TrackInfo, config = cfg) {
  const engine = new ScrobbleEngine(config);
  const run = (e: Parameters<ScrobbleEngine['handle']>[0]): EngineAction[] => engine.handle(e);
  run({ type: 'TRACK_CHANGED', track: t, at: 0 });
  return { engine, run };
}
const scrobbles = (a: EngineAction[]) => a.filter((x) => x.type === 'SCROBBLE');

describe('ScrobbleEngine', () => {
  it('emits now-playing once when playback starts', () => {
    const { run } = setup(track(200));
    const a = run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 0, at: sec(1) });
    expect(a).toEqual([{ type: 'NOW_PLAYING', track: track(200) }]);
    expect(run({ type: 'PLAYBACK_STATE', playing: false, positionSec: 5, at: sec(6) })).toEqual([]);
    expect(run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 5, at: sec(7) })).toEqual([]);
  });

  it('scrobbles at 50% with the start timestamp', () => {
    const { run } = setup(track(200));
    run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 0, at: sec(10) });
    expect(scrobbles(run({ type: 'TICK', at: sec(109) }))).toHaveLength(0);
    expect(run({ type: 'TICK', at: sec(110) })).toEqual([
      { type: 'SCROBBLE', track: track(200), startedAt: sec(10) },
    ]);
  });

  it('caps the threshold at 4 minutes for long tracks', () => {
    const { run } = setup(track(1200));
    run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 0, at: 0 });
    expect(scrobbles(run({ type: 'TICK', at: sec(239) }))).toHaveLength(0);
    expect(scrobbles(run({ type: 'TICK', at: sec(240) }))).toHaveLength(1);
  });

  it('scrobbles only once per play', () => {
    const { run } = setup(track(100));
    run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 0, at: 0 });
    expect(scrobbles(run({ type: 'TICK', at: sec(50) }))).toHaveLength(1);
    expect(scrobbles(run({ type: 'TICK', at: sec(80) }))).toHaveLength(0);
    expect(scrobbles(run({ type: 'TRACK_ENDED', at: sec(100) }))).toHaveLength(0);
  });

  it('does not count time while paused', () => {
    const { run } = setup(track(200));
    run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 0, at: 0 });
    run({ type: 'PLAYBACK_STATE', playing: false, positionSec: 60, at: sec(60) });
    expect(scrobbles(run({ type: 'TICK', at: sec(500) }))).toHaveLength(0);
    run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 60, at: sec(500) });
    expect(scrobbles(run({ type: 'TICK', at: sec(539) }))).toHaveLength(0);
    expect(scrobbles(run({ type: 'TICK', at: sec(540) }))).toHaveLength(1);
  });

  it('does not count seeking to the end as listening', () => {
    const { run } = setup(track(200));
    run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 0, at: 0 });
    run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 195, at: sec(10) }); // seek
    expect(scrobbles(run({ type: 'TRACK_ENDED', at: sec(15) }))).toHaveLength(0);
  });

  it('does not scrobble a track skipped before the threshold', () => {
    const { run } = setup(track(200));
    run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 0, at: 0 });
    const a = run({ type: 'TRACK_CHANGED', track: track(200, 'Next'), at: sec(30) });
    expect(scrobbles(a)).toHaveLength(0);
  });

  it('scrobbles the previous track if it qualified between ticks', () => {
    const { run } = setup(track(200));
    run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 0, at: 0 });
    const a = run({ type: 'TRACK_CHANGED', track: track(200, 'Next'), at: sec(150) });
    expect(scrobbles(a)).toHaveLength(1);
  });

  it('ignores tracks shorter than the minimum', () => {
    const { run } = setup(track(20));
    expect(run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 0, at: 0 })).toEqual([]);
    expect(run({ type: 'TICK', at: sec(100) })).toEqual([]);
  });

  it('ignores live streams and tracks over the max duration', () => {
    const live = setup(track(Infinity));
    expect(live.run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 0, at: 0 })).toEqual([]);

    const long = setup(track(3600), { minDurationSec: 30, maxDurationSec: 900 });
    expect(long.run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 0, at: 0 })).toEqual([]);
  });

  it('counts a replay after scrobbling as a new play', () => {
    const { run } = setup(track(100));
    run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 0, at: 0 });
    run({ type: 'TICK', at: sec(50) }); // scrobbled
    const a = run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 1, at: sec(100) }); // loop
    expect(a).toEqual([{ type: 'NOW_PLAYING', track: track(100) }]);
    expect(scrobbles(run({ type: 'TICK', at: sec(150) }))).toEqual([
      { type: 'SCROBBLE', track: track(100), startedAt: sec(100) },
    ]);
  });

  it('RESET drops the session', () => {
    const { run } = setup(track(100));
    run({ type: 'PLAYBACK_STATE', playing: true, positionSec: 0, at: 0 });
    run({ type: 'RESET' });
    expect(run({ type: 'TICK', at: sec(500) })).toEqual([]);
  });
});
