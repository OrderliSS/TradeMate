import { useState } from "react";
import { useUpdateStockOrderDeliveryStatus } from "./useUpdateStockOrderDeliveryStatus";
import { useUpdateShipmentRecord } from "./useShipmentRecords";
import { toast } from "@/hooks/use-toast";

export interface StatusInconsistency {
  hasInconsistency: boolean;
  stockOrderStatus: string;
  shipmentStatus: string;
  expectedStatus: string;
}

// Check if two statuses are semantically equivalent
const areStatusesEquivalent = (status1: string, status2: string): boolean => {
  if (status1 === status2) return true;
  
  // Define status groups that are equivalent
  const statusGroups = [
    ['in_transit', 'in_international_transit', 'in_transit_with_vendor', 'in_transit_with_local_carrier'],
    ['shipped', 'dispatched_by_vendor', 'passed_to_carrier'],
    ['pending', 'ordered', 'vendor_processing'],
  ];
  
  // Check if both statuses belong to the same group
  return statusGroups.some(group => 
    group.includes(status1) && group.includes(status2)
  );
};

export const useShipmentRecordStatusSync = (stockOrderId?: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const updateStockOrderStatus = useUpdateStockOrderDeliveryStatus();
  const updateShipmentRecord = useUpdateShipmentRecord();

  const mapStockOrderStatusToShipmentStatus = (stockOrderStatus: string | null): string => {
    if (!stockOrderStatus) return "pending";
    
    const statusMap: Record<string, string> = {
      'ordered': 'pending',
      'vendor_processing': 'pending',
      'passed_to_carrier': 'shipped',
      'dispatched_by_vendor': 'shipped',
      'shipped': 'shipped',
      'in_transit': 'in_transit',
      'in_international_transit': 'in_transit',
      'in_transit_with_vendor': 'in_transit',
      'in_transit_with_local_carrier': 'in_transit',
      'out_for_delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'delayed': 'delayed',
      'cancelled': 'cancelled',
    };
    
    return statusMap[stockOrderStatus] || 'pending';
  };

  const checkStatusInconsistency = (
    stockOrderStatus: string | null, 
    shipmentStatus: string
  ): StatusInconsistency | null => {
    if (!stockOrderStatus) return null;
    
    // Use semantic equivalency check instead of exact matching
    const hasInconsistency = !areStatusesEquivalent(stockOrderStatus, shipmentStatus);
    
    return hasInconsistency ? {
      hasInconsistency: true,
      stockOrderStatus: stockOrderStatus,
      shipmentStatus,
      expectedStatus: mapStockOrderStatusToShipmentStatus(stockOrderStatus)
    } : null;
  };

  const syncShipmentFromStockOrder = async (
    shipmentRecordId: string, 
    stockOrderStatus: string
  ) => {
    if (!shipmentRecordId || !stockOrderStatus) return;
    
    setIsLoading(true);
    try {
      const expectedStatus = mapStockOrderStatusToShipmentStatus(stockOrderStatus);
      
      await updateShipmentRecord.mutateAsync({
        id: shipmentRecordId,
        delivery_status: expectedStatus
      });
      
      toast({
        title: "Success",
        description: "Shipment record status synced from stock order",
      });
    } catch (error) {
      console.error("Error syncing shipment from stock order:", error);
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: "Failed to sync shipment status from stock order",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncStockOrderFromShipment = async (
    stockOrderId: string, 
    shipmentStatus: string
  ) => {
    if (!stockOrderId || !shipmentStatus) return;
    
    setIsLoading(true);
    try {
      await updateStockOrderStatus.mutateAsync({
        id: stockOrderId,
        field: 'delivery_status',
        status: shipmentStatus
      });
      
      toast({
        title: "Success",
        description: "Stock order status updated from shipment record",
      });
    } catch (error) {
      console.error("Error syncing stock order from shipment:", error);
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: "Failed to update stock order status from shipment",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    mapStockOrderStatusToShipmentStatus,
    checkStatusInconsistency,
    syncShipmentFromStockOrder,
    syncStockOrderFromShipment,
  };
};