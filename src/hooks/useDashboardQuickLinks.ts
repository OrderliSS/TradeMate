import { useState, useEffect, useRef, useCallback } from 'react';
import { LucideIcon, Users, ShoppingCart, Package, CheckSquare, FileText, Briefcase, BarChart3, BookOpen, LayoutDashboard, Quote } from 'lucide-react';
import { getCurrentEnvironment } from '@/lib/environment-utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DASHBOARD_DEFAULTS } from '@/lib/dashboard-defaults';

export interface QuickLink {
  id: string;
  title: string;
  icon: LucideIcon;
  route: string;
}

const AVAILABLE_LINKS: QuickLink[] = [
  { id: 'link_dashboard', title: 'Dashboard', icon: LayoutDashboard, route: '/' },
  { id: 'link_contacts', title: 'Contacts', icon: Users, route: '/customers' },
  { id: 'link_sales', title: 'Sales Orders', icon: ShoppingCart, route: '/sales-orders' },
  { id: 'link_inventory', title: 'Stock Management', icon: Package, route: '/stock-management' },
  { id: 'link_tasks', title: 'Tasks', icon: CheckSquare, route: '/tasks' },
  { id: 'link_documents', title: 'Documents', icon: FileText, route: '/documents' },
  { id: 'link_quotes', title: 'Quotes', icon: Quote, route: '/quotes' },
  { id: 'link_workspace', title: 'Workspace Ops', icon: Briefcase, route: '/workspace-operations' },
  { id: 'link_insights', title: 'Insights', icon: BarChart3, route: '/insights' },
  { id: 'link_knowledge', title: 'Knowledge', icon: BookOpen, route: '/knowledge' },
];

const DEFAULT_LINKS = [...DASHBOARD_DEFAULTS.quickLinks];
const PREFERENCE_KEY = 'dashboard_quick_links';

export const useDashboardQuickLinks = () => {
  const { user } = useAuth();
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>(DEFAULT_LINKS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedFromSupabase, setHasLoadedFromSupabase] = useState(false);

  const isDispatchingRef = useRef(false);
  const isSavingRef = useRef(false);
  const selectedLinkIdsRef = useRef(selectedLinkIds);

  useEffect(() => {
    selectedLinkIdsRef.current = selectedLinkIds;
  }, [selectedLinkIds]);

  const getStorageKey = useCallback(() => {
    const env = getCurrentEnvironment();
    return `ui:dashboard:quick-links:${env}`;
  }, []);

  const loadFromLocalStorage = useCallback(() => {
    const saved = localStorage.getItem(getStorageKey());
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const linkIds = parsed?.value ?? parsed;
        if (Array.isArray(linkIds) && linkIds.length > 0) {
          const validIds = linkIds.filter((id: string) => AVAILABLE_LINKS.some(l => l.id === id));
          if (validIds.length > 0) return validIds;
        }
      } catch (e) {
        console.error('Failed to parse saved quick links:', e);
      }
    }
    return DEFAULT_LINKS;
  }, [getStorageKey]);

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
      if (error) return null;
      if (data?.preference_value) {
        const parsed = data.preference_value as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validIds = parsed.filter((id: string) => AVAILABLE_LINKS.some(l => l.id === id));
          if (validIds.length > 0) return validIds;
        }
      }
      return null;
    } catch { return null; }
  }, [user?.id]);

  const saveToSupabase = useCallback(async (linkIds: string[]) => {
    if (!user?.id || isSavingRef.current) return;

    // Skip writes during Ghost Mode to prevent 409 conflicts
    const isGhost = localStorage.getItem('orderli_ghost_active') === 'true';
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
          preference_value: linkIds,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,preference_key' });

      // Handle 409/unique violation by falling back to update
      if (dbError && (dbError.code === '23505' || dbError.message?.includes('409'))) {
        await supabase
          .from('user_preferences')
          .update({ preference_value: linkIds, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('preference_key', prefKey);
      }
    } catch { }
    finally { isSavingRef.current = false; }
  }, [user?.id]);

  useEffect(() => {
    const initialize = async () => {
      const localLinks = loadFromLocalStorage();
      setSelectedLinkIds(localLinks);
      if (user?.id) {
        const supabaseLinks = await loadFromSupabase();
        if (supabaseLinks) {
          setSelectedLinkIds(supabaseLinks);
          localStorage.setItem(getStorageKey(), JSON.stringify(supabaseLinks));
        } else {
          await saveToSupabase(localLinks);
        }
        setHasLoadedFromSupabase(true);
      }
      setIsLoading(false);
    };
    initialize();
  }, [user?.id, loadFromLocalStorage, loadFromSupabase, saveToSupabase, getStorageKey]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === getStorageKey() && e.newValue) {
        try {
          const parsedIds = JSON.parse(e.newValue);
          const ids = parsedIds?.value ?? parsedIds;
          if (JSON.stringify(ids) !== JSON.stringify(selectedLinkIdsRef.current)) {
            setSelectedLinkIds(ids);
          }
        } catch { }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [getStorageKey]);

  useEffect(() => {
    if (isLoading) return;
    const toStore = { value: selectedLinkIds, timestamp: Date.now() };
    localStorage.setItem(getStorageKey(), JSON.stringify(toStore));
    if (user?.id && hasLoadedFromSupabase) {
      saveToSupabase(selectedLinkIds);
    }
    isDispatchingRef.current = true;
    window.dispatchEvent(new CustomEvent('dashboardQuickLinksChanged', {
      detail: { links: selectedLinkIds, env: getCurrentEnvironment() }
    }));
    requestAnimationFrame(() => { isDispatchingRef.current = false; });
  }, [selectedLinkIds, isLoading, user?.id, hasLoadedFromSupabase, saveToSupabase, getStorageKey]);

  useEffect(() => {
    const handleLinksChange = (e: Event) => {
      if (isDispatchingRef.current) return;
      const customEvent = e as CustomEvent<{ links: string[], env: string }>;
      const { links: newLinks, env: eventEnv } = customEvent.detail;
      if (eventEnv === getCurrentEnvironment() && JSON.stringify(newLinks) !== JSON.stringify(selectedLinkIdsRef.current)) {
        setSelectedLinkIds(newLinks);
      }
    };
    window.addEventListener('dashboardQuickLinksChanged', handleLinksChange);
    return () => window.removeEventListener('dashboardQuickLinksChanged', handleLinksChange);
  }, []);

  const selectedLinks = selectedLinkIds
    .map(id => AVAILABLE_LINKS.find(l => l.id === id))
    .filter(Boolean) as QuickLink[];

  const availableLinks = AVAILABLE_LINKS.filter(l => !selectedLinkIds.includes(l.id));

  const addQuickLink = (linkId: string) => {
    if (!selectedLinkIds.includes(linkId)) {
      setSelectedLinkIds(prev => [...prev, linkId]);
    }
  };

  const removeQuickLink = (linkId: string) => {
    setSelectedLinkIds(prev => prev.filter(id => id !== linkId));
  };

  const reorderQuickLinks = (newOrder: string[]) => {
    setSelectedLinkIds(newOrder);
  };

  const resetToDefault = () => {
    setSelectedLinkIds(DEFAULT_LINKS);
  };

  return {
    selectedLinks,
    availableLinks,
    addQuickLink,
    removeQuickLink,
    reorderQuickLinks,
    resetToDefault,
    allLinks: AVAILABLE_LINKS,
    isLoading
  };
};
