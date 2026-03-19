import { useState, useEffect, useRef, useCallback } from 'react';
import { LucideIcon, ShoppingCart, Package, Truck, FilePlus2, UserPlus } from 'lucide-react';
import { getCurrentEnvironment } from '@/lib/environment-utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DASHBOARD_DEFAULTS } from '@/lib/dashboard-defaults';

export interface QuickAction {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  action: {
    type: 'navigate' | 'dialog';
    target: string;
  };
  color?: string;
}

// Migration map for old action IDs to new ones
const ACTION_ID_MIGRATION: Record<string, string> = {
  'customer': 'create_customer',
  'order': 'create_order',
  'stock': 'create_stock',
  'product': 'create_product',
  'case': 'create_case',
  'task': 'create_task',
  'call': 'create_call',
  'vendor': 'create_vendor',
};

const AVAILABLE_ACTIONS: QuickAction[] = [
  // Create Actions (dialog type)
  {
    id: 'create_customer',
    title: 'Add Contact',
    description: 'Create new contact',
    icon: UserPlus,
    action: { type: 'dialog', target: 'customer' },
    color: 'hover:bg-blue-50 dark:hover:bg-blue-950/20'
  },
  {
    id: 'create_order',
    title: 'New Sales Order',
    description: 'Create new sales order',
    icon: ShoppingCart,
    action: { type: 'dialog', target: 'order' },
    color: 'hover:bg-green-50 dark:hover:bg-green-950/20'
  },
  {
    id: 'create_stock',
    title: 'New Stock Order',
    description: 'Create new stock order',
    icon: Truck,
    action: { type: 'dialog', target: 'stock_order' },
    color: 'hover:bg-amber-50 dark:hover:bg-amber-950/20'
  },
  {
    id: 'create_product',
    title: 'Add Product',
    description: 'Create new product',
    icon: Package,
    action: { type: 'dialog', target: 'product' },
    color: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/20'
  },
  {
    id: 'create_case',
    title: '+ Add Case',
    description: 'Create new case',
    icon: FilePlus2,
    action: { type: 'dialog', target: 'case' },
    color: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/20'
  },
];

// Use centralized defaults for consistency
const DEFAULT_ACTIONS = [...DASHBOARD_DEFAULTS.actions];

const PREFERENCE_KEY = 'dashboard_quick_actions';

