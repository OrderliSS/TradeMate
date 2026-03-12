import { memo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Home, Users, Users2, ShoppingCart, CheckSquare, Package, Receipt, TrendingUp,
  FileText, Briefcase, Building2, Calculator, User, LogOut, Settings,
  Shield, Wrench, Box, Tag, Truck, Activity, Database, ChevronDown,
  Search, BookOpen, Eye, LayoutDashboard, BarChart3, CreditCard, Palette,
  GitBranch, FlaskConical, ShieldCheck, ScrollText, Sparkles
} from "lucide-react";
import { GlobalCommandPalette } from "@/components/command/GlobalCommandPalette";
import orderliLogoEnhanced from '@/assets/orderi_logo_enahnce.png';
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useUserProfile, UserProfile } from "@/hooks/useUserProfile";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EnvLink } from "@/components/navigation/EnvLink";
import { OrganizationSwitcher } from "@/components/navigation/OrganizationSwitcher";
import { useEnvNavigate } from "@/hooks/useEnvNavigate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ConnectionStatusIndicator } from "@/components/realtime/ConnectionStatusIndicator";
import { CompactDevIndicator } from "@/components/CompactDevIndicator";
import { MobileNavigation } from "@/components/navigation/MobileNavigation";
import { TabletNavigation } from "@/components/navigation/TabletNavigation";
import { SecureEnvironment } from "@/lib/secure-environment";
import { enhancedToast } from "@/components/ui/enhanced-toast";
import { isDevelopmentMode, isTestMode, isProductionMode } from "@/lib/environment-utils";
import { UserSettingsDialog } from "@/components/UserSettingsDialog";
import { PrivacySettingsDialog } from "@/components/privacy/PrivacySettingsDialog";
import { useDashboardVersion } from "@/hooks/useDashboardVersion";
import { DashboardCustomizationModal } from "@/components/dashboard/DashboardCustomizationModal";
import { useDashboardCustomization } from "@/contexts/DashboardCustomizationContext";
import { useSandbox } from "@/contexts/SandboxContext";
import { Switch } from "@/components/ui/switch";
import { DemoUserSwitcher } from "@/components/navigation/DemoUserSwitcher";
import { ImpersonateShortcut } from "@/components/navigation/ImpersonateShortcut";
import { TierSwitcher } from "@/components/navigation/TierSwitcher";
import { useTier } from "@/contexts/TierContext";

const navItems = [
  { path: "/", label: "Dashboard", icon: Home },
];

const workspaceDropdownItems = [
  { path: "/workspace-operations/calendar", label: "Workspace Operations", icon: CheckSquare },
  { path: "/documents", label: "Documents & Notes", icon: FileText },
  { path: "/templates", label: "Templates", icon: FileText },
  { path: "/logs", label: "Logs", icon: ScrollText },
];

const knowledgeDropdownItems = [
  { path: "/knowledge", label: "Knowledge Hub", icon: BookOpen },
  { path: "/knowledge?tab=documentation", label: "User Guide", icon: FileText },
  { path: "/knowledge?tab=flows", label: "Process Flows", icon: GitBranch },
  { path: "/knowledge?tab=colors", label: "Color Legend", icon: Palette },
  { path: "/knowledge?tab=glossary", label: "Glossary", icon: Database },
];

const insightsDropdownItems = [
  { path: "/registry", label: "Record Registry", icon: Database },
  { path: "/analytics", label: "Analytics Dashboard", icon: BarChart3 },
  { path: "/registry/reports", label: "Reports & Export", icon: FileText },
];

const customersDropdownItems = [
  { path: "/contacts", label: "Contacts", icon: Users },
  { path: "/vendors", label: "Vendors", icon: Building2 },
];

const purchasesDropdownItems = [
  { path: "/sales-orders", label: "Sales Orders", icon: ShoppingCart },
  { path: "/stock-orders", label: "Stock Orders", icon: Receipt },
  { path: "/tracking", label: "Tracking", icon: Truck },
];

