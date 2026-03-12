import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PurchaseWithDetails } from "@/types/database";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { useCurrentOrganizationId } from "./useOrganization";
import { useEffect } from "react";

export type PurchaseStatus = 'ordered' | 'configuring' | 'pending_allocation' | 'pending_assets' | 'approved' | 'allocated' | 'sold' | 'cancelled';

export interface PurchaseWithCanonicalStatus extends PurchaseWithDetails {
    normalized_status: PurchaseStatus;
}

export interface CanonicalPurchasesResponse {
    items: PurchaseWithCanonicalStatus[];
    counts: Record<PurchaseStatus, number>;
    totalCount: number;
}

/**
 * The Canonical Source of Truth for Purchases (Sales Orders).
 * Ensures data parity between widgets and queue pages.
 */
export const useCanonicalPurchases = (params?: {
    limit?: number;
    statusFilter?: PurchaseStatus | 'all';
    searchQuery?: string;
}) => {
    const dataEnvironment = useDataEnvironment();
    const orgId = useCurrentOrganizationId();
    const queryClient = useQueryClient();

    // Real-time updates subscription
    useEffect(() => {
        if (!orgId) return;

        const channel = supabase
            .channel('canonical-purchases-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'purchases',
                filter: `organization_id=eq.${orgId}`
            }, () => {
                queryClient.invalidateQueries({ queryKey: ["canonical-purchases", orgId, dataEnvironment] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [orgId, dataEnvironment, queryClient]);

    return useQuery({
        queryKey: ["canonical-purchases", orgId, dataEnvironment, params],
        enabled: !!orgId,
        queryFn: async (): Promise<CanonicalPurchasesResponse> => {
            // 1. Fetch data
            let query = supabase
                .from("purchases")
                .select(`
          *,
          customer:customers!purchases_customer_id_fkey(*),
          product:products(*)
        `)
                .eq("data_environment", dataEnvironment)
                .eq("organization_id", orgId)
                .order("purchase_date", { ascending: false });

            if (params?.limit) query = query.limit(params.limit);

            const { data, error } = await query;
            if (error) throw error;

            // 2. Fetch employment IDs for members from org_members table
            const memberUserIds = (data || [])
                .map(p => {
                    const profileData = (p as any).member ? (Array.isArray((p as any).member) ? (p as any).member[0] : (p as any).member) : null;
                    return profileData?.id;
                })
                .filter(Boolean);

            let employmentIdsMap: Record<string, string> = {};
            if (memberUserIds.length > 0) {
                const { data: omData } = await supabase
                    .from('org_members')
                    .select('user_id, employment_id')
                    .eq('organization_id', orgId)
                    .in('user_id', memberUserIds);

                omData?.forEach(om => {
                    if (om.user_id && om.employment_id) {
                        employmentIdsMap[om.user_id] = om.employment_id;
                    }
                });
            }

            // 3. Fetch counts for parity (regardless of current limit/filter)
            const { data: countData, error: countError } = await supabase
                .from("purchases")
                .select("order_status, status, pickup_date")
                .eq("data_environment", dataEnvironment)
                .eq("organization_id", orgId);

            if (countError) throw countError;

            const counts: Record<PurchaseStatus, number> = {
                ordered: 0,
                configuring: 0,
                pending_allocation: 0,
                pending_assets: 0,
                approved: 0,
                allocated: 0,
                sold: 0,
                cancelled: 0
            };

            countData.forEach(p => {
                // Status normalization logic (Canonical SoT)
                // We prioritize 'sold' if pickup_date exists, then 'status' if matches enum, then 'order_status'
                let status: PurchaseStatus = (p.status as PurchaseStatus) || (p.order_status as PurchaseStatus) || 'ordered';
                if (p.pickup_date) status = 'sold';
                if (counts[status] !== undefined) counts[status]++;
            });

            // 4. Process and filter results for view
            let filteredItems = (data || []).map(purchase => {
                const profileData = (purchase as any).member ? (Array.isArray((purchase as any).member) ? (purchase as any).member[0] : (purchase as any).member) : null;

                // Determine normalized status for each item
                const status: PurchaseStatus = purchase.pickup_date ? 'sold' :
                    (purchase.status as PurchaseStatus || purchase.order_status as PurchaseStatus || 'ordered');

                return {
                    ...purchase,
                    normalized_status: status,
                    completion_method: purchase.completion_method as 'manual' | 'auto' | 'legacy' | 'backdated',
                    allocation_status: purchase.allocation_status as 'pending_allocation' | 'pending_assets' | 'approved' | 'allocated',
                    customer: {
                        ...purchase.customer,
                        relationship_type: purchase.customer.relationship_type,
                        status: purchase.customer.status as 'active' | 'blacklisted' | 'suspended'
                    },
                    member: profileData ? {
                        id: profileData.id,
                        full_name: profileData.full_name,
                        email: profileData.email,
                        employment_id: employmentIdsMap[profileData.id] || purchase.ticket_number,
                    } : undefined,
                };
            });

            // Apply client-side filters if specified (Search)
            if (params?.searchQuery) {
                const q = params.searchQuery.toLowerCase();
                filteredItems = filteredItems.filter(item =>
                    item.customer?.name?.toLowerCase().includes(q) ||
                    item.receipt_number?.toLowerCase().includes(q) ||
                    item.product?.name?.toLowerCase().includes(q)
                );
            }

            // Apply status filter if specified
            if (params?.statusFilter && params.statusFilter !== 'all') {
                filteredItems = filteredItems.filter(item => item.normalized_status === params.statusFilter);
            }

            return {
                items: filteredItems as PurchaseWithCanonicalStatus[],
                counts,
                totalCount: countData.length
            };
        },
        staleTime: 30000,
    });
};
