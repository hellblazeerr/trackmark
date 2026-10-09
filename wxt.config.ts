import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    name: 'Trackmark', // replace with your final name
    description: 'Scrobble YouTube Music, SoundCloud and Apple Music to Last.fm.',
    permissions: ['storage', 'alarms', 'tabs'],
    host_permissions: [
      '*://music.youtube.com/*',
      '*://soundcloud.com/*',
      '*://music.apple.com/*',
      '*://ws.audioscrobbler.com/*',
    ],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'trackmark@hellblazeerr.dev', // permanent once published
          strict_min_version: '140.0',
          data_collection_permissions: {
            required: ['websiteContent', 'authenticationInfo'],
          },
        },
      },
    }),
  }),
});
