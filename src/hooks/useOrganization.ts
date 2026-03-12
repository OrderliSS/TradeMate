import { useOrganization as useOrganizationContext } from '@/contexts/OrganizationContext';

/**
 * Hook to access organization context
 * Re-export from context for convenience
 */
export function useOrganization() {
  return useOrganizationContext();
}

/**
 * Hook to get the current organization ID
 * Useful for queries that need to scope by organization
 */
export function useCurrentOrganizationId(): string | null {
  const { currentOrganization } = useOrganizationContext();
  const id = currentOrganization?.id ?? null;
  return id === 'null' ? null : id;
}

/**
 * Hook to check if user can perform admin actions
 */
export function useCanManageOrganization(): boolean {
  const { isAdmin, isOwner } = useOrganizationContext();
  return isAdmin || isOwner;
}

/**
 * Hook to check specific organization permissions
 */
export function useOrganizationPermissions() {
  const { currentOrganization, isOwner, isAdmin, canManageMembers } = useOrganizationContext();

  return {
    canView: !!currentOrganization,
    canCreate: currentOrganization?.role !== 'viewer',
    canEdit: currentOrganization?.role !== 'viewer',
    canDelete: isAdmin || isOwner,
    canManageMembers,
    canInvite: canManageMembers,
    canChangeRoles: isOwner,
    role: currentOrganization?.role ?? null
  };
}
