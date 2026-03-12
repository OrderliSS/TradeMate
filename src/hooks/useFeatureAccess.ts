import { useSubscription } from '@/contexts/SubscriptionContext';

// Re-export team limits for convenience
export { PLAN_LIMITS, MANAGEMENT_ROLES, EMPLOYEE_ROLES } from './useTeamLimits';
export { useTeamLimits, canAddRole } from './useTeamLimits';
export type { TeamLimits, PlanTier } from './useTeamLimits';

export const useFeatureAccess = () => {
  const { tier, subscribed } = useSubscription();
  
  const isFree = tier === 'free';
  const isStarter = tier === 'starter';
  
  return {
    // Feature access - all features accessible, only team size differs
    canAccessAdvancedAnalytics: true,
    canAccessVendorManagement: true,
    canAccessUnlimitedOrders: true,
    canAccessUnlimitedCustomers: true,
    canAccessUnlimitedProducts: true,
    
    // Team limits are now handled by useTeamLimits hook
    // No feature limits, only team size limits
    limits: {
      orders: Infinity,
      customers: Infinity,
      products: Infinity,
    },
    
    // Helper functions
    isFree,
    isStarter,
    tier,
    subscribed,
  };
};
