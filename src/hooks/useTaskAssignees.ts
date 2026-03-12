import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productionClient } from '@/lib/production-client';
import { useEnvironment } from '@/hooks/useEnvironment';
import { TaskAssignee, TaskAssigneeRole } from '@/types/database';
import { enhancedToast } from '@/components/ui/enhanced-toast';

/**
 * Hook to fetch assignees for a specific task
 */
export const useTaskAssignees = (taskId?: string) => {
  const environment = useEnvironment();

  return useQuery({
    queryKey: ['task-assignees', taskId, environment],
    queryFn: async () => {
      if (!taskId) return [];

      const { data, error } = await productionClient
        .from('task_assignees')
        .select(`
          *,
          user:profiles!task_assignees_user_id_fkey(
            id,
            email,
            full_name,
            employee_id
          )
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TaskAssignee[];
    },
    enabled: !!taskId,
  });
};

/**
 * Hook to add an assignee to a task
 */
export const useAddTaskAssignee = () => {
  const queryClient = useQueryClient();
  const environment = useEnvironment();

  return useMutation({
    mutationFn: async ({ 
      task_id, 
      user_id, 
      role = 'case_manager',
      notes 
    }: { 
      task_id: string; 
      user_id: string; 
      role?: TaskAssigneeRole;
      notes?: string;
    }) => {
      const { data, error } = await productionClient
        .from('task_assignees')
        .insert({
          task_id,
          user_id,
          role,
          notes,
        })
        .select(`
          *,
          user:profiles!task_assignees_user_id_fkey(
            id,
            email,
            full_name,
            employee_id
          )
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-assignees', variables.task_id, environment] });
      queryClient.invalidateQueries({ queryKey: ['task', variables.task_id, environment] });
      enhancedToast.success('Assignee Added', 'Team member assigned successfully');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        enhancedToast.error('Already Assigned', 'This person is already assigned to this task with this role');
      } else {
        enhancedToast.error('Error', 'Failed to add assignee');
      }
    },
  });
};

/**
 * Hook to remove an assignee from a task
 */
export const useRemoveTaskAssignee = () => {
  const queryClient = useQueryClient();
  const environment = useEnvironment();

  return useMutation({
    mutationFn: async ({ 
      assignee_id,
      task_id 
    }: { 
      assignee_id: string;
      task_id: string;
    }) => {
      const { error } = await productionClient
        .from('task_assignees')
        .delete()
        .eq('id', assignee_id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-assignees', variables.task_id, environment] });
      queryClient.invalidateQueries({ queryKey: ['task', variables.task_id, environment] });
      enhancedToast.success('Assignee Removed', 'Team member unassigned successfully');
    },
    onError: () => {
      enhancedToast.error('Error', 'Failed to remove assignee');
    },
  });
};

/**
 * Hook to update an assignee's role
 */
export const useUpdateTaskAssigneeRole = () => {
  const queryClient = useQueryClient();
  const environment = useEnvironment();

  return useMutation({
    mutationFn: async ({ 
      assignee_id,
      task_id,
      role 
    }: { 
      assignee_id: string;
      task_id: string;
      role: TaskAssigneeRole;
    }) => {
      const { data, error } = await productionClient
        .from('task_assignees')
        .update({ role })
        .eq('id', assignee_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-assignees', variables.task_id, environment] });
      enhancedToast.success('Role Updated', 'Assignee role updated successfully');
    },
    onError: () => {
      enhancedToast.error('Error', 'Failed to update assignee role');
    },
  });
};
