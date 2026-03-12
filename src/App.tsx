import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProviders } from './AppProviders';
import { ClassicLayout } from './layouts/ClassicLayout';
import { ClassicDashboard } from './views/ClassicDashboard';
import './styles/theme.css';
import './index.css';

function App() {
  return (
    <Router>
      <AppProviders>
        <ClassicLayout>
          <Routes>
            <Route path="/" element={<ClassicDashboard />} />
            {/* Add other routes as needed */}
            <Route path="/contacts" element={<div className="p-8"><h1>Contacts Page (Placeholder)</h1></div>} />
            <Route path="/sales-orders" element={<div className="p-8"><h1>Sales Orders (Placeholder)</h1></div>} />
            <Route path="/stock-management" element={<div className="p-8"><h1>Inventory (Placeholder)</h1></div>} />
            <Route path="/settings" element={<div className="p-8"><h1>Settings (Placeholder)</h1></div>} />
          </Routes>
        </ClassicLayout>
      </AppProviders>
    </Router>
  );
}

export default App;
