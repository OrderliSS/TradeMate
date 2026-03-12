import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { Calendar as CalendarIcon, ChevronRight, Check, SlidersHorizontal, PanelBottomOpen, PanelBottomClose, Settings, ArrowRight } from 'lucide-react';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardTitle, EnhancedCardContent } from '@/components/ui/enhanced-card';
import { useAppointments } from '@/hooks/useAppointments';
import { useTasks } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { useEnvNavigate } from '@/hooks/useEnvNavigate';
import { AppointmentStatus } from '@/types/appointments';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { DailyAssignmentsWidget } from '@/components/dashboard/DailyAssignmentsWidget';
import { TeamRosterWidget } from '@/components/dashboard/TeamRosterWidget';

type CalendarMode = 'appointments' | 'reminders' | 'roster' | null;

const MODE_LABELS: Record<string, string> = {
  appointments: 'Appointments',
  reminders: 'Reminders',
  roster: 'Roster',
};

const getStatusPriority = (status: AppointmentStatus): number => {
  const priorities: Record<AppointmentStatus, number> = {
    in_progress: 8, confirmed: 7, scheduled: 6, tentative: 5,
    unconfirmed: 4, rescheduled: 3, completed: 2, no_show: 1, cancelled: 0,
  };
  return priorities[status] ?? 0;
};

const getStatusUnderlineColor = (status: AppointmentStatus, isCurrentDay: boolean): string => {
  if (isCurrentDay) {
    switch (status) {
      case 'confirmed': case 'in_progress': return 'bg-green-300';
      case 'completed': return 'bg-blue-200';
      case 'unconfirmed': case 'tentative': case 'scheduled': case 'rescheduled': return 'bg-amber-300';
      default: return 'bg-primary-foreground/50';
    }
  }
  switch (status) {
    case 'confirmed': case 'in_progress': return 'bg-green-500';
    case 'completed': return 'bg-blue-500';
    case 'unconfirmed': case 'tentative': case 'scheduled': case 'rescheduled': return 'bg-amber-500';
    default: return 'bg-muted-foreground/30';
  }
};

interface DashboardCalendarWidgetProps {
  selectedDate?: Date;
  onSelectedDateChange?: (date: Date) => void;
}

export const DashboardCalendarWidget = ({ selectedDate: propSelectedDate, onSelectedDateChange }: DashboardCalendarWidgetProps) => {
  const navigate = useEnvNavigate();
  const currentDate = new Date();
  const [activeMode, setActiveMode] = useState<CalendarMode>(() => {
    const saved = localStorage.getItem('calendar_active_mode');
    return saved !== null ? JSON.parse(saved) : 'appointments';
  });
  const [internalSelectedDate, setInternalSelectedDate] = useState(new Date());
  const selectedDate = propSelectedDate ?? internalSelectedDate;
  const setSelectedDate = onSelectedDateChange ?? setInternalSelectedDate;
  const [showDetail, setShowDetail] = useState<boolean>(() => {
    const saved = localStorage.getItem('calendar_show_detail');
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('calendar_active_mode', JSON.stringify(activeMode));
    localStorage.setItem('calendar_show_detail', JSON.stringify(showDetail));
  }, [activeMode, showDetail]);

  const dateRange = useMemo(() => ({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) }), [currentDate]);
  const { data: appointments = [] } = useAppointments(dateRange);
  const { data: tasks = [] } = useTasks();

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getDayStatus = (date: Date): AppointmentStatus | null => {
    const dayAppointments = appointments.filter(app => isSameDay(new Date(app.start_time), date) && app.status !== 'cancelled');
    if (dayAppointments.length === 0) return null;
    return dayAppointments.reduce((highest, app) => (!highest || getStatusPriority(app.status) > getStatusPriority(highest) ? app.status : highest), null as any);
  };

  const hasTasksOnDay = (date: Date) => tasks.some(task => (task.due_date && isSameDay(new Date(task.due_date), date)) || (task.follow_up_date && isSameDay(new Date(task.follow_up_date), date)));

  return (
    <div className="flex-1 flex flex-col p-4 pt-2 h-full overflow-hidden">

      <div className="grid grid-cols-7 gap-px mb-1 shrink-0">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="flex items-center justify-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr gap-px flex-1 min-h-0 overflow-hidden">
        {calendarDays.map((day) => {
          const isCurrMonth = isSameMonth(day, currentDate);
          const isCurrDay = isToday(day);
          const dayStatus = getDayStatus(day);
          const hasTasks = hasTasksOnDay(day);
          const hasIndicator = dayStatus !== null || hasTasks;
          const isSelected = isSameDay(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={cn(
                "w-full aspect-square transition-all duration-200 flex flex-col items-center justify-center gap-0.5 relative group",
                !isCurrMonth && "opacity-20"
              )}
            >
              {isSelected && (
                <motion.div
                  layoutId="calendar-selection"
                  className="absolute inset-2 bg-primary rounded-lg shadow-sm shadow-primary/20 z-0"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              {isCurrDay && !isSelected && (
                <div className="absolute inset-2 border border-primary/20 bg-primary/5 rounded-lg z-0" />
              )}
              <span className={cn(
                "text-xs font-bold leading-none z-10 relative transition-all duration-200",
                isSelected ? "text-primary-foreground font-black scale-110" :
                  isCurrDay ? "text-primary font-black" : "text-slate-600 group-hover:text-slate-900"
              )}>
                {format(day, 'd')}
              </span>
              {hasIndicator && (
                <div className={cn(
                  "rounded-full h-1 w-1 z-10 relative transition-colors duration-200",
                  dayStatus ? getStatusUnderlineColor(dayStatus, isSelected) : "bg-slate-200"
                )} />
              )}
            </button>
          );
        })}
      </div>

    </div>
  );
};
