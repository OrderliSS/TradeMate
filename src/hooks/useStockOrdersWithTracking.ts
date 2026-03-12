import { useQuery } from "@tanstack/react-query";
import { useScopedSupabase } from "@/hooks/useScopedSupabase";
import { useCurrentOrganizationId } from "@/hooks/useOrganization";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { DELIVERY_STATUS_OPTIONS } from "@/lib/delivery-status-options";
import { logger } from "@/lib/logger";

interface StockOrderWithTracking {
  id: string;
  name: string;
  stock_record_number: string;
  category: string;
  vendor: string;
  vendor_store_name: string | null;
  amount: number;
  delivery_status: string;
  hasTracking: boolean;
  created_at: string;
}

export const useStockOrdersWithTracking = () => {
  const organizationId = useCurrentOrganizationId();
  const dataEnvironment = useDataEnvironment();
  const scopedSupabase = useScopedSupabase();

  return useQuery({
    queryKey: ["stock-orders-with-tracking", organizationId, dataEnvironment],
    queryFn: async (): Promise<StockOrderWithTracking[]> => {
      if (!organizationId) return [];
      logger.info("[SOT-WIDGET] Starting stock orders query", {
        organizationId,
        dataEnvironment,
      });

      // First get stock orders with their basic info and tracking
      const { data: stockOrders, error } = await scopedSupabase
        .from("stock_orders")
        .select("id, name, stock_record_number, category, vendor, vendor_store_name, amount, delivery_status, tracking_number, tracking_number_2, vendor_tracking_number, vendor_tracking_number_2, created_at")
        .order("name");

      if (error) {
        logger.error("[SOT-WIDGET] Error fetching stock orders", {
          error: error.message,
          code: error.code,
          organizationId,
          dataEnvironment,
        });
        throw error;
      }

      logger.info("[SOT-WIDGET] Fetched stock orders", {
        count: stockOrders?.length ?? 0,
        organizationId,
        dataEnvironment,
      });

      // Get stock order shipments with tracking info — non-fatal if this fails
      // Shipments are scoped via org RLS + stock_order_id linkage to already-filtered orders.
      let shipments: Array<{ stock_order_id: string; tracking_number: string | null; vendor_tracking_number: string | null }> | null = null;

      const stockOrderIds = stockOrders?.map(order => order.id) || [];

      if (stockOrderIds.length > 0) {
        const { data: shipmentsData, error: shipmentsError } = await scopedSupabase
          .from("stock_order_shipments")
          .select("stock_order_id, tracking_number, vendor_tracking_number")
          .in("stock_order_id", stockOrderIds);

        if (shipmentsError) {
          // Non-fatal: log warning and continue with stock orders only
          logger.warn("[SOT-WIDGET] Shipments query failed (non-fatal, widget will still show orders)", {
            error: shipmentsError.message,
            code: shipmentsError.code,
            details: (shipmentsError as any).details,
            hint: (shipmentsError as any).hint,
            organizationId,
          });
          shipments = [];
        } else {
          shipments = shipmentsData;
        }
      } else {
        shipments = [];
      }

      logger.info("[SOT-WIDGET] Fetched shipments", {
        count: shipments?.length ?? 0,
        stockOrderCount: stockOrderIds.length,
        organizationId,
      });

      // Return ALL stock orders — do not filter by hasTracking.
      // Orders without tracking will display "Tracking: pending" in the widget.
      const result = stockOrders?.map(stockOrder => {
        const hasDirectTracking = !!(
          stockOrder.tracking_number ||
          stockOrder.tracking_number_2 ||
          stockOrder.vendor_tracking_number ||
          stockOrder.vendor_tracking_number_2
        );

        const hasShipmentTracking = shipments?.some(shipment =>
          shipment.stock_order_id === stockOrder.id &&
          (shipment.tracking_number || shipment.vendor_tracking_number)
        ) ?? false;

        // Check if delivery_status is in a recognized active stage
        const relevantStatuses = new Set(
          DELIVERY_STATUS_OPTIONS
            .filter(s => ['vendor', 'international', 'local', 'complete'].includes(s.stage))
            .map(s => s.value)
        );
        const isRelevantStatus = relevantStatuses.has(stockOrder.delivery_status);

        const hasTracking = hasDirectTracking || hasShipmentTracking || isRelevantStatus;

        return {
          id: stockOrder.id,
          name: stockOrder.name,
          stock_record_number: stockOrder.stock_record_number,
          category: stockOrder.category || 'General',
          vendor: stockOrder.vendor || 'Unknown',
          vendor_store_name: stockOrder.vendor_store_name || null,
          amount: stockOrder.amount || 0,
          delivery_status: stockOrder.delivery_status || 'ordered',
          hasTracking,
          created_at: stockOrder.created_at
        };
      }) || [];

      logger.info("[SOT-WIDGET] Final result", {
        totalOrders: result.length,
        withTracking: result.filter(r => r.hasTracking).length,
        withoutTracking: result.filter(r => !r.hasTracking).length,
        organizationId,
        dataEnvironment,
      });
      return result;
    },
    enabled: !!organizationId,
  });
};
