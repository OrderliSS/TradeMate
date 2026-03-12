import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface InconsistentOrder {
  id: string;
  order_status: string;
  completed_at: string;
  customer_name: string;
  product_name: string;
}

interface StuckAllocation {
  id: string;
  status: string;
  purchase_id: string;
  asset_id: string | null;
}

interface ScanResults {
  inconsistentOrders: InconsistentOrder[];
  stuckAllocations: StuckAllocation[];
}

interface ReconciliationResult {
  ordersFixed: number;
  allocationsFixed: number;
  assetsUpdated: number;
}

export const useOrderReconciliation = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);

  const scanForIssues = async (): Promise<ScanResults> => {
    setIsScanning(true);
    try {
      // Find orders with completed_at set but order_status not 'complete'
      const { data: inconsistentOrders, error: ordersError } = await supabase
        .from("purchases")
        .select(`
          id,
          order_status,
          completed_at,
          customers!purchases_customer_id_fkey(name),
          products!purchases_product_id_fkey(name)
        `)
        .not("completed_at", "is", null)
        .neq("order_status", "complete");

      if (ordersError) throw ordersError;

      // Find allocations that are still 'allocated' for completed orders
      const { data: stuckAllocations, error: allocationsError } = await supabase
        .from("allocations")
        .select(`
          id,
          status,
          purchase_order_id,
          asset_id,
          purchases!allocations_purchase_order_id_fkey(completed_at, order_status)
        `)
        .eq("status", "allocated");

      if (allocationsError) throw allocationsError;

      // Filter to only allocations for completed orders
      const filteredAllocations = (stuckAllocations || []).filter(
        (a: any) => a.purchases?.completed_at !== null
      );

      const results: ScanResults = {
        inconsistentOrders: (inconsistentOrders || []).map((o: any) => ({
          id: o.id,
          order_status: o.order_status,
          completed_at: o.completed_at,
          customer_name: o.customers?.name || "Unknown",
          product_name: o.products?.name || "Unknown",
        })),
        stuckAllocations: filteredAllocations.map((a: any) => ({
          id: a.id,
          status: a.status,
          purchase_id: a.purchase_order_id,
          asset_id: a.asset_id,
        })),
      };

      setScanResults(results);
      return results;
    } catch (error) {
      logger.error("Error scanning for issues", { error });
      toast.error("Failed to scan for issues");
      throw error;
    } finally {
      setIsScanning(false);
    }
  };

  const reconcileOrders = async (): Promise<ReconciliationResult> => {
    if (!scanResults) {
      throw new Error("No scan results available. Run scan first.");
    }

    setIsFixing(true);
    try {
      let ordersFixed = 0;
      let allocationsFixed = 0;
      let assetsUpdated = 0;

      // Fix inconsistent orders - update order_status to 'complete'
      if (scanResults.inconsistentOrders.length > 0) {
        const orderIds = scanResults.inconsistentOrders.map((o) => o.id);
        const { error: updateOrdersError } = await supabase
          .from("purchases")
          .update({ 
            order_status: "complete", 
            last_modified_at: new Date().toISOString() 
          })
          .in("id", orderIds);

        if (updateOrdersError) throw updateOrdersError;
        ordersFixed = orderIds.length;
      }

      // Fix stuck allocations - update status to 'fulfilled'
      if (scanResults.stuckAllocations.length > 0) {
        const allocationIds = scanResults.stuckAllocations.map((a) => a.id);
        const { error: updateAllocationsError } = await supabase
          .from("allocations")
          .update({ 
            status: "fulfilled", 
            updated_at: new Date().toISOString() 
          })
          .in("id", allocationIds);

        if (updateAllocationsError) throw updateAllocationsError;
        allocationsFixed = allocationIds.length;

        // Update linked assets to 'sold'
        const assetIds = scanResults.stuckAllocations
          .map((a) => a.asset_id)
          .filter(Boolean) as string[];

        if (assetIds.length > 0) {
          const { error: updateAssetsError } = await supabase
            .from("asset_management")
            .update({ 
              status: "sold", 
              updated_at: new Date().toISOString() 
            })
            .in("id", assetIds);

          if (updateAssetsError) throw updateAssetsError;
          assetsUpdated = assetIds.length;
        }
      }

      // Clear scan results after successful fix
      setScanResults(null);

      toast.success(
        `Reconciliation complete: ${ordersFixed} orders, ${allocationsFixed} allocations, ${assetsUpdated} assets updated`
      );

      return { ordersFixed, allocationsFixed, assetsUpdated };
    } catch (error) {
      logger.error("Error reconciling orders", { error });
      toast.error("Failed to reconcile orders");
      throw error;
    } finally {
      setIsFixing(false);
    }
  };

  const clearResults = () => {
    setScanResults(null);
  };

  return {
    isScanning,
    isFixing,
    scanResults,
    scanForIssues,
    reconcileOrders,
    clearResults,
  };
};
