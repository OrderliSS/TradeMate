import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDataEnvironment } from "@/hooks/useSandbox";

export interface AllocationDetail {
  id: string;
  productId: string;
  assetId: string;
  assetTag?: string;
  customerName?: string;
  customerContact?: string;
  purchaseOrderId?: string;
  orderNumber?: string;
  orderStatus?: string;
  orderTotal?: number;
  pickupDate?: string;
  mainProductName?: string;
  mainProductDeliveryStatus?: string;
  allocationStatus: 'allocated' | 'ready' | 'waiting_hardware' | 'in_progress';
  allocationContext: string;
  notes?: string;
  allocatedAt: string;
}

export interface AllocationSummary {
  totalAllocated: number;
  readyForDelivery: number;
  waitingForHardware: number;
  inProgress: number;
  details: AllocationDetail[];
}

export const useAllocationDetails = (productId?: string) => {
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ["allocation-details", productId, dataEnvironment],
    queryFn: async () => {
      let query = supabase
        .from("allocations")
        .select(`
          id,
          asset_id,
          product_id,
          allocated_at,
          notes,
          status,
          asset:asset_management!inner(
            id,
            asset_tag,
            status as asset_status
          ),
          purchase_order:purchases!allocations_purchase_order_id_fkey(
            id,
            quantity,
            receipt_number,
            total_amount,
            order_status,
            pickup_date,
            customer:customers!purchases_customer_id_fkey(
              name,
              phone,
              email
            ),
            product:products!purchases_product_id_fkey(
              name
            )
          )
        `)
        .eq("status", "allocated")
        .eq("data_environment", dataEnvironment)
        .order("allocated_at", { ascending: false });

      if (productId) {
        query = query.eq("product_id", productId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const allocationDetails: AllocationDetail[] = (data || []).map((allocation: any) => {
        const customer = allocation.purchase_order?.customer;
        const product = allocation.purchase_order?.product;
        const order = allocation.purchase_order;
        
        // Determine allocation status based on order status and context
        let allocationStatus: AllocationDetail['allocationStatus'] = 'allocated';
        let allocationContext = 'Allocated to order';
        
        if (order) {
          switch (order.order_status) {
            case 'ready_for_pickup':
              allocationStatus = 'ready';
              allocationContext = 'Ready for pickup/delivery';
              break;
            case 'in_transit':
              allocationStatus = 'in_progress';
              allocationContext = 'Order in transit';
              break;
            case 'delivered':
              allocationStatus = 'ready';
              allocationContext = 'Ready for final delivery';
              break;
            case 'pending':
            case 'confirmed':
              // Check if this is a battery allocated to a hardware order
              if (product && product.name.toLowerCase().includes('battery')) {
                allocationStatus = 'ready';
                allocationContext = 'Batteries ready, awaiting hardware';
              } else {
                allocationStatus = 'waiting_hardware';
                allocationContext = 'Waiting for hardware arrival';
              }
              break;
            default:
              allocationStatus = 'allocated';
              allocationContext = 'Allocated to order';
          }
        }

        return {
          id: allocation.id,
          productId: allocation.product_id,
          assetId: allocation.asset_id,
          assetTag: allocation.asset?.asset_tag,
          customerName: customer?.name,
          customerContact: customer?.phone || customer?.email,
          purchaseOrderId: order?.id,
          orderNumber: order?.receipt_number,
          orderStatus: order?.order_status,
          orderTotal: order?.total_amount,
          pickupDate: order?.pickup_date,
          mainProductName: product?.name,
          allocationStatus,
          allocationContext,
          notes: allocation.notes,
          allocatedAt: allocation.allocated_at,
        };
      });

      // Calculate summary
      const summary: AllocationSummary = {
        totalAllocated: allocationDetails.length,
        readyForDelivery: allocationDetails.filter(d => d.allocationStatus === 'ready').length,
        waitingForHardware: allocationDetails.filter(d => d.allocationStatus === 'waiting_hardware').length,
        inProgress: allocationDetails.filter(d => d.allocationStatus === 'in_progress').length,
        details: allocationDetails,
      };

      return summary;
    },
    enabled: !!productId,
  });
};

export const useAllocationDetailsByCustomer = (productId?: string) => {
  const { data: allocationSummary } = useAllocationDetails(productId);
  
  if (!allocationSummary) return {};

  // Group allocations by customer
  const byCustomer: Record<string, {
    customerName: string;
    customerContact?: string;
    orders: Record<string, {
      orderNumber?: string;
      orderStatus?: string;
      orderTotal?: number;
      pickupDate?: string;
      mainProductName?: string;
      allocations: AllocationDetail[];
    }>;
    totalAllocated: number;
  }> = {};

  allocationSummary.details.forEach(detail => {
    const customerKey = detail.customerName || 'Unassigned';
    const orderKey = detail.purchaseOrderId || 'no-order';

    if (!byCustomer[customerKey]) {
      byCustomer[customerKey] = {
        customerName: detail.customerName || 'Unassigned Customer',
        customerContact: detail.customerContact,
        orders: {},
        totalAllocated: 0,
      };
    }

    if (!byCustomer[customerKey].orders[orderKey]) {
      byCustomer[customerKey].orders[orderKey] = {
        orderNumber: detail.orderNumber,
        orderStatus: detail.orderStatus,
        orderTotal: detail.orderTotal,
        pickupDate: detail.pickupDate,
        mainProductName: detail.mainProductName,
        allocations: [],
      };
    }

    byCustomer[customerKey].orders[orderKey].allocations.push(detail);
    byCustomer[customerKey].totalAllocated++;
  });

  return byCustomer;
};