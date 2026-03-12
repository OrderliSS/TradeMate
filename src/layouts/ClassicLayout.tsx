import React, { useState } from 'react';
import { ModernSidebar } from '../components/ModernSidebar';
import { UniversalNavBar } from '../components/UniversalNavBar';

export const ClassicLayout = ({ children }: { children: React.ReactNode }) => {
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
    const [sidebarPinned, setSidebarPinned] = useState(true);

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <ModernSidebar
                isExpanded={isSidebarExpanded}
                onExpandedChange={(expanded) => {
                    if (!sidebarPinned) setIsSidebarExpanded(expanded);
                }}
                isPinned={sidebarPinned}
                onTogglePin={() => setSidebarPinned(!sidebarPinned)}
                expandableMode={true}
            />

            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-all duration-300">
                <div className="sticky top-0 z-30 flex-shrink-0">
                    <UniversalNavBar hideDropdownTabs={true} />
                </div>
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
};