export const useDashboardQuickActions = () => {
  const { user } = useAuth();
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>(DEFAULT_ACTIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedFromSupabase, setHasLoadedFromSupabase] = useState(false);

  // Ref to prevent circular event handling
  const isDispatchingRef = useRef(false);
  const isSavingRef = useRef(false);
  
  // Ref to track latest selectedActionIds for event handlers (avoids stale closure)
  const selectedActionIdsRef = useRef(selectedActionIds);
  
  // Keep ref in sync
  useEffect(() => {
    selectedActionIdsRef.current = selectedActionIds;
  }, [selectedActionIds]);

  // Get storage key for current environment (standardized format)
  const getStorageKey = useCallback(() => {
    const env = getCurrentEnvironment();
    return `ui:dashboard:quick-actions:${env}`;
  }, []);

  // Load preferences from localStorage as initial/fallback
  const loadFromLocalStorage = useCallback(() => {
    const storageKey = getStorageKey();
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Handle both wrapped { value, timestamp } and unwrapped array formats
        const actionIds = parsed?.value ?? parsed;
        if (Array.isArray(actionIds) && actionIds.length > 0) {
          // Migrate old IDs and filter out invalid ones
          const validIds = actionIds
            .map((id: string) => ACTION_ID_MIGRATION[id] || id)
            .filter((id: string) => AVAILABLE_ACTIONS.some(action => action.id === id));
          if (validIds.length > 0) {
            return validIds;
          }
        }
      } catch (e) {
        console.error('Failed to parse saved quick actions:', e);
      }
    }
    return DEFAULT_ACTIONS;
  }, [getStorageKey]);

  // Load preferences from Supabase
  const loadFromSupabase = useCallback(async () => {
    if (!user?.id) return null;
    
    const env = getCurrentEnvironment();
    const prefKey = `${PREFERENCE_KEY}_${env}`;
    
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', user.id)
        .eq('preference_key', prefKey)
        .maybeSingle();
      
      if (error) {
        console.error('Failed to load preferences from Supabase:', error);
        return null;
      }
      
      if (data?.preference_value) {
        const parsed = data.preference_value as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validIds = parsed.filter((id: string) => 
            AVAILABLE_ACTIONS.some(action => action.id === id)
          );
          if (validIds.length > 0) {
            return validIds;
          }
        }
      }
      
      return null;
    } catch (e) {
      console.error('Failed to load preferences from Supabase:', e);
      return null;
    }
  }, [user?.id]);

  // Save preferences to Supabase
  const saveToSupabase = useCallback(async (actionIds: string[]) => {
    if (!user?.id || isSavingRef.current) return;

    // Skip writes during Ghost Mode to prevent 409 conflicts
    const isGhost = localStorage.getItem('trademate_ghost_active') === 'true';
    if (isGhost) return;
    
    isSavingRef.current = true;
    const env = getCurrentEnvironment();
    const prefKey = `${PREFERENCE_KEY}_${env}`;
    
    try {
      const { error: dbError } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          preference_key: prefKey,
          preference_value: actionIds,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,preference_key'
        });
      
      if (dbError) {
        // Handle 409/unique violation by falling back to update
        if (dbError.code === '23505' || dbError.message?.includes('409')) {
          await supabase
            .from('user_preferences')
            .update({ preference_value: actionIds, updated_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('preference_key', prefKey);
        } else {
          console.error('Failed to save preferences to Supabase:', dbError);
        }
      }
    } catch (e) {
      console.error('Failed to save preferences to Supabase:', e);
    } finally {
      isSavingRef.current = false;
    }
  }, [user?.id]);

  // Initialize: Load from localStorage first, then Supabase
  useEffect(() => {
    const initialize = async () => {
      // First, load from localStorage for immediate display
      const localActions = loadFromLocalStorage();
      setSelectedActionIds(localActions);
      
      // Then try to load from Supabase if user is authenticated
      if (user?.id) {
        const supabaseActions = await loadFromSupabase();
        if (supabaseActions) {
          setSelectedActionIds(supabaseActions);
          // Update localStorage with Supabase values
          localStorage.setItem(getStorageKey(), JSON.stringify(supabaseActions));
        } else {
          // No Supabase data yet - save current localStorage values to Supabase
          await saveToSupabase(localActions);
        }
        setHasLoadedFromSupabase(true);
      }
      
      setIsLoading(false);
    };
    
    initialize();
  }, [user?.id, loadFromLocalStorage, loadFromSupabase, saveToSupabase, getStorageKey]);
  
  // Sync with localStorage when storage changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      const storageKey = getStorageKey();
      if (e.key === storageKey && e.newValue) {
        try {
          const parsedIds = JSON.parse(e.newValue);
          if (JSON.stringify(parsedIds) !== JSON.stringify(selectedActionIdsRef.current)) {
            setSelectedActionIds(parsedIds);
          }
        } catch (err) {
          console.error('Failed to parse storage change:', err);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [getStorageKey]);

  // Save to localStorage and Supabase when actions change
  useEffect(() => {
    // Don't save during initial load
    if (isLoading) return;
    
    const storageKey = getStorageKey();
    const toStore = { value: selectedActionIds, timestamp: Date.now() };
    localStorage.setItem(storageKey, JSON.stringify(toStore));
    
    // Save to Supabase if user is authenticated and we've loaded from Supabase
    if (user?.id && hasLoadedFromSupabase) {
      saveToSupabase(selectedActionIds);
    }
    
    // Dispatch custom event to notify other hook instances in same tab
    isDispatchingRef.current = true;
    window.dispatchEvent(new CustomEvent('dashboardQuickActionsChanged', { 
      detail: { actions: selectedActionIds, env: getCurrentEnvironment() } 
    }));
    requestAnimationFrame(() => {
      isDispatchingRef.current = false;
    });
  }, [selectedActionIds, isLoading, user?.id, hasLoadedFromSupabase, saveToSupabase, getStorageKey]);

  // Listen for changes from other instances in the same tab
  useEffect(() => {
    const handleActionsChange = (e: Event) => {
      if (isDispatchingRef.current) return;
      
      const customEvent = e as CustomEvent<{ actions: string[], env: string }>;
      const { actions: newActions, env: eventEnv } = customEvent.detail;
      const currentEnv = getCurrentEnvironment();
      
      // Use ref to avoid stale closure comparison
      if (eventEnv === currentEnv && JSON.stringify(newActions) !== JSON.stringify(selectedActionIdsRef.current)) {
        setSelectedActionIds(newActions);
      }
    };
    
    window.addEventListener('dashboardQuickActionsChanged', handleActionsChange);
    return () => window.removeEventListener('dashboardQuickActionsChanged', handleActionsChange);
  }, []);

  const selectedActions = selectedActionIds
    .map(id => AVAILABLE_ACTIONS.find(action => action.id === id))
    .filter(Boolean) as QuickAction[];

  const availableActions = AVAILABLE_ACTIONS.filter(
    action => !selectedActionIds.includes(action.id)
  );

  const addQuickAction = (actionId: string) => {
    if (!selectedActionIds.includes(actionId)) {
      setSelectedActionIds(prev => [...prev, actionId]);
    }
  };

  const removeQuickAction = (actionId: string) => {
    setSelectedActionIds(prev => prev.filter(id => id !== actionId));
  };

  const reorderQuickActions = (newOrder: string[]) => {
    setSelectedActionIds(newOrder);
  };

  const resetToDefault = () => {
    setSelectedActionIds(DEFAULT_ACTIONS);
  };

  return {
    selectedActions,
    availableActions,
    addQuickAction,
    removeQuickAction,
    reorderQuickActions,
    resetToDefault,
    allActions: AVAILABLE_ACTIONS,
    isLoading
  };
};
