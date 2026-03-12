import { useMemo } from "react";
import { useShipmentRecords, type ShipmentRecord } from "@/hooks/useShipmentRecords";

export interface GroupedShipmentRecord {
  stock_order_id: string;
  stock_order_name: string;
  stock_record_number?: string;
  shipment_count: number;
  individual_records: ShipmentRecord[];
  overall_status: string;
  earliest_ship_date?: string;
  latest_delivery_date?: string;
  carriers: string[];
  tracking_numbers: string[];
}

export const useGroupedShipmentRecords = () => {
  const { data: records = [], isLoading, error } = useShipmentRecords();

  const groupedRecords = useMemo(() => {
    if (!records.length) return [];

    // Group records by source stock order ID, but only include records with proper stock order shipment linkage
    const grouped = records.reduce((acc, record) => {
      const stockOrderId = record.source_stock_order_id;
      // Only include records that have both stock order ID and stock order shipment ID
      if (!stockOrderId || !record.source_stock_order_shipment_id) return acc;

      if (!acc[stockOrderId]) {
        acc[stockOrderId] = {
          stock_order_id: stockOrderId,
          stock_order_name: record.source_stock_order?.name || 'Unknown Stock Order',
          stock_record_number: record.source_stock_order?.stock_record_number,
          shipment_count: 0,
          individual_records: [],
          overall_status: 'pending',
          carriers: [],
          tracking_numbers: []
        };
      }

      acc[stockOrderId].individual_records.push(record);
      acc[stockOrderId].shipment_count++;

      // Collect carriers
      if (record.carrier && !acc[stockOrderId].carriers.includes(record.carrier)) {
        acc[stockOrderId].carriers.push(record.carrier);
      }

      // Collect tracking numbers from stock order shipments
      if (record.stock_order_shipments) {
        record.stock_order_shipments.forEach(shipment => {
          if (shipment.tracking_number && !acc[stockOrderId].tracking_numbers.includes(shipment.tracking_number)) {
            acc[stockOrderId].tracking_numbers.push(shipment.tracking_number);
          }
          if (shipment.carrier && !acc[stockOrderId].carriers.includes(shipment.carrier)) {
            acc[stockOrderId].carriers.push(shipment.carrier);
          }
        });
      }

      return acc;
    }, {} as Record<string, GroupedShipmentRecord>);

    // Calculate overall status and dates for each group
    Object.values(grouped).forEach(group => {
      const statuses = group.individual_records.map(r => r.delivery_status);
      const deliveryDates = group.individual_records
        .map(r => r.estimated_delivery_date)
        .filter(Boolean);

      // Determine overall status
      if (statuses.every(s => s === 'delivered')) {
        group.overall_status = 'delivered';
      } else if (statuses.some(s => s === 'in_transit' || s === 'shipped')) {
        group.overall_status = 'in_transit';
      } else if (statuses.some(s => s === 'delayed')) {
        group.overall_status = 'delayed';
      } else {
        group.overall_status = 'pending';
      }

      // Find earliest and latest dates
      if (deliveryDates.length > 0) {
        const dates = deliveryDates.map(d => new Date(d));
        group.earliest_ship_date = new Date(Math.min(...dates.map(d => d.getTime()))).toISOString();
        group.latest_delivery_date = new Date(Math.max(...dates.map(d => d.getTime()))).toISOString();
      }
    });

    return Object.values(grouped).sort((a, b) => 
      new Date(b.individual_records[0]?.created_at || 0).getTime() - 
      new Date(a.individual_records[0]?.created_at || 0).getTime()
    );
  }, [records]);

  return {
    data: groupedRecords,
    isLoading,
    error
  };
};