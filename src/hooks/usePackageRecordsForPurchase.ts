import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PackageShipment {
  id: string;
  shipment_number: number;
  tracking_number: string | null;
  carrier: string | null;
  delivery_status: string;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  units_expected: number | null;
  units_received: number | null;
}

export interface PackageRecordForPurchase {
  id: string;
  package_record_number: string;
  consolidated_status: string;
  total_shipments: number;
  carriers_used: string[];
  notes: string | null;
  created_at: string;
  source_stock_order_id: string;
  source_stock_order: {
    id: string;
    name: string;
    stock_record_number: string;
  } | null;
  individual_shipments: PackageShipment[];
}

export interface UnlinkedPackageRecord {
  id: string;
  package_record_number: string;
  consolidated_status: string;
  total_shipments: number;
  carriers_used: string[];
  stock_order_id: string;
  stock_order_name: string;
  stock_record_number: string;
}

export const usePackageRecordsForPurchase = (purchaseId: string | undefined) => {
  return useQuery({
    queryKey: ["package-records-for-purchase", purchaseId],
    queryFn: async () => {
      if (!purchaseId) return [];

      // Step 1: Get linked stock order IDs from allocations
      const { data: allocations, error: allocError } = await supabase
        .from("allocations")
        .select("stock_order_id")
        .eq("purchase_order_id", purchaseId)
        .not("stock_order_id", "is", null);

      if (allocError) throw allocError;
      if (!allocations || allocations.length === 0) return [];

      const stockOrderIds = [...new Set(allocations.map(a => a.stock_order_id).filter(Boolean))] as string[];
      if (stockOrderIds.length === 0) return [];

      // Step 2: Get package records for these stock orders
      const { data: packages, error: pkgError } = await supabase
        .from("shipment_records")
        .select(`
          id,
          package_record_number,
          consolidated_status,
          total_shipments,
          carriers_used,
          notes,
          created_at,
          source_stock_order_id,
          source_stock_order:stock_orders!source_stock_order_id(
            id,
            name,
            stock_record_number
          )
        `)
        .in("source_stock_order_id", stockOrderIds)
        .eq("is_package_parent", true)
        .order("created_at", { ascending: false });

      if (pkgError) throw pkgError;
      if (!packages || packages.length === 0) return [];

      // Step 3: Get individual shipments for all linked stock orders
      const { data: shipments, error: shipError } = await supabase
        .from("stock_order_shipments")
        .select(`
          id,
          shipment_number,
          tracking_number,
          carrier,
          delivery_status,
          estimated_delivery_date,
          actual_delivery_date,
          units_expected,
          units_received,
          stock_order_id
        `)
        .in("stock_order_id", stockOrderIds)
        .order("shipment_number", { ascending: true });

      if (shipError) throw shipError;

      // Step 4: Enrich packages with their shipments
      const enrichedPackages: PackageRecordForPurchase[] = packages.map(pkg => {
        const stockOrder = Array.isArray(pkg.source_stock_order) 
          ? pkg.source_stock_order[0] 
          : pkg.source_stock_order;
        
        return {
          id: pkg.id,
          package_record_number: pkg.package_record_number,
          consolidated_status: pkg.consolidated_status || "pending",
          total_shipments: pkg.total_shipments || 0,
          carriers_used: pkg.carriers_used || [],
          notes: pkg.notes,
          created_at: pkg.created_at,
          source_stock_order_id: pkg.source_stock_order_id,
          source_stock_order: stockOrder as PackageRecordForPurchase["source_stock_order"],
          individual_shipments: (shipments || [])
            .filter(s => s.stock_order_id === pkg.source_stock_order_id)
            .map(s => ({
              id: s.id,
              shipment_number: s.shipment_number,
              tracking_number: s.tracking_number,
              carrier: s.carrier,
              delivery_status: s.delivery_status || "pending",
              estimated_delivery_date: s.estimated_delivery_date,
              actual_delivery_date: s.actual_delivery_date,
              units_expected: s.units_expected,
              units_received: s.units_received,
            }))
        };
      });

      return enrichedPackages;
    },
    enabled: !!purchaseId,
  });
};

// Hook to get unlinked package records from stock orders that are linked to this purchase
export const useUnlinkedPackagesForPurchase = (purchaseId: string | undefined) => {
  return useQuery({
    queryKey: ["unlinked-packages-for-purchase", purchaseId],
    queryFn: async () => {
      if (!purchaseId) return [];

      // Get linked stock order IDs from allocations
      const { data: allocations, error: allocError } = await supabase
        .from("allocations")
        .select("stock_order_id")
        .eq("purchase_order_id", purchaseId)
        .not("stock_order_id", "is", null);

      if (allocError) throw allocError;
      if (!allocations || allocations.length === 0) return [];

      const stockOrderIds = [...new Set(allocations.map(a => a.stock_order_id).filter(Boolean))] as string[];
      if (stockOrderIds.length === 0) return [];

      // Get all package records from these stock orders
      const { data: packages, error: pkgError } = await supabase
        .from("shipment_records")
        .select(`
          id,
          package_record_number,
          consolidated_status,
          total_shipments,
          carriers_used,
          source_stock_order_id,
          source_stock_order:stock_orders!source_stock_order_id(
            id,
            name,
            stock_record_number
          )
        `)
        .in("source_stock_order_id", stockOrderIds)
        .eq("is_package_parent", true)
        .order("created_at", { ascending: false });

      if (pkgError) throw pkgError;
      if (!packages) return [];

      // Transform to UnlinkedPackageRecord format
      const unlinkedPackages: UnlinkedPackageRecord[] = packages.map(pkg => ({
        id: pkg.id,
        package_record_number: pkg.package_record_number,
        consolidated_status: pkg.consolidated_status || "pending",
        total_shipments: pkg.total_shipments || 0,
        carriers_used: pkg.carriers_used || [],
        stock_order_id: pkg.source_stock_order_id,
        stock_order_name: (pkg.source_stock_order as any)?.name || "Unknown",
        stock_record_number: (pkg.source_stock_order as any)?.stock_record_number || "N/A",
      }));

      return unlinkedPackages;
    },
    enabled: !!purchaseId,
  });
};
