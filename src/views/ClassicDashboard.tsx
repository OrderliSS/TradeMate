import React from 'react';
import { DashboardMetricsSection } from '../components/DashboardMetricsSection';
import { SalesQueueWidget } from '../components/SalesQueueWidget';
import { StockOrderTrackingWidget } from '../components/StockOrderTrackingWidget';
import { DashboardCalendarWidget } from '../components/DashboardCalendarWidget';

export const ClassicDashboard = () => {
    return (
        <div className="flex flex-col gap-6">
            <section>
                <h2 className="text-xs font-bold uppercase text-slate-400 mb-2">Metric Index</h2>
                <DashboardMetricsSection />
            </section>
            
            <section>
                <h2 className="text-xs font-bold uppercase text-slate-400 mb-2">Workflow Center</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="h-[380px] bg-white border rounded-xl overflow-hidden shadow-sm">
                        <div className="px-3 py-2 border-b flex items-center justify-between h-10">
                            <h3 className="text-[10px] font-semibold uppercase text-slate-500">Sales Ticket Queue</h3>
                        </div>
                        <div className="p-1 h-[calc(100%-40px)]">
                            <SalesQueueWidget statusFilter="all" />
                        </div>
                    </div>
                    <div className="h-[380px] bg-white border rounded-xl overflow-hidden shadow-sm">
                         <div className="px-3 py-2 border-b flex items-center justify-between h-10">
                            <h3 className="text-[10px] font-semibold uppercase text-slate-500">Stock Order Tracking</h3>
                        </div>
                        <div className="p-1 h-[calc(100%-40px)]">
                            <StockOrderTrackingWidget filter="all" />
                        </div>
                    </div>
                    <div className="h-[380px] bg-white border rounded-xl overflow-hidden shadow-sm">
                         <div className="px-3 py-2 border-b flex items-center justify-between h-10">
                            <h3 className="text-[10px] font-semibold uppercase text-slate-500">Service Calendar</h3>
                        </div>
                        <div className="p-1 h-[calc(100%-40px)]">
                            <DashboardCalendarWidget selectedDate={new Date()} onSelectedDateChange={() => {}} />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
