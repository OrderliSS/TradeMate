import React from 'react';
import { Check, LayoutGrid, List, Table, Grid3X3, Grid2X2, Star, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type ViewModeOption = 'cards' | 'list' | 'table' | 'compact' | 'tiles' | 'groups' | 'grid' | 'categories';

interface ViewModeConfig {
  value: ViewModeOption;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const VIEW_MODE_CONFIGS: Record<ViewModeOption, ViewModeConfig> = {
  cards: { value: 'cards', label: 'Cards', icon: LayoutGrid },
  list: { value: 'list', label: 'List', icon: Table },
  table: { value: 'table', label: 'Table', icon: Table },
  compact: { value: 'compact', label: 'Compact', icon: List },
  tiles: { value: 'tiles', label: 'Tiles', icon: Grid2X2 },
  groups: { value: 'groups', label: 'Groups', icon: List },
  grid: { value: 'grid', label: 'Grid', icon: Grid3X3 },
  categories: { value: 'categories', label: 'Categories', icon: List },
};

interface ViewModeDropdownProps<T extends string = ViewModeOption> {
  viewMode: T;
  onViewModeChange: (mode: T) => void;
  availableModes: T[];
  userDefaultMode?: T;
  onSetAsDefault?: () => void;
  isCurrentDefault?: boolean;
  size?: 'sm' | 'default';
  className?: string;
  showLabel?: boolean;
  align?: 'start' | 'center' | 'end';
  buttonLabel?: string;
}

export function ViewModeDropdown<T extends string = ViewModeOption>({
  viewMode,
  onViewModeChange,
  availableModes,
  userDefaultMode,
  onSetAsDefault,
  isCurrentDefault = false,
  size = 'sm',
  className,
  showLabel = true,
  align = 'end',
  buttonLabel,
}: ViewModeDropdownProps<T>) {
  const currentConfig = VIEW_MODE_CONFIGS[viewMode as ViewModeOption] || {
    value: viewMode,
    label: viewMode.charAt(0).toUpperCase() + viewMode.slice(1),
    icon: LayoutGrid,
  };
  const CurrentIcon = currentConfig.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className={cn(
            "gap-1.5",
            size === 'sm' ? "h-8 px-2" : "h-9 px-3",
            className
          )}
          aria-label={`View mode: ${currentConfig.label}. Click to change view`}
        >
          <CurrentIcon className="h-4 w-4" />
          {showLabel && (
            <span className="hidden sm:inline">{buttonLabel || currentConfig.label}</span>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44 z-50 bg-popover">
        {availableModes.map((mode) => {
          const config = VIEW_MODE_CONFIGS[mode as ViewModeOption] || {
            value: mode,
            label: mode.charAt(0).toUpperCase() + mode.slice(1).replace('_', ' '),
            icon: LayoutGrid,
          };
          const Icon = config.icon;
          const isActive = viewMode === mode;

          const isUserDefault = userDefaultMode === mode;
          return (
            <DropdownMenuItem
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">
                {config.label}
                {isUserDefault && (
                  <span className="text-muted-foreground ml-1 text-xs">(default)</span>
                )}
              </span>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        
        {onSetAsDefault && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onSetAsDefault}
              disabled={isCurrentDefault}
              className="gap-2"
            >
              <Star className={cn("h-4 w-4", isCurrentDefault && "fill-current text-primary")} />
              <span className="flex-1">
                {isCurrentDefault ? 'Current default' : 'Set as default'}
              </span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
