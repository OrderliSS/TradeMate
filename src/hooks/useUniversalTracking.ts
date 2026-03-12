import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { mapDeliveryToInternalStatus, isDeliveredStatus } from "@/lib/vendor-status-mapping";

interface UpdateTrackingData {
  recordId: string;
  recordType: 'stock_order' | 'purchase' | 'delivery' | 'stock_order_shipment';
  trackingNumber: string;
  carrier?: string;
  deliveryStatus?: string;
  localHandoverStatus?: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  passedToLocalDate?: string;
  notes?: string;
  trackingType?: 'primary' | 'secondary' | 'vendor' | 'vendor_secondary' | 'shipment' | 'vendor_shipment';
  shipmentId?: string;
  localTrackingNumber?: string;
  localCarrier?: string;
}

interface CreateTrackingData {
  recordId: string;
  recordType: 'stock_order';
  trackingNumber: string;
  carrier?: string;
  deliveryStatus?: string;
  localHandoverStatus?: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  passedToLocalDate?: string;
  notes?: string;
  trackingType: 'additional_vendor' | 'additional_local';
}

export const useUpdateTracking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateTrackingData) => {
      const {
        recordId,
        recordType,
        trackingNumber,
        carrier,
        deliveryStatus,
        estimatedDeliveryDate,
        actualDeliveryDate,
        passedToLocalDate,
        notes
      } = data;

      let tableName: string;
      let updateData: any = {};

      switch (recordType) {
        case 'stock_order':
          tableName = 'stock_orders';
          // Determine which fields to update based on tracking type
          switch (data.trackingType) {
            case 'primary':
              updateData = {
                tracking_number: trackingNumber,
                carrier,
                delivery_status: deliveryStatus,
                estimated_delivery_date: estimatedDeliveryDate || null,
                actual_delivery_date: actualDeliveryDate || null,
                notes
              };
              break;
            case 'secondary':
              updateData = {
                tracking_number_2: trackingNumber,
                carrier_2: carrier,
                delivery_status_2: deliveryStatus,
                estimated_delivery_date_2: estimatedDeliveryDate || null,
                actual_delivery_date_2: actualDeliveryDate || null,
                notes
              };
              break;
            case 'vendor':
            updateData = {
              vendor_tracking_number: trackingNumber,
              vendor_carrier: carrier,
              delivery_status: deliveryStatus,
              estimated_delivery_date: estimatedDeliveryDate || null,
              actual_delivery_date: actualDeliveryDate || null,
              notes
            };
              break;
            case 'vendor_secondary':
              updateData = {
                vendor_tracking_number_2: trackingNumber,
                vendor_carrier: carrier,
                delivery_status_2: deliveryStatus,
                estimated_delivery_date_2: estimatedDeliveryDate || null,
                actual_delivery_date_2: actualDeliveryDate || null,
                notes
              };
              break;
            default:
              // Default to primary tracking
              updateData = {
                tracking_number: trackingNumber,
                carrier,
                delivery_status: deliveryStatus,
                estimated_delivery_date: estimatedDeliveryDate || null,
                actual_delivery_date: actualDeliveryDate || null,
                notes
              };
          }
          break;
        case 'stock_order_shipment':
          tableName = 'stock_order_shipments';
          // For shipments with vendor tracking, handle dual tracking system
          if (data.trackingType === 'vendor_shipment') {
            updateData = {
              vendor_tracking_number: trackingNumber,
              vendor_carrier: carrier,
              delivery_status: deliveryStatus,
              estimated_delivery_date: estimatedDeliveryDate || null,
              actual_delivery_date: actualDeliveryDate || null,
              passed_to_local_date: passedToLocalDate || null,
              local_handover_status: data.localHandoverStatus || (deliveryStatus === 'passed_to_local' ? 'in_progress' : 'pending'),
              notes
            };
            
            // Add local tracking if provided
            if (data.localTrackingNumber) {
              updateData.tracking_number = data.localTrackingNumber;
              updateData.carrier = data.localCarrier;
            }
          } else {
            // Standard shipment tracking or updating local tracking after handover
            updateData = {
              tracking_number: trackingNumber,
              carrier,
              delivery_status: deliveryStatus,
              estimated_delivery_date: estimatedDeliveryDate || null,
              actual_delivery_date: actualDeliveryDate || null,
              local_handover_status: data.localHandoverStatus || 'pending',
              notes
            };
            
            // If local tracking fields are provided separately, use them
            if (data.localTrackingNumber) {
              updateData.tracking_number = data.localTrackingNumber;
              updateData.carrier = data.localCarrier;
            }
          }
          break;

        case 'delivery':
          tableName = 'deliveries';
          updateData = {
            tracking_number: trackingNumber,
            carrier,
            status: deliveryStatus,
            eta: estimatedDeliveryDate || null
          };
          break;

        case 'purchase':
          // For now, we'll need to check if purchases table has tracking fields
          tableName = 'purchases';
          updateData = {
            tracking_number: trackingNumber,
            carrier,
            delivery_status: deliveryStatus,
            estimated_delivery_date: estimatedDeliveryDate || null,
            actual_delivery_date: actualDeliveryDate || null,
            notes
          };
          break;

        default:
          throw new Error(`Unsupported record type: ${recordType}`);
      }

      let result;
      let error;

      if (recordType === 'stock_order_shipment' && data.shipmentId) {
        // Update specific shipment
        const response = await supabase
          .from(tableName as any)
          .update(updateData)
          .eq('id', data.shipmentId)
          .select()
          .single();
        result = response.data;
        error = response.error;
      } else {
        // Update main record
        const response = await supabase
          .from(tableName as any)
          .update(updateData)
          .eq('id', recordId)
          .select()
          .single();
        result = response.data;
        error = response.error;
      }

      if (error) throw error;
      return result;
    },

    onSuccess: async (data, variables) => {
      // Invalidate all tracking-related queries
      queryClient.invalidateQueries({ queryKey: ["all-tracking-data"] });
      queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-order-shipments"] });
      queryClient.invalidateQueries({ queryKey: ["shipment-details"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });

      // Auto-sync vendor_internal_status when stock_order delivery status changes
      if (variables.recordType === 'stock_order' && variables.deliveryStatus) {
        try {
          const mappedInternal = mapDeliveryToInternalStatus(variables.deliveryStatus);
          const syncUpdates: Record<string, any> = {};
          
          if (mappedInternal) {
            syncUpdates.vendor_internal_status = mappedInternal;
          }
          if (isDeliveredStatus(variables.deliveryStatus)) {
            syncUpdates.actual_delivery_date = new Date().toISOString();
          }

          if (Object.keys(syncUpdates).length > 0) {
            await supabase
              .from('stock_orders')
              .update(syncUpdates)
              .eq('id', variables.recordId);
            console.log('Auto-synced vendor status from tracking dialog:', syncUpdates);
            queryClient.invalidateQueries({ queryKey: ['stock-orders', variables.recordId] });
          }
        } catch (err) {
          console.error('Failed to sync vendor internal status:', err);
        }
      }

      // Auto-consolidate package record when a shipment is marked delivered
      if (
        variables.recordType === 'stock_order_shipment' &&
        variables.deliveryStatus &&
        isDeliveredStatus(variables.deliveryStatus) &&
        data?.stock_order_id
      ) {
        try {
          const { data: allShipments } = await supabase
            .from('stock_order_shipments')
            .select('delivery_status')
            .eq('stock_order_id', data.stock_order_id);

          const allDelivered = allShipments?.length > 0 &&
            allShipments.every((s: any) => isDeliveredStatus(s.delivery_status));

          if (allDelivered) {
            // Consolidate package record
            const { error: pkgError } = await supabase
              .from('shipment_records')
              .update({ consolidated_status: 'delivered' } as any)
              .eq('source_stock_order_id', data.stock_order_id)
              .eq('is_package_parent', true);

            if (pkgError) {
              console.error('Failed to consolidate package status:', pkgError);
            }

            // Also sync parent stock order's vendor_internal_status and actual_delivery_date
            await supabase
              .from('stock_orders')
              .update({
                vendor_internal_status: 'completed',
                actual_delivery_date: new Date().toISOString(),
              })
              .eq('id', data.stock_order_id);

            queryClient.invalidateQueries({ queryKey: ['package-records'] });
            queryClient.invalidateQueries({ queryKey: ['shipment-records'] });
            queryClient.invalidateQueries({ queryKey: ['stock-orders', data.stock_order_id] });
            console.log('All shipments delivered - synced parent stock order to completed');
          }
        } catch (err) {
          console.error('Failed to check/consolidate package status:', err);
        }
      }

      toast({
        title: "Success",
        description: `Tracking information updated for ${variables.recordType}`,
      });
    },

    onError: (error: any) => {
      console.error("Failed to update tracking:", error);
      toast({
        title: "Error",
        description: "Failed to update tracking information",
        variant: "destructive",
      });
    },
  });
};

