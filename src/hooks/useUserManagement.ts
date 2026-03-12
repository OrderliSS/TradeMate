import { useState, useEffect, useCallback } from 'react';
import { productionClient } from '@/lib/production-client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SecureEnvironment } from '@/lib/secure-environment';
import { AppRole } from './useUserRoles';
import { useEnvironment } from '@/hooks/useEnvironment';
import { PLAN_LIMITS, MANAGEMENT_ROLES, EMPLOYEE_ROLES, PlanTier } from './useTeamLimits';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  employee_id?: string;
  roles: AppRole[];
  created_at: string;
}

export const useUserManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const environment = useEnvironment();
  const { tier } = useSubscription();
  const { currentOrganization } = useOrganization();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      // Get basic user profiles with employee_id
      const { data: profiles, error: profilesError } = await productionClient
        .from('profiles')
        .select('id, email, full_name, employee_id, created_at');

      if (profilesError) {
        SecureEnvironment.error('Error fetching profiles:', profilesError);
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive",
        });
        return;
      }

      // Get all user roles from user_roles table
      const { data: userRoles, error: rolesError } = await productionClient
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        SecureEnvironment.error('Error fetching roles:', rolesError);
      }

      // Map roles to users
      const usersWithRoles = (profiles || []).map((profile: any) => {
        const roles = (userRoles || [])
          .filter((ur: any) => ur.user_id === profile.id)
          .map((ur: any) => ur.role as AppRole);
        
        return {
          ...profile,
          roles
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      SecureEnvironment.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check team limits before adding a role
  const checkTeamLimits = useCallback((role: AppRole, targetUserId: string): { allowed: boolean; reason?: string } => {
    const planTier = (tier === 'starter' ? 'starter' : 'free') as PlanTier;
    const limits = PLAN_LIMITS[planTier];
    
    // Check if target user already has roles (existing team member)
    const targetUser = users.find(u => u.id === targetUserId);
    const isExistingTeamMember = targetUser && targetUser.roles.length > 0;
    
    // Count current team metrics
    const teamMembers = users.filter(u => u.roles.length > 0);
    const currentManagement = users.filter(u => 
      u.roles.some(r => MANAGEMENT_ROLES.includes(r))
    ).length;
    const currentEmployees = users.filter(u => 
      u.roles.includes('employee') && 
      !u.roles.some(r => MANAGEMENT_ROLES.includes(r))
    ).length;
    
    // If adding to a new team member, check team size
    if (!isExistingTeamMember && teamMembers.length >= limits.teamSize) {
      return {
        allowed: false,
        reason: `Team size limit reached (${teamMembers.length}/${limits.teamSize}). Upgrade your plan to add more members.`,
      };
    }
    
    // Check management role limits
    if (MANAGEMENT_ROLES.includes(role)) {
      const targetAlreadyHasManagement = targetUser?.roles.some(r => MANAGEMENT_ROLES.includes(r));
      if (!targetAlreadyHasManagement && currentManagement >= limits.managementRoles) {
        return {
          allowed: false,
          reason: `Management role limit reached (${currentManagement}/${limits.managementRoles}). Upgrade to Starter plan for more management slots.`,
        };
      }
    }
    
    // Check employee role limits
    if (EMPLOYEE_ROLES.includes(role)) {
      const targetHasManagement = targetUser?.roles.some(r => MANAGEMENT_ROLES.includes(r));
      if (!targetHasManagement && currentEmployees >= limits.employeeRoles) {
        return {
          allowed: false,
          reason: `Employee role limit reached (${currentEmployees}/${limits.employeeRoles}). Upgrade to Starter plan for more employee slots.`,
        };
      }
    }
    
    return { allowed: true };
  }, [users, tier]);

  const updateUserRole = async (userId: string, newRole: AppRole, action: 'add' | 'remove') => {
    if (!user) return false;

    // Prevent self-removal of admin role
    if (userId === user.id && newRole === 'admin' && action === 'remove') {
      toast({
        title: "Cannot modify own role",
        description: "You cannot remove admin access from your own account",
        variant: "destructive",
      });
      return false;
    }

    // Check team limits before adding
    if (action === 'add') {
      const limitCheck = checkTeamLimits(newRole, userId);
      if (!limitCheck.allowed) {
        toast({
          title: "Team Limit Reached",
          description: limitCheck.reason,
          variant: "destructive",
        });
        return false;
      }
    }

    setUpdating(userId);
    try {
      if (action === 'add') {
        // Cast role to the database enum type
        const dbRole = newRole as 'admin' | 'employee' | 'finance' | 'marketing' | 'sales' | 'security';
        const { error } = await productionClient
          .from('user_roles')
          .insert([{ user_id: userId, role: dbRole }]);

        if (error) {
          if (error.code !== '23505') {
            throw error;
          }
        }
      } else {
        // Cast role to the database enum type
        const dbRole = newRole as 'admin' | 'employee' | 'finance' | 'marketing' | 'sales' | 'security';
        const { error } = await productionClient
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', dbRole);

        if (error) throw error;
      }

      await fetchUsers();

      toast({
        title: "Success",
        description: `User role ${action === 'add' ? 'added' : 'removed'} successfully`,
      });

      return true;
    } catch (error) {
      SecureEnvironment.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
      return false;
    } finally {
      setUpdating(null);
    }
  };

  const removeUser = async (userId: string): Promise<boolean> => {
    if (!user || !currentOrganization) return false;

    // Prevent self-removal
    if (userId === user.id) {
      toast({
        title: "Cannot remove yourself",
        description: "You cannot remove your own account from the organization",
        variant: "destructive",
      });
      return false;
    }

    setRemoving(userId);
    try {
      // Get the org_member record for this user
      const { data: orgMember, error: checkError } = await productionClient
        .from('org_members')
        .select('id, role')
        .eq('user_id', userId)
        .eq('organization_id', currentOrganization.id)
        .single();

      if (checkError || !orgMember) {
        throw new Error('User is not a member of this organization');
      }

      if (orgMember.role === 'owner') {
        toast({
          title: "Cannot remove owner",
          description: "The organization owner cannot be removed",
          variant: "destructive",
        });
        return false;
      }

      // Remove user roles first
      const { error: rolesError } = await productionClient
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (rolesError) {
        SecureEnvironment.error('Error removing user roles:', rolesError);
      }

      // Remove from org_members using the RPC (uses member id, not user id)
      const { data: result, error: removeError } = await productionClient.rpc('remove_org_member', {
        p_member_id: orgMember.id
      });

      if (removeError) {
        throw removeError;
      }

      // Check RPC result
      const resultObj = result as { success?: boolean; error?: string } | null;
      if (resultObj && !resultObj.success) {
        throw new Error(resultObj.error || 'Failed to remove user');
      }

      await fetchUsers();

      toast({
        title: "User removed",
        description: "User has been removed from the organization",
      });

      return true;
    } catch (error: any) {
      SecureEnvironment.error('Error removing user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove user from organization",
        variant: "destructive",
      });
      return false;
    } finally {
      setRemoving(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [environment]);

  return {
    users,
    loading,
    updating,
    removing,
    updateUserRole,
    removeUser,
    refetch: fetchUsers,
    currentUserId: user?.id,
    currentOrgId: currentOrganization?.id,
  };
};