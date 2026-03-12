import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Options for useTypedStorage hook
 */
interface UseTypedStorageOptions<T> {
  /** Optional TTL in milliseconds - data expires after this duration */
  ttl?: number;
  /** Whether to sync across browser tabs (default: true) */
  crossTabSync?: boolean;
  /** Validation function to ensure stored data matches expected type */
  validate?: (value: unknown) => value is T;
  /** Callback when value changes (from any source) */
  onChange?: (value: T) => void;
  /** Whether to include environment prefix in key */
  environmentAware?: boolean;
}

interface StoredValue<T> {
  value: T;
  timestamp: number;
  version?: number;
}

/**
 * Enhanced localStorage hook with type safety, TTL, cross-tab sync, and validation
 * 
 * @example
 * // Simple usage
 * const [theme, setTheme] = useTypedStorage('system:theme', 'light');
 * 
 * @example
 * // With TTL (expires after 24 hours)
 * const [draft, setDraft] = useTypedStorage('draft:form:customer', '', { ttl: 24 * 60 * 60 * 1000 });
 * 
 * @example
 * // With validation
 * const [columns, setColumns] = useTypedStorage('ui:columns:tasks', DEFAULT_COLUMNS, {
 *   validate: (v): v is ColumnConfig[] => Array.isArray(v) && v.every(c => 'key' in c)
 * });
 */
export function useTypedStorage<T>(
  key: string,
  initialValue: T,
  options: UseTypedStorageOptions<T> = {}
): [T, (value: T | ((prev: T) => T)) => void, { 
  reset: () => void; 
  isExpired: boolean;
  lastUpdated: Date | null;
}] {
  const {
    ttl,
    crossTabSync = true,
    validate,
    onChange,
    environmentAware = false,
  } = options;

  // Get environment-aware key if needed
  const getStorageKey = useCallback(() => {
    if (environmentAware) {
      const env = localStorage.getItem('system:data-environment') || 
                  localStorage.getItem('data-environment') || 
                  'production';
      return `${key}:${env}`;
    }
    return key;
  }, [key, environmentAware]);

  const storageKey = getStorageKey();
  const initialValueRef = useRef(initialValue);

  // Parse stored value with TTL and validation checks
  const parseStoredValue = useCallback((stored: string | null): { value: T; timestamp: number | null; isExpired: boolean } => {
    if (stored === null) {
      return { value: initialValue, timestamp: null, isExpired: false };
    }

    try {
      const parsed = JSON.parse(stored);
      
      // Check if it's a wrapped value with timestamp
      if (parsed && typeof parsed === 'object' && 'value' in parsed && 'timestamp' in parsed) {
        const storedData = parsed as StoredValue<T>;
        
        // Check TTL
        if (ttl && Date.now() - storedData.timestamp > ttl) {
          return { value: initialValue, timestamp: storedData.timestamp, isExpired: true };
        }
        
        // Validate if validator provided
        if (validate && !validate(storedData.value)) {
          console.warn(`Invalid stored value for key "${storageKey}", using initial value`);
          return { value: initialValue, timestamp: storedData.timestamp, isExpired: false };
        }
        
        return { value: storedData.value, timestamp: storedData.timestamp, isExpired: false };
      }
      
      // Legacy format (raw value without wrapper)
      if (validate && !validate(parsed)) {
        console.warn(`Invalid stored value for key "${storageKey}", using initial value`);
        return { value: initialValue, timestamp: null, isExpired: false };
      }
      
      return { value: parsed as T, timestamp: null, isExpired: false };
    } catch (error) {
      console.error(`Error parsing localStorage key "${storageKey}":`, error);
      return { value: initialValue, timestamp: null, isExpired: false };
    }
  }, [initialValue, storageKey, ttl, validate]);

  // Initialize state from localStorage
  const [state, setState] = useState<{ value: T; timestamp: number | null; isExpired: boolean }>(() => {
    if (typeof window === 'undefined') {
      return { value: initialValue, timestamp: null, isExpired: false };
    }
    
    try {
      const stored = localStorage.getItem(storageKey);
      return parseStoredValue(stored);
    } catch {
      return { value: initialValue, timestamp: null, isExpired: false };
    }
  });

  // Update localStorage when value changes
  const setValue = useCallback((valueOrUpdater: T | ((prev: T) => T)) => {
    setState(prevState => {
      const newValue = valueOrUpdater instanceof Function 
        ? valueOrUpdater(prevState.value) 
        : valueOrUpdater;
      
      const timestamp = Date.now();
      
      try {
        const toStore: StoredValue<T> = {
          value: newValue,
          timestamp,
        };
        localStorage.setItem(storageKey, JSON.stringify(toStore));
      } catch (error) {
        console.error(`Error saving to localStorage key "${storageKey}":`, error);
      }
      
      onChange?.(newValue);
      
      return { value: newValue, timestamp, isExpired: false };
    });
  }, [storageKey, onChange]);

  // Reset to initial value
  const reset = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error(`Error removing localStorage key "${storageKey}":`, error);
    }
    
    setState({ value: initialValueRef.current, timestamp: null, isExpired: false });
    onChange?.(initialValueRef.current);
  }, [storageKey, onChange]);

  // Listen for changes from other tabs
  useEffect(() => {
    if (!crossTabSync) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue !== null) {
        const parsed = parseStoredValue(event.newValue);
        setState(parsed);
        onChange?.(parsed.value);
      } else if (event.key === storageKey && event.newValue === null) {
        // Key was removed in another tab
        setState({ value: initialValueRef.current, timestamp: null, isExpired: false });
        onChange?.(initialValueRef.current);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [storageKey, crossTabSync, parseStoredValue, onChange]);

  // Re-check expiration on mount/key change
  useEffect(() => {
    if (ttl && state.timestamp) {
      const isNowExpired = Date.now() - state.timestamp > ttl;
      if (isNowExpired && !state.isExpired) {
        setState(prev => ({ ...prev, isExpired: true, value: initialValueRef.current }));
      }
    }
  }, [ttl, state.timestamp, state.isExpired]);

  return [
    state.value,
    setValue,
    {
      reset,
      isExpired: state.isExpired,
      lastUpdated: state.timestamp ? new Date(state.timestamp) : null,
    },
  ];
}

/**
 * Simple typed storage for values that don't need TTL or validation
 * Maintains full compatibility with existing useLocalStorage patterns
 */
export function useSimpleStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useTypedStorage(key, initialValue);
  return [value, setValue];
}

/**
 * Storage hook for environment-aware preferences
 * Automatically prefixes key with current data environment
 */
export function useEnvironmentStorage<T>(
  key: string,
  initialValue: T,
  options: Omit<UseTypedStorageOptions<T>, 'environmentAware'> = {}
): [T, (value: T | ((prev: T) => T)) => void, { reset: () => void }] {
  const [value, setValue, { reset }] = useTypedStorage(key, initialValue, {
    ...options,
    environmentAware: true,
  });
  return [value, setValue, { reset }];
}

/**
 * Read-only storage hook - for values set elsewhere
 */
export function useStorageValue<T>(key: string, defaultValue: T): T {
  const [value] = useTypedStorage(key, defaultValue, { crossTabSync: true });
  return value;
}
