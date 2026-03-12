import { useState, useEffect, useCallback } from 'react';

export type MobileWidgetType = 'schedule' | 'activity' | 'lowStock' | 'topCustomers' | 'revenue';
export type WidgetLayoutMode = 'single' | 'stacked' | 'split';
export type CalendarDisplayMode = 'calendar-only' | 'calendar-operations' | 'calendar-tasks' | 'calendar-stats';

export interface MobileWidgetOption {
  id: MobileWidgetType;
  label: string;
  description: string;
}

export interface CalendarDisplayOption {
  id: CalendarDisplayMode;
  label: string;
  description: string;
}

export const MOBILE_WIDGET_OPTIONS: MobileWidgetOption[] = [
  {
    id: 'schedule',
    label: 'Schedule & Tasks',
    description: 'View upcoming events and pending tasks'
  },
  {
    id: 'activity',
    label: 'Recent Activity',
    description: 'Latest orders and updates'
  },
  {
    id: 'lowStock',
    label: 'Stock Alerts',
    description: 'All inventory stock levels'
  },
  {
    id: 'topCustomers',
    label: 'Top Customers',
    description: 'Your best customers'
  },
  {
    id: 'revenue',
    label: 'Revenue Chart',
    description: 'Quick revenue overview'
  }
];

export const CALENDAR_DISPLAY_OPTIONS: CalendarDisplayOption[] = [
  {
    id: 'calendar-only',
    label: 'Calendar Only',
    description: 'Full-width calendar view'
  },
  {
    id: 'calendar-operations',
    label: 'Calendar + Operations',
    description: 'Calendar with asset metrics'
  },
  {
    id: 'calendar-tasks',
    label: 'Calendar + Tasks',
    description: 'Calendar with today\'s tasks'
  },
  {
    id: 'calendar-stats',
    label: 'Calendar + Stats',
    description: 'Calendar with quick metrics'
  }
];

const STORAGE_KEY = 'mobileWidgetPreference';
const HIDDEN_WIDGETS_KEY = 'hiddenMobileWidgets';
const CALENDAR_DISPLAY_KEY = 'mobileCalendarDisplayMode';
const SECONDARY_WIDGET_KEY = 'mobileSecondaryWidget';
const LAYOUT_MODE_KEY = 'mobileWidgetLayoutMode';
const WIDGET_ORDER_KEY = 'mobileWidgetOrder';
const DEFAULT_WIDGET: MobileWidgetType = 'schedule';
const DEFAULT_CALENDAR_DISPLAY: CalendarDisplayMode = 'calendar-operations';
const DEFAULT_WIDGET_ORDER: MobileWidgetType[] = ['schedule', 'activity', 'lowStock', 'topCustomers', 'revenue'];

