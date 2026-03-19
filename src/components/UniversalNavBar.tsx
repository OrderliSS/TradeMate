import {
  LogOut, Settings, Sparkles
} from "lucide-react";
import { GlobalCommandPalette } from "@/components/command/GlobalCommandPalette";
import orderliLogoEnhanced from '@/assets/orderi_logo_enahnce.png';
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile, UserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/UIMocks";
import { EnvLink, MobileNavigation, OrganizationSwitcher } from "@/components/navigation/Mocks";
import { useEnvNavigate } from "@/hooks/useEnvNavigate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/MiscMocks";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ConnectionStatusIndicator } from "@/components/realtime/ConnectionStatusIndicator";
import { isProductionMode } from "@/lib/environment-utils";
import { useDashboardVersion } from "@/hooks/useDashboardVersion";



export const UniversalNavBar = ({ hideDropdownTabs = false }: { hideDropdownTabs?: boolean } = {}) => {
  const navigate = useEnvNavigate();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();
  const typedProfile = profile as UserProfile | null;
  const { setVersion, canToggle } = useDashboardVersion();

  const userInitial = user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <nav className="navbar-container">
      <div className="navbar-inner">
        {/* Left Section */}
        <div className="navbar-left">
          <MobileNavigation />
          <EnvLink to="/" className="navbar-logo-link">
            <img src={orderliLogoEnhanced} alt="TradeMate" className="navbar-logo" />
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