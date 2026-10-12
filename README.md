# Trackmark

Scrobble music from **YouTube Music**, **SoundCloud** and **Apple Music** to your [Last.fm](https://www.last.fm) profile. Built for Firefox and Firefox-based browsers such as Zen.

> Independent project. Not affiliated with or endorsed by Last.fm, YouTube, SoundCloud or Apple.

## Features

- Automatic scrobbling and Now Playing updates, with no per-site setup
- Popup with the current track, progress toward the scrobble point, and status
- Global and per-site on/off toggles
- Offline queue: scrobbles are saved and sent later with their original timestamps
- Runs only on the three supported sites, never on regular YouTube

## Install

Requires Firefox 140 or newer.

**Firefox Add-ons:** [link](https://addons.mozilla.org/en-US/firefox/addon/trackmark/)

Click the toolbar icon, choose **Connect Last.fm**, and approve access on the Last.fm page. The tab closes automatically and the popup shows your username. Tabs open before installation need a reload.

## How scrobbling works

- A track is scrobbled after **50% of its length or 4 minutes**, whichever comes first.
- Tracks under 30 seconds and live streams are ignored.
- Only time spent actually playing counts. Pausing and seeking do not.
- The timestamp is the moment playback started.
- Failed scrobbles are queued and retried every minute (up to 500 items, none older than 14 days).

Track details come from the browser's [Media Session API](https://developer.mozilla.org/docs/Web/API/Media_Session_API), so accuracy depends on what each site reports.

## Privacy

Trackmark talks only to Last.fm. There is no Trackmark server, analytics or tracking.

| Sent to Last.fm | Never sent |
|---|---|
| Artist, title, album, duration, start time, and your Last.fm session key | Page URLs, browsing history, your Last.fm password |

Settings, your session, and the scrobble queue are stored locally. **Disconnect** in the popup clears the session, and you can revoke access at [last.fm/settings/applications](https://www.last.fm/settings/applications).

### Permissions

| Permission | Purpose |
|---|---|
| `storage` | Settings, session and scrobble queue |
| `alarms` | Retry queued scrobbles |
| `tabs` | Open the Last.fm login page, detect approval, close the tab |
| `music.youtube.com`, `soundcloud.com`, `music.apple.com` | Read what is playing |
| `ws.audioscrobbler.com` | Last.fm API |

A small page-context script on the three sites observes audio elements that sites create without attaching them to the page, and relays play, pause and position to the extension.

## Known limitations

- Tabs playing at the same time are scrobbled independently.
- Titles are used as reported; suffixes like `(Official Video)` are not cleaned up.

## Development

**Requirements:** [Bun](https://bun.sh) and a Last.fm API key from [last.fm/api/account/create](https://www.last.fm/api/account/create).

```bash
bun install
cp .env.example .env.local   # add WXT_LASTFM_API_KEY and WXT_LASTFM_API_SECRET
bun run dev:firefox          # run with hot reload
bun run test                 # unit tests
bun run build:firefox        # .output/firefox-mv3
bun run zip:firefox          # store package + sources zip
```

To launch a specific browser such as Zen, create a gitignored `web-ext.config.ts`:

```ts
import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  binaries: { firefox: '/path/to/zen' },
});
```

The API secret is compiled into the bundle, as with any client-side extension.

### Structure

```
entrypoints/   background, content script, media hook, React popup
core/          scrobble engine (pure TypeScript) and shared types
lastfm/        signed API client, auth, persistent queue
storage/       typed settings and now-playing state
sites/         site detection
tests/unit/    Vitest tests
```

Content scripts send playback events to the background worker, which feeds the scrobble engine and the queue. Because the worker can be stopped at any time, state is saved to storage after every event.

## Building from source (store reviewers)

Built with WXT (Vite), which bundles and minifies the code. To reproduce the submitted package:

```bash
bun install
cp .env.example .env.local   # add the Last.fm key and secret
bun run zip:firefox          # output in .output/
```


