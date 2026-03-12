import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UpdateOutboundDeliveryData {
  trackingNumber?: string;
  carrier?: string;
  deliveryStatus?: string;
  pickupDate?: string;
  orderStatus?: string;
  closureNotes?: string;
  deliveryCompletedAt?: string; // Synced with pickupDate for completion tracking
}

interface UpdateOutboundDeliveryParams {
  purchaseId: string;
  slot: 'primary' | 'secondary' | 'pickup';
  data: UpdateOutboundDeliveryData;
  isDelete?: boolean;
}

// Helper to determine the main delivery_status based on methods
const determineMainDeliveryStatus = (
  slot: 'primary' | 'secondary' | 'pickup',
  data: UpdateOutboundDeliveryData,
  isDelete: boolean,
  currentPurchase?: any
): string | null => {
  if (isDelete) {
    // When deleting, check if other methods exist
    if (slot === 'primary') {
      // If primary deleted but secondary exists, use secondary status
      if (currentPurchase?.tracking_number_2) {
        return currentPurchase.delivery_status_2 || 'pending';
      }
      // No methods left
      return null;
    } else if (slot === 'secondary') {
      // Primary still exists
      if (currentPurchase?.tracking_number) {
        return currentPurchase.delivery_status || 'pending';
      }
      return null;
    } else {
      // Pickup deleted, check courier methods
      if (currentPurchase?.tracking_number) {
        return currentPurchase.delivery_status || 'pending';
      }
      if (currentPurchase?.tracking_number_2) {
        return currentPurchase.delivery_status_2 || 'pending';
      }
      return null;
    }
  }

  // When adding/updating a method
  if (slot === 'primary' || slot === 'secondary') {
    return data.deliveryStatus || 'pending';
  } else if (slot === 'pickup') {
    // For pickup/personal, map status
    if (data.orderStatus === 'ready_for_pickup_delivery') {
      return 'ready_for_pickup';
    }
    if (data.pickupDate) {
      return 'delivered';
    }
    return 'pending';
  }

  return null;
};

export const useUpdateOutboundDelivery = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      purchaseId, 
      slot, 
      data,
      isDelete = false
    }: UpdateOutboundDeliveryParams) => {
      // First get current purchase to check existing methods
      const { data: currentPurchase } = await supabase
        .from('purchases')
        .select('tracking_number, tracking_number_2, delivery_status, delivery_status_2, order_status, delivery_completed_at')
        .eq('id', purchaseId)
        .single();

      let updateData: Record<string, any> = {};
      
      if (isDelete) {
        // Clear the fields for deletion
        if (slot === 'primary') {
          updateData = {
            tracking_number: null,
            carrier: null,
            delivery_status: null,
          };
        } else if (slot === 'secondary') {
          updateData = {
            tracking_number_2: null,
            carrier_2: null,
            delivery_status_2: null,
          };
        } else if (slot === 'pickup') {
          updateData = {
            pickup_date: null,
            order_status: null,
          };
        }
      } else {
        // Normal update
        if (slot === 'primary') {
          updateData = {
            tracking_number: data.trackingNumber,
            carrier: data.carrier,
            delivery_status: data.deliveryStatus,
          };
          // Note: delivery_completed_at is now set explicitly by user via dialogs, not auto-populated
        } else if (slot === 'secondary') {
          updateData = {
            tracking_number_2: data.trackingNumber,
            carrier_2: data.carrier,
            delivery_status_2: data.deliveryStatus,
          };
          // Note: delivery_completed_at is now set explicitly by user via dialogs, not auto-populated
        } else if (slot === 'pickup') {
          updateData = {
            pickup_date: data.pickupDate,
            order_status: data.orderStatus,
          };
          // Sync delivery_completed_at with pickupDate when provided
          if (data.pickupDate) {
            updateData.delivery_completed_at = data.pickupDate;
          }
          // Also allow explicit delivery_completed_at if provided
          if (data.deliveryCompletedAt) {
            updateData.delivery_completed_at = data.deliveryCompletedAt;
            // Sync pickup_date with delivery_completed_at as well
            if (!data.pickupDate) {
              updateData.pickup_date = data.deliveryCompletedAt;
            }
          }
        }
      }
      
      // Add closure notes if provided
      if (data.closureNotes !== undefined) {
        updateData.closure_notes = data.closureNotes;
      }

      // Sync main delivery_status based on method changes
      const newMainStatus = determineMainDeliveryStatus(slot, data, isDelete, currentPurchase);
      if (newMainStatus !== undefined) {
        // Only update if we have a clear status to set
        // Primary slot controls main status, or other slots if no primary
        const isPrimarySlot = slot === 'primary';
        const hasPrimaryMethod = !!currentPurchase?.tracking_number;
        
        if (isPrimarySlot || !hasPrimaryMethod) {
          if (newMainStatus !== null) {
            updateData.delivery_status = newMainStatus;
          }
        }
      }
      
      const { data: result, error } = await supabase
        .from('purchases')
        .update(updateData)
        .eq('id', purchaseId)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase', data.id] });
      
      if (variables.isDelete) {
        toast.success('Delivery method deleted successfully');
      } else {
        toast.success('Delivery method updated successfully');
      }
    },
    onError: (error) => {
      console.error('Failed to update delivery method:', error);
      toast.error('Failed to update delivery method');
    }
  });
};
