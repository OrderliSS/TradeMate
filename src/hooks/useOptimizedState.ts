/**
 * Optimized state management hooks for better performance
 */
import { useReducer, useCallback, useMemo, useRef, useState } from 'react';
import { logger } from '@/lib/logger';

// Enhanced useReducer for complex array state
export function useOptimizedArray<T>(initialValue: T[] = []) {
  const reducer = useCallback((state: T[], action: {
    type: 'SET' | 'ADD' | 'REMOVE' | 'UPDATE' | 'CLEAR' | 'TOGGLE';
    payload?: any;
    index?: number;
    predicate?: (item: T) => boolean;
  }) => {
    switch (action.type) {
      case 'SET':
        return action.payload || [];
      case 'ADD':
        return [...state, action.payload];
      case 'REMOVE':
        if (action.predicate) {
          return state.filter(item => !action.predicate!(item));
        }
        if (action.index !== undefined) {
          return state.filter((_, i) => i !== action.index);
        }
        return state.filter(item => item !== action.payload);
      case 'UPDATE':
        if (action.index !== undefined) {
          const newState = [...state];
          newState[action.index] = action.payload;
          return newState;
        }
        if (action.predicate) {
          return state.map(item => action.predicate!(item) ? action.payload : item);
        }
        return state;
      case 'TOGGLE':
        if (state.includes(action.payload)) {
          return state.filter(item => item !== action.payload);
        }
        return [...state, action.payload];
      case 'CLEAR':
        return [];
      default:
        return state;
    }
  }, []);

  const [state, dispatch] = useReducer(reducer, initialValue);

  const actions = useMemo(() => ({
    set: (items: T[]) => dispatch({ type: 'SET', payload: items }),
    add: (item: T) => dispatch({ type: 'ADD', payload: item }),
    remove: (item: T) => dispatch({ type: 'REMOVE', payload: item }),
    removeAt: (index: number) => dispatch({ type: 'REMOVE', index }),
    removeWhere: (predicate: (item: T) => boolean) => dispatch({ type: 'REMOVE', predicate }),
    update: (item: T, predicate: (item: T) => boolean) => dispatch({ type: 'UPDATE', payload: item, predicate }),
    updateAt: (index: number, item: T) => dispatch({ type: 'UPDATE', index, payload: item }),
    toggle: (item: T) => dispatch({ type: 'TOGGLE', payload: item }),
    clear: () => dispatch({ type: 'CLEAR' }),
  }), [dispatch]);

  return [state, actions] as const;
}

// Optimized form state management
export function useOptimizedForm<T extends Record<string, any>>(initialValues: T) {
  const [values, setValues] = useReducer(
    (state: T, action: { type: 'SET' | 'UPDATE' | 'RESET'; field?: keyof T; value?: any; payload?: T }) => {
      switch (action.type) {
        case 'SET':
          return action.payload || initialValues;
        case 'UPDATE':
          if (action.field && action.value !== undefined) {
            return { ...state, [action.field]: action.value };
          }
          return state;
        case 'RESET':
          return initialValues;
        default:
          return state;
      }
    },
    initialValues
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback((field: keyof T, value: any) => {
    setValues({ type: 'UPDATE', field, value });
  }, []);

  const resetForm = useCallback(() => {
    setValues({ type: 'RESET' });
    setIsSubmitting(false);
  }, []);

  const getFieldProps = useCallback((field: keyof T) => ({
    value: values[field],
    onChange: (value: any) => setValue(field, value),
  }), [values, setValue]);

  const setSubmitting = useCallback((submitting: boolean) => {
    setIsSubmitting(submitting);
  }, []);

  return {
    values,
    setValue,
    setValues: (newValues: T) => setValues({ type: 'SET', payload: newValues }),
    resetForm,
    getFieldProps,
    isSubmitting,
    setSubmitting,
  };
}

// Optimized selection state for multiple items
export function useOptimizedSelection<T = any>(keyExtractor: (item: T) => string = (item: any) => item?.id || item) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectItem = useCallback((id: string) => {
    setSelectedIds(prev => new Set(prev).add(id));
  }, []);

  const deselectItem = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    // This will be called with items from the parent component
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.size;
  const isAllSelected = false; // This would need to be calculated with total items
  const isIndeterminate = selectedCount > 0 && !isAllSelected;

  return {
    selectedIds,
    isAllSelected,
    isIndeterminate,
    selectedCount,
    selectedArray,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    toggleItem,
  };
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string, dependencies: any[] = []) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  
  renderCount.current += 1;
  const currentTime = Date.now();
  const timeSinceLastRender = currentTime - lastRenderTime.current;
  lastRenderTime.current = currentTime;

  // Log performance issues
  if (renderCount.current > 1 && timeSinceLastRender < 16) { // Less than 1 frame
    logger.warn(`Rapid re-render detected in ${componentName}`, {
      renderCount: renderCount.current,
      timeSinceLastRender,
      dependencies: dependencies.length,
    });
  }

  return {
    renderCount: renderCount.current,
    timeSinceLastRender,
  };
}

// Debounced state hook
export function useDebouncedState<T>(initialValue: T, delay: number = 300) {
  const [immediateValue, setImmediateValue] = useReducer((_: T, newValue: T) => newValue, initialValue);
  const [debouncedValue, setDebouncedValue] = useReducer((_: T, newValue: T) => newValue, initialValue);
  
  const timeoutRef = useRef<NodeJS.Timeout>();

  const setValue = useCallback((value: T) => {
    setImmediateValue(value);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
  }, [delay]);

  return [debouncedValue, setValue, immediateValue] as const;
}