export const useCreateAdditionalTracking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTrackingData) => {
      // First, get the highest shipment_number for this expense
      const { data: existingShipments, error: queryError } = await supabase
        .from('stock_order_shipments')
        .select('shipment_number')
        .eq('stock_order_id', data.recordId)
        .order('shipment_number', { ascending: false })
        .limit(1);

      if (queryError) throw queryError;

      // Calculate the next shipment number
      const nextShipmentNumber = existingShipments && existingShipments.length > 0 
        ? existingShipments[0].shipment_number + 1 
        : 1;

      const { data: result, error } = await supabase
        .from('stock_order_shipments')
        .insert({
          stock_order_id: data.recordId,
          tracking_number: data.trackingType === 'additional_local' ? data.trackingNumber : null,
          carrier: data.trackingType === 'additional_local' ? data.carrier : null,
          delivery_status: data.deliveryStatus || 'ordered',
          local_handover_status: data.localHandoverStatus || 'pending',
          estimated_delivery_date: data.estimatedDeliveryDate || null,
          actual_delivery_date: data.actualDeliveryDate || null,
          passed_to_local_date: data.passedToLocalDate || null,
          notes: data.notes,
          shipment_number: nextShipmentNumber,
          ...(data.trackingType === 'additional_vendor' && {
            vendor_tracking_number: data.trackingNumber,
            vendor_carrier: data.carrier,
            tracking_number: null,
            carrier: null,
          })
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["all-tracking-data"] });
      queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-order-shipments"] });

      toast({
        title: "Success",
        description: `Additional tracking added for ${variables.recordType}`,
      });
    },

    onError: (error: any) => {
      console.error("Failed to create additional tracking:", error);
      toast({
        title: "Error",
        description: "Failed to add additional tracking information",
        variant: "destructive",
      });
    },
  });
};

