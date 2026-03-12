import { useState, useEffect, useRef } from 'react';
import { getCurrentEnvironment } from '@/lib/environment-utils';
import { DASHBOARD_DEFAULTS, AVAILABLE_CARDS, type DashboardCard } from '@/lib/dashboard-defaults';

const DASHBOARD_VERSION = '2.4';
const DEFAULT_CARDS = [...DASHBOARD_DEFAULTS.cards];
const DEFAULT_TABLET_CARDS = [...DASHBOARD_DEFAULTS.tabletCards];

// Migration: one-time forced reset for 2.4, non-destructive for future versions
const migrateIfNeeded = (env: string) => {
  const versionKey = `dashboardVersion_${env}`;
  const storedVersion = localStorage.getItem(versionKey);

  if (!storedVersion || parseFloat(storedVersion) < 2.4) {
    // Force reset to defaults — fixes stale widget order from pre-2.4
    const storageKey = getNewStorageKey(env);
    localStorage.removeItem(storageKey);
    localStorage.removeItem(getLegacyStorageKey(env));
    localStorage.setItem(versionKey, DASHBOARD_VERSION);
    return true; // use defaults
  }

  if (parseFloat(storedVersion) < parseFloat(DASHBOARD_VERSION)) {
    // Future versions: non-destructive — filter out invalid IDs, keep the rest
    const storageKey = getNewStorageKey(env);
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const value = parsed?.value ?? parsed;
        if (Array.isArray(value)) {
          const validIds = value.filter((id: string) =>
            AVAILABLE_CARDS.some(card => card.id === id)
          );
          if (validIds.length > 0) {
            const toStore = { value: validIds, timestamp: Date.now() };
            localStorage.setItem(storageKey, JSON.stringify(toStore));
            localStorage.setItem(versionKey, DASHBOARD_VERSION);
            return false; // cards preserved
          }
        }
      } catch (e) {
        // corrupted data, fall through to defaults
      }
    }

    localStorage.removeItem(getLegacyStorageKey(env));
    localStorage.setItem(versionKey, DASHBOARD_VERSION);
    return true;
  }

  return false;
};

// Helper to get standardized storage key (same as modal uses)
const getNewStorageKey = (env: string) => `ui:dashboard:cards:${env}`;
const getLegacyStorageKey = (env: string) => `dashboardCards_${env}`;

// Helper to parse stored value (handles both wrapped and unwrapped formats)
const parseStoredCards = (saved: string | null): string[] | null => {
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    const value = parsed?.value ?? parsed;
    if (Array.isArray(value) && value.length > 0) {
      const validIds = value.filter((id: string) =>
        AVAILABLE_CARDS.some(card => card.id === id)
      );
      if (validIds.length > 0) return validIds;
    }
  } catch (e) {
    console.error('[useDashboardCards] Failed to parse saved cards:', e);
  }
  return null;
};

export const useDashboardCards = () => {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>(() => {
    const env = getCurrentEnvironment();
    const versionKey = `dashboardVersion_${env}`;

    // Run migration first — clears stale saved cards if version is outdated
    if (migrateIfNeeded(env)) {
      return DEFAULT_CARDS;
    }

    // Try new standardized key first (same as modal)
    const newStorageKey = getNewStorageKey(env);
    const newSaved = localStorage.getItem(newStorageKey);
    const parsedNew = parseStoredCards(newSaved);
    if (parsedNew) {
      return parsedNew.slice(0, DASHBOARD_DEFAULTS.maxCards);
    }

    // Fallback to legacy key
    const legacyStorageKey = getLegacyStorageKey(env);
    const legacySaved = localStorage.getItem(legacyStorageKey);
    const parsedLegacy = parseStoredCards(legacySaved);
    if (parsedLegacy) {
      return parsedLegacy.slice(0, DASHBOARD_DEFAULTS.maxCards);
    }

    // No saved data - use defaults
    localStorage.setItem(versionKey, DASHBOARD_VERSION);
    return DEFAULT_CARDS;
  });

  // Persist selection to localStorage whenever it changes
  useEffect(() => {
    if (selectedCardIds.length === 0) return; // don't persist empty state
    const env = getCurrentEnvironment();
    const toStore = { value: selectedCardIds, timestamp: Date.now() };
    localStorage.setItem(getNewStorageKey(env), JSON.stringify(toStore));
  }, [selectedCardIds]);

  // Ref to prevent circular event handling
  const isDispatchingRef = useRef(false);

  // Listen for dashboardCardsChanged events from the modal
  useEffect(() => {
    const handleCardsChange = (e: Event) => {
      if (isDispatchingRef.current) return;
      const customEvent = e as CustomEvent<{ cards: string[], env: string }>;
      const { cards, env: eventEnv } = customEvent.detail;
      const currentEnv = getCurrentEnvironment();
      if (eventEnv === currentEnv) {
        setSelectedCardIds(cards);
      }
    };

    window.addEventListener('dashboardCardsChanged', handleCardsChange);
    return () => {
      window.removeEventListener('dashboardCardsChanged', handleCardsChange);
    };
  }, []);

  const selectedCards = selectedCardIds
    .map(id => AVAILABLE_CARDS.find(card => card.id === id))
    .filter(Boolean) as DashboardCard[];

  const availableCards = AVAILABLE_CARDS.filter(
    card => !selectedCardIds.includes(card.id)
  );

  const addCard = (cardId: string) => {
    if (!selectedCardIds.includes(cardId) && selectedCardIds.length < DASHBOARD_DEFAULTS.maxCards) {
      setSelectedCardIds(prev => [...prev, cardId]);
    }
  };

  const removeCard = (cardId: string) => {
    setSelectedCardIds(prev => prev.filter(id => id !== cardId));
  };

  const reorderCards = (newOrder: string[]) => {
    setSelectedCardIds(newOrder);
  };

  const resetToDefault = () => {
    setSelectedCardIds(DEFAULT_CARDS);
  };

  return {
    selectedCards,
    availableCards,
    addCard,
    removeCard,
    reorderCards,
    resetToDefault,
    allCards: AVAILABLE_CARDS
  };
};
