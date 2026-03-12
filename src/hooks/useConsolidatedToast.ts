import { useState, useCallback, useRef } from 'react';

export interface ToastResult {
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  details?: string[];
}

export interface ConsolidatedToastOptions {
  title: string;
  results: ToastResult[];
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

// Get overall status from results
export const getOverallStatus = (results: ToastResult[]): 'success' | 'warning' | 'error' => {
  if (results.some(r => r.type === 'error')) return 'error';
  if (results.some(r => r.type === 'warning')) return 'warning';
  return 'success';
};

// Helper to collect toast results during an operation
export const useToastCollector = () => {
  const resultsRef = useRef<ToastResult[]>([]);

  const collect = useCallback((result: ToastResult) => {
    resultsRef.current.push(result);
  }, []);

  const collectSuccess = useCallback((title: string, message: string, details?: string[]) => {
    resultsRef.current.push({ type: 'success', title, message, details });
  }, []);

  const collectWarning = useCallback((title: string, message: string, details?: string[]) => {
    resultsRef.current.push({ type: 'warning', title, message, details });
  }, []);

  const collectError = useCallback((title: string, message: string, details?: string[]) => {
    resultsRef.current.push({ type: 'error', title, message, details });
  }, []);

  const getResults = useCallback((): ToastResult[] => {
    return [...resultsRef.current];
  }, []);

  const clear = useCallback(() => {
    resultsRef.current = [];
  }, []);

  return {
    collect,
    collectSuccess,
    collectWarning,
    collectError,
    getResults,
    clear,
  };
};

// Non-hook version for use outside components
export const createToastCollector = () => {
  let results: ToastResult[] = [];

  return {
    collect: (result: ToastResult) => {
      results.push(result);
    },
    collectSuccess: (title: string, message: string, details?: string[]) => {
      results.push({ type: 'success', title, message, details });
    },
    collectWarning: (title: string, message: string, details?: string[]) => {
      results.push({ type: 'warning', title, message, details });
    },
    collectError: (title: string, message: string, details?: string[]) => {
      results.push({ type: 'error', title, message, details });
    },
    getResults: (): ToastResult[] => [...results],
    clear: () => {
      results = [];
    },
  };
};
