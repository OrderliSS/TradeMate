import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { useDynamicCategories } from "@/hooks/useDynamicCategories";

interface ContactRoleSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

const FALLBACK_ROLES = [
  "customer",
  "owner",
  "manager",
  "admin",
  "accounts",
  "purchasing",
  "warehouse",
  "sales",
  "technician",
  "support",
  "other"
];

export const ContactRoleSelect = ({
  value,
  onValueChange,
  placeholder = "Select contact role"
}: ContactRoleSelectProps) => {
  const { categories, isLoading } = useDynamicCategories("contact_roles");

  // Use categories from database if available, otherwise use fallback list
  // Note: we preserve original name as value for database roles to match existing data
  const displayRoles = categories.length > 0
    ? categories.map(c => ({ id: c.id, value: c.name, label: c.name }))
    : FALLBACK_ROLES.map(role => ({ id: role.toLowerCase(), value: role, label: role.charAt(0).toUpperCase() + role.slice(1) }));

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={isLoading ? "Loading..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {displayRoles.map((role) => (
          <SelectItem key={role.id} value={role.value}>
            {role.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
