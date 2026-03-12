import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ClassicLayout } from './layouts/ClassicLayout';
import { ClassicDashboard } from './views/ClassicDashboard';
import { SalesQueue } from './views/SalesQueue';
import { ServiceCalendar } from './views/ServiceCalendar';

export default function App() {
  return (
    <Router>
      <ClassicLayout>
        <Routes>
          <Route path="/" element={<ClassicDashboard />} />
          <Route path="/workspace-operations/sales-queue" element={<SalesQueue />} />
          <Route path="/workspace-operations/calendar" element={<ServiceCalendar />} />
        </Routes>
      </ClassicLayout>
    </Router>
  );
}
