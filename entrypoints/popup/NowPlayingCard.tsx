import { useEffect, useState } from 'react';
import type { NowPlaying, SiteId } from '../../core/types';
import { nowPlayingItem } from '../../storage/nowPlaying';

const SITE_LABEL: Record<SiteId, string> = {
  ytmusic: 'YouTube Music',
  soundcloud: 'SoundCloud',
  apple: 'Apple Music',
};

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function NowPlayingCard() {
  const [np, setNp] = useState<NowPlaying | null>(null);
  const [, force] = useState(0);
  const [artFailed, setArtFailed] = useState(false);

  useEffect(() => {
    nowPlayingItem.getValue().then(setNp);
    return nowPlayingItem.watch(setNp);
  }, []);

  // re-render every second while playing so the bar moves between background updates
  useEffect(() => {
    if (!np?.playing) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [np?.playing]);

  useEffect(() => setArtFailed(false), [np?.track.artworkUrl]);

  if (!np) return <p className="np-empty">Nothing playing</p>;

  const elapsed =
    np.accumulatedMs +
    (np.playing && np.playingSince !== null ? Date.now() - np.playingSince : 0);
  const remaining = Math.max(0, np.thresholdMs - elapsed);
  const pct = np.scrobbled ? 100 : Math.min(100, (elapsed / np.thresholdMs) * 100);

  const status = np.scrobbled
    ? 'Scrobbled ✓'
    : np.playing
      ? `Scrobbles in ${fmt(remaining)}`
      : 'Paused';

  if (!np) {
    return (
      <div className="np np-empty">
        <span className="np-note">♪</span>
        <span>Nothing playing</span>
      </div>
    );
  }

// ...elapsed / remaining / pct / status calculations unchanged...

  return (
    <div className="np">
      {np.track.artworkUrl && !artFailed ? (
        <img className="np-art" src={np.track.artworkUrl} alt="" onError={() => setArtFailed(true)} />
      ) : (
        <div className="np-art" />
      )}
      <div className="np-info">
        <div className="np-title" title={np.track.title}>{np.track.title}</div>
        <div className="np-artist" title={np.track.artist}>{np.track.artist}</div>
        <div className="np-bar"><div style={{ width: `${pct}%` }} /></div>
        <div className="np-meta">
          <span className={np.scrobbled ? 'np-done' : ''}>{status}</span>
          <span>{SITE_LABEL[np.site]}</span>
        </div>
      </div>
    </div>
  );
}
