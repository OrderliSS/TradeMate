/**
 * Centralized Hooks Export
 * 
 * Provides easy access to commonly used hooks across the application.
 */

// Realtime System Hooks (Phase 2)
export { useConnectionStatus } from './useConnectionStatus';
export { useRealtimeMutation, trackMutation, completeMutation } from './useRealtimeMutation';
export { useCatchUpSync, usePageCatchUpSync } from './useCatchUpSync';
export { useGlobalRealtimeSubscriptions } from './useGlobalRealtimeSubscriptions';

// Realtime Metrics Hooks (Relationship-Aware Updates)
export { useRealtimeQueueCounts, useAnimatedCount } from './useRealtimeQueueCounts';
export { 
  useRealtimeTaskStats, 
  useRealtimePendingCases, 
  useRealtimePendingTasks, 
  useRealtimeOverdueTasks, 
  useRealtimeDueTodayTasks 
} from './useRealtimeTaskStats';

// Common UI Hooks
export { useToast, toast } from './use-toast';
export { useIsMobile } from './use-mobile';
export { useBreakpoint } from './useBreakpoint';

// Data Environment
export { useSandbox, useDataEnvironment } from './useSandbox';
export { useEnvironment } from './useEnvironment';

// User & Organization
export { useUserProfile } from './useUserProfile';
export { useUserRoles } from './useUserRoles';
export { useOrganization } from './useOrganization';
export { useAdminCheck } from './useAdminCheck';

// Core Entity Hooks
export { usePurchases, usePurchase, useCreatePurchase } from './usePurchases';
export { useTasks, useTaskById, useCreateTask, useUpdateTask, useDeleteTask } from './useTasks';
export { useContacts, useContact, useCreateContact, useUpdateContact } from './useContacts';
export { useProducts } from './useProducts';

// User Preferences (Database-synced)
export { useUserPreferences, useUserPreferencesBatch } from './useUserPreferences';
export { useViewModePreferences, useFilterPreferences } from './useViewModePreferences';
