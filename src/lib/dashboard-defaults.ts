import {
  Calendar, Users, ClipboardList, Truck, CheckSquare, AlertTriangle,
  Clock, AlertOctagon, Zap, Activity, ShoppingCart, TrendingUp, Package, Target
} from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

export interface DashboardCard {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: 'operations' | 'hubs' | 'analytics' | 'intelligence';
  size: 'small' | 'medium' | 'large' | 'wide' | 'tall';
  gridClass?: string;
  requiredTier?: 'basic' | 'service-ops';
  supportedIn: ('classic' | 'modern')[];
  routeClassic?: string;
  routeModern?: string;
}

export const AVAILABLE_CARDS: DashboardCard[] = [
  // Workflow Center (Operations)
  { id: 'monthly_calendar', title: 'Monthly Calendar', description: 'View appointments and tasks', icon: Calendar, category: 'operations', size: 'large', gridClass: 'lg:col-span-2', supportedIn: ['classic', 'modern'], routeClassic: '/workspace-operations/calendar', routeModern: '/workspace-operations/calendar' },
  { id: 'workspace_operations', title: 'Team Rostering', description: 'Roster and schedule management', icon: Users, category: 'operations', size: 'medium', supportedIn: ['classic', 'modern'], routeClassic: '/workspace-operations/roster' },
  { id: 'sales_ticket_queue', title: 'Sales Ticket Queue', description: 'Active sales tickets with status tracking', icon: ClipboardList, category: 'operations', size: 'medium', supportedIn: ['classic', 'modern'], routeClassic: '/workspace-operations/sales-queue', routeModern: '/workspace-operations/sales-queue' },
  { id: 'stock_order_tracking', title: 'Stock Order Status & Tracking', description: 'Monitor stock order delivery statuses', icon: Truck, category: 'operations', size: 'medium', supportedIn: ['classic', 'modern'], routeClassic: '/inventory' },
  { id: 'tasks', title: 'Workspace Operations', description: 'Your active jobs and operations', icon: CheckSquare, category: 'operations', size: 'medium', supportedIn: ['classic', 'modern'], routeClassic: '/workspace-operations' },
  { id: 'low_stock_alerts', title: 'Stock Alerts', description: 'All inventory stock levels and alerts', icon: AlertTriangle, category: 'operations', size: 'medium', supportedIn: ['classic', 'modern'], routeClassic: '/inventory/alerts' },
  { id: 'upcoming_deadlines', title: 'Upcoming Deadlines', description: 'Upcoming tasks and appointments', icon: Clock, category: 'operations', size: 'small', supportedIn: ['classic', 'modern'], routeClassic: '/workspace-operations/tasks' },
  { id: 'jeopardy_management', title: 'Jeopardy Management', description: 'Records needing urgent attention', icon: AlertOctagon, category: 'operations', size: 'medium', supportedIn: ['classic', 'modern'], routeClassic: '/workspace-operations' },
  { id: 'team_roster', title: 'Detailed Team Roster', description: 'Daily shift and on-call schedule', icon: Users, category: 'operations', size: 'medium', supportedIn: ['classic', 'modern'], routeClassic: '/workspace-operations/roster' },
  { id: 'quick_actions', title: 'Quick Actions', description: 'Customizable navigation shortcuts', icon: Zap, category: 'operations', size: 'small', supportedIn: ['classic', 'modern'] },

  // Status Feed (Hubs)
  { id: 'recent_activity', title: 'Activity Hub', description: 'Real-time activity stream', icon: Activity, category: 'hubs', size: 'medium', supportedIn: ['classic', 'modern'] },
  { id: 'recent_sales', title: 'Recents Hub', description: 'Latest sales and order updates', icon: ShoppingCart, category: 'hubs', size: 'medium', supportedIn: ['classic', 'modern'] },
  { id: 'live_activity_feed', title: 'Live Activity Feed', description: 'Real-time system activity stream', icon: Activity, category: 'hubs', size: 'wide', gridClass: 'lg:col-span-3', supportedIn: ['classic', 'modern'] },

  // Intelligence Hub (Under Construction)
  { id: 'intelligence', title: 'Intelligence Hub', description: 'Advanced AI insights and analytics', icon: TrendingUp, category: 'intelligence', size: 'medium', requiredTier: 'service-ops', supportedIn: ['classic', 'modern'] },
  { id: 'top_products', title: 'Top Products', description: 'Best selling products this month', icon: Package, category: 'intelligence', size: 'small', requiredTier: 'service-ops', supportedIn: ['classic', 'modern'] },
  { id: 'top_customers', title: 'Top Customers', description: 'Top customers by revenue', icon: Users, category: 'intelligence', size: 'small', supportedIn: ['classic', 'modern'] },
  { id: 'monthly_target', title: 'Monthly Target', description: 'Progress toward monthly revenue goal', icon: Target, category: 'intelligence', size: 'small', requiredTier: 'service-ops', supportedIn: ['classic', 'modern'] },
  { id: 'revenue_trend', title: 'Revenue Trend', description: '7-day revenue trend', icon: TrendingUp, category: 'intelligence', size: 'small', gridClass: 'lg:col-span-2', requiredTier: 'service-ops', supportedIn: ['classic', 'modern'] },
];

