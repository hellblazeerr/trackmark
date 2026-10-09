export default defineContentScript({
  matches: [
    '*://music.youtube.com/*',
    '*://soundcloud.com/*',
    '*://music.apple.com/*',
  ],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const seen = new WeakSet<HTMLMediaElement>();
    const ids = new WeakMap<HTMLMediaElement, number>();
    let nextId = 1;

    const post = (type: string, el: HTMLMediaElement) =>
      window.postMessage(
        {
          __scrobbler: true,
          type,
          id: ids.get(el),
          currentTime: el.currentTime,
          duration: el.duration,
          paused: el.paused,
          ended: el.ended,
        },
        '*',
      );

    const track = (el: HTMLMediaElement) => {
      if (seen.has(el)) return;
      seen.add(el);
      ids.set(el, nextId++);
      for (const ev of ['play', 'playing', 'pause', 'seeked', 'ended', 'timeupdate', 'durationchange']) {
        el.addEventListener(ev, () => post(ev, el));
      }
    };

    // catches elements that are created in JS and never attached to the DOM
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      track(this);
      return origPlay.call(this);
    };

    // catches normal elements that were already in the page
    for (const ev of ['play', 'playing', 'timeupdate']) {
      document.addEventListener(
        ev,
        (e) => {
          if (e.target instanceof HTMLMediaElement) track(e.target);
        },
        true,
      );
    }
  },
});
