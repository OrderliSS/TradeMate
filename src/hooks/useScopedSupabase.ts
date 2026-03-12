import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganizationId } from '@/hooks/useOrganization';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

/**
 * A scoped wrapper around the Supabase client that ensures
 * all queries are filtered by the active organization.
 * 
 * Usage:
 * const scopedDb = useScopedSupabase();
 * const { data } = await scopedDb.from('table').select('*');
 * // Automatically becomes: ...select('*').eq('organization_id', orgId)
 */
export function useScopedSupabase() {
  const organizationId = useCurrentOrganizationId();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  // Determine effective organization ID for filtering
  // If impersonating, we MUST ensure we are scoped to an allowed org.
  // Ideally, organizationId from context is already correct because we switched orgs.
  // But as a failsafe, we can enforce it.
  const effectiveOrgId = organizationId;
  // If we wanted to be extra safe: if (isImpersonating && !impersonatedUser.allowedOrgIds.includes(organizationId)) ... block access

  const scopedClient = useMemo(() => {
    return {
      ...supabase,
      from: (table: string) => {
        const queryBuilder = supabase.from(table as any);

        // Helper to inject organization_id filter into any builder
        const injectOrgFilter = (builder: any) => {
          if (!organizationId || organizationId === 'null') {
            console.warn(`[ScopedSupabase] Blocked mutation/query to '${table}' - No active organization ID (was ${organizationId}).`);
            // Return a builder that will effectively fail safely
            return builder.eq('organization_id', '00000000-0000-0000-0000-000000000000');
          }

          // IMPERSONATION SECURITY LAYER
          if (isImpersonating && impersonatedUser?.allowedOrgIds) {
            // If the current org is NOT in the allowed list, block hard.
            if (!impersonatedUser.allowedOrgIds.includes(organizationId)) {
              console.error(`[ScopedSupabase] SECURITY BLOCK: Impersonated user ${impersonatedUser.email} attempted to access Org ${organizationId} which is not in allowed list.`);
              return builder.eq('organization_id', '00000000-0000-0000-0000-000000000000');
            }
          }

          return builder.eq('organization_id', organizationId);
        };

        return {
          ...queryBuilder,

          select: (columns = '*', { count = null, head = false } = {}) => {
            return injectOrgFilter(queryBuilder.select(columns, { count, head }));
          },

          insert: (values: any, { count = null } = {}) => {
            const valuesWithOrg = Array.isArray(values)
              ? values.map(v => ({ ...v, organization_id: organizationId }))
              : { ...values, organization_id: organizationId };

            if (!organizationId) {
              console.error(`[ScopedSupabase] Blocked insert to '${table}' - No active organization ID.`);
              throw new Error('Cannot insert data without an active organization.');
            }
            return queryBuilder.insert(valuesWithOrg, { count });
          },

          update: (values: any, { count = null } = {}) => {
            // Update prepares the builder, then we MUST attach the filter
            return injectOrgFilter(queryBuilder.update(values, { count }));
          },

          delete: ({ count = null } = {}) => {
            return injectOrgFilter(queryBuilder.delete({ count }));
          },

          upsert: (values: any, { count = null, onConflict = undefined, ignoreDuplicates = false } = {}) => {
            const valuesWithOrg = Array.isArray(values)
              ? values.map(v => ({ ...v, organization_id: organizationId }))
              : { ...values, organization_id: organizationId };

            if (!organizationId) {
              console.error(`[ScopedSupabase] Blocked upsert to '${table}' - No active organization ID.`);
              throw new Error('Cannot upsert data without an active organization.');
            }
            // Upsert acts like insert, but might update. We don't usually chain .eq() after upsert unless it returns rows?
            // Actually upsert executes immediately if awaited? No, it returns a builder.
            // But we don't usually filter an upsert. The filter applies to the "update" part implicitly by ID?
            // Standard upsert doesn't take filters usually, but let's return the builder just in case.
            return queryBuilder.upsert(valuesWithOrg, { count, onConflict, ignoreDuplicates });
          },

          // Allow access to the raw builder for edge cases (e.g. storage, auth)
          // We cast to 'any' to avoid the "Type instantiation is excessively deep" error
          // which happens when trying to wrap the complex PostgrestBuilder types recursively.
          raw: queryBuilder as any
        } as any; // Cast the whole returned proxy to 'any' to silence the strict type checker infinite recursion
      }
    };
  }, [organizationId, isImpersonating, impersonatedUser]);

  return scopedClient as any;
}
