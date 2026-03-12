import { useState } from "react";
import { Check, ChevronsUpDown, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ContactDialog } from "@/components/ContactDialog";
import { cn } from "@/lib/utils";
import type { Contact } from "@/types/database";

interface CustomerComboboxProps {
  value: string;
  onValueChange: (value: string, isCustomerId: boolean) => void;
  customers: Contact[];
  placeholder?: string;
  required?: boolean;
  allowCustom?: boolean;
  allowNone?: boolean;
}

export function CustomerCombobox({
  value,
  onValueChange,
  customers = [],
  placeholder = "Search or type customer name...",
  required = false,
  allowCustom = true,
  allowNone = true,
}: CustomerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [contactDialogInitialName, setContactDialogInitialName] = useState("");

  // Find selected customer
  const selectedCustomer = customers.find((c) => c.id === value);
  
  // Display value: customer name, custom value, or placeholder
  const displayValue = selectedCustomer?.name || (value && !selectedCustomer ? value : "");

  // Filter customers based on search
  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if search query matches any customer
  const hasExactMatch = filteredCustomers.some(
    (c) => c.name.toLowerCase() === searchQuery.toLowerCase()
  );

  const handleSelectCustomer = (customerId: string) => {
    onValueChange(customerId, true);
    setOpen(false);
    setSearchQuery("");
  };

  const handleUseCustomName = () => {
    if (searchQuery.trim()) {
      onValueChange(searchQuery.trim(), false);
      setOpen(false);
      setSearchQuery("");
    }
  };

  const handleCustomerCreated = (customerId: string) => {
    onValueChange(customerId, true);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between"
          >
            {displayValue ? (
              <span className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {displayValue}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or type customer name..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>
                {searchQuery ? (
                  <div className="text-sm text-muted-foreground p-2">
                    No customers found matching "{searchQuery}"
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-2">
                    Start typing to search customers
                  </div>
                )}
              </CommandEmpty>
              
              <CommandGroup>
                {allowNone && (
                  <CommandItem
                    value="none"
                    onSelect={() => {
                      onValueChange("", false);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                    onClick={() => {
                      onValueChange("", false);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-muted-foreground">No customer</span>
                  </CommandItem>
                )}
                
                {filteredCustomers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => handleSelectCustomer(customer.id)}
                    onClick={() => handleSelectCustomer(customer.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === customer.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{customer.name}</span>
                      {customer.email && (
                        <span className="text-xs text-muted-foreground">
                          {customer.email}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>

              {allowCustom && searchQuery && !hasExactMatch && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem onSelect={handleUseCustomName} onClick={handleUseCustomName}>
                      <Plus className="mr-2 h-4 w-4" />
                      Use "{searchQuery}" as custom name
                    </CommandItem>
                    <CommandItem
                      onSelect={() => {
                        setContactDialogInitialName(searchQuery);
                        setOpen(false);
                        setTimeout(() => setShowContactDialog(true), 150);
                      }}
                      onClick={() => {
                        setContactDialogInitialName(searchQuery);
                        setOpen(false);
                        setTimeout(() => setShowContactDialog(true), 150);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add "{searchQuery}" to contacts
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <ContactDialog
        onCustomerCreated={handleCustomerCreated}
        trigger={
          <Button variant="outline" size="icon" type="button" aria-label="Add new customer">
            <Plus className="h-4 w-4" />
          </Button>
        }
      />

      {showContactDialog && (
        <ContactDialog
          open={showContactDialog}
          onOpenChange={setShowContactDialog}
          initialName={contactDialogInitialName}
          onCustomerCreated={(customerId) => {
            handleCustomerCreated(customerId);
            setShowContactDialog(false);
          }}
        />
      )}
    </div>
  );
}
