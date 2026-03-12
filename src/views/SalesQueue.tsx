import React from 'react';
import { SalesQueueWidget } from '../components/SalesQueueWidget';

export const SalesQueue = () => {
    return (
        <div className="h-full">
            <h1 className="text-xl font-bold mb-4">Sales Ticket Queue</h1>
            <SalesQueueWidget statusFilter="all" />
        </div>
    );
};
