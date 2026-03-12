import { useCallback } from "react";

type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error";

interface HapticFeedback {
  trigger: (style?: HapticStyle) => void;
  isSupported: boolean;
}

/**
 * Hook to trigger haptic feedback on supported devices
 * Uses the Vibration API with patterns appropriate for each feedback type
 */
export function useHapticFeedback(): HapticFeedback {
  const isSupported = typeof navigator !== "undefined" && "vibrate" in navigator;

  const trigger = useCallback((style: HapticStyle = "light") => {
    if (!isSupported) return;

    // Vibration patterns in milliseconds
    const patterns: Record<HapticStyle, number | number[]> = {
      light: 10,
      medium: 25,
      heavy: 50,
      success: [10, 50, 10], // Short-pause-short
      warning: [25, 50, 25], // Medium-pause-medium
      error: [50, 100, 50, 100, 50], // Strong pattern for errors
    };

    try {
      navigator.vibrate(patterns[style]);
    } catch (e) {
      // Silently fail if vibration fails
      console.debug("Haptic feedback failed:", e);
    }
  }, [isSupported]);

  return { trigger, isSupported };
}

export default useHapticFeedback;
