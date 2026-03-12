import { useState, useEffect, useCallback } from 'react';

export interface AppSettings {
  notifications_enabled: boolean;
  auto_refresh: boolean;
  default_page_size: number;
  compact_view: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  notifications_enabled: true,
  auto_refresh: true,
  default_page_size: 25,
  compact_view: false,
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('app_settings');
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to parse settings:', error);
      }
    }
    setLoading(false);
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('app_settings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return {
    settings,
    updateSettings,
    loading,
  };
}
