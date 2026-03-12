export interface CanonicalStockOrder {
  id: string;
  vendor_store_name?: string;
  vendor?: string;
  stock_record_number?: string;
  name?: string;
  amount?: number;
  delivery_status: string;
  isTransit: boolean;
  isDelivered: boolean;
  created_at: string;
  hasTracking: boolean;
}

export const useCanonicalStockOrders = () => ({
  data: {
    items: [] as CanonicalStockOrder[],
    counts: { pending: 0, inTransit: 0, delivered: 0 }
  },
  isLoading: false
});
