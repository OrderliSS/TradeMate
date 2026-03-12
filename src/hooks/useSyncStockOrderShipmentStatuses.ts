import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useStockOrderShipments } from "./useStockOrderShipments";

// Status hierarchy for determining main stock order status based on shipments
const STATUS_HIERARCHY = {
  'delivered': 100,
  'returned': 90,
  'cancelled': 80,
  'mixed_final_stages': 75,
  'out_for_delivery': 70,
  'in_transit_with_local_carrier': 65,
  'passed_to_carrier': 60,
  'mixed_local_delivery': 58,
  'processing_local_customs': 55,
  'arrived_at_local_airport': 50,
  'in_international_transit': 45,
  'mixed_international_transit': 42,
  'customs_approved': 40,
  'at_vendor_airport': 35,
  'in_transit_with_vendor': 30,
  'dispatched_by_vendor': 25,
  'vendor_processing': 20,
  'mixed_vendor_stage': 18,
  'delayed': 15,
  'ordered': 10,
};

// Define status phases for intelligent mixed-status handling
const STATUS_PHASES = {
  VENDOR: ['ordered', 'vendor_processing', 'dispatched_by_vendor', 'in_transit_with_vendor'],
  INTERNATIONAL: ['at_vendor_airport', 'customs_approved', 'in_international_transit', 'arrived_at_local_airport', 'processing_local_customs'],
  LOCAL: ['passed_to_carrier', 'in_transit_with_local_carrier', 'out_for_delivery'],
  FINAL: ['delivered', 'delivered_backlog', 'resolved'],
  EXCEPTION: ['delayed', 'returned', 'cancelled']
};

// Get the phase of a status
const getStatusPhase = (status: string): string => {
  for (const [phase, statuses] of Object.entries(STATUS_PHASES)) {
    if (statuses.includes(status)) return phase;
  }
  return 'UNKNOWN';
};

// Check if mixed statuses are within normal progression range
const isNormalMixedStatus = (statuses: string[]): boolean => {
  const phases = statuses.map(getStatusPhase);
  const uniquePhases = [...new Set(phases)];
  
  // If all statuses are in the same phase, it's normal
  if (uniquePhases.length <= 1) return true;
  
  // If statuses span adjacent phases, it's normal progression
  const phaseOrder = ['VENDOR', 'INTERNATIONAL', 'LOCAL', 'FINAL'];
  const phaseIndices = uniquePhases.map(phase => phaseOrder.indexOf(phase)).filter(i => i >= 0);
  
  if (phaseIndices.length === 0) return false;
  
  const minPhase = Math.min(...phaseIndices);
  const maxPhase = Math.max(...phaseIndices);
  
  // Allow spanning up to 2 adjacent phases (e.g., INTERNATIONAL + LOCAL)
  return (maxPhase - minPhase) <= 2;
};

// Determine the main stock order status based on all shipment statuses with intelligent mixed-status handling
const determineStockOrderStatus = (shipmentStatuses: string[]): string => {
  if (!shipmentStatuses.length) return 'ordered';
  
  // Filter out empty/null statuses
  const validStatuses = shipmentStatuses.filter(Boolean);
  if (!validStatuses.length) return 'ordered';
  
  // If any shipment is in exception state, check if it's the majority
  const exceptionStatuses = validStatuses.filter(status => STATUS_PHASES.EXCEPTION.includes(status));
  if (exceptionStatuses.length > validStatuses.length / 2) {
    // Return the highest priority exception status
    return exceptionStatuses.sort((a, b) => {
      const priorityA = STATUS_HIERARCHY[a as keyof typeof STATUS_HIERARCHY] || 0;
      const priorityB = STATUS_HIERARCHY[b as keyof typeof STATUS_HIERARCHY] || 0;
      return priorityB - priorityA;
    })[0];
  }
  
  // If all shipments are the same status, use that status
  const uniqueStatuses = [...new Set(validStatuses)];
  if (uniqueStatuses.length === 1) {
    return uniqueStatuses[0];
  }
  
  // Check if mixed statuses are within normal progression
  if (isNormalMixedStatus(validStatuses)) {
    const phases = validStatuses.map(getStatusPhase);
    const uniquePhases = [...new Set(phases)];
    
    // Determine appropriate mixed status based on predominant phase
    if (uniquePhases.includes('FINAL') || uniquePhases.includes('LOCAL')) {
      // Some shipments are in final delivery stages
      if (validStatuses.some(s => ['out_for_delivery', 'delivered'].includes(s))) {
        return 'mixed_final_stages';
      }
      return 'mixed_local_delivery';
    } else if (uniquePhases.includes('INTERNATIONAL')) {
      return 'mixed_international_transit';
    } else if (uniquePhases.includes('VENDOR')) {
      return 'mixed_vendor_stage';
    }
  }
  
  // Fallback: use the most advanced status (existing behavior for problematic cases)
  const sortedStatuses = validStatuses.sort((a, b) => {
    const priorityA = STATUS_HIERARCHY[a as keyof typeof STATUS_HIERARCHY] || 0;
    const priorityB = STATUS_HIERARCHY[b as keyof typeof STATUS_HIERARCHY] || 0;
    return priorityB - priorityA;
  });
  
  return sortedStatuses[0];
};

