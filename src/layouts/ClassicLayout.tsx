import React, { useState } from 'react';
import './Layout.css';
import { ModernSidebar } from '../components/ModernSidebar';
import { UniversalNavBar } from '../components/UniversalNavBar';

export const ClassicLayout = ({ children }: { children: React.ReactNode }) => {
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
    const [sidebarPinned, setSidebarPinned] = useState(true);

    return (
        <div className="app-layout">
            <ModernSidebar
                isExpanded={isSidebarExpanded}
                onExpandedChange={(expanded) => {
                    if (!sidebarPinned) setIsSidebarExpanded(expanded);
                }}
                isPinned={sidebarPinned}
                onTogglePin={() => setSidebarPinned(!sidebarPinned)}
                expandableMode={true}
            />

            <div className={`main-content ${isSidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
                <nav className="top-nav">
                    <UniversalNavBar hideDropdownTabs={true} />
                </nav>
                <main className="page-body">
                    {children}
                </main>
            </div>
        </div>
    );
};
