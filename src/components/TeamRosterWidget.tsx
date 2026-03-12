import { Users, Phone, Sun, Moon, Clock, ArrowRight, Settings } from 'lucide-react';
import { useTodayRoster } from '@/hooks/useTeamSchedule';
import { cn } from '@/lib/utils';
import { useEnvNavigate } from '@/hooks/useEnvNavigate';
import { Button } from '@/components/ui/button';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardTitle, EnhancedCardContent } from '@/components/ui/enhanced-card';

const getShiftIcon = (shiftName: string) => {
  const name = shiftName.toLowerCase();
  if (name.includes('morning')) return Sun;
  if (name.includes('night')) return Moon;
  return Clock;
};

export const TeamRosterWidget = () => {
  const { onCallMembers, membersByShift, totalWorking, isLoading } = useTodayRoster();
  const navigate = useEnvNavigate();

  const handleNavigateToRoster = () => {
    navigate('/workspace?tab=roster');
  };

  const hasScheduleData = onCallMembers.length > 0 || totalWorking > 0;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center opacity-50 p-4 pt-10">
        <Users className="h-10 w-10 text-[#2563EB]/20 animate-pulse mb-3" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Personnel</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 pt-1 h-full min-h-0 overflow-hidden">
      {!hasScheduleData ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
          <div className="flex flex-col items-center justify-center">
            <Users className="h-10 w-10 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">No Active Roster</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status Summary - Compact */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-violet-50 border border-violet-100/50">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-violet-600 uppercase tracking-widest opacity-70 leading-none mb-1">Active Force</span>
              <span className="text-lg font-black text-slate-900 tracking-tighter leading-none">{totalWorking} Personnel</span>
            </div>
            <div className="flex -space-x-2">
              {[...Array(Math.min(3, totalWorking))].map((_, i) => (
                <div key={i} className="w-6 h-6 rounded-full border border-white bg-violet-200 flex items-center justify-center text-[9px] font-bold text-violet-700">
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
              {totalWorking > 3 && (
                <div className="w-6 h-6 rounded-full border border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500">
                  +{totalWorking - 3}
                </div>
              )}
            </div>
          </div>

          {/* On Call Responder - High Density */}
          {onCallMembers.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-[9px] font-black text-emerald-600 uppercase tracking-widest ml-1">Priority Responder</h4>
              {onCallMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-lg px-3 h-10">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-emerald-500 text-white flex items-center justify-center font-black text-[10px]">
                      {(member.user.full_name || 'U').charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold text-slate-800 tracking-tight leading-none">
                        {member.user.full_name || member.user.email?.split('@')[0]}
                      </span>
                      <span className="text-[9px] font-black text-emerald-700 uppercase tracking-tighter opacity-70 leading-none">On Call Priority</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-emerald-200/50 text-emerald-600">
                    <Phone className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Shift Deployment - Standardized rows */}
          <div className="space-y-3">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Shift Deployment</h4>
            <div className="space-y-1">
              {Object.entries(membersByShift).map(([shiftName, members]) => {
                const ShiftIcon = getShiftIcon(shiftName);
                return (
                  <div key={shiftName} className="group border border-slate-100 rounded-lg p-2 bg-white">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-2">
                        <ShiftIcon className="h-3 w-3 text-[#2563EB] opacity-60" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#2563EB]">
                          {shiftName}
                        </span>
                      </div>
                      <span className="text-[8px] font-black text-slate-400 uppercase">{members.length} Active</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {members.map((m) => (
                        <div key={m.id} className="px-2 h-7 flex items-center rounded-md bg-white border border-slate-100 text-[11px] font-bold text-slate-700">
                          {m.user.full_name || m.user.email?.split('@')[0]}
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
    </div>
  );
};
