import { useMemo } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useUserManagement } from './useUserManagement';
import { AppRole } from './useUserRoles';

// Role categories
export const MANAGEMENT_ROLES: AppRole[] = ['admin', 'sales', 'marketing', 'finance', 'security'];
export const EMPLOYEE_ROLES: AppRole[] = ['employee'];

// Plan limits configuration
export const PLAN_LIMITS = {
  free: {
    teamSize: 1,           // Solo only (the owner)
    managementRoles: 0,    // No additional management
    employeeRoles: 0,      // No employees
  },
  starter: {
    teamSize: 7,           // Including owner
    managementRoles: 3,    // Management slots
    employeeRoles: 5,      // Employee slots
  },
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;

export interface TeamLimits {
  // Limits from plan
  maxTeamSize: number;
  maxManagement: number;
  maxEmployees: number;
  
  // Current counts
  currentTeamSize: number;
  currentManagement: number;
  currentEmployees: number;
  
  // Capacity checks
  canAddTeamMember: boolean;
  canAddManagementRole: boolean;
  canAddEmployeeRole: boolean;
  
  // Percentages for progress bars
  teamPercentage: number;
  managementPercentage: number;
  employeePercentage: number;
  
  // Near capacity warnings (80%+)
  isTeamNearCapacity: boolean;
  isManagementNearCapacity: boolean;
  isEmployeeNearCapacity: boolean;
  
  // At capacity
  isTeamAtCapacity: boolean;
  isManagementAtCapacity: boolean;
  isEmployeeAtCapacity: boolean;
  
  // Plan info
  tier: string;
  tierLabel: string;
}

export const useTeamLimits = (): TeamLimits => {
  const { tier } = useSubscription();
  const { users } = useUserManagement();
  
  return useMemo(() => {
    // Default to free tier limits
    const planTier = (tier === 'starter' ? 'starter' : 'free') as PlanTier;
    const limits = PLAN_LIMITS[planTier];
    
    // Count team members (users with at least one role)
    const teamMembers = users.filter(u => u.roles.length > 0);
    const currentTeamSize = teamMembers.length;
    
    // Count management (users with any management role)
    const currentManagement = users.filter(u => 
      u.roles.some(r => MANAGEMENT_ROLES.includes(r))
    ).length;
    
    // Count employees (users with employee role but no management role)
    const currentEmployees = users.filter(u => 
      u.roles.includes('employee') && 
      !u.roles.some(r => MANAGEMENT_ROLES.includes(r))
    ).length;
    
    // Calculate percentages (cap at 100)
    const teamPercentage = limits.teamSize > 0 
      ? Math.min(100, (currentTeamSize / limits.teamSize) * 100) 
      : 100;
    const managementPercentage = limits.managementRoles > 0 
      ? Math.min(100, (currentManagement / limits.managementRoles) * 100) 
      : 100;
    const employeePercentage = limits.employeeRoles > 0 
      ? Math.min(100, (currentEmployees / limits.employeeRoles) * 100) 
      : 100;
    
    // Capacity checks
    const canAddTeamMember = currentTeamSize < limits.teamSize;
    const canAddManagementRole = currentManagement < limits.managementRoles;
    const canAddEmployeeRole = currentEmployees < limits.employeeRoles;
    
    // Near capacity (80%+)
    const isTeamNearCapacity = teamPercentage >= 80 && teamPercentage < 100;
    const isManagementNearCapacity = managementPercentage >= 80 && managementPercentage < 100;
    const isEmployeeNearCapacity = employeePercentage >= 80 && employeePercentage < 100;
    
    // At capacity
    const isTeamAtCapacity = currentTeamSize >= limits.teamSize;
    const isManagementAtCapacity = currentManagement >= limits.managementRoles;
    const isEmployeeAtCapacity = currentEmployees >= limits.employeeRoles;
    
    return {
      maxTeamSize: limits.teamSize,
      maxManagement: limits.managementRoles,
      maxEmployees: limits.employeeRoles,
      currentTeamSize,
      currentManagement,
      currentEmployees,
      canAddTeamMember,
      canAddManagementRole,
      canAddEmployeeRole,
      teamPercentage,
      managementPercentage,
      employeePercentage,
      isTeamNearCapacity,
      isManagementNearCapacity,
      isEmployeeNearCapacity,
      isTeamAtCapacity,
      isManagementAtCapacity,
      isEmployeeAtCapacity,
      tier: planTier,
      tierLabel: planTier === 'starter' ? 'Starter' : 'Free',
    };
  }, [tier, users]);
};

/**
 * Check if a specific role can be added based on plan limits
 */
export const canAddRole = (
  role: AppRole, 
  limits: TeamLimits
): { allowed: boolean; reason?: string } => {
  // Check if it's a management role
  if (MANAGEMENT_ROLES.includes(role)) {
    if (!limits.canAddManagementRole) {
      return {
        allowed: false,
        reason: `Management role limit reached (${limits.currentManagement}/${limits.maxManagement}). Upgrade to add more.`,
      };
    }
  }
  
  // Check if it's an employee role
  if (EMPLOYEE_ROLES.includes(role)) {
    if (!limits.canAddEmployeeRole) {
      return {
        allowed: false,
        reason: `Employee role limit reached (${limits.currentEmployees}/${limits.maxEmployees}). Upgrade to add more.`,
      };
    }
  }
  
  // Check overall team size
  if (!limits.canAddTeamMember) {
    return {
      allowed: false,
      reason: `Team size limit reached (${limits.currentTeamSize}/${limits.maxTeamSize}). Upgrade to add more members.`,
    };
  }
  
  return { allowed: true };
};
