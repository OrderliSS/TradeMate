import { useState } from 'react';
import { Check, ChevronsUpDown, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { TaskAssigneeRole } from '@/types/database';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface TeamMember {
  id: string;
  email: string;
  full_name?: string;
  employee_id?: string;
}

export interface AssignedMember extends TeamMember {
  role: TaskAssigneeRole;
  assignee_id?: string;
}

interface TeamMemberSelectorProps {
  availableMembers: TeamMember[];
  selectedMembers: AssignedMember[];
  onAdd: (memberId: string, role: TaskAssigneeRole) => void;
  onRemove: (assigneeId: string) => void;
  onRoleChange?: (assigneeId: string, role: TaskAssigneeRole) => void;
  disabled?: boolean;
  showRoleSelector?: boolean;
}

const roleLabels: Record<TaskAssigneeRole, string> = {
  case_manager: 'Case Manager',
  technician: 'Technician',
  support: 'Support',
  observer: 'Observer',
};

const roleColors: Record<TaskAssigneeRole, string> = {
  case_manager: 'bg-blue-100 text-blue-800',
  technician: 'bg-green-100 text-green-800',
  support: 'bg-purple-100 text-purple-800',
  observer: 'bg-gray-100 text-gray-800',
};

export const TeamMemberSelector = ({
  availableMembers,
  selectedMembers,
  onAdd,
  onRemove,
  onRoleChange,
  disabled = false,
  showRoleSelector = true,
}: TeamMemberSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TaskAssigneeRole>('case_manager');

  const getInitials = (member: TeamMember) => {
    if (member.full_name) {
      return member.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (member.employee_id) {
      return member.employee_id.slice(0, 2).toUpperCase();
    }
    return '??';
  };

  const getDisplayName = (member: TeamMember) => {
    if (member.full_name) {
      return member.full_name;
    }
    if (member.employee_id) {
      return member.employee_id;
    }
    return 'Unknown Member';
  };

  const selectedMemberIds = new Set(selectedMembers.map(m => m.id));
  const unassignedMembers = availableMembers.filter(m => !selectedMemberIds.has(m.id));

  const handleAddMember = (memberId: string) => {
    onAdd(memberId, selectedRole);
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      {/* Selected Members Display */}
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedMembers.map((member) => (
            <Badge
              key={member.id}
              variant="secondary"
              className="gap-2 pr-1 pl-2 py-1.5"
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-xs">
                  {getInitials(member)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{getDisplayName(member)}</span>
              {showRoleSelector && onRoleChange && member.assignee_id ? (
                <Select
                  value={member.role}
                  onValueChange={(value) => onRoleChange(member.assignee_id!, value as TaskAssigneeRole)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-5 w-auto border-0 bg-transparent p-0 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-md',
                  roleColors[member.role]
                )}>
                  {roleLabels[member.role]}
                </span>
              )}
              {!disabled && member.assignee_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-destructive/10"
                  onClick={() => onRemove(member.assignee_id!)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Add Member Dropdown */}
      {!disabled && unassignedMembers.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          {showRoleSelector && (
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as TaskAssigneeRole)}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="justify-between"
              >
                <User className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Add Member</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="Search team members..." />
                <CommandEmpty>No team member found.</CommandEmpty>
                <CommandGroup>
                  {unassignedMembers.map((member) => (
                    <CommandItem
                      key={member.id}
                      value={`${member.full_name} ${member.email}`}
                      onSelect={() => handleAddMember(member.id)}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {getInitials(member)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{getDisplayName(member)}</span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {unassignedMembers.length === 0 && selectedMembers.length === 0 && (
        <p className="text-sm text-muted-foreground">No team members available</p>
      )}
    </div>
  );
};
