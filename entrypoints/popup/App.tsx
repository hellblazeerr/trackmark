import { useSettings } from './useSettings';
import { Toggle } from './Toggle';
import { NowPlayingCard } from './NowPlayingCard';
import { AccountSection } from './AccountSection';
import type { SiteId } from '../../core/types';
import './style.css';

const SITES: { id: SiteId; label: string }[] = [
  { id: 'ytmusic', label: 'YouTube Music' },
  { id: 'soundcloud', label: 'SoundCloud' },
  { id: 'apple', label: 'Apple Music' },
];

export default function App() {
  const { settings, loaded, update } = useSettings();
  if (!loaded) return null;

  return (
    <main className="popup">
      <header className="top">
        <h1>Scrobbler</h1>
        <span className={`pill ${settings.enabled ? 'on' : 'off'}`}>
          {settings.enabled ? 'ON' : 'OFF'}
        </span>
      </header>

      <NowPlayingCard />

      <section className="group">
        <Toggle
          label="Enable scrobbling"
          checked={settings.enabled}
          onChange={(enabled) => update((s) => ({ ...s, enabled }))}
        />
      </section>

      <h2 className="section-label">Sites</h2>
      <section className="group">
        {SITES.map(({ id, label }) => (
          <Toggle
            key={id}
            label={label}
            checked={settings.sites[id]}
            disabled={!settings.enabled}
            onChange={(v) => update((s) => ({ ...s, sites: { ...s.sites, [id]: v } }))}
          />
        ))}
      </section>

      <h2 className="section-label">Account</h2>
      <section className="group">
        <AccountSection />
      </section>
    </main>
  );
}
