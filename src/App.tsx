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
            <Route path="/settings" element={<div className="p-8"><h1>Settings Page (Placeholder)</h1></div>} />
            <Route path="*" element={<div className="p-8"><h1>404 - Not Found</h1></div>} />
          </Routes>
        </ClassicLayout>
      </AppProviders>
    </Router>
  );
}


export default App;
