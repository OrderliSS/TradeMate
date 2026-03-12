import { useBreakpoint } from './useBreakpoint';
import { useDeviceOrientation } from './useDeviceOrientation';
import { useIsMobile } from './use-mobile';

export interface ResponsiveLayoutState {
  // Breakpoints
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  
  // Orientation
  isPortrait: boolean;
  isLandscape: boolean;
  
  // Layout decisions
  shouldUseDrawer: boolean;          // Use drawer instead of dropdown
  shouldStackVertically: boolean;    // Stack elements vertically 
  shouldUseSingleColumn: boolean;    // Use single column layout
  shouldShowFullscreenModals: boolean; // Show modals fullscreen
  shouldUseBiggerTouchTargets: boolean; // Increase touch target sizes
  shouldUseBottomNavigation: boolean;   // Use bottom navigation
  shouldUseCompactHeader: boolean;   // Use compact mobile header
  shouldHideDesktopNav: boolean;     // Hide desktop navigation
  shouldUseCardList: boolean;        // Convert tables to card lists
  
  // Grid columns
  gridCols: number;
  
  // Spacing
  containerPadding: string;
  cardSpacing: string;
  touchTargetSize: string;
  
  // Mobile-specific
  mobileIconSize: string;
  mobileHeaderHeight: string;
  
  // Card and form sizing (NEW for mobile optimization)
  cardPadding: string;           // Mobile: 'p-3', Tablet: 'p-4', Desktop: 'p-6'
  cardHeaderPadding: string;     // Mobile: 'p-3 pb-2', Tablet: 'p-4 pb-3', Desktop: 'p-6 pb-4'
  cardContentPadding: string;    // Mobile: 'p-3', Tablet: 'p-4', Desktop: 'p-6'
  formLabelSize: string;         // Mobile: 'text-xs', Desktop: 'text-sm'
  formInputHeight: string;       // Mobile: 'h-9', Desktop: 'h-10'
  sectionSpacing: string;        // Mobile: 'space-y-2', Desktop: 'space-y-4'
  titleSize: string;             // Mobile: 'text-base', Desktop: 'text-lg'
  iconSize: string;              // Mobile: 'h-4 w-4', Desktop: 'h-5 w-5'
  
  // Field display patterns
  fieldLayout: string;           // Mobile: 'flex-col items-start gap-0.5', Desktop: 'gap-2'
  fieldContainerClass: string;   // Full class for field containers
}

export function useResponsiveLayout(): ResponsiveLayoutState {
  const breakpoint = useBreakpoint();
  const orientation = useDeviceOrientation();
  const isMobileLegacy = useIsMobile(); // Keep compatibility with existing hook

  const isMobile = breakpoint.isMobile;
  const isTablet = breakpoint.isTablet;
  const isDesktop = breakpoint.isDesktop;
  const isWide = breakpoint.isWide;

  // Layout decisions based on device type and orientation
  const shouldUseDrawer = isMobile || (isTablet && orientation.isPortrait);
  const shouldStackVertically = isMobile;
  const shouldUseSingleColumn = isMobile;
  const shouldShowFullscreenModals = isMobile;
  const shouldUseBiggerTouchTargets = isMobile || isTablet;
  const shouldUseBottomNavigation = isMobile;
  const shouldUseCompactHeader = isMobile;
  const shouldHideDesktopNav = isMobile;
  const shouldUseCardList = isMobile;

  // Grid columns based on screen size
  let gridCols = 1;
  if (isTablet) {
    gridCols = orientation.isLandscape ? 3 : 2;
  } else if (isDesktop) {
    gridCols = 3;
  } else if (isWide) {
    gridCols = 4;
  }

  // Responsive spacing
  const containerPadding = isMobile ? 'p-4' : isTablet ? 'p-6' : 'p-8';
  const cardSpacing = isMobile ? 'space-y-4' : isTablet ? 'space-y-6' : 'space-y-8';
  const touchTargetSize = isMobile ? 'min-h-[44px]' : 'min-h-[36px]';
  
  // Mobile-specific measurements
  const mobileIconSize = 'h-4 w-4';
  const mobileHeaderHeight = 'h-14';
  
  // Card and form sizing
  const cardPadding = isMobile ? 'p-3' : isTablet ? 'p-4' : 'p-6';
  const cardHeaderPadding = isMobile ? 'p-3 pb-2' : isTablet ? 'p-4 pb-3' : 'p-6 pb-4';
  const cardContentPadding = isMobile ? 'p-3' : isTablet ? 'p-4' : 'p-6';
  const formLabelSize = isMobile ? 'text-xs' : 'text-sm';
  const formInputHeight = isMobile ? 'h-9' : 'h-10';
  const sectionSpacing = isMobile ? 'space-y-2' : 'space-y-4';
  const titleSize = isMobile ? 'text-base' : 'text-lg';
  const iconSize = isMobile ? 'h-4 w-4' : 'h-5 w-5';
  
  // Field display patterns - consistent label-value display
  const fieldLayout = isMobile ? 'flex-col items-start gap-0.5' : 'gap-2';
  const fieldContainerClass = `flex items-center flex-wrap ${fieldLayout}`;

  return {
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    isPortrait: orientation.isPortrait,
    isLandscape: orientation.isLandscape,
    shouldUseDrawer,
    shouldStackVertically,
    shouldUseSingleColumn,
    shouldShowFullscreenModals,
    shouldUseBiggerTouchTargets,
    shouldUseBottomNavigation,
    shouldUseCompactHeader,
    shouldHideDesktopNav,
    shouldUseCardList,
    gridCols,
    containerPadding,
    cardSpacing,
    touchTargetSize,
    mobileIconSize,
    mobileHeaderHeight,
    cardPadding,
    cardHeaderPadding,
    cardContentPadding,
    formLabelSize,
    formInputHeight,
    sectionSpacing,
    titleSize,
    iconSize,
    fieldLayout,
    fieldContainerClass,
  };
}