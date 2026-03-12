import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  color: string;
}

export interface TeamScheduleEntry {
  id: string;
  user_id: string;
  shift_id: string | null;
  schedule_date: string;
  is_on_call: boolean;
  notes: string | null;
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
  shift: Shift | null;
}

export const useShifts = () => {
  return useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .order('start_time');

      if (error) throw error;
      return data as Shift[];
    },
  });
};

export const useTeamSchedule = (date?: Date) => {
  const scheduleDate = date || new Date();
  const dateStr = format(scheduleDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['team-schedule', dateStr],
    queryFn: async () => {
      // First get schedules for the date
      const { data: schedules, error: schedulesError } = await supabase
        .from('team_schedules')
        .select('*')
        .eq('schedule_date', dateStr);

      if (schedulesError) throw schedulesError;

      if (!schedules || schedules.length === 0) {
        return [];
      }

      // Get user profiles for the scheduled users
      const userIds = schedules.map(s => s.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Get shifts
      const shiftIds = schedules.filter(s => s.shift_id).map(s => s.shift_id);
      let shifts: Shift[] = [];
      if (shiftIds.length > 0) {
        const { data: shiftData, error: shiftError } = await supabase
          .from('shifts')
          .select('*')
          .in('id', shiftIds);

        if (shiftError) throw shiftError;
        shifts = shiftData || [];
      }

      // Combine the data
      return schedules.map(schedule => ({
        ...schedule,
        user: profiles?.find(p => p.id === schedule.user_id) || {
          id: schedule.user_id,
          full_name: null,
          email: null,
        },
        shift: shifts.find(s => s.id === schedule.shift_id) || null,
      })) as TeamScheduleEntry[];
    },
  });
};

export const useTodayRoster = () => {
  const { data: schedules, isLoading } = useTeamSchedule(new Date());

  const onCallMembers = schedules?.filter(s => s.is_on_call) || [];
  const workingMembers = schedules?.filter(s => s.shift_id) || [];

  // Group by shift
  const membersByShift = workingMembers.reduce((acc, member) => {
    const shiftName = member.shift?.name || 'Unassigned';
    if (!acc[shiftName]) {
      acc[shiftName] = [];
    }
    acc[shiftName].push(member);
    return acc;
  }, {} as Record<string, TeamScheduleEntry[]>);

  return {
    onCallMembers,
    membersByShift,
    totalWorking: workingMembers.length,
    isLoading,
  };
};
