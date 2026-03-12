import { ReactNode } from 'react';
import { DashboardPrivacySettings } from "@/components/DashboardPrivacyToggle";
import { useAnalyticsSummary } from "@/hooks/useAnalyticsSummary";
import { useDashboardKeyMetrics } from "@/hooks/useDashboardKeyMetrics";
import { useDashboardStats } from "@/hooks/usePurchases";
import { useVendorStats } from "@/hooks/useVendors";
import { useProducts } from "@/hooks/useProducts";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTopCustomers } from "@/hooks/useDashboardWidgets";
import { HighFidelityMetricCard } from "./HighFidelityMetricCard";
import { useTierStore } from "@/hooks/useTierStore";
import { useDashboardStore } from "@/hooks/useDashboardStore";
import { InventoryLogo } from "./DashboardIcons";

interface DashboardMetricsSectionProps {
  privacySettings: DashboardPrivacySettings;
}

export const DashboardMetricsSection = ({
  privacySettings,
}: DashboardMetricsSectionProps) => {
  const { currentOrganization } = useOrganization();
  const permissions = useTierStore((state) => state.permissions);

  // Read user-configured metric order from localStorage store
  const { selectedIds } = useDashboardKeyMetrics();

  const {
    orderStatusData,
    totalRevenue,
    customerComparison,
    totalCustomers,
    stockOverview,
    isLoading,
  } = useAnalyticsSummary(true);

  const { data: stats } = useDashboardStats(currentOrganization?.id);
  const { data: vendorStats } = useVendorStats();
  const { data: products } = useProducts();

  const renderKeyMetric = (metricId: string) => {

    // Default Props
    let title = "";
    let value: string | number = 0;
    let subValue: ReactNode = null;
    let icon: ReactNode = <InventoryLogo />;
    let accentColor: 'blue' | 'green' = 'blue';
    let isLocked = false;

    if (isLoading) {
      return <HighFidelityMetricCard key={metricId} title="Loading..." value="-" isLoading={true} />;
    }

    switch (metricId) {
      case 'total_sales':
        const totalActive = orderStatusData.reduce((sum, item) => sum + item.value, 0);
        title = "Total Sales";
        value = totalActive;
        icon = <InventoryLogo />;
        subValue = (
          <span className="rounded-full bg-[#10B981]/10 px-2 py-0.5 text-[9px] font-bold text-[#10B981]">
            ${(totalRevenue / 1000).toFixed(1)}K REVENUE
          </span>
        );
        isLocked = !permissions.service_ops_tools;
        break;

      case 'total_customers':
        title = "Total Customers";
        value = totalCustomers;
        icon = <InventoryLogo />;
        const isPositive = customerComparison.isPositive;
        subValue = (
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${isPositive ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-red-500/10 text-red-500'}`}>
            {isPositive ? '+' : ''}{customerComparison.percentChange}% GROWTH
          </span>
        );
        break;

      case 'total_vendors':
        title = "Total Vendors";
        value = vendorStats?.totalVendors || 0;
        icon = <InventoryLogo />;
        break;

      case 'units_in_stock':
        title = "Units in Stock";
        value = stockOverview.categoryBreakdown.reduce((sum, c) => sum + c.available, 0);
        icon = <InventoryLogo />;
        break;

      case 'monthly_orders':
        title = "Monthly Orders";
        value = stats?.monthlyPurchases ?? 0;
        icon = <InventoryLogo />;
        break;

      case 'total_products':
        title = "Product Catalog";
        value = products?.length ?? 0;
        icon = <InventoryLogo />;
        break;

      default:
        return null;
    }

    return (
      <HighFidelityMetricCard
        key={metricId}
        title={title}
        value={value}
        subValue={subValue}
        icon={icon}
        accentColor={accentColor}
        isLocked={isLocked}
      />
    );
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {selectedIds.map(metricId => (
          <div key={metricId} className="w-full">
            {renderKeyMetric(metricId)}
          </div>
        ))}
      </div>
    </div>
  );
};
