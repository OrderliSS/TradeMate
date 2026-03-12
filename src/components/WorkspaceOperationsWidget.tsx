import { useState } from "react";
import { cn } from "@/lib/utils";
import { TeamRosterWidget } from "./TeamRosterWidget";
import { DailyAssignmentsWidget } from "./DailyAssignmentsWidget";

interface WorkspaceOperationsWidgetProps {
    activeView?: 'roster' | 'appointments';
    onViewChange?: (view: 'roster' | 'appointments') => void;
}

export const WorkspaceOperationsWidget = ({ activeView: externalView, onViewChange }: WorkspaceOperationsWidgetProps = {}) => {
    const [internalView, setInternalView] = useState<'roster' | 'appointments'>('roster');
    const activeView = externalView ?? internalView;

    return (
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
                {activeView === 'roster' && (
                    <div className="h-full bg-white">
                        <TeamRosterWidget />
                    </div>
                )}

                {activeView === 'appointments' && (
                    <div className="h-full bg-white p-3 pt-1 space-y-0">
                        <DailyAssignmentsWidget date={new Date()} type="appointments" />
                        <DailyAssignmentsWidget date={new Date()} type="meetings" />
                        <DailyAssignmentsWidget date={new Date()} type="reminders" />
                        <DailyAssignmentsWidget date={new Date()} type="shifts" />
                        <DailyAssignmentsWidget date={new Date()} type="oncall" />
                    </div>
                )}
            </div>
        </div>
    );
};
