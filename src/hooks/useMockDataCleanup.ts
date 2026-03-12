/**
 * Mock Data Cleanup Hook
 * 
 * Provides functionality to detect, review, and safely delete mock data
 * from the production database with conservative safety checks.
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDataEnvironment } from '@/hooks/useSandbox';
import {
  MockDataCandidate,
  detectMockData,
  detectBatchCreation,
  calculateDeletionSafety,
  DEFAULT_DETECTION_RULES,
  DetectionRule
} from '@/lib/mock-data-detection';

export interface CleanupStats {
  totalCustomers: number;
  totalTasks: number;
  totalPurchases: number;
  flaggedCustomers: number;
  flaggedTasks: number;
  flaggedPurchases: number;
  safeToDelete: number;
  hasLinkedRecords: number;
}

export function useMockDataCleanup() {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rules, setRules] = useState<DetectionRule[]>(DEFAULT_DETECTION_RULES);
  const [forceDeleteMode, setForceDeleteMode] = useState(false);

  // Fetch all customers with linked record counts
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['cleanup-customers', dataEnvironment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          id,
          name,
          email,
          phone,
          created_at,
          updated_at,
          purchases:purchases(count),
          tasks:tasks(count)
        `)
        .eq('data_environment', dataEnvironment)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  // Fetch all tasks with linked record counts
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['cleanup-tasks', dataEnvironment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          task_number,
          created_at,
          updated_at,
          task_notes:task_notes(count),
          task_assignees:task_assignees(count)
        `)
        .eq('data_environment', dataEnvironment)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  // Fetch all purchases with linked record counts
  const { data: purchases = [], isLoading: purchasesLoading } = useQuery({
    queryKey: ['cleanup-purchases', dataEnvironment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          id,
          ticket_number,
          purchase_date,
          created_at,
          customer:customers(name),
          invoices:invoices(count),
          appointments:appointments(count),
          purchase_events:purchase_events(count)
        `)
        .eq('data_environment', dataEnvironment)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []).map(p => ({
        ...p,
        customer_name: (p.customer as any)?.name || 'Unknown'
      }));
    }
  });

  // Process customers into candidates
  const customerCandidates: MockDataCandidate[] = customers.map((customer: any) => {
    const linkedCount = (customer.purchases?.[0]?.count || 0) + (customer.tasks?.[0]?.count || 0);
    const detection = detectMockData(customer, 'customer', rules);
    const safety = calculateDeletionSafety(linkedCount, detection.confidence);

    return {
      id: customer.id,
      type: 'customer' as const,
      name: customer.name,
      reasons: detection.reasons,
      confidence: detection.confidence,
      linkedRecordsCount: linkedCount,
      createdAt: customer.created_at,
      isSafeToDelete: safety.isSafe
    };
  }).filter(c => c.reasons.length > 0);

  // Process tasks into candidates
  const taskCandidates: MockDataCandidate[] = tasks.map((task: any) => {
    const linkedCount = (task.task_notes?.[0]?.count || 0) + (task.task_assignees?.[0]?.count || 0);
    const detection = detectMockData(task, 'task', rules);
    const safety = calculateDeletionSafety(linkedCount, detection.confidence);

    return {
      id: task.id,
      type: 'task' as const,
      name: task.title || task.task_number || 'Untitled Task',
      reasons: detection.reasons,
      confidence: detection.confidence,
      linkedRecordsCount: linkedCount,
      createdAt: task.created_at,
      isSafeToDelete: safety.isSafe
    };
  }).filter(t => t.reasons.length > 0);

  // Process purchases into candidates
  const purchaseCandidates: MockDataCandidate[] = purchases.map((purchase: any) => {
    const linkedCount = (purchase.invoices?.[0]?.count || 0) +
      (purchase.appointments?.[0]?.count || 0) +
      (purchase.purchase_events?.[0]?.count || 0);
    const detection = detectMockData(purchase, 'purchase', rules);
    const safety = calculateDeletionSafety(linkedCount, detection.confidence);

    return {
      id: purchase.id,
      type: 'purchase' as const,
      name: purchase.ticket_number || 'Unknown',
      ticketNumber: purchase.ticket_number,
      customerName: purchase.customer_name,
      reasons: detection.reasons,
      confidence: detection.confidence,
      linkedRecordsCount: linkedCount,
      createdAt: purchase.created_at,
      isSafeToDelete: safety.isSafe
    };
  }).filter(p => p.reasons.length > 0);

  // Add batch detection
  const customerBatchFlags = detectBatchCreation(customers);
  const taskBatchFlags = detectBatchCreation(tasks);
  const purchaseBatchFlags = detectBatchCreation(purchases);

  // Merge batch flags into candidates
  customerCandidates.forEach(c => {
    const batchReason = customerBatchFlags.get(c.id);
    if (batchReason && !c.reasons.includes(batchReason)) {
      c.reasons.push(batchReason);
    }
  });

  taskCandidates.forEach(t => {
    const batchReason = taskBatchFlags.get(t.id);
    if (batchReason && !t.reasons.includes(batchReason)) {
      t.reasons.push(batchReason);
    }
  });

  purchaseCandidates.forEach(p => {
    const batchReason = purchaseBatchFlags.get(p.id);
    if (batchReason && !p.reasons.includes(batchReason)) {
      p.reasons.push(batchReason);
    }
  });

  // Combined candidates
  const allCandidates = [...customerCandidates, ...taskCandidates, ...purchaseCandidates];

  // Add duplicate name detection
  const namesMap = new Map<string, string[]>();
  customers.forEach((c: any) => {
    const name = (c.name || '').trim().toLowerCase();
    if (!name) return;
    if (!namesMap.has(name)) namesMap.set(name, []);
    namesMap.get(name)!.push(c.id);
  });

  namesMap.forEach((ids, name) => {
    if (ids.length > 1) {
      ids.forEach(id => {
        const candidate = allCandidates.find(c => c.id === id && c.type === 'customer');
        if (candidate) {
          if (!candidate.reasons.includes('Duplicate contact name')) {
            candidate.reasons.push('Duplicate contact name');
          }
          candidate.confidence = 'medium';
        } else {
          // If not already a candidate, add it
          const fullCustomer = customers.find((c: any) => c.id === id);
          if (fullCustomer) {
            const linkedCount = (fullCustomer.purchases?.[0]?.count || 0) + (fullCustomer.tasks?.[0]?.count || 0);
            const safety = calculateDeletionSafety(linkedCount, 'medium');
            allCandidates.push({
              id: fullCustomer.id,
              type: 'customer',
              name: fullCustomer.name,
              reasons: ['Duplicate contact name'],
              confidence: 'medium',
              linkedRecordsCount: linkedCount,
              createdAt: fullCustomer.created_at,
              isSafeToDelete: safety.isSafe
            });
          }
        }
      });
    }
  });

  // Re-calculate stats after adding duplicates
  const customerCandidatesUpdated = allCandidates.filter(c => c.type === 'customer');
  const taskCandidatesUpdated = allCandidates.filter(c => c.type === 'task');
  const purchaseCandidatesUpdated = allCandidates.filter(c => c.type === 'purchase');

  // Calculate stats
  const stats: CleanupStats = {
    totalCustomers: customers.length,
    totalTasks: tasks.length,
    totalPurchases: purchases.length,
    flaggedCustomers: customerCandidatesUpdated.length,
    flaggedTasks: taskCandidatesUpdated.length,
    flaggedPurchases: purchaseCandidatesUpdated.length,
    safeToDelete: allCandidates.filter(c => c.isSafeToDelete).length,
    hasLinkedRecords: allCandidates.filter(c => c.linkedRecordsCount > 0).length
  };

  // Delete mutation - handles dependencies when force delete is enabled
  const deleteMutation = useMutation({
    mutationFn: async (candidates: MockDataCandidate[]) => {
      const customerIds = candidates.filter(c => c.type === 'customer').map(c => c.id);
      const taskIds = candidates.filter(c => c.type === 'task').map(c => c.id);
      const purchaseIds = candidates.filter(c => c.type === 'purchase').map(c => c.id);

      const errors: string[] = [];
      let deletedNotes = 0;
      let deletedAssignees = 0;
      let deletedInvoices = 0;
      let deletedAppointments = 0;
      let deletedEvents = 0;
      let deletedAssets = 0;

      // Delete purchase dependencies first
      if (purchaseIds.length > 0) {
        // Delete invoices
        const { error: invoicesError, count: invoicesCount } = await supabase
          .from('invoices')
          .delete({ count: 'exact' })
          .in('purchase_id', purchaseIds);
        if (invoicesError) {
          errors.push(`Invoices: ${invoicesError.message}`);
        } else {
          deletedInvoices = invoicesCount || 0;
        }

        // Delete appointments
        const { error: appointmentsError, count: appointmentsCount } = await supabase
          .from('appointments')
          .delete({ count: 'exact' })
          .in('purchase_id', purchaseIds);
        if (appointmentsError) {
          errors.push(`Appointments: ${appointmentsError.message}`);
        } else {
          deletedAppointments = appointmentsCount || 0;
        }

        // Delete purchase_events
        const { error: eventsError, count: eventsCount } = await supabase
          .from('purchase_events')
          .delete({ count: 'exact' })
          .in('purchase_id', purchaseIds);
        if (eventsError) {
          errors.push(`Purchase Events: ${eventsError.message}`);
        } else {
          deletedEvents = eventsCount || 0;
        }

        // Delete asset_management records
        const { error: assetsError, count: assetsCount } = await supabase
          .from('asset_management')
          .delete({ count: 'exact' })
          .in('purchase_id', purchaseIds);
        if (assetsError) {
          errors.push(`Assets: ${assetsError.message}`);
        } else {
          deletedAssets = assetsCount || 0;
        }

        // Delete asset_configuration_checklist
        await supabase
          .from('asset_configuration_checklist')
          .delete()
          .in('purchase_id', purchaseIds);

        // Delete allocations
        await supabase
          .from('allocations')
          .delete()
          .in('purchase_order_id', purchaseIds);

        // Delete allocation_reconciliation_audit
        await supabase
          .from('allocation_reconciliation_audit')
          .delete()
          .in('purchase_id', purchaseIds);

        // Now delete the purchases themselves
        const { error: purchasesError } = await supabase
          .from('purchases')
          .delete()
          .in('id', purchaseIds);
        if (purchasesError) errors.push(`Purchases: ${purchasesError.message}`);
      }

      // Delete task dependencies (notes and assignees)
      if (taskIds.length > 0) {
        // Delete task_notes for these tasks
        const { error: notesError, count: notesCount } = await supabase
          .from('task_notes')
          .delete({ count: 'exact' })
          .in('task_id', taskIds);
        if (notesError) {
          errors.push(`Task Notes: ${notesError.message}`);
        } else {
          deletedNotes = notesCount || 0;
        }

        // Delete task_assignees for these tasks
        const { error: assigneesError, count: assigneesCount } = await supabase
          .from('task_assignees')
          .delete({ count: 'exact' })
          .in('task_id', taskIds);
        if (assigneesError) {
          errors.push(`Task Assignees: ${assigneesError.message}`);
        } else {
          deletedAssignees = assigneesCount || 0;
        }

        // Now delete the tasks themselves
        const { error: tasksError } = await supabase
          .from('tasks')
          .delete()
          .in('id', taskIds);
        if (tasksError) errors.push(`Tasks: ${tasksError.message}`);
      }

      if (customerIds.length > 0) {
        const { error } = await supabase
          .from('customers')
          .delete()
          .in('id', customerIds);
        if (error) errors.push(`Customers: ${error.message}`);
      }

      if (errors.length > 0) {
        throw new Error(errors.join('; '));
      }

      return {
        deletedCustomers: customerIds.length,
        deletedTasks: taskIds.length,
        deletedPurchases: purchaseIds.length,
        deletedNotes,
        deletedAssignees,
        deletedInvoices,
        deletedAppointments,
        deletedEvents,
        deletedAssets
      };
    },
    onSuccess: (result) => {
      const details: string[] = [];
      if (result.deletedCustomers > 0) details.push(`${result.deletedCustomers} customers`);
      if (result.deletedTasks > 0) details.push(`${result.deletedTasks} tasks`);
      if (result.deletedPurchases > 0) details.push(`${result.deletedPurchases} purchases`);
      if (result.deletedNotes > 0) details.push(`${result.deletedNotes} notes`);
      if (result.deletedAssignees > 0) details.push(`${result.deletedAssignees} assignees`);
      if (result.deletedInvoices > 0) details.push(`${result.deletedInvoices} invoices`);
      if (result.deletedAppointments > 0) details.push(`${result.deletedAppointments} appointments`);
      if (result.deletedEvents > 0) details.push(`${result.deletedEvents} events`);
      if (result.deletedAssets > 0) details.push(`${result.deletedAssets} assets`);

      toast.success('Cleanup Complete', {
        description: `Deleted ${details.join(', ')}`
      });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['cleanup-customers'] });
      queryClient.invalidateQueries({ queryKey: ['cleanup-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cleanup-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: (error) => {
      toast.error('Cleanup Failed', {
        description: error.message
      });
    }
  });

  // Selection handlers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllSafe = useCallback(() => {
    const safeIds = allCandidates.filter(c => c.isSafeToDelete).map(c => c.id);
    setSelectedIds(new Set(safeIds));
  }, [allCandidates]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Delete selected - force mode allows deleting items with linked records
  const deleteSelected = useCallback(() => {
    const toDelete = forceDeleteMode
      ? allCandidates.filter(c => selectedIds.has(c.id))
      : allCandidates.filter(c => selectedIds.has(c.id) && c.isSafeToDelete);

    if (toDelete.length === 0) {
      toast.error(forceDeleteMode ? 'No items selected' : 'No safe items selected');
      return;
    }
    deleteMutation.mutate(toDelete);
  }, [selectedIds, allCandidates, deleteMutation, forceDeleteMode]);

  // Toggle rule
  const toggleRule = useCallback((ruleId: string) => {
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ));
  }, []);

  // Toggle force delete mode
  const toggleForceDeleteMode = useCallback(() => {
    setForceDeleteMode(prev => !prev);
    // Clear selection when toggling to prevent accidental deletes
    setSelectedIds(new Set());
  }, []);

  // Get selected candidates with linked records info
  const getSelectedWithLinkedRecords = useCallback(() => {
    return allCandidates.filter(c => selectedIds.has(c.id) && c.linkedRecordsCount > 0);
  }, [allCandidates, selectedIds]);

  return {
    candidates: allCandidates,
    customerCandidates,
    taskCandidates,
    purchaseCandidates,
    stats,
    isLoading: customersLoading || tasksLoading || purchasesLoading,
    isDeleting: deleteMutation.isPending,
    selectedIds,
    toggleSelection,
    selectAllSafe,
    clearSelection,
    deleteSelected,
    rules,
    toggleRule,
    forceDeleteMode,
    toggleForceDeleteMode,
    getSelectedWithLinkedRecords
  };
}
