import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  normalizeSettings,
  type AppSettings,
} from '../../settings';

const hasStorage = typeof chrome !== 'undefined' && !!chrome.storage?.local;

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  // In the dev server (no `chrome`) there's nothing to load — treat this as an
  // already-configured install so the preview keeps opening on the chat view.
  const [loaded, setLoaded] = useState(!hasStorage);
  const [configured, setConfigured] = useState(!hasStorage);

  useEffect(() => {
    if (!hasStorage) return;
    let cancelled = false;
    void chrome.storage.local
      .get(SETTINGS_KEY)
      .then((stored) => {
        if (cancelled) return;
        // A missing key means the preferences have never been saved.
        if (stored[SETTINGS_KEY] !== undefined) {
          setSettings(normalizeSettings(stored[SETTINGS_KEY]));
          setConfigured(true);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSettings = useCallback(async (next: AppSettings) => {
    setSettings(next);
    setConfigured(true);
    if (!hasStorage) return;
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  }, []);

  return { settings, loaded, configured, saveSettings };
}
