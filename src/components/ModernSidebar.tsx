import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    ShoppingCart,
    Sparkles,
    Package,
    TrendingUp,
    Building2,
    ChevronLeft,
    ChevronRight,
    Monitor,
    BarChart3,
    Briefcase,
    BookOpen as BookOpenIcon,
    Database,
    Settings,
    PanelLeftClose,
    PanelLeft,
    ChevronDown,
    FileText,
    ScrollText,
    GitBranch,
    Palette,
    Receipt,
    Truck,
    Tag,
    BookOpen,
    CheckSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEnvNavigate } from "@/hooks/useEnvNavigate";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { OrganizationSwitcher } from "@/components/navigation/OrganizationSwitcher";

interface SidebarItemProps {
    icon: React.ElementType;
    label: string;
    path: string;
    isExpanded: boolean;
    isActive: boolean;
    onClick: () => void;
}

const SidebarItem = ({ icon: Icon, label, path, isExpanded, isActive, onClick }: SidebarItemProps) => {
    return (
        <div
            onClick={onClick}
            className={cn(
                "group relative flex items-center h-12 cursor-pointer transition-all duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                isActive && "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-primary before:rounded-r-full"
            )}
        >
            <div className="flex items-center justify-center w-12 shrink-0">
                <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="text-sm font-medium whitespace-nowrap overflow-hidden"
                    >
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>

            {!isExpanded && (
                <div className="absolute left-14 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 whitespace-nowrap shadow-md border border-border">
                    {label}
                </div>
            )}
        </div>
    );
};

// Expandable nav group for Classic mode
interface NavGroupItem {
    icon: React.ElementType;
    label: string;
    path: string;
}

interface ExpandableNavGroupProps {
    icon: React.ElementType;
    label: string;
    items: NavGroupItem[];
    isExpanded: boolean;
    isOpen: boolean;
    onToggle: () => void;
    onNavigate: (path: string) => void;
    currentPath: string;
}

