import { useUpdateTask, useDeleteTask } from './useTasks';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { chunk } from '@/lib/task-data-utils';
import { useQueryClient } from '@tanstack/react-query';
import { useDataEnvironment } from '@/hooks/useSandbox';

const BATCH_SIZE = 50;

/**
 * Process items in batches with progress tracking
 */
async function processBatches<T>(
  items: T[],
  operation: (batch: T[]) => Promise<void>,
  onProgress?: (percent: number) => void
): Promise<void> {
  const batches = chunk(items, BATCH_SIZE);
  
  for (let i = 0; i < batches.length; i++) {
    await operation(batches[i]);
    if (onProgress) {
      const percent = Math.round(((i + 1) / batches.length) * 100);
      onProgress(percent);
    }
  }
}

export const useBulkTaskOperations = () => {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();

  const updateStatus = async (
    taskIds: string[], 
    status: 'pending' | 'completed' | 'archived' | 'on_hold' | 'in_progress' | 'waiting_response',
    onProgress?: (percent: number) => void
  ) => {
    try {
      await processBatches(
        taskIds,
        async (batch) => {
          const updates = batch.map((id) =>
            updateTask.mutateAsync({ id, status })
          );
          await Promise.all(updates);
        },
        onProgress
      );
      toast.success(`${taskIds.length} task(s) updated to ${status}`);
    } catch (error) {
      console.error('Bulk status update failed:', error);
      toast.error('Failed to update some tasks');
      throw error;
    }
  };

  const updateDueDate = async (taskIds: string[], date: Date) => {
    const updates = taskIds.map((id) =>
      updateTask.mutateAsync({ id, due_date: date.toISOString() })
    );
    
    try {
      await Promise.all(updates);
      toast.success(`Due date set for ${taskIds.length} task(s)`);
    } catch (error) {
      console.error('Bulk due date update failed:', error);
      toast.error('Failed to update due dates');
      throw error;
    }
  };

  const updateFollowUp = async (taskIds: string[], date: Date) => {
    const updates = taskIds.map((id) =>
      updateTask.mutateAsync({ id, follow_up_date: date.toISOString() })
    );
    
    try {
      await Promise.all(updates);
      toast.success(`Follow-up date set for ${taskIds.length} task(s)`);
    } catch (error) {
      console.error('Bulk follow-up update failed:', error);
      toast.error('Failed to update follow-up dates');
      throw error;
    }
  };

  const archiveTasks = async (taskIds: string[]) => {
    const updates = taskIds.map((id) =>
      updateTask.mutateAsync({ id, status: 'archived' })
    );
    
    try {
      await Promise.all(updates);
      toast.success(`${taskIds.length} task(s) archived`);
    } catch (error) {
      console.error('Bulk archive failed:', error);
      toast.error('Failed to archive some tasks');
      throw error;
    }
  };

  const deleteTasks = async (taskIds: string[], onProgress?: (percent: number) => void) => {
    try {
      await processBatches(
        taskIds,
        async (batch) => {
          const deletes = batch.map((id) => deleteTask.mutateAsync(id));
          await Promise.all(deletes);
        },
        onProgress
      );
      toast.success(`${taskIds.length} task(s) deleted`);
    } catch (error) {
      console.error('Bulk delete failed:', error);
      toast.error('Failed to delete some tasks');
      throw error;
    }
  };

  const assignCustomer = async (taskIds: string[], customerId: string) => {
    const updates = taskIds.map((id) =>
      updateTask.mutateAsync({ id, customer_id: customerId })
    );
    
    try {
      await Promise.all(updates);
      toast.success(`Customer assigned to ${taskIds.length} task(s)`);
    } catch (error) {
      console.error('Bulk customer assignment failed:', error);
      toast.error('Failed to assign customer');
      throw error;
    }
  };

  const archiveTasksWithUndo = async (taskIds: string[]) => {
    // Fetch current statuses before archiving
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, status')
      .in('id', taskIds);

    if (!tasks) throw new Error('Failed to fetch task data');

    // Archive all tasks
    const updates = taskIds.map((id) =>
      updateTask.mutateAsync({ id, status: 'archived' })
    );
    await Promise.all(updates);

    // Return restore function
    return async () => {
      const restores = tasks.map((task) =>
        updateTask.mutateAsync({ id: task.id, status: task.status })
      );
      await Promise.all(restores);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    };
  };

  const deleteTasksWithUndo = async (taskIds: string[], onProgress?: (percent: number) => void) => {
    // Fetch full task data before deletion
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .in('id', taskIds);

    if (!tasks) throw new Error('Failed to fetch task data');

    // Delete all tasks
    await processBatches(
      taskIds,
      async (batch) => {
        const deletes = batch.map((id) => deleteTask.mutateAsync(id));
        await Promise.all(deletes);
      },
      onProgress
    );

    // Return restore function
    return async () => {
      const tasksWithEnv = tasks.map(t => ({ ...t, data_environment: dataEnvironment }));
      const { error } = await supabase.from('tasks').insert(tasksWithEnv);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    };
  };

  return {
    updateStatus,
    updateDueDate,
    updateFollowUp,
    archiveTasks,
    deleteTasks,
    assignCustomer,
    archiveTasksWithUndo,
    deleteTasksWithUndo,
  };
};
