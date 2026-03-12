export const useCanonicalStockOrders = () => ({
  data: {
    items: [
      { id: 'so1', created_at: new Date().toISOString(), amount: 5000, vendor: 'Vendor A', stock_record_number: 'SO-001', delivery_status: 'in_transit', isTransit: true },
      { id: 'so2', created_at: new Date().toISOString(), amount: 1200, vendor: 'Vendor B', stock_record_number: 'SO-002', delivery_status: 'delivered', isDelivered: true },
    ],
    counts: { pending: 1, inTransit: 1, delivered: 1 }
  },
  isLoading: false
});