// Direct sync function that can be called from mutation callbacks
export const syncStockOrderStatusFromShipments = async (stockOrderId: string, queryClient: any) => {
  try {
    // Fetch all shipments for this stock order
    const { data: shipments, error } = await supabase
      .from("stock_order_shipments")
      .select("delivery_status")
      .eq("stock_order_id", stockOrderId);

    if (error) throw error;

    const shipmentStatuses = (shipments as any)?.map((s: any) => s.delivery_status).filter(Boolean) || [];
    const newStockOrderStatus = determineStockOrderStatus(shipmentStatuses);
    
    // Update the main stock order status
    const { error: updateError } = await supabase
      .from("stock_orders")
      .update({ delivery_status: newStockOrderStatus })
      .eq("id", stockOrderId);

    if (updateError) throw updateError;

    // Invalidate queries to refresh UI
    queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
    queryClient.invalidateQueries({ queryKey: ["stock-orders-by-category"] });
    
    return newStockOrderStatus;
  } catch (error) {
    console.error("Failed to sync stock order status:", error);
    throw error;
  }
};

// Direct sync function to update all shipments to match stock order status
export const syncShipmentsFromStockOrderStatus = async (stockOrderId: string, newStatus: string, queryClient: any) => {
  try {
    // Build update payload - include actual_delivery_date when delivered
    const updatePayload: Record<string, any> = { delivery_status: newStatus };
    if (newStatus === 'delivered') {
      updatePayload.actual_delivery_date = new Date().toISOString();
    }

    // Update all shipments for this stock order to match the new status
    const { error: updateError } = await supabase
      .from("stock_order_shipments")
      .update(updatePayload)
      .eq("stock_order_id", stockOrderId);

    if (updateError) throw updateError;

    // Invalidate queries to refresh UI
    queryClient.invalidateQueries({ queryKey: ["stock-order-shipments", stockOrderId] });
    
    return newStatus;
  } catch (error) {
    console.error("Failed to sync shipments from stock order status:", error);
    throw error;
  }
};

// Status mapping function (needed for inconsistency check)
const mapStatusForComparison = (stockOrderStatus: string | null): string => {
  if (!stockOrderStatus) return "ordered";
  
  const statusMap: Record<string, string> = {
    // Basic statuses remain the same
    'ordered': 'ordered',
    'vendor_processing': 'vendor_processing', 
    'dispatched_by_vendor': 'dispatched_by_vendor',
    'in_transit_with_vendor': 'in_transit_with_vendor',
    
    // International transit mappings
    'at_vendor_airport': 'at_vendor_airport',
    'customs_approved': 'customs_approved',
    'in_international_transit': 'in_international_transit',
    'arrived_at_local_airport': 'arrived_at_local_airport',
    'processing_local_customs': 'processing_local_customs',
    
    // Local delivery statuses  
    'passed_to_carrier': 'passed_to_carrier',
    'in_transit_with_local_carrier': 'in_transit_with_local_carrier',
    'out_for_delivery': 'out_for_delivery',
    'delivered': 'delivered',
    
    // Exception statuses
    'delayed': 'delayed',
    'returned': 'returned',
    
    // Legacy mappings for backwards compatibility
    'shipped': 'dispatched_by_vendor',
    'in_transit': 'in_transit_with_local_carrier',
    'cancelled': 'returned',
  };
  
  return statusMap[stockOrderStatus] || 'ordered';
};

