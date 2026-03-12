import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { subDays, differenceInDays } from 'date-fns';

export interface JeopardyRecord {
  id: string;
  task_number: string | null;
  title: string;
  task_type: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  customer?: { name: string } | null;
  daysSinceActivity: number;
  jeopardyReason: 'stale' | 'no_due_date' | 'overdue';
}

export function useJeopardyRecords(limit = 10) {
  const { currentOrganization } = useOrganization();

  return useQuery({
    queryKey: ['jeopardy-records', currentOrganization?.id, limit],
    queryFn: async (): Promise<JeopardyRecord[]> => {
      if (!currentOrganization?.id) return [];

      const sevenDaysAgo = subDays(new Date(), 7);
      const now = new Date();

      // Fetch stale tasks - pending/on_hold that haven't been updated in 7+ days
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          task_number,
          title,
          task_type,
          status,
          priority,
          due_date,
          created_at,
          updated_at,
          customer:customers!tasks_customer_id_fkey(name)
        `)
        .eq('organization_id', currentOrganization.id)
        .in('status', ['pending', 'on_hold', 'in_progress'])
        .lt('updated_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('[useJeopardyRecords] Error fetching records:', error);
        throw error;
      }

      // Process and categorize records
      const jeopardyRecords: JeopardyRecord[] = (tasks || []).map((task) => {
        const updatedAt = new Date(task.updated_at);
        const daysSinceActivity = differenceInDays(now, updatedAt);
        
        // Determine jeopardy reason
        let jeopardyReason: JeopardyRecord['jeopardyReason'] = 'stale';
        
        if (task.due_date) {
          const dueDate = new Date(task.due_date);
          if (dueDate < now) {
            jeopardyReason = 'overdue';
          }
        } else if (!task.due_date && ['pending', 'in_progress'].includes(task.status)) {
          jeopardyReason = 'no_due_date';
        }

        return {
          id: task.id,
          task_number: task.task_number,
          title: task.title,
          task_type: task.task_type,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date,
          created_at: task.created_at,
          updated_at: task.updated_at,
          customer: task.customer,
          daysSinceActivity,
          jeopardyReason,
        };
      });

      // Sort by days since activity (oldest first)
      return jeopardyRecords.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
    },
    enabled: !!currentOrganization?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Helper to get urgency level based on days
export function getUrgencyLevel(days: number): 'warning' | 'high' | 'critical' {
  if (days >= 14) return 'critical';
  if (days >= 10) return 'high';
  return 'warning';
}

// Helper to get urgency color classes
export function getUrgencyColorClasses(days: number) {
  const level = getUrgencyLevel(days);
  
  switch (level) {
    case 'critical':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-600 dark:text-red-400',
        border: 'border-red-500/30',
        dot: 'bg-red-500',
      };
    case 'high':
      return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-600 dark:text-orange-400',
        border: 'border-orange-500/30',
        dot: 'bg-orange-500',
      };
    default:
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-500/30',
        dot: 'bg-amber-500',
      };
  }
}