export const useBulkUpdateTracking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateTrackingData[]) => {
      const results = [];
      
      for (const update of updates) {
        const { recordId, recordType, ...updateData } = update;
        
        let tableName: string;
        let formattedData: any = {};

        switch (recordType) {
          case 'stock_order':
            tableName = 'stock_orders';
            formattedData = {
              tracking_number: updateData.trackingNumber,
              carrier: updateData.carrier,
              delivery_status: updateData.deliveryStatus,
              estimated_delivery_date: updateData.estimatedDeliveryDate || null,
              actual_delivery_date: updateData.actualDeliveryDate || null,
              notes: updateData.notes
            };
            break;
          case 'stock_order_shipment':
            tableName = 'stock_order_shipments';
            formattedData = {
              tracking_number: updateData.trackingNumber,
              carrier: updateData.carrier,
              delivery_status: updateData.deliveryStatus,
              estimated_delivery_date: updateData.estimatedDeliveryDate || null,
              actual_delivery_date: updateData.actualDeliveryDate || null,
              notes: updateData.notes
            };
            break;
          default:
            continue;
        }

        const { data, error } = await supabase
          .from(tableName as any)
          .update(formattedData)
          .eq('id', recordId)
          .select()
          .single();

        if (error) throw error;
        results.push(data);
      }

      return results;
    },

    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["all-tracking-data"] });
      queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-order-shipments"] });

      toast({
        title: "Success",
        description: `${variables.length} tracking records updated successfully`,
      });
    },

    onError: (error: any) => {
      console.error("Failed to bulk update tracking:", error);
      toast({
        title: "Error",
        description: "Failed to update tracking records",
        variant: "destructive",
      });
    },
  });
};