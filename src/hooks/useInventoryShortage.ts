import { useMemo } from "react";
import { useProductAvailability } from "./useInventoryCalculations";

interface InventoryShortageResult {
  hasShortage: boolean;
  shortageAmount: number;
  availableStock: number;
  requestedQuantity: number;
  isLoading: boolean;
}

export const useInventoryShortage = (
  productId: string | undefined,
  requestedQuantity: number
): InventoryShortageResult => {
  const { data: availability, isLoading } = useProductAvailability(productId || "");

  const result = useMemo(() => {
    if (!productId || !availability) {
      return {
        hasShortage: false,
        shortageAmount: 0,
        availableStock: 0,
        requestedQuantity,
        isLoading,
      };
    }

    const availableStock = availability.true_available || 0;
    const shortage = Math.max(0, requestedQuantity - availableStock);

    return {
      hasShortage: shortage > 0,
      shortageAmount: shortage,
      availableStock,
      requestedQuantity,
      isLoading,
    };
  }, [productId, availability, requestedQuantity, isLoading]);

  return result;
};
