import { useState, useEffect, useCallback, useRef } from "react";

export type DraftStatus = "clean" | "dirty" | "saving" | "saved" | "error";

interface DraftData {
  text: string;
  savedAt: number;
}

interface DraftPersistenceOptions {
  /**
   * Unique key for draft storage (format: entityType:entityId:fieldName)
   * e.g., "case:2841:notes" or "ticket:123:description"
   */
  draftKey: string;
  /**
   * Initial value to use if no draft exists
   */
  initialValue?: string;
  /**
   * Autosave interval in milliseconds (default: 2000)
   */
  autosaveIntervalMs?: number;
  /**
   * Time-to-live for drafts in days (default: 14)
   */
  ttlDays?: number;
  /**
   * Callback when a draft is restored from storage
   */
  onRestore?: (text: string) => void;
  /**
   * Callback when draft status changes
   */
  onStatusChange?: (status: DraftStatus) => void;
}

interface DraftPersistenceResult {
  value: string;
  setValue: (newValue: string) => void;
  setInitialValue: (initial: string) => void;
  status: DraftStatus;
  isDirty: boolean;
  hasChanges: () => boolean;
  saveDraft: () => void;
  clearDraft: () => void;
  lastSaved: Date | null;
  restoredFromDraft: boolean;
  retryLastSave: () => void;
}

const STORAGE_PREFIX = "draft_";
const DEFAULT_TTL_DAYS = 14;
const DEFAULT_AUTOSAVE_INTERVAL = 2000;

function getStorageKey(draftKey: string): string {
  return `${STORAGE_PREFIX}${draftKey}`;
}

function isExpired(savedAt: number, ttlDays: number): boolean {
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return Date.now() - savedAt > ttlMs;
}

export function useDraftPersistence({
  draftKey,
  initialValue = "",
  autosaveIntervalMs = DEFAULT_AUTOSAVE_INTERVAL,
  ttlDays = DEFAULT_TTL_DAYS,
  onRestore,
  onStatusChange,
}: DraftPersistenceOptions): DraftPersistenceResult {
  const [value, setValue] = useState<string>(initialValue);
  const [status, setStatus] = useState<DraftStatus>("clean");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  
  const initialValueRef = useRef<string>(initialValue);
  const autosaveTimerRef = useRef<NodeJS.Timeout>();
  const storageKey = getStorageKey(draftKey);

  // Update status and call callback
  const updateStatus = useCallback((newStatus: DraftStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  // Save draft to localStorage
  const saveDraft = useCallback(() => {
    if (status === "clean") return;
    
    try {
      updateStatus("saving");
      const draftData: DraftData = {
        text: value,
        savedAt: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(draftData));
      setLastSaved(new Date());
      updateStatus("saved");
      
      // Reset to dirty if value differs from initial after a short delay
      setTimeout(() => {
        if (value !== initialValueRef.current) {
          updateStatus("dirty");
        } else {
          updateStatus("clean");
        }
      }, 1000);
    } catch (error) {
      console.error("Failed to save draft:", error);
      updateStatus("error");
    }
  }, [value, status, storageKey, updateStatus]);

  // Retry last save (for error recovery)
  const retryLastSave = useCallback(() => {
    if (status === "error") {
      saveDraft();
    }
  }, [status, saveDraft]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setLastSaved(null);
      setRestoredFromDraft(false);
      updateStatus("clean");
    } catch (error) {
      console.error("Failed to clear draft:", error);
    }
  }, [storageKey, updateStatus]);

  // Update value and mark as dirty
  const updateValue = useCallback((newValue: string) => {
    setValue(newValue);
    if (newValue !== initialValueRef.current) {
      updateStatus("dirty");
    } else {
      updateStatus("clean");
    }
  }, [updateStatus]);

  // Set initial value (e.g., from server data)
  const setInitialValue = useCallback((initial: string) => {
    initialValueRef.current = initial;
    setValue(initial);
    updateStatus("clean");
  }, [updateStatus]);

  // Check if current value differs from initial
  const hasChanges = useCallback(() => {
    return value !== initialValueRef.current;
  }, [value]);

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draftData: DraftData = JSON.parse(stored);
        
        // Check if draft is expired
        if (isExpired(draftData.savedAt, ttlDays)) {
          localStorage.removeItem(storageKey);
          return;
        }

        // Restore draft if it differs from initial
        if (draftData.text && draftData.text !== initialValue) {
          setValue(draftData.text);
          setRestoredFromDraft(true);
          setLastSaved(new Date(draftData.savedAt));
          updateStatus("dirty");
          onRestore?.(draftData.text);
        }
      }
    } catch (error) {
      console.error("Failed to restore draft:", error);
    }
  }, [storageKey, initialValue, ttlDays, onRestore, updateStatus]);

  // Autosave timer
  useEffect(() => {
    if (status === "dirty") {
      autosaveTimerRef.current = setTimeout(() => {
        saveDraft();
      }, autosaveIntervalMs);
    }

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [value, status, autosaveIntervalMs, saveDraft]);

  // Save on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (status === "dirty") {
        const draftData: DraftData = {
          text: value,
          savedAt: Date.now(),
        };
        try {
          localStorage.setItem(storageKey, JSON.stringify(draftData));
        } catch {
          // Ignore errors on unload
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [value, status, storageKey]);

  return {
    value,
    setValue: updateValue,
    setInitialValue,
    status,
    isDirty: status === "dirty" || status === "saving",
    hasChanges,
    saveDraft,
    clearDraft,
    lastSaved,
    restoredFromDraft,
    retryLastSave,
  };
}
