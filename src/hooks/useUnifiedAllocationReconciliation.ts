// Placeholder hook for allocation reconciliation
export const useUnifiedAllocationReconciliation = (purchaseId?: string) => {
  return {
    data: null,
    isLoading: false,
    error: null
  };
};

export const useReconcileAllocations = () => {
  return {
    mutate: () => {},
    isPending: false
  };
};