export const useMobileWidgetPreference = () => {
  const [selectedWidget, setSelectedWidget] = useState<MobileWidgetType>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as MobileWidgetType) || DEFAULT_WIDGET;
  });

  // Secondary widget for multi-widget layouts
  const [secondaryWidget, setSecondaryWidgetState] = useState<MobileWidgetType | null>(() => {
    const saved = localStorage.getItem(SECONDARY_WIDGET_KEY);
    return saved ? (saved as MobileWidgetType) : null;
  });

  // Layout mode: single, stacked, or split
  const [widgetLayout, setWidgetLayoutState] = useState<WidgetLayoutMode>(() => {
    const saved = localStorage.getItem(LAYOUT_MODE_KEY);
    return (saved as WidgetLayoutMode) || 'single';
  });

  // Track hidden widgets
  const [hiddenWidgets, setHiddenWidgets] = useState<MobileWidgetType[]>(() => {
    const saved = localStorage.getItem(HIDDEN_WIDGETS_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // Widget order for drag-and-drop reordering
  const [widgetOrder, setWidgetOrderState] = useState<MobileWidgetType[]>(() => {
    const saved = localStorage.getItem(WIDGET_ORDER_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_WIDGET_ORDER;
      }
    }
    return DEFAULT_WIDGET_ORDER;
  });

  // Calendar display mode (replaces isMergedView with more options)
  const [calendarDisplayMode, setCalendarDisplayMode] = useState<CalendarDisplayMode>(() => {
    const saved = localStorage.getItem(CALENDAR_DISPLAY_KEY);
    if (saved) {
      return saved as CalendarDisplayMode;
    }
    // Backward compatibility: check old merged view key
    const oldMerged = localStorage.getItem('mobileWidgetMergedView');
    if (oldMerged) {
      return JSON.parse(oldMerged) ? 'calendar-operations' : 'calendar-only';
    }
    return DEFAULT_CALENDAR_DISPLAY;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, selectedWidget);
    window.dispatchEvent(new CustomEvent('mobileWidgetChanged', { detail: selectedWidget }));
  }, [selectedWidget]);

  // Persist secondary widget
  useEffect(() => {
    if (secondaryWidget) {
      localStorage.setItem(SECONDARY_WIDGET_KEY, secondaryWidget);
    } else {
      localStorage.removeItem(SECONDARY_WIDGET_KEY);
    }
    window.dispatchEvent(new CustomEvent('mobileSecondaryWidgetChanged', { detail: secondaryWidget }));
  }, [secondaryWidget]);

  // Persist layout mode
  useEffect(() => {
    localStorage.setItem(LAYOUT_MODE_KEY, widgetLayout);
    window.dispatchEvent(new CustomEvent('mobileWidgetLayoutChanged', { detail: widgetLayout }));
  }, [widgetLayout]);

  // Persist hidden widgets
  useEffect(() => {
    localStorage.setItem(HIDDEN_WIDGETS_KEY, JSON.stringify(hiddenWidgets));
    window.dispatchEvent(new CustomEvent('mobileWidgetHiddenChanged', { detail: hiddenWidgets }));
  }, [hiddenWidgets]);

  // Persist widget order
  useEffect(() => {
    localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(widgetOrder));
    window.dispatchEvent(new CustomEvent('mobileWidgetOrderChanged', { detail: widgetOrder }));
  }, [widgetOrder]);

  // Persist calendar display mode
  useEffect(() => {
    localStorage.setItem(CALENDAR_DISPLAY_KEY, calendarDisplayMode);
    window.dispatchEvent(new CustomEvent('mobileCalendarDisplayChanged', { detail: calendarDisplayMode }));
  }, [calendarDisplayMode]);

  // Listen for changes from other hook instances
  useEffect(() => {
    const handleWidgetChanged = (e: CustomEvent) => {
      const newWidget = e.detail;
      if (newWidget !== selectedWidget) {
        setSelectedWidget(newWidget);
      }
    };

    const handleSecondaryChanged = (e: CustomEvent) => {
      const newSecondary = e.detail;
      if (newSecondary !== secondaryWidget) {
        setSecondaryWidgetState(newSecondary);
      }
    };

    const handleLayoutChanged = (e: CustomEvent) => {
      const newLayout = e.detail;
      if (newLayout !== widgetLayout) {
        setWidgetLayoutState(newLayout);
      }
    };

    const handleHiddenChanged = (e: CustomEvent) => {
      const newHidden = e.detail;
      if (JSON.stringify(newHidden) !== JSON.stringify(hiddenWidgets)) {
        setHiddenWidgets(newHidden);
      }
    };

    const handleCalendarDisplayChanged = (e: CustomEvent) => {
      const newMode = e.detail;
      if (newMode !== calendarDisplayMode) {
        setCalendarDisplayMode(newMode);
      }
    };

    const handleWidgetOrderChanged = (e: CustomEvent) => {
      const newOrder = e.detail;
      if (JSON.stringify(newOrder) !== JSON.stringify(widgetOrder)) {
        setWidgetOrderState(newOrder);
      }
    };

    window.addEventListener('mobileWidgetChanged', handleWidgetChanged as EventListener);
    window.addEventListener('mobileSecondaryWidgetChanged', handleSecondaryChanged as EventListener);
    window.addEventListener('mobileWidgetLayoutChanged', handleLayoutChanged as EventListener);
    window.addEventListener('mobileWidgetHiddenChanged', handleHiddenChanged as EventListener);
    window.addEventListener('mobileCalendarDisplayChanged', handleCalendarDisplayChanged as EventListener);
    window.addEventListener('mobileWidgetOrderChanged', handleWidgetOrderChanged as EventListener);
    return () => {
      window.removeEventListener('mobileWidgetChanged', handleWidgetChanged as EventListener);
      window.removeEventListener('mobileSecondaryWidgetChanged', handleSecondaryChanged as EventListener);
      window.removeEventListener('mobileWidgetLayoutChanged', handleLayoutChanged as EventListener);
      window.removeEventListener('mobileWidgetHiddenChanged', handleHiddenChanged as EventListener);
      window.removeEventListener('mobileCalendarDisplayChanged', handleCalendarDisplayChanged as EventListener);
      window.removeEventListener('mobileWidgetOrderChanged', handleWidgetOrderChanged as EventListener);
    };
  }, [selectedWidget, secondaryWidget, widgetLayout, hiddenWidgets, calendarDisplayMode, widgetOrder]);

  const changeWidget = (widgetId: MobileWidgetType) => {
    // If selecting the same as secondary, swap them
    if (widgetId === secondaryWidget) {
      setSecondaryWidgetState(selectedWidget);
    }
    setSelectedWidget(widgetId);
  };

  const setSecondaryWidget = (widgetId: MobileWidgetType | null) => {
    // Prevent setting secondary to same as primary
    if (widgetId === selectedWidget) {
      return;
    }
    setSecondaryWidgetState(widgetId);
  };

  const setWidgetLayout = (layout: WidgetLayoutMode) => {
    setWidgetLayoutState(layout);
    // Clear secondary if switching to single mode
    if (layout === 'single') {
      setSecondaryWidgetState(null);
    }
  };

  const swapWidgets = () => {
    if (secondaryWidget) {
      const temp = selectedWidget;
      setSelectedWidget(secondaryWidget);
      setSecondaryWidgetState(temp);
    }
  };

  const resetToDefault = () => {
    setSelectedWidget(DEFAULT_WIDGET);
    setSecondaryWidgetState(null);
    setWidgetLayoutState('single');
    setWidgetOrderState(DEFAULT_WIDGET_ORDER);
  };

  const setCalendarDisplay = (mode: CalendarDisplayMode) => {
    setCalendarDisplayMode(mode);
  };

  // Widget order management
  const setWidgetOrder = useCallback((newOrder: MobileWidgetType[]) => {
    setWidgetOrderState(newOrder);
  }, []);

  const reorderWidget = useCallback((fromIndex: number, toIndex: number) => {
    setWidgetOrderState(prev => {
      const newOrder = [...prev];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);
      return newOrder;
    });
  }, []);

  // Backward compatibility helper
  const isMergedView = calendarDisplayMode !== 'calendar-only';

  // Functions to manage visibility
  const hideWidget = (widgetId: MobileWidgetType) => {
    if (widgetId === selectedWidget || widgetId === secondaryWidget) {
      return;
    }
    if (!hiddenWidgets.includes(widgetId)) {
      setHiddenWidgets(prev => [...prev, widgetId]);
    }
  };

  const showWidget = (widgetId: MobileWidgetType) => {
    setHiddenWidgets(prev => prev.filter(id => id !== widgetId));
  };

  const isWidgetHidden = (widgetId: MobileWidgetType) => {
    return hiddenWidgets.includes(widgetId);
  };

  // Get widgets sorted by custom order
  const getOrderedWidgets = useCallback(() => {
    return [...MOBILE_WIDGET_OPTIONS].sort((a, b) => {
      const indexA = widgetOrder.indexOf(a.id);
      const indexB = widgetOrder.indexOf(b.id);
      return indexA - indexB;
    });
  }, [widgetOrder]);

  // Get only visible widgets (sorted by order)
  const visibleWidgets = getOrderedWidgets().filter(
    widget => !hiddenWidgets.includes(widget.id)
  );

  // Get widgets available for secondary selection (exclude primary and hidden)
  const availableForSecondary = visibleWidgets.filter(
    widget => widget.id !== selectedWidget
  );

  return {
    selectedWidget,
    secondaryWidget,
    widgetLayout,
    changeWidget,
    setSecondaryWidget,
    setWidgetLayout,
    swapWidgets,
    resetToDefault,
    availableWidgets: MOBILE_WIDGET_OPTIONS,
    calendarDisplayOptions: CALENDAR_DISPLAY_OPTIONS,
    visibleWidgets,
    availableForSecondary,
    hiddenWidgets,
    hideWidget,
    showWidget,
    isWidgetHidden,
    calendarDisplayMode,
    setCalendarDisplay,
    isMergedView, // backward compatibility
    // Widget ordering
    widgetOrder,
    setWidgetOrder,
    reorderWidget,
    getOrderedWidgets,
  };
};
