import { useStockOrder } from "./useStockOrders";
import { useStockOrderShipments } from "./useStockOrderShipments";
import { usePackageRecords } from "./usePackageRecords";
import { getCurrentEnvironment } from "@/lib/environment-utils";

/**
 * Unified hook that batches all stock order related queries
 * Provides single loading state and efficient refetch pattern
 */
export const useStockOrderDetails = (stockOrderId: string) => {
  // Parallel queries with optimized settings
  const stockOrderQuery = useStockOrder(stockOrderId);
  const shipmentsQuery = useStockOrderShipments(stockOrderId);
  const packageRecordsQuery = usePackageRecords(stockOrderId);

  // Combined loading state - only true if any query is loading
  const isLoading = 
    stockOrderQuery.isLoading || 
    shipmentsQuery.isLoading || 
    packageRecordsQuery.isLoading;

  // Combined error state - first error encountered
  const error = 
    stockOrderQuery.error || 
    shipmentsQuery.error || 
    packageRecordsQuery.error;

  // Unified refetch function
  const refetchAll = () => {
    stockOrderQuery.refetch();
    shipmentsQuery.refetch();
    packageRecordsQuery.refetch();
  };

  return {
    // Data
    stockOrder: stockOrderQuery.data,
    shipments: shipmentsQuery.data || [],
    packageRecords: packageRecordsQuery.data || [],
    
    // State
    isLoading,
    error,
    
    // Individual query states (for granular control if needed)
    stockOrderLoading: stockOrderQuery.isLoading,
    shipmentsLoading: shipmentsQuery.isLoading,
    packageRecordsLoading: packageRecordsQuery.isLoading,
    
    // Actions
    refetchAll,
    refetchStockOrder: stockOrderQuery.refetch,
    refetchShipments: shipmentsQuery.refetch,
    refetchPackageRecords: packageRecordsQuery.refetch,
  };
};
