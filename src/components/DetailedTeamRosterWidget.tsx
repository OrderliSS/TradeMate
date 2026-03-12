import { Users, Phone, Sun, Moon, Clock, Calendar, MessageSquare, Settings, Check } from 'lucide-react';
import { useTeamSchedule } from '@/hooks/useTeamSchedule';
import { cn } from '@/lib/utils';
import { useEnvNavigate } from '@/hooks/useEnvNavigate';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardTitle, EnhancedCardContent } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { format } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CustomRole {
    id: string;
    name: string;
    color: string;
}

const getShiftIcon = (shiftName: string) => {
    const name = shiftName.toLowerCase();
    if (name.includes('morning')) return Sun;
    if (name.includes('night')) return Moon;
    return Clock;
};

export const DetailedTeamRosterWidget = () => {
    const [filter, setFilter] = useState<'all' | 'working' | 'on_call'>('all');

    // Load default filter on mount
    useEffect(() => {
        const savedDefault = localStorage.getItem('roster_filter_default');
        if (savedDefault && ['all', 'working', 'on_call'].includes(savedDefault)) {
            setFilter(savedDefault as 'all' | 'working' | 'on_call');
        }
    }, []);

    const handleSetDefault = () => {
        localStorage.setItem('roster_filter_default', filter);
    };

    const { data: schedules, isLoading } = useTeamSchedule(new Date());
    const navigate = useEnvNavigate();

    const handleNavigateToRoster = () => {
        navigate('/workspace?tab=roster');
    };

    // Custom Roles State
    const [roles, setRoles] = useState<CustomRole[]>([]);

    // Load roles to display badges correctly
    useEffect(() => {
        const loadRoles = () => {
            const savedRoles = localStorage.getItem('orderli_roster_roles');
            if (savedRoles) {
                try {
                    setRoles(JSON.parse(savedRoles));
                } catch (e) {
                    console.error("Failed to parse roles", e);
                }
            }
        };
        loadRoles();
        // Listen for storage events in case settings change
        window.addEventListener('storage', loadRoles);
        return () => window.removeEventListener('storage', loadRoles);
    }, []);

    // Helper to extract and render role badge
    const renderRoleBadge = (notes: string | null) => {
        if (!notes) return null;
        const match = notes.match(/\[Role: (.*?)\]/);
        if (match && match[1]) {
            const roleName = match[1];
            const role = roles.find(r => r.name === roleName);
            const color = role?.color || "#6b7280";

            return (
                <Badge
                    variant="outline"
                    className="text-[10px] h-4 px-1 ml-2 border-0"
                    style={{
                        backgroundColor: `${color}15`,
                        color: color
                    }}
                >
                    {roleName}
                </Badge>
            );
        }
        return null;
    };

    // Helper to clean notes for display
    const cleanNotes = (notes: string | null) => {
        if (!notes) return null;
        const cleaned = notes.replace(/\[Role: .*?\]/, "").trim();
        return cleaned || null;
    };

    const onCallMembers = useMemo(() => {
        if (!schedules) return [];
        if (filter === 'working') return [];
        return schedules.filter(s => s.is_on_call);
    }, [schedules, filter]);

    const workingMembers = useMemo(() => {
        if (!schedules) return [];
        if (filter === 'on_call') return [];
        return schedules.filter(s => s.shift_id);
    }, [schedules, filter]);

    // Group by shift
    const membersByShift = useMemo(() => {
        return workingMembers.reduce((acc, member) => {
            const shiftId = member.shift_id || 'unassigned';
            if (!acc[shiftId]) {
                acc[shiftId] = {
                    name: member.shift?.name || 'Unassigned',
                    members: [],
                    shift: member.shift
                };
            }
            acc[shiftId].members.push(member);
            return acc;
        }, {} as Record<string, { name: string; members: any[]; shift: any }>);
    }, [workingMembers]);

    const hasData = schedules && schedules.length > 0;
    const hasFilteredData = onCallMembers.length > 0 || workingMembers.length > 0;

    if (isLoading) {
        return (
            <EnhancedCard className="h-full flex flex-col">
                <EnhancedCardHeader>
                    <EnhancedCardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Team Roster
                    </EnhancedCardTitle>
                </EnhancedCardHeader>
                <EnhancedCardContent className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="text-sm">Loading roster...</span>
                    </div>
                </EnhancedCardContent>
            </EnhancedCard>
        );
    }

    return (
        <EnhancedCard className="h-full flex flex-col transition-all duration-200 hover:shadow-md">
            <EnhancedCardHeader className="pb-2">
                <EnhancedCardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-primary text-sm">
                        <Users className="h-4 w-4" />
                        Team Roster
                    </span>
                    <div className="flex items-center gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
                                    <Settings className="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-popover border shadow-lg z-50">
                                <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Filter View</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setFilter('all')} className="text-xs flex items-center justify-between cursor-pointer">
                                    All Members
                                    {filter === 'all' && <Check className="h-3 w-3" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilter('working')} className="text-xs flex items-center justify-between cursor-pointer">
                                    Working Only
                                    {filter === 'working' && <Check className="h-3 w-3" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilter('on_call')} className="text-xs flex items-center justify-between cursor-pointer">
                                    On Call Only
                                    {filter === 'on_call' && <Check className="h-3 w-3" />}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleSetDefault} className="text-xs font-medium text-primary cursor-pointer">
                                    Save as Default View
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <EnhancedButton
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:bg-primary/10 h-7 px-2 text-xs"
                            onClick={handleNavigateToRoster}
                        >
                            View All
                        </EnhancedButton>
                    </div>
                </EnhancedCardTitle>
            </EnhancedCardHeader>
            <EnhancedCardContent className="flex-1 flex flex-col overflow-auto pt-2">
                {!hasFilteredData ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-muted/20 rounded-lg border border-dashed border-muted">
                        <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                            <Calendar className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                            {filter === 'all' ? 'No shifts scheduled for today' : `No ${filter.replace('_', ' ')} members today`}
                        </p>
                        <EnhancedButton
                            variant="link"
                            size="sm"
                            className="mt-1"
                            onClick={handleNavigateToRoster}
                        >
                            Update Schedule
                        </EnhancedButton>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* On Call Section - High prominence */}
                        {onCallMembers.length > 0 && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-3">
                                <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                    <Phone className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
                                        On Call Support
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {onCallMembers.map(member => (
                                            <div key={member.id} className="flex flex-col">
                                                <span className="text-sm font-bold text-foreground">
                                                    {member.user.full_name || member.user.email?.split('@')[0]}
                                                    {renderRoleBadge(member.notes)}
                                                </span>
                                                {cleanNotes(member.notes) && (
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground italic">
                                                        <MessageSquare className="h-2 w-2" />
                                                        <span className="truncate max-w-[150px]">{cleanNotes(member.notes)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Shift Breakdown */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                                Active Shifts
                            </h4>
                            <div className="grid gap-2">
                                {Object.values(membersByShift).map(({ name, members, shift }) => {
                                    const ShiftIcon = getShiftIcon(name);
                                    const color = shift?.color || '#3b82f6';

                                    return (
                                        <div
                                            key={name}
                                            className="group relative flex flex-col p-3 rounded-xl border border-border/50 bg-card hover:border-primary/20 hover:bg-muted/30 transition-all"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="h-7 w-7 rounded-lg flex items-center justify-center"
                                                        style={{ backgroundColor: `${color}15` }}
                                                    >
                                                        <ShiftIcon className="h-4 w-4" style={{ color }} />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-bold block leading-none">{name}</span>
                                                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                                                            {shift?.start_time ? `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}` : 'Manual Shift'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted/50">
                                                    {members.length}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap gap-x-3 gap-y-1.5 ml-9 border-l border-muted pl-3">
                                                {members.map(m => (
                                                    <div key={m.id} className="flex flex-col min-w-0">
                                                        <div className="flex items-center min-w-0">
                                                            <span className="text-xs font-medium text-foreground truncate">
                                                                {m.user.full_name || m.user.email?.split('@')[0]}
                                                            </span>
                                                            {renderRoleBadge(m.notes)}
                                                        </div>
                                                        {cleanNotes(m.notes) && (
                                                            <span className="text-[9px] text-muted-foreground truncate italic max-w-[120px]">
                                                                {cleanNotes(m.notes)}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </EnhancedCardContent>
        </EnhancedCard>
    );
};
