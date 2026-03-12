export const useCanonicalPurchases = () => ({
  data: {
    items: [
      { id: '1', created_at: new Date().toISOString(), total_amount: 1500, customer: { name: 'John Doe' }, normalized_status: 'ordered', order_status: 'Ordered' },
      { id: '2', created_at: new Date().toISOString(), total_amount: 2500, customer: { name: 'Jane Smith' }, normalized_status: 'sold', order_status: 'Sold' },
    ],
    counts: { total: 2 }
  },
  isLoading: false
});
