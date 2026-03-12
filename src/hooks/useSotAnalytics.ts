import { useQuery } from "@tanstack/react-query";
import { useSourceOfTruthMetrics } from "./useSourceOfTruthMetrics";
import { subDays, eachDayOfInterval, format } from "date-fns";

/**
 * Analytics time range type
 */
type TimeRange = "7d" | "30d" | "90d";

/**
 * Analytics data point interface
 */
export interface SotAnalyticsDataPoint {
  date: string;
  totalAssets: number;
  availableAssets: number;
  allocatedAssets: number;
  inTransitAssets: number;
  soldAssets: number;
  consistencyScore: number;
}

/**
 * SOT Analytics result interface
 */
export interface SotAnalyticsResult {
  metrics: SotAnalyticsDataPoint[];
  trends: {
    assetGrowth: number;
    availabilityChange: number;
    allocationChange: number;
    avgConsistencyScore: number;
  };
  reconciliationStats: {
    totalChecks: number;
    successfulChecks: number;
    failedChecks: number;
    successRate: number;
  };
}

/**
 * Hook for SOT Analytics
 * 
 * Provides historical metrics, trend analysis, and reconciliation statistics
 * for the Source of Truth system over a specified time range.
 * 
 * @param timeRange - Time period to analyze ("7d", "30d", "90d")
 * @returns Analytics data with metrics, trends, and reconciliation stats
 * 
 * @example
 * ```tsx
 * const { data, isLoading } = useSotAnalytics("30d");
 * 
 * if (data) {
 *   console.log("Asset growth:", data.trends.assetGrowth);
 *   console.log("Success rate:", data.reconciliationStats.successRate);
 * }
 * ```
 */
export const useSotAnalytics = (timeRange: TimeRange) => {
  const { data: currentMetrics } = useSourceOfTruthMetrics();

  return useQuery({
    queryKey: ["sot-analytics", timeRange],
    queryFn: async (): Promise<SotAnalyticsResult> => {
      // Calculate days from time range
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const now = new Date();
      const startDate = subDays(now, days);
      
      // Generate date range
      const dateRange = eachDayOfInterval({ start: startDate, end: now });
      
      // For now, generate simulated historical data based on current metrics
      // In production, this would fetch from a time-series database
      const metrics: SotAnalyticsDataPoint[] = dateRange.map((date, index) => {
        const progress = index / dateRange.length;
        const variance = Math.sin(index / 2) * 0.1; // Add some realistic variance
        
        return {
          date: format(date, "MMM dd"),
          totalAssets: Math.floor((currentMetrics?.assets.totalAssets || 0) * (0.85 + progress * 0.15 + variance)),
          availableAssets: Math.floor((currentMetrics?.assets.availableAssets || 0) * (0.8 + progress * 0.2 + variance)),
          allocatedAssets: Math.floor((currentMetrics?.assets.allocatedAssets || 0) * (0.9 + progress * 0.1 + variance)),
          inTransitAssets: Math.floor((currentMetrics?.assets.inTransitAssets || 0) * (0.85 + progress * 0.15 + variance)),
          soldAssets: Math.floor((currentMetrics?.assets.soldAssets || 0) * (0.7 + progress * 0.3)),
          consistencyScore: Math.min(100, 95 + Math.random() * 5), // High consistency scores
        };
      });

      // Calculate trends
      const firstWeek = metrics.slice(0, 7);
      const lastWeek = metrics.slice(-7);
      
      const avgFirst = (arr: SotAnalyticsDataPoint[], key: keyof SotAnalyticsDataPoint) => 
        arr.reduce((sum, m) => sum + Number(m[key]), 0) / arr.length;
      
      const assetGrowth = ((avgFirst(lastWeek, 'totalAssets') - avgFirst(firstWeek, 'totalAssets')) / avgFirst(firstWeek, 'totalAssets')) * 100;
      const availabilityChange = avgFirst(lastWeek, 'availableAssets') - avgFirst(firstWeek, 'availableAssets');
      const allocationChange = avgFirst(lastWeek, 'allocatedAssets') - avgFirst(firstWeek, 'allocatedAssets');
      const avgConsistencyScore = metrics.reduce((sum, m) => sum + m.consistencyScore, 0) / metrics.length;

      // Reconciliation statistics (simulated for now)
      const totalChecks = metrics.length * 3; // Assume 3 checks per day
      const successfulChecks = Math.floor(totalChecks * 0.98); // 98% success rate
      const failedChecks = totalChecks - successfulChecks;
      const successRate = (successfulChecks / totalChecks) * 100;

      return {
        metrics,
        trends: {
          assetGrowth: Number(assetGrowth.toFixed(2)),
          availabilityChange: Number(availabilityChange.toFixed(0)),
          allocationChange: Number(allocationChange.toFixed(0)),
          avgConsistencyScore: Number(avgConsistencyScore.toFixed(2)),
        },
        reconciliationStats: {
          totalChecks,
          successfulChecks,
          failedChecks,
          successRate: Number(successRate.toFixed(2)),
        },
      };
    },
    enabled: !!currentMetrics,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
};
