import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { useCurrentOrganizationId } from "./useOrganization";
import { useScopedSupabase } from "@/hooks/useScopedSupabase";
import { DELIVERY_STATUS_OPTIONS } from "@/lib/delivery-status-options";
import { useEffect } from "react";

export interface CanonicalStockOrder {
    id: string;
    name: string;
    stock_record_number: string;
    category: string;
    vendor: string;
    vendor_store_name: string | null;
    amount: number;
    delivery_status: string;
    delivery_status_2?: string;
    hasTracking: boolean;
    isDelivered: boolean;
    isTransit: boolean;
    notes?: string;
    order_number?: string;
    tracking_number?: string;
    vendor_tracking_number?: string;
    vendor_tracking_number_2?: string;
    vendor_carrier?: string;
    purchase_date?: string;
    created_at: string;
    quantity_needed?: number;
    product?: any;
}

export interface CanonicalStockOrdersResponse {
    items: CanonicalStockOrder[];
    counts: {
        pending: number;
        inTransit: number;
        delivered: number;
        total: number;
    };
}

/**
 * The Canonical Source of Truth for Stock Orders.
 * Unifies basic orders, tracking data, and shipments.
 */
export const useCanonicalStockOrders = (params?: { limit?: number }) => {
    const organizationId = useCurrentOrganizationId();
    const dataEnvironment = useDataEnvironment();
    const scopedSupabase = useScopedSupabase();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!organizationId) return;
        const channel = supabase
            .channel('canonical-stock-orders-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'stock_orders',
                filter: `organization_id=eq.${organizationId}`
            }, () => {
                queryClient.invalidateQueries({ queryKey: ["canonical-stock-orders", organizationId, dataEnvironment] });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [organizationId, dataEnvironment, queryClient]);

    return useQuery({
        queryKey: ["canonical-stock-orders", organizationId, dataEnvironment, params?.limit],
        enabled: !!organizationId,
        queryFn: async (): Promise<CanonicalStockOrdersResponse> => {
            // 1. Fetch Orders
            let query = scopedSupabase
                .from("stock_orders")
                .select(`
          *,
          product:products(*)
        `)
                .order("created_at", { ascending: false });

            if (params?.limit) query = query.limit(params.limit);

            const { data: stockOrders, error } = await query;
            if (error) throw error;

            // 2. Fetch Shipments for tracking context
            const stockOrderIds = stockOrders?.map(order => order.id) || [];
            let shipments: any[] = [];
            if (stockOrderIds.length > 0) {
                const { data: shipmentsData } = await scopedSupabase
                    .from("stock_order_shipments")
                    .select("stock_order_id, tracking_number, vendor_tracking_number")
                    .in("stock_order_id", stockOrderIds);
                shipments = shipmentsData || [];
            }

            // 3. Normalization and Parity Logic
            const counts = { pending: 0, inTransit: 0, delivered: 0, total: stockOrders?.length || 0 };

            const items = (stockOrders || []).map(order => {
                const hasDirectTracking = !!(
                    order.tracking_number ||
                    order.tracking_number_2 ||
                    order.vendor_tracking_number ||
                    order.vendor_tracking_number_2
                );

                const hasShipmentTracking = shipments.some(s =>
                    s.stock_order_id === order.id && (s.tracking_number || s.vendor_tracking_number)
                );

                const isDelivered = order.delivery_status === 'delivered' || order.delivery_status_2 === 'delivered';
                const isTransit = !isDelivered && (hasDirectTracking || hasShipmentTracking || order.delivery_status !== 'ordered');

                if (isDelivered) counts.delivered++;
                else if (isTransit) counts.inTransit++;
                else counts.pending++;

                return {
                    ...order,
                    hasTracking: hasDirectTracking || hasShipmentTracking,
                    isDelivered,
                    isTransit
                };
            });

            return { items, counts };
        },
        staleTime: 30000,
    });
};
