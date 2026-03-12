import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export function useActivityLog() {
  const { user } = useAuth();

  const logActivity = useCallback(
    async (
      action: string,
      entityType: string,
      entityId?: string,
      metadata?: Record<string, any>
    ) => {
      if (!user) {
        console.warn('Cannot log activity: user not authenticated');
        return;
      }

      try {
        const { error } = await supabase.from('activity_logs' as any).insert({
          user_id: user.id,
          action,
          entity_type: entityType,
          entity_id: entityId,
          metadata,
        } as any);

        if (error) {
          console.error('Failed to log activity:', error);
        }
      } catch (error) {
        console.error('Error logging activity:', error);
      }
    },
    [user]
  );

  const getActivityLogs = useCallback(
    async (filters?: {
      entityType?: string;
      entityId?: string;
      limit?: number;
    }) => {
      try {
        let query = supabase
          .from('activity_logs' as any)
          .select('*')
          .order('created_at', { ascending: false });

        if (filters?.entityType) {
          query = query.eq('entity_type', filters.entityType);
        }

        if (filters?.entityId) {
          query = query.eq('entity_id', filters.entityId);
        }

        if (filters?.limit) {
          query = query.limit(filters.limit);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        return (data || []) as unknown as ActivityLog[];
      } catch (error) {
        console.error('Error fetching activity logs:', error);
        toast.error('Failed to load activity logs');
        return [];
      }
    },
    []
  );

  return {
    logActivity,
    getActivityLogs,
  };
}
