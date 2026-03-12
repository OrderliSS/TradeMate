import React from 'react';
import './Dashboard.css';
import { DashboardMetricsSection } from '../components/DashboardMetricsSection';
import { SalesQueueWidget } from '../components/SalesQueueWidget';
import { StockOrderTrackingWidget } from '../components/StockOrderTrackingWidget';
import { DashboardCalendarWidget } from '../components/DashboardCalendarWidget';

export const ClassicDashboard = () => {
    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h2 className="section-title">Metric Index</h2>
                <div className="metrics-wrapper">
                    <DashboardMetricsSection />
                </div>
            </header>
            
            <section className="workflow-center">
                <h2 className="section-title">Workflow Center</h2>
                <div className="workflow-grid">
                    <article className="workflow-card premium-card">
                        <div className="card-header">
                            <h3 className="card-title">Sales Ticket Queue</h3>
                        </div>
                        <div className="card-content">
                            <SalesQueueWidget statusFilter="all" />
                        </div>
                    </article>

                    <article className="workflow-card premium-card">
                        <div className="card-header">
                            <h3 className="card-title">Stock Order Tracking</h3>
                        </div>
                        <div className="card-content">
                            <StockOrderTrackingWidget filter="all" />
                        </div>
                    </article>

                    <article className="workflow-card premium-card">
                        <div className="card-header">
                            <h3 className="card-title">Service Calendar</h3>
                        </div>
                        <div className="card-content">
                            <DashboardCalendarWidget selectedDate={new Date()} onSelectedDateChange={() => {}} />
                        </div>
                    </article>
                </div>
            </section>
        </div>
    );
};
