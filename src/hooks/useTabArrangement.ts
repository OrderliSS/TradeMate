import { useState } from 'react';
import { Package, Tag, PackagePlus, Truck, Layers, LucideIcon } from 'lucide-react';

export interface TabConfig {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  value: string;
}

const DEFAULT_TAB_ORDER: TabConfig[] = [
  { id: 'items', label: 'Item Management', shortLabel: 'Items', icon: Package, value: 'items' },
  { id: 'assets', label: 'Asset Tags', shortLabel: 'Assets', icon: Tag, value: 'assets' },
  { id: 'inbound', label: 'Inbound Stock & Shipping', shortLabel: 'Inbound', icon: PackagePlus, value: 'inbound' },
  { id: 'outbound', label: 'Outbound Delivery', shortLabel: 'Outbound', icon: Truck, value: 'outbound' },
  { id: 'tasks', label: 'Linked Records', shortLabel: 'Records', icon: Layers, value: 'tasks' },
];

const STORAGE_KEY = 'purchase-tabs-order';

export const useTabArrangement = () => {
  const [tabOrder, setTabOrder] = useState<TabConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Migration: Convert old tab order to new structure
        const migrated = parsed.map((tab: TabConfig) => {
          // Replace 'stock' or 'shipping' with 'inbound'
          if (tab.id === 'stock' || tab.id === 'shipping') {
            return DEFAULT_TAB_ORDER.find(t => t.id === 'inbound');
          }
          return tab;
        }).filter((tab: TabConfig | undefined, index: number, array: any[]) => {
          // Remove duplicates
          if (!tab) return false;
          return array.findIndex((t: any) => t?.id === tab.id) === index;
        });
        
        // Add 'outbound' if missing
        if (!migrated.some((t: TabConfig) => t.id === 'outbound')) {
          const outboundTab = DEFAULT_TAB_ORDER.find(t => t.id === 'outbound');
          const inboundIndex = migrated.findIndex((t: TabConfig) => t.id === 'inbound');
          if (inboundIndex !== -1 && outboundTab) {
            migrated.splice(inboundIndex + 1, 0, outboundTab);
          } else if (outboundTab) {
            migrated.push(outboundTab);
          }
        }
        
        // Validate all default tabs are present
        const hasAllTabs = DEFAULT_TAB_ORDER.every(defaultTab => 
          migrated.some((tab: TabConfig) => tab.id === defaultTab.id)
        );
        
        if (hasAllTabs) {
          return migrated;
        }
      }
    } catch (error) {
      console.error('Error loading tab order:', error);
    }
    return DEFAULT_TAB_ORDER;
  });

  const updateTabOrder = (newOrder: TabConfig[]) => {
    setTabOrder(newOrder);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
    } catch (error) {
      console.error('Error saving tab order:', error);
    }
  };

  const resetToDefault = () => {
    setTabOrder(DEFAULT_TAB_ORDER);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error resetting tab order:', error);
    }
  };

  return { tabOrder, updateTabOrder, resetToDefault, defaultTabOrder: DEFAULT_TAB_ORDER };
};
