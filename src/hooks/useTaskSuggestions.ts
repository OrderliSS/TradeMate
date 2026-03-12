import { useMemo } from 'react';
import type { TaskWithCustomer } from '@/types/database';

interface TaskSuggestion {
  id: string;
  type: 'overdue' | 'follow_up' | 'high_priority' | 'no_customer' | 'duplicate';
  title: string;
  description: string;
  actionLabel: string;
  taskId: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Smart suggestions based on task analysis
 * Provides actionable insights to improve task management
 */
export function useTaskSuggestions(tasks: TaskWithCustomer[]): TaskSuggestion[] {
  return useMemo(() => {
    const suggestions: TaskSuggestion[] = [];
    const now = new Date();

    tasks.forEach((task) => {
      // Overdue tasks
      if (task.due_date && new Date(task.due_date) < now && task.status !== 'completed') {
        suggestions.push({
          id: `overdue-${task.id}`,
          type: 'overdue',
          title: 'Overdue Task',
          description: `"${task.title}" is past its due date`,
          actionLabel: 'View Task',
          taskId: task.id,
          priority: 'high',
        });
      }

      // Follow-up reminders
      if (task.follow_up_date && new Date(task.follow_up_date) <= now && task.status !== 'completed') {
        suggestions.push({
          id: `follow-up-${task.id}`,
          type: 'follow_up',
          title: 'Follow-up Due',
          description: `Time to follow up on "${task.title}"`,
          actionLabel: 'Follow Up',
          taskId: task.id,
          priority: 'medium',
        });
      }

      // High priority pending tasks
      if (task.priority === 'high' && task.status === 'pending' && !task.due_date) {
        suggestions.push({
          id: `priority-${task.id}`,
          type: 'high_priority',
          title: 'Set Due Date',
          description: `High priority task "${task.title}" has no due date`,
          actionLabel: 'Set Date',
          taskId: task.id,
          priority: 'medium',
        });
      }

      // Tasks without customer
      if (!task.customer_id && task.status === 'pending') {
        suggestions.push({
          id: `no-customer-${task.id}`,
          type: 'no_customer',
          title: 'Missing Customer',
          description: `"${task.title}" has no customer assigned`,
          actionLabel: 'Assign Customer',
          taskId: task.id,
          priority: 'low',
        });
      }
    });

    // Sort by priority and limit to top 5
    return suggestions
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 5);
  }, [tasks]);
}