const ExpandableNavGroup = ({ icon: Icon, label, items, isExpanded, isOpen, onToggle, onNavigate, currentPath }: ExpandableNavGroupProps) => {
    const isGroupActive = items.some(item => {
        if (item.path.includes("?")) {
            const basePath = item.path.split("?")[0];
            return currentPath === basePath || currentPath.startsWith(basePath);
        }
        return currentPath === item.path || currentPath.startsWith(item.path);
    });

    return (
        <div className="relative">
            {/* Group header */}
            <div
                onClick={onToggle}
                className={cn(
                    "group relative flex items-center h-12 cursor-pointer transition-all duration-200",
                    isGroupActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    isGroupActive && "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-primary before:rounded-r-full"
                )}
            >
                <div className="flex items-center justify-center w-12 shrink-0">
                    <Icon className={cn("h-5 w-5", isGroupActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                </div>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="flex items-center justify-between flex-1 pr-3 overflow-hidden"
                        >
                            <span className="text-sm font-medium whitespace-nowrap">{label}</span>
                            <motion.div
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Sub-items: shown inline when sidebar is expanded */}
            {isExpanded && (
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                        >
                            {items.map((item) => {
                                const isActive = item.path.includes("?")
                                    ? currentPath === item.path.split("?")[0]
                                    : currentPath === item.path || currentPath.startsWith(item.path);
                                return (
                                    <div
                                        key={item.path}
                                        onClick={(e) => { e.stopPropagation(); onNavigate(item.path); }}
                                        className={cn(
                                            "flex items-center h-10 pl-12 pr-3 cursor-pointer transition-colors duration-150",
                                            isActive
                                                ? "text-primary bg-primary/5"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        )}
                                    >
                                        <item.icon className="h-4 w-4 mr-2.5 shrink-0" />
                                        <span className="text-sm whitespace-nowrap truncate">{item.label}</span>
                                    </div>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {/* Flyout popover when sidebar is collapsed */}
            {!isExpanded && (
                <div className="absolute left-14 top-0 hidden group-hover:block z-50">
                    <div className="bg-popover text-popover-foreground rounded-lg shadow-lg border border-border py-1 min-w-[180px]">
                        <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
                        {items.map((item) => {
                            const isActive = item.path.includes("?")
                                ? currentPath === item.path.split("?")[0]
                                : currentPath === item.path || currentPath.startsWith(item.path);
                            return (
                                <div
                                    key={item.path}
                                    onClick={() => onNavigate(item.path)}
                                    className={cn(
                                        "flex items-center px-3 py-2 cursor-pointer transition-colors",
                                        isActive
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "hover:bg-muted/50 text-foreground"
                                    )}
                                >
                                    <item.icon className="h-4 w-4 mr-2.5 shrink-0" />
                                    <span className="text-sm">{item.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// Navigation groups for expandable (Classic) mode
const expandableNavGroups = [
    {
        icon: Users,
        label: "Contacts",
        items: [
            { icon: Users, label: "Contacts", path: "/contacts" },
            { icon: Building2, label: "Vendors", path: "/vendors" },
        ]
    },
    {
        icon: ShoppingCart,
        label: "Orders",
        items: [
            { icon: ShoppingCart, label: "Sales Orders", path: "/sales-orders" },
            { icon: Receipt, label: "Stock Orders", path: "/stock-orders" },
            { icon: Truck, label: "Tracking", path: "/tracking" },
        ]
    },
    {
        icon: Package,
        label: "Inventory",
        items: [
            { icon: Package, label: "Stock Management", path: "/stock-management" },
            { icon: Tag, label: "Asset Management", path: "/asset-management" },
            { icon: BookOpen, label: "Catalog", path: "/catalog" },
        ]
    },
    {
        icon: BarChart3,
        label: "Insights",
        items: [
            { icon: Database, label: "Record Registry", path: "/registry" },
            { icon: BarChart3, label: "Analytics Dashboard", path: "/analytics" },
            { icon: FileText, label: "Reports & Export", path: "/registry/reports" },
        ]
    },
    {
        icon: Briefcase,
        label: "Workspace",
        items: [
            { icon: CheckSquare, label: "Workspace Operations", path: "/workspace-operations/calendar" },
            { icon: FileText, label: "Documents & Notes", path: "/documents" },
            { icon: FileText, label: "Templates", path: "/templates" },
            { icon: ScrollText, label: "Logs", path: "/logs" },
        ]
    },
    {
        icon: BookOpenIcon,
        label: "Knowledge",
        items: [
            { icon: BookOpenIcon, label: "Knowledge Hub", path: "/knowledge" },
            { icon: FileText, label: "User Guide", path: "/knowledge?tab=documentation" },
            { icon: GitBranch, label: "Process Flows", path: "/knowledge?tab=flows" },
            { icon: Palette, label: "Color Legend", path: "/knowledge?tab=colors" },
            { icon: Database, label: "Glossary", path: "/knowledge?tab=glossary" },
        ]
    },
];

interface ModernSidebarProps {
    isExpanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    isPinned?: boolean;
    onTogglePin?: () => void;
    expandableMode?: boolean;
    onVersionToggle?: () => void;
}

export const ModernSidebar = ({ isExpanded, onExpandedChange, isPinned = false, onTogglePin, expandableMode = false, onVersionToggle }: ModernSidebarProps) => {
    const navigate = useEnvNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { currentOrganization } = useOrganization();
    const isMobile = useIsMobile();
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

    const userInitial = user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || "U";
    const workspaceId = currentOrganization?.access_code || "Workspace";

    const navItems = [
        { icon: LayoutDashboard, label: "Dashboard", path: "/" },
        { icon: Users, label: "Contacts", path: "/contacts" },
        { icon: ShoppingCart, label: "Orders", path: "/sales-orders" },
        { icon: Package, label: "Inventory", path: "/stock-management" },
        { icon: BarChart3, label: "Insights", path: "/analytics" },
        { icon: Briefcase, label: "Workspace", path: "/workspace-operations" },
        { icon: Database, label: "Knowledge", path: "/knowledge" },
    ];

    const toggleGroup = (label: string) => {
        setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
    };

    return (
        <>
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isMobile && isExpanded && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => onExpandedChange(false)}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
                    />
                )}
            </AnimatePresence>

            <motion.div
                initial={isMobile ? { x: -240 } : false}
                animate={{
                    width: isMobile ? 240 : (isExpanded ? 240 : 64),
                    x: isMobile ? (isExpanded ? 0 : -240) : 0,
                    boxShadow: isMobile && isExpanded ? "20px 0 25px -5px rgb(0 0 0 / 0.1), 8px 0 10px -6px rgb(0 0 0 / 0.1)" : "none"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={cn(
                    "h-full bg-background border-r border-border z-50 flex flex-col overflow-hidden shrink-0",
                    isMobile ? "fixed left-0 top-0 bottom-0 shadow-2xl" : "relative shadow-sm"
                )}
                onMouseEnter={() => !isMobile && !isPinned && onExpandedChange(true)}
                onMouseLeave={() => !isMobile && !isPinned && onExpandedChange(false)}
            >
                <div className="flex flex-col h-full py-4 px-3 md:px-0">
                    {/* Logo / Top section */}
                    <div className="mb-4">
                        <div className="flex items-center h-12 cursor-pointer" onClick={() => navigate('/')}>
                            <div className="w-12 h-12 flex items-center justify-center shrink-0">
                                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                                    <span className="text-primary-foreground font-black text-xs">{userInitial}</span>
                                </div>
                            </div>
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center justify-between flex-1 pr-2"
                                    >
                                        <span className="font-bold text-sm tracking-tight text-foreground truncate">
                                            {workspaceId}
                                        </span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="pl-3 pr-2 mt-1"
                                >
                                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium ml-1">Workspace</span>
                                    <div className="mt-0.5">
                                        <OrganizationSwitcher />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Navigation Items */}
                    <div className="flex-1 space-y-1 overflow-y-auto scrollbar-none">
                        {expandableMode ? (
                            <>
                                {/* Dashboard - single link */}
                                <SidebarItem
                                    icon={LayoutDashboard}
                                    label="Dashboard"
                                    path="/"
                                    isExpanded={isExpanded}
                                    isActive={location.pathname === "/"}
                                    onClick={() => navigate("/")}
                                />
                                {/* Expandable groups */}
                                {expandableNavGroups.map((group) => (
                                    <ExpandableNavGroup
                                        key={group.label}
                                        icon={group.icon}
                                        label={group.label}
                                        items={group.items}
                                        isExpanded={isExpanded}
                                        isOpen={!!openGroups[group.label]}
                                        onToggle={() => toggleGroup(group.label)}
                                        onNavigate={navigate}
                                        currentPath={location.pathname}
                                    />
                                ))}
                            </>
                        ) : (
                            navItems.map((item) => (
                                <SidebarItem
                                    key={item.path}
                                    {...item}
                                    isExpanded={isExpanded}
                                    isActive={item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)}
                                    onClick={() => navigate(item.path)}
                                />
                            ))
                        )}
                    </div>

                    {/* Bottom section */}
                    <div className="mt-auto pt-4 border-t border-border/50 space-y-1">
                        {onVersionToggle && (
                            <div
                                onClick={onVersionToggle}
                                className="group relative flex items-center h-12 cursor-pointer transition-all duration-200 text-muted-foreground hover:text-foreground"
                                title="Switch to Classic"
                            >
                                <div className="flex items-center justify-center w-12 shrink-0">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.span
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="text-sm font-medium whitespace-nowrap overflow-hidden"
                                        >
                                            Switch to Classic
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                                {!isExpanded && (
                                    <div className="absolute left-14 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 whitespace-nowrap shadow-md border border-border">
                                        Switch to Classic
                                    </div>
                                )}
                            </div>
                        )}

                        <div
                            onClick={onTogglePin}
                            className={cn(
                                "group relative flex items-center h-12 cursor-pointer transition-all duration-200",
                                isPinned ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                            title={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
                        >
                            <div className="flex items-center justify-center w-12 shrink-0">
                                {isPinned ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
                            </div>
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="text-sm font-medium whitespace-nowrap overflow-hidden"
                                    >
                                        {isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>

                        <SidebarItem
                            icon={Settings}
                            label="Settings"
                            path="/settings"
                            isExpanded={isExpanded}
                            isActive={location.pathname === "/settings"}
                            onClick={() => navigate("/settings")}
                        />
                    </div>
                </div>
            </motion.div>
        </>
    );
};