/**
 * Dashboard Defaults - Single Source of Truth
 * 
 * This file centralizes all default values for dashboard customization
 * to ensure consistency between the modal, hooks, and reset functionality.
 */

export const DASHBOARD_DEFAULTS = {
  // Widget cards shown in the dashboard grid
  cards: [
    'monthly_calendar',
    'workspace_operations',
    'tasks',
    'sales_ticket_queue',
    'stock_order_tracking',
    'team_roster',
    'low_stock_alerts'
  ],

  // Modern UI Workflow Centre specifically uses these 3 slots default
  modernWorkflowCentre: {
    leftTop: 'sales_ticket_queue',
    right: 'monthly_calendar',
    leftBottom: null as string | null,
    rightBottom: null as string | null
  },

  // Supported versions for widgets (classic vs modern)
  widgetSupport: {
    monthly_calendar: ['classic', 'modern'],
    workspace_operations: ['classic', 'modern'],
    tasks: ['classic', 'modern'],
    sales_ticket_queue: ['classic', 'modern'],
    stock_order_tracking: ['classic', 'modern'],
    teamRoster: ['classic', 'modern'],
    low_stock_alerts: ['classic', 'modern'],
    recent_activity: ['classic', 'modern'],
    recent_sales: ['classic', 'modern'],
    intelligence: ['classic', 'modern'],
    top_products: ['classic', 'modern'],
    top_customers: ['classic', 'modern'],
    monthly_target: ['classic', 'modern'],
    revenue_trend: ['classic', 'modern'],
    upcoming_deadlines: ['classic', 'modern'],
    jeopardy_management: ['classic', 'modern'],
    team_roster: ['classic', 'modern'],
    quick_actions: ['classic', 'modern'],
    live_activity_feed: ['classic', 'modern']
  } as Record<string, ('classic' | 'modern')[]>,

  // Subset for tablet/smaller screens
  tabletCards: ['calendar', 'pendingTasks'],

  // Visual Key Metrics charts (Order Status donut, Monthly Target gauge, etc.)
  // Also includes stat-style cards that were migrated from the legacy system
  keyMetrics: [
    'total_sales',
    'total_customers',
    'total_vendors',
    'units_in_stock',
    'monthly_orders',
    'total_products'
  ],

  // Quick action buttons
  actions: [
    'create_customer',
    'create_order',
    'create_stock',
    'create_product'
  ],

  // Quick link shortcuts
  quickLinks: [
    'link_contacts',
    'link_sales',
    'link_tasks'
  ],

  // Row layout preset
  rowLayout: 'equal' as const,

  // Maximum limits
  maxCards: 9,
  maxActions: 6,
  maxKeyMetrics: 6,
  maxQuickLinks: 6,

  // Tablet limits
  tabletMaxKeyMetrics: 4,
  tabletMaxCards: 2,

  // Mobile limits
  mobileMaxKeyMetrics: 2,
  mobileMaxActions: 4,
  mobileMaxQuickLinks: 4,
} as const;

export type RowLayoutPreset = 'equal' | 'top-heavy' | 'bottom-heavy';

export const ROW_LAYOUT_HEIGHTS: Record<RowLayoutPreset, { row1: string; row2: string }> = {
  'equal': { row1: 'flex-[1]', row2: 'flex-[1]' },
  'top-heavy': { row1: 'flex-[13]', row2: 'flex-[7]' },
  'bottom-heavy': { row1: 'flex-[7]', row2: 'flex-[13]' },
};

// Type exports for type-safe access
export type DashboardCardId = typeof DASHBOARD_DEFAULTS.cards[number];
export type DashboardActionId = typeof DASHBOARD_DEFAULTS.actions[number];
