import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface AssetConfirmation {
  assetId: string;
  confirmed: boolean;
  quantity: number;
}

export interface ReceiptConfirmationInput {
  shipmentId: string;
  unitsReceived: number;
  notes?: string;
  assetConfirmations?: AssetConfirmation[];
  stockOrderId?: string;
  actualDeliveryDate?: string;
}

export interface ReceiptConfirmationResult {
  shipmentId: string;
  unitsReceived: number;
  receiptStatus: 'pending' | 'partial' | 'complete' | 'over_received';
  assetsUpdated: number;
}

const calculateReceiptStatus = (expected: number, received: number): string => {
  if (received === 0) return 'pending';
  if (received < expected) return 'partial';
  if (received === expected) return 'complete';
  return 'over_received';
};

export const useConfirmShipmentReceipt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReceiptConfirmationInput): Promise<ReceiptConfirmationResult> => {
      const { shipmentId, unitsReceived, notes, assetConfirmations, stockOrderId, actualDeliveryDate } = input;

      // 1. Get current shipment to calculate status
      const { data: shipment, error: fetchError } = await supabase
        .from('stock_order_shipments')
        .select('units_expected, stock_order_id')
        .eq('id', shipmentId)
        .single();

      if (fetchError) throw fetchError;

      const unitsExpected = shipment.units_expected || 0;
      const receiptStatus = calculateReceiptStatus(unitsExpected, unitsReceived);

      // 2. Update the shipment with receipt information
      const { error: updateError } = await supabase
        .from('stock_order_shipments')
        .update({
          units_received: unitsReceived,
          receipt_status: receiptStatus,
          receipt_confirmed_at: new Date().toISOString(),
          notes: notes ? `${notes}` : undefined,
          actual_delivery_date: actualDeliveryDate || null,
        })
        .eq('id', shipmentId);

      if (updateError) throw updateError;

      // 3. Update asset statuses if confirmations provided
      let assetsUpdated = 0;
      if (assetConfirmations && assetConfirmations.length > 0) {
        for (const confirmation of assetConfirmations) {
          const newStatus = confirmation.confirmed ? 'available' : 'missing';
          
          // Update shipment_assets status
          const { error: assetError } = await supabase
            .from('shipment_assets')
            .update({
              confirmed_quantity: confirmation.quantity,
              confirmed_at: confirmation.confirmed ? new Date().toISOString() : null,
              status: confirmation.confirmed ? 'confirmed' : 'missing',
            })
            .eq('stock_order_shipment_id', shipmentId)
            .eq('asset_id', confirmation.assetId);

          if (assetError) {
            console.error('Failed to update shipment asset:', assetError);
            continue;
          }

          // Update the actual asset status
          const { error: assetMgmtError } = await supabase
            .from('asset_management')
            .update({
              status: newStatus,
              shipment_arrival_confirmed: confirmation.confirmed,
            })
            .eq('id', confirmation.assetId);

          if (!assetMgmtError) {
            assetsUpdated++;
          }
        }
      }

      // 4. Update package-level totals if stock order has package records
      const effectiveStockOrderId = stockOrderId || shipment.stock_order_id;
      if (effectiveStockOrderId) {
        await updatePackageRecordTotals(effectiveStockOrderId);
      }

      // 5. Auto-consolidate package record if all shipments are delivered
      if (effectiveStockOrderId) {
        try {
          const { data: allShipments } = await supabase
            .from('stock_order_shipments')
            .select('delivery_status')
            .eq('stock_order_id', effectiveStockOrderId);

          const allDelivered = allShipments?.length > 0 &&
            allShipments.every(s => s.delivery_status === 'delivered');

          if (allDelivered) {
            const { error: pkgError } = await supabase
              .from('shipment_records')
              .update({ consolidated_status: 'delivered' })
              .eq('source_stock_order_id', effectiveStockOrderId)
              .eq('is_package_parent', true);

            if (pkgError) {
              console.error('Failed to consolidate package status:', pkgError);
            }
          }
        } catch (err) {
          console.error('Failed to check/consolidate package status:', err);
        }
      }

      return {
        shipmentId,
        unitsReceived,
        receiptStatus: receiptStatus as ReceiptConfirmationResult['receiptStatus'],
        assetsUpdated,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['stock-order-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['shipment-assets'] });
      queryClient.invalidateQueries({ queryKey: ['package-records'] });
      queryClient.invalidateQueries({ queryKey: ['shipment-records'] });
      queryClient.invalidateQueries({ queryKey: ['asset-management'] });
      
      toast({
        title: "Receipt Confirmed",
        description: `${result.unitsReceived} units received. Status: ${result.receiptStatus.replace('_', ' ')}`,
      });
    },
    onError: (error) => {
      console.error('Receipt confirmation failed:', error);
      toast({
        title: "Error",
        description: "Failed to confirm receipt. Please try again.",
        variant: "destructive",
      });
    },
  });
};

// Helper function to update package record totals
async function updatePackageRecordTotals(stockOrderId: string) {
  try {
    // Get all shipments for this stock order
    const { data: shipments, error: shipmentsError } = await supabase
      .from('stock_order_shipments')
      .select('units_expected, units_received, receipt_status')
      .eq('stock_order_id', stockOrderId);

    if (shipmentsError || !shipments) return;

    const totalExpected = shipments.reduce((sum, s) => sum + (s.units_expected || 0), 0);
    const totalReceived = shipments.reduce((sum, s) => sum + (s.units_received || 0), 0);
    const overallStatus = calculateReceiptStatus(totalExpected, totalReceived);

    // Update the package record
    await supabase
      .from('shipment_records')
      .update({
        total_units_expected: totalExpected,
        total_units_received: totalReceived,
        receipt_status: overallStatus,
      })
      .eq('source_stock_order_id', stockOrderId);

  } catch (error) {
    console.error('Failed to update package record totals:', error);
  }
}

// Hook to set expected units for a shipment
export const useSetShipmentExpectedUnits = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shipmentId, unitsExpected }: { shipmentId: string; unitsExpected: number }) => {
      const { error } = await supabase
        .from('stock_order_shipments')
        .update({ units_expected: unitsExpected })
        .eq('id', shipmentId);

      if (error) throw error;
      return { shipmentId, unitsExpected };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-order-shipments'] });
    },
  });
};

// Hook to get shipment receipt status
export const useShipmentReceiptStatus = (shipmentId: string | undefined) => {
  // This would be a useQuery if needed for real-time status
  // For now, the data comes from the shipment query itself
  return null;
};
