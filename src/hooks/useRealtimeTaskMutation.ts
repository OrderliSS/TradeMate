/**
 * Realtime Task Mutation Hooks
 * 
 * Enhanced task mutations with correlation tracking for proper
 * echo deduplication in the realtime system.
 */

import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/database';
import { toast } from '@/hooks/use-toast';
import { useRealtimeMutation } from './useRealtimeMutation';
import { useDataEnvironment } from './useSandbox';

export const useRealtimeCreateTask = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();

  return useRealtimeMutation({
    mutationFn: async (
      task: Omit<Task, 'id' | 'created_at' | 'updated_at'>,
      correlationId: string
    ) => {
      console.log('[RealtimeTask] Creating task with correlation:', correlationId);
      
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ ...task, data_environment: dataEnvironment }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    entityType: 'task',
    getEntityId: () => 'new',
    onSuccess: () => {
      // Minimal invalidation - realtime will handle most updates
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      toast({
        title: 'Success',
        description: 'Task created successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create task',
        variant: 'destructive',
      });
    },
  });
};

export const useRealtimeUpdateTask = () => {
  const queryClient = useQueryClient();

  return useRealtimeMutation({
    mutationFn: async (
      { id, ...task }: Partial<Task> & { id: string },
      correlationId: string
    ) => {
      console.log('[RealtimeTask] Updating task with correlation:', correlationId);
      
      const { data, error } = await supabase
        .from('tasks')
        .update(task)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    entityType: 'task',
    getEntityId: (variables) => variables.id,
    onSuccess: (data) => {
      // Update specific task cache immediately for responsive UI
      queryClient.setQueryData(['task', data.id], data);
      toast({
        title: 'Success',
        description: 'Task updated successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive',
      });
    },
  });
};

export const useRealtimeCompleteTask = () => {
  const queryClient = useQueryClient();

  return useRealtimeMutation({
    mutationFn: async (
      { id, completedAt }: { id: string; completedAt?: string },
      correlationId: string
    ) => {
      console.log('[RealtimeTask] Completing task with correlation:', correlationId);
      
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: completedAt || new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    entityType: 'task',
    getEntityId: (variables) => variables.id,
    onSuccess: (data) => {
      queryClient.setQueryData(['task', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      toast({
        title: 'Task Completed',
        description: 'Task marked as complete',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive',
      });
    },
  });
};
