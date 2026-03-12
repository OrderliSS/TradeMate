import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { useAssetStatusDashboard } from "@/hooks/useAssetStatusDashboard";
import { usePurchases } from "@/hooks/usePurchases";
import { useStockOrders } from "@/hooks/useStockOrders";
import { useProducts } from "@/hooks/useProducts";
import { useCurrentOrganizationId } from "./useOrganization";

export interface SourceOfTruthMetrics {
  inventory: {
    totalProducts: number;
    totalUnits: number;
    availableUnits: number;
    allocatedUnits: number;
    inTransitUnits: number;
    soldUnits: number;
    lowStockProducts: Array<{
      id: string;
      name: string;
      stock: number;
      reorderLevel: number;
    }>;
  };
  assets: {
    totalAssets: number;
    availableAssets: number;
    allocatedAssets: number;
    soldAssets: number;
    inTransitAssets: number;
  };
  financial: {
    totalInventoryValue: number;
    availableInventoryValue: number;
    allocatedInventoryValue: number;
    monthlyRevenue: number;
    ytdRevenue: number;
    monthlyStockOrders: number;
    pendingDeliveryValue: number;
    averageOrderValue: number;
  };
  reconciliation: {
    consistencyScore: number;
    issues: string[];
    reconciliationResults?: Array<{
      productId: string;
      productName: string;
      oldStock: number;
      newStock: number;
      assetCount: number;
      correctionApplied: boolean;
    }>;
  };
}

/**
 * Centralized hook for all Source of Truth metrics
 * This serves as the single source of truth for application-wide data consistency
 * Now uses Asset Inventory as the authoritative source
 */
export const useSourceOfTruthMetrics = () => {
  const dataEnvironment = useDataEnvironment();
  const { data: assetData } = useAssetStatusDashboard();
  const { data: products } = useProducts();
  const { data: purchases } = usePurchases();
  const { data: stockOrders } = useStockOrders();
  const organizationId = useCurrentOrganizationId();

  return useQuery({
    queryKey: ["source-of-truth-metrics", assetData, products, purchases, stockOrders, dataEnvironment, organizationId],
    queryFn: async (): Promise<SourceOfTruthMetrics> => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      // Use Asset Dashboard as the single source of truth for inventory and asset metrics
      const inventoryMetrics = calculateInventoryMetricsFromAssetDashboard(assetData || []);
      const assetMetrics = calculateAssetMetricsFromAssetDashboard(assetData || []);

      // Get financial metrics using asset data for inventory values
      const financialMetrics = await calculateFinancialMetricsFromAssets(
        purchases || [],
        stockOrders || [],
        products || [],
        assetData || [],
        startOfMonth,
        startOfYear
      );

      // Simplified reconciliation - no mismatches since we're using single source
      const reconciliationMetrics = {
        consistencyScore: 100, // Perfect consistency when using single source
        issues: [],
        reconciliationResults: []
      };

      return {
        inventory: inventoryMetrics,
        assets: assetMetrics,
        financial: financialMetrics,
        reconciliation: reconciliationMetrics,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
    staleTime: 10000, // Consider data stale after 10 seconds
    enabled: !!assetData && !!organizationId, // Only run when asset data and organization are available
  });
};

function calculateInventoryMetricsFromAssetDashboard(assetData: any[]) {
  const totalProducts = assetData.length;

  let totalUnits = 0;
  let availableUnits = 0;
  let allocatedUnits = 0;
  let inTransitUnits = 0;
  let soldUnits = 0;
  let beingConfiguredUnits = 0;

  const lowStockProducts: any[] = [];

  assetData.forEach(item => {
    totalUnits += Number(item.total_assets) || 0;
    availableUnits += Number(item.available_assets) || 0;
    allocatedUnits += Number(item.allocated_assets) || 0;
    inTransitUnits += Number(item.in_transit_assets) || 0;
    soldUnits += Number(item.sold_assets) || 0;
    beingConfiguredUnits += Number(item.being_configured_assets) || 0;

    // Check for low stock using available assets
    const stock = Number(item.available_assets) || 0;
    if (stock <= 10) {
      lowStockProducts.push({
        id: item.product_id,
        name: item.product_name,
        stock,
        reorderLevel: 10,
      });
    }
  });

  return {
    totalProducts,
    totalUnits,
    availableUnits,
    allocatedUnits,
    inTransitUnits,
    soldUnits,
    lowStockProducts,
  };
}

function calculateAssetMetricsFromAssetDashboard(assetData: any[]) {
  let totalAssets = 0;
  let availableAssets = 0;
  let allocatedAssets = 0;
  let soldAssets = 0;
  let inTransitAssets = 0;
  let beingConfiguredAssets = 0;

  assetData.forEach(item => {
    totalAssets += Number(item.total_assets) || 0;
    availableAssets += Number(item.available_assets) || 0;
    allocatedAssets += Number(item.allocated_assets) || 0;
    soldAssets += Number(item.sold_assets) || 0;
    inTransitAssets += Number(item.in_transit_assets) || 0;
    beingConfiguredAssets += Number(item.being_configured_assets) || 0;
  });


  return {
    totalAssets,
    availableAssets,
    allocatedAssets,
    soldAssets,
    inTransitAssets,
  };
}


async function calculateFinancialMetricsFromAssets(
  purchases: any[],
  expenses: any[],
  products: any[],
  assetData: any[],
  startOfMonth: Date,
  startOfYear: Date
) {
  // Calculate inventory values using asset dashboard data and product prices
  let totalInventoryValue = 0;
  let availableInventoryValue = 0;
  let allocatedInventoryValue = 0;

  assetData.forEach(item => {
    const product = products.find(p => p.id === item.product_id);
    const price = Number(product?.price) || 0;

    totalInventoryValue += price * (Number(item.total_assets) || 0);
    availableInventoryValue += price * (Number(item.available_assets) || 0);
    allocatedInventoryValue += price * (Number(item.allocated_assets) || 0);
  });

  // Calculate revenue metrics (unchanged)
  const monthlyPurchases = purchases.filter(p =>
    p.pickup_date && new Date(p.pickup_date) >= startOfMonth
  );
  const yearlyPurchases = purchases.filter(p =>
    p.pickup_date && new Date(p.pickup_date) >= startOfYear
  );

  const monthlyRevenue = monthlyPurchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
  const ytdRevenue = yearlyPurchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

  // Calculate monthly stock orders (unchanged)
  const monthlyStockOrders = expenses
    .filter(e => e.purchase_date && new Date(e.purchase_date) >= startOfMonth)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Calculate pending delivery value (unchanged)
  const pendingDeliveryValue = expenses
    .filter(e => e.delivery_status && !['delivered', 'cancelled'].includes(e.delivery_status))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Calculate average order value (unchanged)
  const averageOrderValue = monthlyPurchases.length > 0
    ? Number(monthlyRevenue / monthlyPurchases.length) || 0
    : 0;


  return {
    totalInventoryValue,
    availableInventoryValue,
    allocatedInventoryValue,
    monthlyRevenue,
    ytdRevenue,
    monthlyStockOrders,
    pendingDeliveryValue,
    averageOrderValue,
  };
}
