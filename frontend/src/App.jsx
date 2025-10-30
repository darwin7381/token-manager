import { useState } from 'react';
import './index.css';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import TokenManager from './components/TokenManager/TokenManager';
import RouteManager from './components/RouteManager/RouteManager';
import Stats from './components/Stats/Stats';

function App() {
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
        </div>
        
        <Footer />
      </div>
    </div>
  );
}

export default App;
