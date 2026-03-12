import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { enhancedToast } from '@/components/ui/enhanced-toast';

/**
 * Activity feed item structure
 */
export interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: any;
  created_at: string;
  user_id?: string;
}

const DISMISSED_IDS_KEY = 'activity-dismissed-ids';

/**
 * Get dismissed activity IDs from localStorage
 */
export function getDismissedActivityIds(): string[] {
  try {
    const stored = localStorage.getItem(DISMISSED_IDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Dismiss a single activity by ID
 */
export function dismissActivity(activityId: string): void {
  const dismissed = getDismissedActivityIds();
  if (!dismissed.includes(activityId)) {
    dismissed.push(activityId);
    localStorage.setItem(DISMISSED_IDS_KEY, JSON.stringify(dismissed));
    window.dispatchEvent(new CustomEvent('activity-dismissed'));
  }
}

/**
 * Dismiss all currently loaded activities
 */
export function dismissAllActivities(activityIds: string[]): void {
  const dismissed = getDismissedActivityIds();
  const updated = [...new Set([...dismissed, ...activityIds])];
  localStorage.setItem(DISMISSED_IDS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('activity-dismissed'));
}

/**
 * Clear all dismissed activity IDs (for admin reset)
 */
export function clearDismissedActivities(): void {
  localStorage.removeItem(DISMISSED_IDS_KEY);
  window.dispatchEvent(new CustomEvent('activity-dismissed'));
}

/**
 * Hook for real-time activity feed
 * 
 * Subscribes to activity log changes and maintains a live feed of recent actions.
 * Automatically loads initial data and updates when new activities occur.
 * 
 * @param limit - Maximum number of activities to display (default: 20)
 * @param maxAgeHours - Only show activities newer than this many hours (default: 48)
 * @returns Activity feed state with loading indicator and refresh function
 * @example
 * ```tsx
 * const { activities, isLoading, refresh } = useRealtimeActivityFeed(20, 48);
 * ```
 */
export function useRealtimeActivityFeed(limit: number = 20, maxAgeHours: number = 48) {
  const [allActivities, setAllActivities] = useState<ActivityItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(getDismissedActivityIds);
  const [isLoading, setIsLoading] = useState(true);

  // Listen for dismissal changes
  useEffect(() => {
    const handleDismissal = () => {
      setDismissedIds(getDismissedActivityIds());
    };
    window.addEventListener('activity-dismissed', handleDismissal);
    return () => window.removeEventListener('activity-dismissed', handleDismissal);
  }, []);

  // Filter out dismissed activities
  const activities = useMemo(() => {
    return allActivities.filter(a => !dismissedIds.includes(a.id));
  }, [allActivities, dismissedIds]);

  useEffect(() => {
    // Load initial activities
    loadActivities();

    // Subscribe to new activities
    const channel = supabase
      .channel('activity-feed-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
        },
        (payload) => {
          console.log('New activity detected:', payload);
          
          // Add new activity to the beginning of the list
          setAllActivities((prev) => {
            const newActivity = payload.new as ActivityItem;
            const updated = [newActivity, ...prev];
            // Keep only the latest items
            return updated.slice(0, limit * 2); // Keep more for filtering
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, maxAgeHours]);

  async function loadActivities() {
    try {
      setIsLoading(true);
      
      // Calculate the cutoff time based on maxAgeHours
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);
      
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit * 2); // Fetch more to account for dismissed items

      if (error) throw error;

      setAllActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
      enhancedToast.error('Failed to load activity feed');
    } finally {
      setIsLoading(false);
    }
  }

  return {
    activities: activities.slice(0, limit),
    allActivityIds: activities.map(a => a.id),
    isLoading,
    refresh: loadActivities,
    dismissedCount: dismissedIds.length,
  };
}

