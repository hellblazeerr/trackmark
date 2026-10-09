import type { SiteId } from '../core/types';

export function detectSite(hostname: string): SiteId | null {
  if (hostname === 'music.youtube.com') return 'ytmusic';
  if (hostname === 'soundcloud.com') return 'soundcloud';
  if (hostname === 'music.apple.com') return 'apple';
  return null;
}
