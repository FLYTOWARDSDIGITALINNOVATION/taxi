import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import NewBooking from './pages/NewBooking';
import Trips from './pages/Trips';
import Drivers from './pages/Drivers';
import Taxis from './pages/Taxis';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import './App.css';

const Layout = ({ children, sidebarOpen, setSidebarOpen }) => {
  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <main className="main-content">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <div className="page-content">
          {children}
        </div>
      </main>
      {/* Backdrop for mobile */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)}></div>}
    </div>
  );
};

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  console.log("FlyRoll App Rendering...");
  
  return (
    <>
      <Routes>
      <Route path="/" element={<Layout sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}><Dashboard /></Layout>} />
      <Route path="/new-booking" element={<Layout sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}><NewBooking /></Layout>} />
      <Route path="/trips" element={<Layout sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}><Trips /></Layout>} />
      <Route path="/drivers" element={<Layout sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}><Drivers /></Layout>} />
      <Route path="/taxis" element={<Layout sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}><Taxis /></Layout>} />
      
      {/* Fallback routes for unimplemented features */}
      <Route path="/notifications" element={<Layout sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}><Notifications /></Layout>} />
      <Route path="/messages" element={<Layout sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}><Messages /></Layout>} />
      
      <Route path="/settings" element={<Layout sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}><Settings /></Layout>} />

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;

