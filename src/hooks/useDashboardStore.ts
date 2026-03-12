import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DashboardState {
    activeMetrics: string[];
    // Classic grid columns
    columnConfig: {
        col_1: string[];
        col_2: string[];
        col_3: string[];
        col_hubs: string[];
        col_intelligence: string[];
    };
    // Modern specific layouts
    modernWorkflowCentre: {
        leftTop: string;
        right: string;
        leftBottom: string | null;
        rightBottom: string | null;
    };
    version: string;
    layoutMode: string;
    rowDensityLimit: number;
    forceBelowFold: boolean;
    pillarModes: {
        col_1: 'full' | 'compact';
        col_2: 'full' | 'compact';
        col_3: 'full' | 'compact';
    };
    swapMetric: (newMetric: string, indexToReplace: number) => void;
    togglePillarMode: (col: 'col_1' | 'col_2' | 'col_3') => void;
    resetToDefault: () => void;
    saveLayoutToDB: (userId: string) => Promise<void>;
    setColumnConfig: (config: { col_1: string[]; col_2: string[]; col_3: string[]; col_hubs: string[]; col_intelligence: string[]; }) => void;
    setModernWorkflowCentre: (config: { leftTop: string; right: string; leftBottom: string | null; rightBottom: string | null }) => void;
}

