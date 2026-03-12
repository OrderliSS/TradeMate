import React, { useState } from 'react';
import './Sidebar.css';
import {
    LayoutDashboard,
    Users,
    ShoppingCart,
    Sparkles,
    Package,
    Building2,
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
            className={`sidebar-item ${isActive ? 'active' : ''}`}
        >
            <div className="item-icon-wrapper">
                <Icon className="item-icon" />
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="item-label"
                    >
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>

            {!isExpanded && (
                <div className="item-tooltip">{label}</div>
            )}
        </div>
    );
};

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
        <div className={`nav-group ${isGroupActive ? 'group-active' : ''} ${isOpen ? 'group-open' : ''}`}>
            <div
                onClick={onToggle}
                className="group-header"
            >
                <div className="item-icon-wrapper">
                    <Icon className="item-icon" />
                </div>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="group-label-wrapper"
                        >
                            <span className="item-label">{label}</span>
                            <motion.div
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ChevronDown className="chevron-icon" />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {isExpanded && (
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="group-items"
                        >
                            {items.map((item) => {
                                const isActive = item.path.includes("?")
                                    ? currentPath === item.path.split("?")[0]
                                    : currentPath === item.path || currentPath.startsWith(item.path);
                                return (
                                    <div
                                        key={item.path}
                                        onClick={(e) => { e.stopPropagation(); onNavigate(item.path); }}
                                        className={`sub-item ${isActive ? 'active' : ''}`}
                                    >
                                        <item.icon className="sub-item-icon" />
                                        <span className="sub-item-label">{item.label}</span>
                                    </div>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
};

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

    const toggleGroup = (label: string) => {
        setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
    };

    return (
        <>
            <AnimatePresence>
                {isMobile && isExpanded && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => onExpandedChange(false)}
                        className="mobile-overlay"
                    />
                )}
            </AnimatePresence>

            <motion.div
                animate={{
                    width: isMobile ? 240 : (isExpanded ? 260 : 72),
                    x: isMobile ? (isExpanded ? 0 : -240) : 0,
                }}
                className={`sidebar-container ${isMobile ? 'mobile' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}
                onMouseEnter={() => !isMobile && !isPinned && onExpandedChange(true)}
                onMouseLeave={() => !isMobile && !isPinned && onExpandedChange(false)}
            >
                <div className="sidebar-inner">
                    <div className="sidebar-logo-section" onClick={() => navigate('/')}>
                        <div className="logo-avatar">
                            <span className="avatar-text">{userInitial}</span>
                        </div>
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="workspace-info"
                                >
                                    <span className="workspace-name">{workspaceId}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="sidebar-nav-section">
                        <SidebarItem
                            icon={LayoutDashboard}
                            label="Dashboard"
                            path="/"
                            isExpanded={isExpanded}
                            isActive={location.pathname === "/"}
                            onClick={() => navigate("/")}
                        />
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
                    </div>

                    <div className="sidebar-footer-section">
                        {onVersionToggle && (
                            <div onClick={onVersionToggle} className="sidebar-item">
                                <div className="item-icon-wrapper"><Sparkles className="item-icon" /></div>
                                {isExpanded && <span className="item-label">Switch to Classic</span>}
                            </div>
                        )}

                        <div onClick={onTogglePin} className="sidebar-item sticky-toggle">
                            <div className="item-icon-wrapper">
                                {isPinned ? <PanelLeftClose className="item-icon" /> : <PanelLeft className="item-icon" />}
                            </div>
                            {isExpanded && <span className="item-label">{isPinned ? "Unpin" : "Pin"} Sidebar</span>}
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
