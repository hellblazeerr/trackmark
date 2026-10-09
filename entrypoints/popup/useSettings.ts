import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '../../core/types';
import { settingsItem } from '../../storage/settings';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    settingsItem.getValue().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
    // keeps the popup live if settings change elsewhere (options page, other window)
    const unwatch = settingsItem.watch((s) => setSettings(s));
    return unwatch;
  }, []);

  // read the latest stored value before writing, so rapid clicks never overwrite each other
  const update = async (fn: (s: Settings) => Settings) => {
    const current = await settingsItem.getValue();
    await settingsItem.setValue(fn(current));
  };

  return { settings, loaded, update };
}
