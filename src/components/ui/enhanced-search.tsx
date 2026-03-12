import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EnhancedSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onClear?: () => void;
  showClearButton?: boolean;
}

export const EnhancedSearch: React.FC<EnhancedSearchProps> = ({
  value,
  onChange,
  placeholder = "Search...",
  className,
  disabled = false,
  onClear,
  showClearButton = true
}) => {
  const handleClear = () => {
    onChange("");
    onClear?.();
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "pl-10",
          showClearButton && value && "pr-10"
        )}
      />
      {showClearButton && value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
          onClick={handleClear}
        >
          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </Button>
      )}
    </div>
  );
};

// Advanced search with filters
interface SearchFilter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface AdvancedSearchProps extends EnhancedSearchProps {
  filters?: SearchFilter[];
  activeFilters?: Record<string, string>;
  onFilterChange?: (filters: Record<string, string>) => void;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  filters = [],
  activeFilters = {},
  onFilterChange,
  ...searchProps
}) => {
  const updateFilter = (filterKey: string, value: string) => {
    const newFilters = { ...activeFilters };
    if (value) {
      newFilters[filterKey] = value;
    } else {
      delete newFilters[filterKey];
    }
    onFilterChange?.(newFilters);
  };

  return (
    <div className="space-y-4">
      <EnhancedSearch {...searchProps} />
      
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <select
              key={filter.key}
              value={activeFilters[filter.key] || ""}
              onChange={(e) => updateFilter(filter.key, e.target.value)}
              className="px-3 py-2 text-sm border rounded-md bg-background"
            >
              <option value="">{filter.label}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}
      
      {Object.keys(activeFilters).length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Active filters:</span>
          {Object.entries(activeFilters).map(([key, value]) => {
            const filter = filters.find(f => f.key === key);
            const option = filter?.options.find(o => o.value === value);
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md"
              >
                {filter?.label}: {option?.label || value}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => updateFilter(key, "")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </span>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onFilterChange?.({})}
            className="text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
};