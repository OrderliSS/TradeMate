export const useCanonicalStockOrders = () => ({
  data: {
    items: [],
    counts: { pending: 0, inTransit: 0, delivered: 0 }
  },
  isLoading: false
});