const inventoryDropdownItems = [
  { path: "/stock-management", label: "Stock Management", icon: Package },
  { path: "/asset-management", label: "Asset Management", icon: Tag },
  { path: "/catalog", label: "Catalog", icon: BookOpen },
];

interface UniversalNavBarProps {
  hideDropdownTabs?: boolean;
}

export const UniversalNavBar = ({ hideDropdownTabs = false }: UniversalNavBarProps = {}) => {
  const location = useLocation();
  const navigate = useEnvNavigate();
  const { user, signOut } = useAuth();
  const { canManageMembers, currentOrganization } = useOrganization();
  const { tier } = useSubscription();
  const { profile } = useUserProfile();
  const { isAdmin, roles } = useUserRoles();
  const { activeTier } = useTier();
  const { isImpersonating, impersonatedUser, stopImpersonation } = useImpersonation();
  const typedProfile = profile as UserProfile | null;
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const { setVersion, canToggle } = useDashboardVersion();
  const { isOpen: showDashboardCustomization, setOpen: setShowDashboardCustomization, closeDialog } = useDashboardCustomization();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (isImpersonating) {
      await stopImpersonation();
      return;
    }
    const { error } = await signOut();
    if (error) {
      enhancedToast.error("Sign Out Failed", "Unable to sign out. Please try again.");
    } else {
      enhancedToast.success("Signed Out", "Successfully signed out of your account");
    }
  };

  const handleDashboardRefresh = () => {
    closeDialog();
  };

  const getUserInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  return (
    // Heading tabs navigation bar
    <nav className="bg-background border-b border-border sticky top-0 z-50">
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center h-14 md:h-16">
          {/* Left Section - Mobile Menu + Logo */}
          <div className="flex items-center flex-shrink-0 mr-2 md:mr-4">
            {/* Mobile Navigation hamburger - only visible below md */}
            <MobileNavigation className="md:hidden mr-2" />

            <EnvLink to="/" className="flex items-center hover:opacity-90 transition-opacity">
              <img src={orderliLogoEnhanced} alt="Orderli" className="h-10 md:h-12 w-auto" />
            </EnvLink>
          </div>

          {/* Tablet Navigation (md to lg) - Icon-based navigation */}
          <div className="hidden md:flex lg:hidden flex-1 items-center justify-center">
            <TabletNavigation />
          </div>

          {/* Center Section - Classic mode: global controls row */}
          {hideDropdownTabs && (
            <div className="hidden lg:flex flex-1 items-center justify-center">
              <div className="flex items-center gap-2 px-3 py-1 bg-muted/30 rounded-lg border border-border/50">
                {/* Search */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium">Search</span>
                  <GlobalCommandPalette />
                </div>
                <div className="h-5 w-px bg-border/60" />
                {/* Workspace */}
                {!isProductionMode() && (
                  <>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium">Workspace</span>
                      <OrganizationSwitcher className="w-auto scale-100" />
                    </div>
                    <div className="h-5 w-px bg-border/60" />
                  </>
                )}
                {/* Tier - DEV only */}
                {isDevelopmentMode() && (
                  <>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium">Tier</span>
                      <TierSwitcher />
                    </div>
                    <div className="h-5 w-px bg-border/60" />
                  </>
                )}
                {/* View - switch to Modern */}
                {canToggle && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium">View</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVersion("MODERN")}
                      className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted"
                      title="Switch to Modern"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {/* Staging tools */}
                {isTestMode() && !isImpersonating && (
                  <>
                    <div className="h-5 w-px bg-border/60" />
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium">Staging</span>
                      <div className="flex items-center gap-1">
                        <DemoUserSwitcher />
                        {isAdmin && <ImpersonateShortcut />}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Center Section - Desktop Navigation Tabs (lg+) */}
          {!hideDropdownTabs && activeTier !== 'TRADES' && (
            <div className="hidden lg:flex flex-1 items-center justify-center">
              <div className="flex items-center space-x-6">
                {/* Main Navigation Items */}
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;

                  return (
                    <EnvLink
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors",
                        isActive
                          ? "text-primary border-b-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-muted-foreground"
                      )}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </EnvLink>
                  );
                })}

                {/* Customers dropdown */}
                <DropdownMenu open={openDropdown === 'contacts'} onOpenChange={(open) => setOpenDropdown(open ? 'contacts' : null)}>
                  <DropdownMenuTrigger asChild>
                    {(() => {
                      const isCustomersActive = location.pathname === "/contacts" ||
                        location.pathname.startsWith("/contacts") ||
                        location.pathname === "/vendors" ||
                        location.pathname.startsWith("/vendors");

                      return (
                        <button
                          className={cn(
                            "inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors",
                            isCustomersActive
                              ? "text-primary border-b-2 border-primary"
                              : "text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-muted-foreground"
                          )}
                        >
                          <Users className="w-4 h-4 mr-2" />
                          Contacts
                          <ChevronDown className="w-3 h-3 ml-1" />
                        </button>
                      );
                    })()}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="bg-background/95 backdrop-blur-sm border border-border shadow-lg z-50"
                    align="start"
                  >
                    {customersDropdownItems.map((item) => (
                      <DropdownMenuItem key={item.path} asChild>
                        <EnvLink
                          to={item.path}
                          className={cn(
                            "flex w-full items-center",
                            location.pathname === item.path ||
                              (item.path !== "/" && location.pathname.startsWith(item.path))
                              ? "bg-muted text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </EnvLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Purchases dropdown */}
                <DropdownMenu open={openDropdown === 'orders'} onOpenChange={(open) => setOpenDropdown(open ? 'orders' : null)}>
                  <DropdownMenuTrigger asChild>
                    {(() => {
                      const isPurchasesActive = location.pathname === "/sales-orders" ||
                        location.pathname.startsWith("/sales-orders") ||
                        location.pathname === "/stock-orders" ||
                        location.pathname.startsWith("/stock-orders") ||
                        location.pathname === "/tracking" ||
                        location.pathname.startsWith("/tracking");

                      return (
                        <button
                          className={cn(
                            "inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors",
                            isPurchasesActive
                              ? "text-primary border-b-2 border-primary"
                              : "text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-muted-foreground"
                          )}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Orders
                          <ChevronDown className="w-3 h-3 ml-1" />
                        </button>
                      );
                    })()}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="bg-background/95 backdrop-blur-sm border border-border shadow-lg z-50"
                    align="start"
                  >
                    {purchasesDropdownItems.map((item) => (
                      <DropdownMenuItem key={item.path} asChild>
                        <EnvLink
                          to={item.path}
                          className={cn(
                            "flex w-full items-center",
                            location.pathname === item.path ||
                              (item.path !== "/" && location.pathname.startsWith(item.path))
                              ? "bg-muted text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </EnvLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Inventory dropdown - moved to be adjacent to Purchases */}
                <DropdownMenu open={openDropdown === 'inventory'} onOpenChange={(open) => setOpenDropdown(open ? 'inventory' : null)}>
                  <DropdownMenuTrigger asChild>
                    {(() => {
                      const isInventoryActive = location.pathname === "/stock-management" ||
                        location.pathname.startsWith("/asset-management") ||
                        location.pathname === "/catalog" ||
                        location.pathname.startsWith("/catalog");

                      return (
                        <button
                          className={cn(
                            "inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors",
                            isInventoryActive
                              ? "text-primary border-b-2 border-primary"
                              : "text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-muted-foreground"
                          )}
                        >
                          <Package className="w-4 h-4 mr-2" />
                          Inventory
                          <ChevronDown className="w-3 h-3 ml-1" />
                        </button>
                      );
                    })()}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="bg-background/95 backdrop-blur-sm border border-border shadow-lg z-50"
                    align="start"
                  >
                    {inventoryDropdownItems.map((item) => (
                      <DropdownMenuItem key={item.path} asChild>
                        <EnvLink
                          to={item.path}
                          className={cn(
                            "flex w-full items-center",
                            location.pathname === item.path ||
                              (item.path !== "/" && location.pathname.startsWith(item.path))
                              ? "bg-muted text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </EnvLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Insights Dropdown */}
                <DropdownMenu open={openDropdown === 'insights'} onOpenChange={(open) => setOpenDropdown(open ? 'insights' : null)}>
                  <DropdownMenuTrigger asChild>
                    {(() => {
                      const isInsightsActive = location.pathname.startsWith("/registry") ||
                        location.pathname === "/analytics" ||
                        location.pathname.startsWith("/analytics");

                      return (
                        <button
                          className={cn(
                            "inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors",
                            isInsightsActive
                              ? "text-primary border-b-2 border-primary"
                              : "text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-muted-foreground"
                          )}
                        >
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Insights
                          <ChevronDown className="w-3 h-3 ml-1" />
                        </button>
                      );
                    })()}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="bg-background/95 backdrop-blur-sm border border-border shadow-lg z-50"
                    align="start"
                  >
                    {insightsDropdownItems.map((item) => (
                      <DropdownMenuItem key={item.path} asChild>
                        <EnvLink
                          to={item.path}
                          className={cn(
                            "flex w-full items-center",
                            location.pathname === item.path ||
                              (item.path !== "/" && location.pathname.startsWith(item.path))
                              ? "bg-muted text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </EnvLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Workspace dropdown */}
                <DropdownMenu open={openDropdown === 'workspace'} onOpenChange={(open) => setOpenDropdown(open ? 'workspace' : null)}>
                  <DropdownMenuTrigger asChild>
                    {(() => {
                      const isWorkspaceActive =
                        location.pathname.startsWith("/workspace-operations") ||
                        location.pathname.startsWith("/tasks") ||
                        location.pathname === "/documents" ||
                        location.pathname.startsWith("/documents") ||
                        location.pathname === "/templates" ||
                        location.pathname.startsWith("/templates") ||
                        location.pathname === "/logs";

                      return (
                        <button
                          className={cn(
                            "inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors",
                            isWorkspaceActive
                              ? "text-primary border-b-2 border-primary"
                              : "text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-muted-foreground"
                          )}
                        >
                          <Briefcase className="w-4 h-4 mr-2" />
                          Workspace
                          <ChevronDown className="w-3 h-3 ml-1" />
                        </button>
                      );
                    })()}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="bg-background/95 backdrop-blur-sm border border-border shadow-lg z-50"
                    align="start"
                  >
                    {workspaceDropdownItems.map((item) => (
                      <DropdownMenuItem key={item.path} asChild>
                        <EnvLink
                          to={item.path}
                          className={cn(
                            "flex w-full items-center",
                            location.pathname === item.path ||
                              (item.path !== "/" && location.pathname.startsWith(item.path))
                              ? "bg-muted text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </EnvLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Knowledge dropdown */}
                <DropdownMenu open={openDropdown === 'knowledge'} onOpenChange={(open) => setOpenDropdown(open ? 'knowledge' : null)}>
                  <DropdownMenuTrigger asChild>
                    {(() => {
                      const isKnowledgeActive = location.pathname === "/knowledge" ||
                        location.pathname.startsWith("/knowledge") ||
                        location.pathname === "/help";

                      return (
                        <button
                          className={cn(
                            "inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors",
                            isKnowledgeActive
                              ? "text-primary border-b-2 border-primary"
                              : "text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-muted-foreground"
                          )}
                        >
                          <BookOpen className="w-4 h-4 mr-2" />
                          Knowledge
                          <ChevronDown className="w-3 h-3 ml-1" />
                        </button>
                      );
                    })()}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="bg-background/95 backdrop-blur-sm border border-border shadow-lg z-50"
                    align="start"
                  >
                    {knowledgeDropdownItems.map((item) => (
                      <DropdownMenuItem key={item.path} asChild>
                        <EnvLink
                          to={item.path}
                          className={cn(
                            "flex w-full items-center",
                            location.pathname === item.path ||
                              (item.path !== "/" && location.pathname.startsWith(item.path))
                              ? "bg-muted text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </EnvLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}

          {/* Right Section - Theme, Notifications, Profile */}
          <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3 ml-auto pr-1">
            {/* These controls only show on non-Classic pages (when hideDropdownTabs is false) */}
            {!hideDropdownTabs && (
              <>
                {/* Organization Switcher - visible on md+ in development/staging, hidden on dashboard */}
                {!isProductionMode() && location.pathname !== '/' && (
                  <div className="hidden md:block">
                    <OrganizationSwitcher />
                  </div>
                )}
                {isDevelopmentMode() && location.pathname !== '/' && (
                  <div className="hidden md:block">
                    <TierSwitcher />
                  </div>
                )}

                {/* Demo User Switcher - only in TEST mode */}
                {isTestMode() && !isImpersonating && <DemoUserSwitcher />}
                {isTestMode() && isAdmin && <ImpersonateShortcut />}

                {/* Desktop/Tablet Search - hidden on dashboard */}
                {location.pathname !== '/' && (
                  <div className="hidden md:block">
                    <GlobalCommandPalette />
                  </div>
                )}

                {/* Try Modern UI Button - visible on classic dashboard */}
                {canToggle && location.pathname === '/' && (
                  <div className="hidden sm:block">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVersion("MODERN")}
                      className="h-9 px-3 text-xs font-semibold text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 gap-2 mr-2"
                    >
                      <Sparkles className="h-4 w-4" /> Try Modern
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Theme Toggle - with responsive sizing */}
            <div className="[&>button]:h-9 [&>button]:w-9 md:[&>button]:h-10 md:[&>button]:w-10">
              <ThemeToggle />
            </div>

            {/* Connection Status - shows when degraded */}
            <ConnectionStatusIndicator />

            {/* Notifications - with responsive sizing */}
            <div className="[&>button]:h-9 [&>button]:w-9 md:[&>button]:h-10 md:[&>button]:w-10">
              <NotificationCenter />
            </div>

            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getUserInitials(user?.email || '')}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 bg-background/95 backdrop-blur-sm border border-border shadow-lg z-50"
                align="end"
                forceMount
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {typedProfile?.full_name || typedProfile?.email || 'User'}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                      {(() => {
                        const firstPortion = user?.id?.split('-')[0] || '';
                        const derivedId = `D${firstPortion}`;
                        const displayId = (isProductionMode() && !typedProfile?.employee_id) ? derivedId : typedProfile?.employee_id;

                        if (!displayId) return null;

                        return (
                          <>
                            <span className="text-[10px] text-muted-foreground/40">•</span>
                            <p className="text-[10px] font-mono font-medium text-primary/70">
                              {displayId}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                    {roles && roles.length > 0 && (
                      <Badge
                        variant={isAdmin ? 'default' : 'outline'}
                        className={cn(
                          "text-[10px] mt-1 h-4",
                          isAdmin && "bg-purple-600"
                        )}
                      >
                        {isAdmin ? '👑 Admin' : roles[0]}
                      </Badge>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {isAdmin && !isImpersonating && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Admin Tools
                    </DropdownMenuLabel>

                    <DropdownMenuItem onClick={() => navigate('/source-of-truth')}>
                      <Database className="mr-2 h-4 w-4" />
                      <span>Source of Truth</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Admin Console</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                  </>
                )}



                {/* Subscription Management */}
                <DropdownMenuItem onClick={() => navigate('/subscription')}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>My Plan</span>
                  {isAdmin ? (
                    <Badge variant="default" className="ml-auto text-xs bg-purple-600">
                      Admin
                    </Badge>
                  ) : (
                    <Badge variant={tier === 'starter' ? 'default' : 'outline'} className="ml-auto text-xs">
                      {tier === 'starter' ? 'Starter' : 'Free'}
                    </Badge>
                  )}
                </DropdownMenuItem>

                {/* Workspace / Team Management */}
                {canManageMembers && (
                  <DropdownMenuItem onClick={() => navigate('/settings?tab=team')}>
                    <Users2 className="mr-2 h-4 w-4" />
                    <span>Team</span>
                    {currentOrganization?.member_count && currentOrganization.member_count > 1 && (
                      <Badge variant="outline" className="ml-auto text-xs">
                        {currentOrganization.member_count}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {/* Sandbox Mode Toggle */}
                <SandboxModeMenuItem />

                <DropdownMenuSeparator />

                {/* Settings - Main entry point */}
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{isImpersonating ? "End Impersonation" : "Sign out"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
          <CompactDevIndicator />
        </div>
      </div>

      {/* User Settings Dialog */}
      <UserSettingsDialog
        open={showUserSettings}
        onOpenChange={setShowUserSettings}
      />

      {/* Privacy Settings Dialog */}
      <PrivacySettingsDialog
        open={showPrivacySettings}
        onOpenChange={setShowPrivacySettings}
      />

      {/* Dashboard Customization Dialog */}
      <DashboardCustomizationModal
        open={showDashboardCustomization}
        onOpenChange={setShowDashboardCustomization}
      />
    </nav>
  );
};

// Sandbox Mode Menu Item Component
function SandboxModeMenuItem() {
  const { isSandboxMode, toggleSandboxMode, loading, sandboxEnabled } = useSandbox();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirmDialog(true);
  };

  const confirmSwitch = async () => {
    setShowConfirmDialog(false);
    await toggleSandboxMode();
  };

  if (!sandboxEnabled) {
    return null; // Don't show if sandbox not enabled for org
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between px-2 py-1.5 rounded-sm cursor-pointer transition-colors",
          isSandboxMode
            ? "bg-amber-100/50 dark:bg-amber-900/20"
            : "hover:bg-accent"
        )}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          {isSandboxMode ? (
            <FlaskConical className="h-4 w-4 text-amber-500" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          )}
          <span className="text-sm">
            {isSandboxMode ? 'Sandbox Mode' : 'Live Mode'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] px-1.5 py-0",
              isSandboxMode
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            )}
          >
            {isSandboxMode ? 'TEST' : 'LIVE'}
          </Badge>
          <Switch
            checked={isSandboxMode}
            disabled={loading}
            className="scale-75"
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={() => setShowConfirmDialog(true)}
          />
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowConfirmDialog(false)}>
          <div
            className="bg-background border border-border rounded-lg shadow-xl p-6 max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              {isSandboxMode ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-lg font-semibold">Switch to Live Mode?</h3>
                </>
              ) : (
                <>
                  <FlaskConical className="h-5 w-5 text-amber-500" />
                  <h3 className="text-lg font-semibold">Switch to Sandbox Mode?</h3>
                </>
              )}
            </div>
            <div className="text-sm text-muted-foreground mb-6">
              {isSandboxMode ? (
                <ul className="list-disc list-inside space-y-1">
                  <li>You'll see your real production data</li>
                  <li>All changes will affect your live data</li>
                  <li>Test/sandbox data will not be visible</li>
                </ul>
              ) : (
                <ul className="list-disc list-inside space-y-1">
                  <li>You'll see test data only</li>
                  <li>Any new records you create will be test data</li>
                  <li>Your live production data will not be affected</li>
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={confirmSwitch}
                className={cn(
                  isSandboxMode
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                {isSandboxMode ? 'Switch to Live' : 'Switch to Sandbox'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}