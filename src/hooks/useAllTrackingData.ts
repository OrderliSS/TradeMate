import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isAfter, format } from "date-fns";
import { isPermissionError } from "@/lib/error-utils";

interface TrackingItem {
  tracking_number: string;
  carrier?: string;
  delivery_status: string;
  record_type: string;
  record_id: string;
  record_name: string;
  record_number?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  notes?: string;
  tracking_type: 'primary' | 'secondary' | 'vendor' | 'vendor_secondary' | 'shipment' | 'vendor_shipment';
  tracking_id: string; // Unique identifier for this specific tracking entry
  shipment_id?: string; // For shipment-based tracking
  parent_stock_order_id?: string; // For linking shipments back to their parent stock order
  updated_at?: string; // Track last update time for real-time display
}

interface TrackingStats {
  total: number;
  inTransit: number;
  delivered: number;
  delayed: number;
  dueToday: number;
  overdue: number;
}

interface AllTrackingData {
  items: TrackingItem[];
  stats: TrackingStats;
  hasPermission?: boolean;
}

export const useAllTrackingData = () => {
  return useQuery({
    queryKey: ["all-tracking-data"],
    queryFn: async (): Promise<AllTrackingData> => {
      const trackingItems: TrackingItem[] = [];
      
      
      
      try {
        // Fetch stock order tracking data
        const { data: stockOrders, error: stockOrderError } = await supabase
          .from("stock_orders")
          .select(`
            id,
            name,
            stock_record_number,
            tracking_number,
            carrier,
            delivery_status,
            estimated_delivery_date,
            actual_delivery_date,
            notes,
            tracking_number_2,
            carrier_2,
            delivery_status_2,
            estimated_delivery_date_2,
            actual_delivery_date_2,
            vendor_tracking_number,
            vendor_tracking_number_2,
            vendor_carrier
          `);

        if (stockOrderError) {
          console.error("Error fetching stock orders:", stockOrderError);
          
          // If it's a permission error, return empty data gracefully
          if (isPermissionError(stockOrderError)) {
            return {
              items: [],
              stats: {
                total: 0,
                inTransit: 0,
                delivered: 0,
                delayed: 0,
                dueToday: 0,
                overdue: 0,
              },
              hasPermission: false,
            };
          }
          
          throw stockOrderError;
        }

        

        // Process stock order tracking data
        stockOrders?.forEach((stockOrder) => {
          // Primary tracking
          if (stockOrder.tracking_number) {
            trackingItems.push({
              tracking_number: stockOrder.tracking_number,
              carrier: stockOrder.carrier,
              delivery_status: stockOrder.delivery_status || 'ordered',
              record_type: 'stock_order',
              record_id: stockOrder.id,
              record_name: stockOrder.name,
              record_number: stockOrder.stock_record_number,
              estimated_delivery_date: stockOrder.estimated_delivery_date,
              actual_delivery_date: stockOrder.actual_delivery_date,
              notes: stockOrder.notes,
              tracking_type: 'primary',
              tracking_id: `${stockOrder.id}-primary`,
            });
          }

          // Secondary tracking
          if (stockOrder.tracking_number_2) {
            trackingItems.push({
              tracking_number: stockOrder.tracking_number_2,
              carrier: stockOrder.carrier_2,
              delivery_status: stockOrder.delivery_status_2 || 'ordered',
              record_type: 'stock_order',
              record_id: stockOrder.id,
              record_name: `${stockOrder.name} (Secondary)`,
              record_number: stockOrder.stock_record_number,
              estimated_delivery_date: stockOrder.estimated_delivery_date_2,
              actual_delivery_date: stockOrder.actual_delivery_date_2,
              notes: stockOrder.notes,
              tracking_type: 'secondary',
              tracking_id: `${stockOrder.id}-secondary`,
            });
          }

          // Vendor tracking (primary)
          if (stockOrder.vendor_tracking_number) {
            trackingItems.push({
              tracking_number: stockOrder.vendor_tracking_number,
              carrier: stockOrder.vendor_carrier,
              delivery_status: stockOrder.delivery_status || 'ordered',
              record_type: 'stock_order',
              record_id: stockOrder.id,
              record_name: `${stockOrder.name} (Vendor)`,
              record_number: stockOrder.stock_record_number,
              estimated_delivery_date: stockOrder.estimated_delivery_date,
              actual_delivery_date: stockOrder.actual_delivery_date,
              notes: stockOrder.notes,
              tracking_type: 'vendor',
              tracking_id: `${stockOrder.id}-vendor`,
            });
          }

          // Vendor tracking (secondary)
          if (stockOrder.vendor_tracking_number_2) {
            trackingItems.push({
              tracking_number: stockOrder.vendor_tracking_number_2,
              carrier: stockOrder.vendor_carrier,
              delivery_status: stockOrder.delivery_status_2 || 'ordered',
              record_type: 'stock_order',
              record_id: stockOrder.id,
              record_name: `${stockOrder.name} (Vendor Secondary)`,
              record_number: stockOrder.stock_record_number,
              estimated_delivery_date: stockOrder.estimated_delivery_date_2,
              actual_delivery_date: stockOrder.actual_delivery_date_2,
              notes: stockOrder.notes,
              tracking_type: 'vendor_secondary',
              tracking_id: `${stockOrder.id}-vendor-secondary`,
            });
          }
        });

        // Fetch stock order shipments tracking data
        const { data: stockOrderShipments, error: shipmentsError } = await supabase
          .from("stock_order_shipments")
          .select(`
            id,
            tracking_number,
            carrier,
            delivery_status,
            estimated_delivery_date,
            actual_delivery_date,
            notes,
            shipment_number,
            vendor_tracking_number,
            vendor_carrier,
            stock_order_id,
            updated_at
          `);

        if (shipmentsError) {
          console.error("Error fetching stock_order_shipments:", shipmentsError);
        } else {
          
        }

        // Get stock order details for shipments
        const stockOrderIds = stockOrderShipments?.map(s => s.stock_order_id).filter(Boolean) || [];
        const stockOrderMap: Record<string, any> = {};
        
        if (stockOrderIds.length > 0) {
          const { data: stockOrderDetails } = await supabase
            .from("stock_orders")
            .select("id, name, stock_record_number")
            .in("id", stockOrderIds);
          
          stockOrderDetails?.forEach(so => {
            stockOrderMap[so.id] = so;
          });
        }

        // Process stock order shipments
        stockOrderShipments?.forEach((shipment) => {
          const stockOrder = stockOrderMap[shipment.stock_order_id];
          if (!stockOrder) return;

          if (shipment.tracking_number) {
            trackingItems.push({
              tracking_number: shipment.tracking_number,
              carrier: shipment.carrier,
              delivery_status: shipment.delivery_status || 'ordered',
              record_type: 'stock_order_shipment',
              record_id: shipment.id,
              record_name: `${stockOrder.name} (Shipment ${shipment.shipment_number})`,
              record_number: stockOrder.stock_record_number,
              estimated_delivery_date: shipment.estimated_delivery_date,
              actual_delivery_date: shipment.actual_delivery_date,
              notes: shipment.notes,
              tracking_type: 'shipment',
              tracking_id: `${shipment.id}-shipment`,
              shipment_id: shipment.id,
              parent_stock_order_id: stockOrder.id,
              updated_at: shipment.updated_at,
            });
          }

          // Vendor tracking from shipments
          if (shipment.vendor_tracking_number) {
            trackingItems.push({
              tracking_number: shipment.vendor_tracking_number,
              carrier: shipment.vendor_carrier,
              delivery_status: shipment.delivery_status || 'ordered',
              record_type: 'stock_order_shipment',
              record_id: shipment.id,
              record_name: `${stockOrder.name} (Vendor Shipment ${shipment.shipment_number})`,
              record_number: stockOrder.stock_record_number,
              estimated_delivery_date: shipment.estimated_delivery_date,
              actual_delivery_date: shipment.actual_delivery_date,
              notes: shipment.notes,
              tracking_type: 'vendor_shipment',
              tracking_id: `${shipment.id}-vendor-shipment`,
              shipment_id: shipment.id,
              parent_stock_order_id: stockOrder.id,
              updated_at: shipment.updated_at,
            });
          }
        });

        // Fetch delivery tracking data
        const { data: deliveries, error: deliveriesError } = await supabase
          .from("deliveries")
          .select(`
            id,
            tracking_number,
            carrier,
            status,
            eta,
            po_id,
            expense_id
          `)
          .not("tracking_number", "is", null);

        if (deliveriesError) {
          console.error("Error fetching deliveries:", deliveriesError);
        } else {
          
        }

        deliveries?.forEach((item) => {
          // Complete null and type safety for delivery processing
          if (!item || typeof item !== 'object') return;
          
          // Use type assertion with strict null checking
          const delivery = item as Record<string, any>;
          if (!delivery.tracking_number) return;
          
          // Safe property extraction with fallbacks
          const deliveryId = String(delivery.id || 'unknown');
          const trackingNumber = String(delivery.tracking_number || '');
          const carrier = String(delivery.carrier || '');
          const status = String(delivery.status || '');
          const eta = String(delivery.eta || '');
          
          trackingItems.push({
            tracking_number: trackingNumber,
            carrier: carrier,
            delivery_status: status,
            record_type: 'delivery',
            record_id: deliveryId,
            record_name: `Delivery ${trackingNumber}`,
            estimated_delivery_date: eta,
            notes: '',
            tracking_type: 'primary',
            tracking_id: `${deliveryId}-delivery`,
          });
        });

        

        // Calculate stats
        const today = new Date();
        const stats: TrackingStats = {
          total: trackingItems.length,
          inTransit: trackingItems.filter(item => 
            ['shipped', 'in_transit'].includes(item.delivery_status)
          ).length,
          delivered: trackingItems.filter(item => 
            item.delivery_status === 'delivered'
          ).length,
          delayed: trackingItems.filter(item => 
            item.delivery_status === 'delayed'
          ).length,
          dueToday: trackingItems.filter(item => 
            item.estimated_delivery_date && 
            format(new Date(item.estimated_delivery_date), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
          ).length,
          overdue: trackingItems.filter(item => 
            item.estimated_delivery_date && 
            isAfter(today, new Date(item.estimated_delivery_date)) &&
            item.delivery_status !== 'delivered'
          ).length,
        };

        

        return {
          items: trackingItems.sort((a, b) => {
            // Sort by estimated delivery date, then by record name
            if (a.estimated_delivery_date && b.estimated_delivery_date) {
              return new Date(a.estimated_delivery_date).getTime() - new Date(b.estimated_delivery_date).getTime();
            }
            if (a.estimated_delivery_date) return -1;
            if (b.estimated_delivery_date) return 1;
            return a.record_name.localeCompare(b.record_name);
          }),
          stats,
          hasPermission: true,
        };
      } catch (error) {
        console.error("Error in useAllTrackingData:", error);
        
        // Return empty data for permission errors instead of throwing
        if (isPermissionError(error)) {
          return {
            items: [],
            stats: {
              total: 0,
              inTransit: 0,
              delivered: 0,
              delayed: 0,
              dueToday: 0,
              overdue: 0,
            },
            hasPermission: false,
          };
        }
        
        throw error;
      }
    },
  });
};