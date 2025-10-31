import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import './index.css';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import TokenManager from './components/TokenManager/TokenManager';
import RouteManager from './components/RouteManager/RouteManager';
import Stats from './components/Stats/Stats';
import UserManagement from './components/UserManagement/UserManagement';
import SignIn from './components/Auth/SignIn';
import SignUp from './components/Auth/SignUp';
import ProtectedRoute from './components/Auth/ProtectedRoute';

function Dashboard() {
  const [activeTab, setActiveTab] = useState('tokens');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="dashboard">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header />
        
        <div className="content-area">
          {activeTab === 'tokens' && <TokenManager />}
          {activeTab === 'routes' && <RouteManager />}
          {activeTab === 'stats' && <Stats />}
          {activeTab === 'dashboard' && <Stats />}
          {activeTab === 'users' && <UserManagement />}
        </div>
        
        <Footer />
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 公開路由 */}
        <Route path="/sign-in/*" element={<SignIn />} />
        <Route path="/sign-up/*" element={<SignUp />} />
        
        {/* 受保護的路由 */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
