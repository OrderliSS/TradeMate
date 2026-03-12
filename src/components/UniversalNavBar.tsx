import { memo, useState } from "react";
import { useLocation } from "react-router-dom";
import './NavBar.css';
import {
  Home, Users, Users2, ShoppingCart, CheckSquare, Package, Receipt, TrendingUp,
  FileText, Briefcase, Building2, User, LogOut, Settings,
  Shield, Database, ChevronDown,
  Search, BookOpen, LayoutDashboard, BarChart3, CreditCard,
  FlaskConical, ShieldCheck, Sparkles
} from "lucide-react";
import { GlobalCommandPalette } from "@/components/command/GlobalCommandPalette";
import orderliLogoEnhanced from '@/assets/orderi_logo_enahnce.png';
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
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
import { isDevelopmentMode, isTestMode, isProductionMode } from "@/lib/environment-utils";
import { UserSettingsDialog } from "@/components/UserSettingsDialog";
import { PrivacySettingsDialog } from "@/components/privacy/PrivacySettingsDialog";
import { useDashboardVersion } from "@/hooks/useDashboardVersion";
import { DashboardCustomizationModal } from "@/components/dashboard/DashboardCustomizationModal";
import { useDashboardCustomization } from "@/contexts/DashboardCustomizationContext";
import { useSandbox } from "@/contexts/SandboxContext";
import { DemoUserSwitcher } from "@/components/navigation/DemoUserSwitcher";
import { ImpersonateShortcut } from "@/components/navigation/ImpersonateShortcut";
import { TierSwitcher } from "@/components/navigation/TierSwitcher";

export const UniversalNavBar = ({ hideDropdownTabs = false }: { hideDropdownTabs?: boolean } = {}) => {
  const location = useLocation();
  const navigate = useEnvNavigate();
  const { user, signOut } = useAuth();
  const { currentOrganization } = useOrganization();
  const { profile } = useUserProfile();
  const { isAdmin } = useUserRoles();
  const { activeTier } = useTier();
  const { isImpersonating, stopImpersonation } = useImpersonation();
  const typedProfile = profile as UserProfile | null;
  const { setVersion, canToggle } = useDashboardVersion();
  const { isOpen: showDashboardCustomization, setOpen: setShowDashboardCustomization } = useDashboardCustomization();

  const userInitial = user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <nav className="navbar-container">
      <div className="navbar-inner">
        {/* Left Section */}
        <div className="navbar-left">
          <MobileNavigation className="mobile-only" />
          <EnvLink to="/" className="navbar-logo-link">
            <img src={orderliLogoEnhanced} alt="Orderli" className="navbar-logo" />
          </EnvLink>
        </div>

        {/* Center Section - Classic Global Controls */}
        {hideDropdownTabs && (
          <div className="navbar-center-classic">
            <div className="controls-pill">
              <div className="control-item">
                <span className="control-label">Search</span>
                <GlobalCommandPalette />
              </div>
              <div className="control-divider" />
              {!isProductionMode() && (
                <>
                  <div className="control-item">
                    <span className="control-label">Workspace</span>
                    <OrganizationSwitcher />
                  </div>
                  <div className="control-divider" />
                </>
              )}
              {canToggle && (
                <div className="control-item">
                  <span className="control-label">View</span>
                  <button className="view-toggle-btn" onClick={() => setVersion("MODERN")}>
                    <Sparkles size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Section */}
        <div className="navbar-right">
          <div className="utility-actions">
            <ThemeToggle />
            <ConnectionStatusIndicator />
            <NotificationCenter />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="profile-btn">
                <Avatar className="avatar-small">
                  <AvatarFallback className="avatar-fallback">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="dropdown-panel" align="end">
              <DropdownMenuLabel className="dropdown-header">
                <p className="user-name">{typedProfile?.full_name || user?.email}</p>
                <p className="user-email">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="menu-icon" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="menu-icon" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};