import { storage } from 'wxt/utils/storage';
import { authUrl, getSession } from './client';

export interface LastfmSession { name: string; key: string }

export const sessionItem = storage.defineItem<LastfmSession | null>('local:lastfmSession', {
  fallback: null,
});

export async function beginAuth() {
  await browser.tabs.create({ url: authUrl() });
}

// called by the background when Last.fm redirects back with ?token=...
export async function completeAuthWithToken(token: string) {
  const session = await getSession(token);
  await sessionItem.setValue(session);
}

export async function logout() {
  await sessionItem.setValue(null);
}
