import { useMemo } from 'react';
import type { TaskWithCustomer } from '@/types/database';

interface TaskAnalytics {
  completionRate: number;
  averageCompletionTime: number;
  overdueCount: number;
  upcomingCount: number;
  highPriorityPending: number;
  tasksPerCustomer: Record<string, number>;
  topCustomers: Array<{ name: string; count: number }>;
  tasksByType: Record<string, number>;
  productivityTrend: 'improving' | 'stable' | 'declining';
}

/**
 * Analytics and insights for task management
 * Provides data-driven insights for productivity improvement
 */
export function useTaskAnalytics(tasks: TaskWithCustomer[]): TaskAnalytics {
  return useMemo(() => {
    const now = new Date();
    const completed = tasks.filter(t => t.status === 'completed');
    const pending = tasks.filter(t => t.status === 'pending');
    
    // Completion rate
    const completionRate = tasks.length > 0
      ? (completed.length / tasks.length) * 100
      : 0;

    // Average completion time (in days)
    const completionTimes = completed
      .filter(t => t.created_at && t.updated_at)
      .map(t => {
        const created = new Date(t.created_at);
        const updated = new Date(t.updated_at);
        return (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      });
    
    const averageCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

    // Overdue and upcoming
    const overdueCount = pending.filter(t => 
      t.due_date && new Date(t.due_date) < now
    ).length;

    const upcomingCount = pending.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      const threeDaysFromNow = new Date(now);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      return dueDate >= now && dueDate <= threeDaysFromNow;
    }).length;

    // High priority pending
    const highPriorityPending = pending.filter(t => 
      t.priority === 'high' || t.priority === 'urgent'
    ).length;

    // Tasks per customer
    const tasksPerCustomer: Record<string, number> = {};
    tasks.forEach(t => {
      if (t.customer?.name) {
        tasksPerCustomer[t.customer.name] = (tasksPerCustomer[t.customer.name] || 0) + 1;
      }
    });

    // Top customers
    const topCustomers = Object.entries(tasksPerCustomer)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Tasks by type
    const tasksByType: Record<string, number> = {};
    tasks.forEach(t => {
      const type = t.task_type || 'general';
      tasksByType[type] = (tasksByType[type] || 0) + 1;
    });

    // Productivity trend (simple heuristic)
    let productivityTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (completionRate > 75 && overdueCount === 0) {
      productivityTrend = 'improving';
    } else if (completionRate < 50 || overdueCount > 5) {
      productivityTrend = 'declining';
    }

    return {
      completionRate,
      averageCompletionTime,
      overdueCount,
      upcomingCount,
      highPriorityPending,
      tasksPerCustomer,
      topCustomers,
      tasksByType,
      productivityTrend,
    };
  }, [tasks]);
}
