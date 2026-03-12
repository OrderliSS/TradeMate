import React, { useMemo } from "react";
import { DashboardPrivacyToggle } from "./DashboardPrivacyToggle";
import { 
  useAnalyticsSummary, 
  useDashboardKeyMetrics, 
  usePurchases, 
  useVendors, 
  useProducts, 
  useDashboardWidgets,
  useTierStore,
  useDashboardStore
} from "@/hooks/useDashboardMocks";
import { HighFidelityMetricCard } from "./HighFidelityMetricCard";
import { LayoutDashboard, Users, ShoppingCart, Package } from "./DashboardIcons";
import { useOrganization } from "@/contexts/OrganizationContext";

export const DashboardMetricsSection = () => {
    const { currentOrganization } = useOrganization();
    
    // Using mock hooks
    const { metrics: analyticsMetrics, loading: analyticsLoading } = useAnalyticsSummary();
    const { metrics: keyMetrics, loading: keyMetricsLoading } = useDashboardKeyMetrics();
    const { purchases, loading: purchasesLoading } = usePurchases();
    const { vendors, loading: vendorsLoading } = useVendors();
    const { products, loading: productsLoading } = useProducts();
    const { widgets, loading: widgetsLoading } = useDashboardWidgets();

    const stats = useMemo(() => [
        {
            title: "Total Revenue",
            value: "$124,592",
            change: "+12.5%",
            trend: "up" as const,
            icon: LayoutDashboard,
            color: "blue" as const
        },
        {
            title: "Active Customers",
            value: "1,284",
            change: "+8.2%",
            trend: "up" as const,
            icon: Users,
            color: "purple" as const
        },
        {
            title: "Pending Orders",
            value: "42",
            change: "-3.1%",
            trend: "down" as const,
            icon: ShoppingCart,
            color: "blue" as const
        },
        {
            title: "Inventory Value",
            value: "$84,200",
            change: "+5.4%",
            trend: "up" as const,
            icon: Package,
            color: "purple" as const
        }
    ], []);

    return (
        <section className="dashboard-metrics-grid">
            <div className="metrics-header">
                <h2 className="section-title">Performance Overview</h2>
                <DashboardPrivacyToggle />
            </div>
            <div className="metrics-cards">
                {stats.map((stat, index) => (
                    <HighFidelityMetricCard
                        key={index}
                        title={stat.title}
                        value={stat.value}
                        change={stat.change}
                        isPositive={stat.trend === "up"}
                        icon={stat.icon}
                        accentColor={stat.color}
                        isLoading={false}
                    />
                ))}
            </div>
        </section>
    );
};