export const useDashboardStore = create<DashboardState>()(
    persist(
        (set, get) => ({
            activeMetrics: ['total_sales', 'total_customers', 'total_vendors', 'units_in_stock', 'monthly_orders'],
            columnConfig: {
                col_1: ["monthly_calendar", "workspace_operations"],
                col_2: ["sales_ticket_queue", "tasks"],
                col_3: ["stock_order_tracking", "low_stock_alerts"],
                col_hubs: ["recent_activity", "recent_sales"],
                col_intelligence: ["intelligence", "top_products", "top_customers", "monthly_target", "revenue_trend"]
            },
            modernWorkflowCentre: {
                leftTop: 'sales_ticket_queue',
                right: 'monthly_calendar',
                leftBottom: null,
                rightBottom: null,
            },
            version: "7.5", // Bumped version to force sales_ticket_queue in leftTop
            layoutMode: "unified_pillars",
            rowDensityLimit: 12,
            forceBelowFold: true,
            pillarModes: {
                col_1: 'compact',
                col_2: 'compact',
                col_3: 'compact'
            },

            swapMetric: (newMetric, indexToReplace) => {
                const current = [...get().activeMetrics];
                current[indexToReplace] = newMetric;
                set({ activeMetrics: current.slice(0, 5) });
            },

            togglePillarMode: (col) => set((state) => ({
                pillarModes: {
                    ...state.pillarModes,
                    [col]: state.pillarModes[col] === 'full' ? 'compact' : 'full'
                }
            })),

            resetToDefault: () => set({
                activeMetrics: ['total_sales', 'total_customers', 'total_vendors', 'units_in_stock', 'monthly_orders'],
                columnConfig: {
                    col_1: ["monthly_calendar", "workspace_operations"],
                    col_2: ["sales_ticket_queue", "tasks"],
                    col_3: ["stock_order_tracking", "low_stock_alerts"],
                    col_hubs: ["recent_activity", "recent_sales"],
                    col_intelligence: ["intelligence", "top_products", "top_customers", "monthly_target", "revenue_trend"]
                },
                modernWorkflowCentre: {
                    leftTop: 'sales_ticket_queue',
                    right: 'monthly_calendar',
                    leftBottom: null,
                    rightBottom: null,
                },
                version: "7.5",
                layoutMode: "unified_pillars",
                rowDensityLimit: 12,
                forceBelowFold: true,
                pillarModes: {
                    col_1: 'compact',
                    col_2: 'compact',
                    col_3: 'compact'
                },
            }),

            saveLayoutToDB: async (userId) => {
                const state = get();
                const prefs = {
                    dashboard_prefs: {
                        dashboard_layout: {
                            version: state.version,
                            performance_index: {
                                active_slots: state.activeMetrics.slice(0, 5),
                                slot_cap: 5
                            },
                            operations_control: {
                                layout_mode: state.layoutMode,
                                column_config: state.columnConfig,
                                modern_workflow_centre: state.modernWorkflowCentre,
                                row_density_limit: state.rowDensityLimit,
                                pillar_modes: state.pillarModes
                            },
                            force_below_fold: state.forceBelowFold
                        }
                    }
                };

                console.log("[DEBUG] saveLayoutToDB Payload:", JSON.stringify(prefs, null, 2));

                try {
                    // Coordinates with profiles table backend schema
                    await fetch(`/api/users/${userId}/preferences`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(prefs)
                    });
                } catch (error) {
                    console.error("Layout sync failed:", error);
                }
            },

            setColumnConfig: (config) => set({ columnConfig: config }),

            setModernWorkflowCentre: (config) => {
                console.log("[DEBUG] Personalizer setting modernWorkflowCentre:", config);
                set({ modernWorkflowCentre: config });
            }
        }),
        {
            name: 'orderli-dashboard-layout',
            merge: (persistedState: any, currentState) => {
                console.log("[DEBUG] Zustand Merge - PersistedState:", persistedState);
                const merged = { ...currentState, ...persistedState };

                // Unified ID migration map (camelCase -> snake_case)
                const idMap: Record<string, string> = {
                    'calendar': 'monthly_calendar',
                    'pendingTasks': 'workspace_operations',
                    'salesQueue': 'sales_ticket_queue',
                    'stockOrderTracking': 'stock_order_tracking',
                    'queueActions': 'tasks',
                    'lowStockAlerts': 'low_stock_alerts',
                    'upcomingDeadlines': 'upcoming_deadlines',
                    'jeopardyManagement': 'jeopardy_management',
                    'teamRoster': 'team_roster',
                    'recentActivity': 'recent_activity',
                    'recentSales': 'recent_sales',
                    'topProducts': 'top_products',
                    'topCustomers': 'top_customers',
                    'quickActions': 'quick_actions',
                    'revenueChart': 'revenue_trend'
                };

                const migrateIds = (ids: string[]) => ids.map(id => idMap[id] || id);

                if (merged.columnConfig) {
                    merged.columnConfig = {
                        col_1: migrateIds(merged.columnConfig.col_1 || []),
                        col_2: migrateIds(merged.columnConfig.col_2 || []),
                        col_3: migrateIds(merged.columnConfig.col_3 || []),
                        col_hubs: migrateIds(merged.columnConfig.col_hubs || []),
                        col_intelligence: migrateIds(merged.columnConfig.col_intelligence || [])
                    };
                }

                if (merged.modernWorkflowCentre) {
                    merged.modernWorkflowCentre = {
                        leftTop: idMap[merged.modernWorkflowCentre.leftTop] || merged.modernWorkflowCentre.leftTop,
                        right: idMap[merged.modernWorkflowCentre.right] || merged.modernWorkflowCentre.right,
                        leftBottom: merged.modernWorkflowCentre.leftBottom ? (idMap[merged.modernWorkflowCentre.leftBottom] || merged.modernWorkflowCentre.leftBottom) : null,
                        rightBottom: merged.modernWorkflowCentre.rightBottom ? (idMap[merged.modernWorkflowCentre.rightBottom] || merged.modernWorkflowCentre.rightBottom) : null
                    };
                }
                // Version mismatch = reset/migrate layout
                if (merged.version !== "7.5") {
                    merged.version = "7.5";
                    merged.columnConfig = currentState.columnConfig;
                    merged.pillarModes = currentState.pillarModes;
                    // Force sales_ticket_queue into leftTop on version bump
                    merged.modernWorkflowCentre = {
                        leftTop: 'sales_ticket_queue',
                        right: merged.modernWorkflowCentre?.right || 'monthly_calendar',
                        leftBottom: merged.modernWorkflowCentre?.leftBottom || null,
                        rightBottom: merged.modernWorkflowCentre?.rightBottom || null,
                    };
                }

                merged.columnConfig = {
                    col_1: merged.columnConfig?.col_1 || ["monthly_calendar", "workspace_operations"],
                    col_2: merged.columnConfig?.col_2 || ["sales_ticket_queue", "tasks"],
                    col_3: merged.columnConfig?.col_3 || ["stock_order_tracking", "low_stock_alerts"],
                    col_hubs: merged.columnConfig?.col_hubs || ["recent_activity", "recent_sales"],
                    col_intelligence: merged.columnConfig?.col_intelligence || ["intelligence", "top_products", "top_customers", "monthly_target", "revenue_trend"],
                };

                // Self-healing: migrate intelligence-related cards from col_hubs to col_intelligence
                const intelligenceIds = ['intelligence', 'top_products', 'top_customers'];
                const misplacedIntel = merged.columnConfig.col_hubs.filter((id: string) => intelligenceIds.includes(id));
                if (misplacedIntel.length > 0) {
                    merged.columnConfig.col_hubs = merged.columnConfig.col_hubs.filter((id: string) => !intelligenceIds.includes(id));
                    merged.columnConfig.col_intelligence = [
                        ...merged.columnConfig.col_intelligence,
                        ...misplacedIntel.filter((id: string) => !merged.columnConfig.col_intelligence.includes(id))
                    ];
                }

                // Migrate analytics cards from workflow columns to col_intelligence
                const analyticsIds = ['top_products', 'top_customers'];
                for (const col of ['col_1', 'col_2', 'col_3'] as const) {
                    const misplaced = merged.columnConfig[col].filter((id: string) => analyticsIds.includes(id));
                    if (misplaced.length > 0) {
                        merged.columnConfig[col] = merged.columnConfig[col].filter((id: string) => !analyticsIds.includes(id));
                        merged.columnConfig.col_intelligence = [
                            ...merged.columnConfig.col_intelligence,
                            ...misplaced.filter((id: string) => !merged.columnConfig.col_intelligence.includes(id))
                        ];
                    }
                }

                return merged;
            },
        }
    )
);
