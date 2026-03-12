export type PurchaseStatus = 'all' | 'ordered' | 'configuring' | 'sold' | 'delivered';

export interface CanonicalPurchase {
  id: string;
  member?: { full_name: string; employment_id?: string };
  customer?: { name: string };
  ticket_number?: string;
  product?: { name: string };
  total_amount?: number;
  normalized_status: string;
  order_status: string;
  created_at: string;
}

export const useCanonicalPurchases = (params?: any) => ({
  data: {
    items: [] as CanonicalPurchase[],
    counts: { total: 0 }
  },
  isLoading: false
});
