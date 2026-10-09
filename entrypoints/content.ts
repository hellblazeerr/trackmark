import type { ContentMessage, TrackInfo } from '../core/types';
import { detectSite } from '../sites/config';
import { settingsItem } from '../storage/settings';

interface MediaState {
  id: number;
  currentTime: number;
  duration: number;
  paused: boolean;
}

export default defineContentScript({
  matches: [
    '*://music.youtube.com/*',
    '*://soundcloud.com/*',
    '*://music.apple.com/*',
  ],
  runAt: 'document_idle',
  main() {
    const site = detectSite(location.hostname);
    if (!site) return;

    const send = (m: ContentMessage) => {
      browser.runtime.sendMessage(m).catch(() => {});
    };

    let media: MediaState | null = null; // the element that is actually playing
    let announcedId = '';
    let candidateSig = '';
    let lastPos = 0;
    let lastBeat = 0;

    const playbackState = (): ContentMessage => ({
      type: 'PLAYBACK_STATE',
      site,
      playing: !!media && !media.paused,
      positionSec: media?.currentTime ?? 0,
      at: Date.now(),
    });

    function readTrack(): TrackInfo | null {
      const md = navigator.mediaSession.metadata;
      const dur = media?.duration;
      if (!md?.title || !md.artist || !dur || !Number.isFinite(dur)) return null;
      return {
        title: md.title,
        artist: md.artist,
        album: md.album || undefined,
        durationSec: Math.round(dur),
        artworkUrl: md.artwork?.[0]?.src,
      };
    }

    // events relayed from the MAIN-world hook
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (e.source !== window || !d?.__scrobbler) return;

      const state: MediaState = {
        id: d.id,
        currentTime: d.currentTime,
        duration: d.duration,
        paused: d.paused,
      };

      // an element becomes the active one when it starts playing
      const starting = d.type === 'play' || d.type === 'playing' || (d.type === 'timeupdate' && !d.paused);
      if (starting) media = state;
      if (!media || media.id !== d.id) return; // ignore preview/ad elements
      media = state;

      if (d.type === 'ended') {
        send({ type: 'TRACK_ENDED', site, at: Date.now() });
        announcedId = '';
      } else if (d.type === 'play' || d.type === 'pause' || d.type === 'seeked') {
        send(playbackState());
      }
    });

    // a page reload closes whatever session this tab had
    send({ type: 'TRACK_ENDED', site, at: Date.now() });

    settingsItem.watch(() => { announcedId = ''; });

    setInterval(() => {
      const track = readTrack();
      if (track) {
        const id = `${track.artist}|${track.title}`;
        const sig = `${id}|${track.durationSec}`;
        if (id !== announcedId) {
          if (sig === candidateSig) {
            announcedId = id;
            send({ type: 'TRACK_CHANGED', site, track, at: Date.now() });
            send(playbackState());
          } else {
            candidateSig = sig;
          }
        }
      }

      if (media && !media.paused) {
        if (lastPos - media.currentTime > 2) send(playbackState());
        lastPos = media.currentTime;

        if (Date.now() - lastBeat >= 5000) {
          lastBeat = Date.now();
          send({ type: 'TICK', site, at: Date.now() });
        }
      }
    }, 1000);
  },
});
