import { useState, useMemo } from "react";
import { Product } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Check, 
  ChevronsUpDown, 
  Search, 
  Package, 
  Star, 
  Circle, 
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EnhancedProductSelectorProps {
  products: Product[];
  value: string;
  onValueChange: (value: string) => void;
  onProductSelect?: (product: Product | null) => void;
  placeholder?: string;
  showNoneOption?: boolean;
  className?: string;
}

export const EnhancedProductSelector = ({
  products = [],
  value,
  onValueChange,
  onProductSelect,
  placeholder = "Select product",
  showNoneOption = true,
  className,
}: EnhancedProductSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "primary" | "secondary">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(product => {
      if (product.category) {
        const mainCategory = product.category.split(' > ')[0];
        cats.add(mainCategory);
      }
    });
    return Array.from(cats).sort();
  }, [products]);

  // Filter and group products
  const processedProducts = useMemo(() => {
    let filtered = products;

    // Apply priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter(product => {
        const priority = (product as any).asset_priority;
        if (priorityFilter === "primary") {
          return priority === "primary" || !priority;
        } else {
          return priority === "secondary";
        }
      });
    }

    // Apply category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(product => {
        const mainCategory = product.category?.split(' > ')[0];
        return mainCategory === categoryFilter;
      });
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchLower) ||
        product.sku?.toLowerCase().includes(searchLower) ||
        product.brand?.toLowerCase().includes(searchLower) ||
        product.category?.toLowerCase().includes(searchLower)
      );
    }

    // Group by category
    const grouped = filtered.reduce((acc, product) => {
      const category = product.category?.split(' > ')[0] || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(product);
      return acc;
    }, {} as Record<string, Product[]>);

    // Sort products within each category by name
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => a.name.localeCompare(b.name));
    });

    return grouped;
  }, [products, search, priorityFilter, categoryFilter]);

  const selectedProduct = products.find(p => p.id === value);

  const handleSelect = (productId: string) => {
    onValueChange(productId);
    
    if (onProductSelect) {
      const product = products.find(p => p.id === productId) || null;
      onProductSelect(product);
    }
    
    setOpen(false);
  };

  const getPriorityIcon = (priority?: string) => {
    if (priority === "primary") return <Star className="h-3 w-3 text-yellow-500 fill-current" />;
    if (priority === "secondary") return <Circle className="h-3 w-3 text-muted-foreground" />;
    return <Star className="h-3 w-3 text-yellow-500 fill-current" />; // Default to primary
  };

  const clearFilters = () => {
    setSearch("");
    setPriorityFilter("all");
    setCategoryFilter("all");
  };

  const hasActiveFilters = search || priorityFilter !== "all" || categoryFilter !== "all";
  const totalFiltered = Object.values(processedProducts).flat().length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-9", className)}
        >
          {selectedProduct ? (
            <div className="flex items-center gap-1.5 truncate text-sm">
              {getPriorityIcon((selectedProduct as any).asset_priority)}
              <span className="truncate">{selectedProduct.name}</span>
            </div>
          ) : value === "none" ? (
            <span className="text-sm">None</span>
          ) : (
            <span className="text-sm text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[280px] p-0 bg-popover border shadow-lg" 
        align="end"
        side="right"
        sideOffset={8}
        collisionPadding={16}
      >
        <Command className="bg-transparent">
          {/* Compact Search */}
          <div className="flex items-center border-b px-2 py-1.5 bg-muted/30">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 border-0 shadow-none focus-visible:ring-0 text-sm bg-transparent pl-2"
            />
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-6 w-6 p-0 shrink-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {/* Compact Filter Chips */}
          <div className="px-2 py-1.5 border-b bg-muted/20 space-y-1.5">
            {/* Priority Pills */}
            <div className="flex items-center gap-1">
              {(["all", "primary", "secondary"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPriorityFilter(filter)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
                    priorityFilter === filter 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                >
                  {filter === "primary" && <Star className="h-2.5 w-2.5" />}
                  {filter === "secondary" && <Circle className="h-2.5 w-2.5" />}
                  {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            {/* Category Pills - Horizontal scroll */}
            {categories.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
                <button
                  onClick={() => setCategoryFilter("all")}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs whitespace-nowrap transition-colors shrink-0",
                    categoryFilter === "all" 
                      ? "bg-secondary text-secondary-foreground font-medium" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  All
                </button>
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs whitespace-nowrap transition-colors shrink-0",
                      categoryFilter === category 
                        ? "bg-secondary text-secondary-foreground font-medium" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results count */}
          <div className="px-2 py-1 text-xs text-muted-foreground border-b bg-background">
            {totalFiltered} product{totalFiltered !== 1 ? 's' : ''}
          </div>

          <CommandList className="max-h-[240px] overflow-y-auto">
            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
              No products found.
            </CommandEmpty>
            
            {showNoneOption && (
              <CommandGroup>
                <CommandItem 
                  onSelect={() => handleSelect("none")}
                  className="py-1.5 px-2 cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-1.5 h-3 w-3 shrink-0",
                      value === "none" ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Package className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm">None (General Stock Order)</span>
                </CommandItem>
              </CommandGroup>
            )}

            {Object.entries(processedProducts).map(([category, categoryProducts]) => (
              <CommandGroup 
                key={category} 
                heading={
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {category}
                  </span>
                }
                className="px-1"
              >
                {categoryProducts.map((product) => (
                  <CommandItem
                    key={product.id}
                    onSelect={() => handleSelect(product.id)}
                    className="py-1.5 px-2 cursor-pointer rounded"
                  >
                    <Check
                      className={cn(
                        "mr-1.5 h-3 w-3 shrink-0",
                        value === product.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {getPriorityIcon((product as any).asset_priority)}
                    <div className="ml-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{product.name}</span>
                      </div>
                      {(product.sku || product.brand) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {product.sku && (
                            <span className="font-mono">{product.sku}</span>
                          )}
                          {product.sku && product.brand && <span>•</span>}
                          {product.brand && <span>{product.brand}</span>}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
