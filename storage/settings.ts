import { storage } from 'wxt/utils/storage';
import { DEFAULT_SETTINGS, type Settings } from '../core/types';

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});