// Function to check if stock order and shipment statuses are inconsistent with intelligent analysis
export const checkStatusInconsistency = async (stockOrderId: string) => {
  try {
    // Get main stock order status
    const { data: stockOrder, error: stockOrderError } = await supabase
      .from("stock_orders")
      .select("delivery_status")
      .eq("id", stockOrderId)
      .single();

    if (stockOrderError) throw stockOrderError;

    // Get all shipment statuses
    const { data: shipments, error: shipmentsError } = await supabase
      .from("stock_order_shipments")
      .select("delivery_status")
      .eq("stock_order_id", stockOrderId);

    if (shipmentsError) throw shipmentsError;

    const stockOrderStatus = stockOrder?.delivery_status;
    const shipmentStatuses = shipments?.map((s: any) => s.delivery_status).filter(Boolean) || [];
    
    if (!shipmentStatuses.length) {
      return {
        hasInconsistency: false,
        stockOrderStatus,
        shipmentStatuses: [],
        uniqueShipmentStatuses: [],
        mappedStockOrderStatus: null,
        isNormalMixed: false,
        expectedStatus: null
      };
    }
    
    // Calculate what the stock order status should be based on shipments
    const expectedStockOrderStatus = determineStockOrderStatus(shipmentStatuses);
    
    // Check if current mixed statuses are normal
    const isNormalMixed = isNormalMixedStatus(shipmentStatuses);
    
    // Only consider it an inconsistency if:
    // 1. The statuses are NOT in a normal mixed progression, AND
    // 2. The current stock order status doesn't match the expected status, AND
    // 3. It's not a mixed status that represents normal progression
    const isMixedStatus = stockOrderStatus?.startsWith('mixed_') || false;
    const statusMatches = stockOrderStatus === expectedStockOrderStatus;
    
    // True inconsistency occurs when:
    // - We have an impossible combination (e.g., one delivered, one ordered)
    // - Current status doesn't represent the actual shipment state
    const hasRealInconsistency = !isNormalMixed && !statusMatches && !isMixedStatus;
    
    console.log("Intelligent status inconsistency check:", {
      stockOrderId,
      currentStockOrderStatus: stockOrderStatus,
      expectedStockOrderStatus,
      shipmentStatuses,
      isNormalMixed,
      isMixedStatus,
      statusMatches,
      hasRealInconsistency
    });
    
    return {
      hasInconsistency: hasRealInconsistency,
      stockOrderStatus,
      shipmentStatuses,
      uniqueShipmentStatuses: [...new Set(shipmentStatuses)],
      mappedStockOrderStatus: mapStatusForComparison(stockOrderStatus),
      isNormalMixed,
      expectedStatus: expectedStockOrderStatus
    };
  } catch (error) {
    console.error("Failed to check status inconsistency:", error);
    return {
      hasInconsistency: false,
      stockOrderStatus: null,
      shipmentStatuses: [],
      uniqueShipmentStatuses: [],
      mappedStockOrderStatus: null,
      isNormalMixed: false,
      expectedStatus: null
    };
  }
};

export const useSyncStockOrderShipmentStatuses = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ stockOrderId }: { stockOrderId: string }) => {
      return await syncStockOrderStatusFromShipments(stockOrderId, queryClient);
    },
    onSuccess: (newStatus, { stockOrderId }) => {
      toast({
        title: "Status Synced",
        description: `Main stock order status updated to: ${newStatus}`,
      });
    },
    onError: (error) => {
      console.error("Failed to sync stock order status:", error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync stock order status with shipments",
        variant: "destructive",
      });
    }
  });
};

// Hook for reverse sync - updating all shipments to match stock order status
export const useSyncShipmentsFromStockOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ stockOrderId, status }: { stockOrderId: string; status: string }) => {
      return await syncShipmentsFromStockOrderStatus(stockOrderId, status, queryClient);
    },
    onSuccess: (newStatus) => {
      toast({
        title: "Shipments Synced",
        description: `All shipments updated to status: ${newStatus}`,
      });
    },
    onError: (error) => {
      console.error("Failed to sync shipments:", error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync shipments with stock order status",
        variant: "destructive",
      });
    }
  });
};

// Hook to sync shipment statuses to stock order status after shipment update
export const useShipmentStatusSync = (stockOrderId: string) => {
  const { data: shipments } = useStockOrderShipments(stockOrderId);
  const syncStatuses = useSyncStockOrderShipmentStatuses();
  const syncShipments = useSyncShipmentsFromStockOrder();
  
  const syncStockOrderStatus = () => {
    if (stockOrderId) {
      syncStatuses.mutate({ stockOrderId });
    }
  };

  const syncAllShipments = (status: string) => {
    if (stockOrderId && status) {
      syncShipments.mutate({ stockOrderId, status });
    }
  };

  const checkStatusInconsistency = async () => {
    try {
      const { data: stockOrder } = await supabase
        .from("stock_orders")
        .select("delivery_status, status_approved_at")
        .eq("id", stockOrderId)
        .single();

      const { data: shipments } = await supabase
        .from("stock_order_shipments")
        .select("delivery_status")
        .eq("stock_order_id", stockOrderId);

      if (!stockOrder || !shipments || shipments.length === 0) {
        return { hasInconsistency: false };
      }

      const shipmentStatuses = shipments.map(s => s.delivery_status);
      const uniqueStatuses = Array.from(new Set(shipmentStatuses));
      
      // If status has been approved, don't show as inconsistency
      if (stockOrder.status_approved_at) {
        return { 
          hasInconsistency: false, 
          isApproved: true,
          approvedAt: stockOrder.status_approved_at 
        };
      }

      // Check if all shipments match the stock order status
      const allMatch = shipmentStatuses.every(s => s === stockOrder.delivery_status);
      
      if (allMatch) {
        return { hasInconsistency: false };
      }

      // Check if this is a normal mixed status scenario
      const isNormalMixed = isNormalMixedStatus(shipmentStatuses);
      
      return {
        hasInconsistency: true,
        isNormalMixed,
        stockOrderStatus: stockOrder.delivery_status,
        shipmentStatuses,
        uniqueShipmentStatuses: uniqueStatuses,
        recommendedAction: isNormalMixed ? 'approve' : 'sync'
      };
    } catch (error) {
      console.error("Failed to check status inconsistency:", error);
      return { hasInconsistency: false };
    }
  };
  
  return {
    syncStockOrderStatus,
    syncAllShipments,
    isLoading: syncStatuses.isPending || syncShipments.isPending,
    checkStatusInconsistency
  };
};
