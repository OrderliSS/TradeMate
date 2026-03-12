import React from 'react';
import { DashboardCalendarWidget } from '../components/DashboardCalendarWidget';

export const ServiceCalendar = () => {
    return (
        <div className="h-full">
            <h1 className="text-xl font-bold mb-4">Service Calendar</h1>
            <DashboardCalendarWidget selectedDate={new Date()} onSelectedDateChange={() => {}} />
        </div>
    );
};
