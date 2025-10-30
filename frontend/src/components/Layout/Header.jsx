import { useState, useEffect } from 'react';
import { Search, Bell, Sun, Moon, User, Settings, LogOut, FileText, ChevronDown } from 'lucide-react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { getHealth } from '../../services/api';

export default function Header() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [status, setStatus] = useState('checking');
  const [theme, setTheme] = useState('light');
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await getHealth();
        setStatus('healthy');
      } catch {
        setStatus('error');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // 點擊外部關閉菜單
    const handleClick = () => setShowUserMenu(false);
    if (showUserMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showUserMenu]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <div className="header">
      <div className="header-left">
        <div className="header-title">API Token 管理系統</div>
      </div>

      <div className="header-right">
        {/* 搜尋框 */}
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input
            type="search"
            className="search-input"
            placeholder="搜尋 Token 或路由..."
          />
        </div>

        {/* 後端狀態 */}
        <div className="status-indicator">
          <span className={`status-dot ${status}`} />
          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>
            {status === 'healthy' ? '後端正常' : status === 'error' ? '後端異常' : '檢查中'}
          </span>
        </div>

        {/* 主題切換 */}
        <button className="theme-toggle" onClick={toggleTheme} title="切換主題">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* 通知 */}
        <button className="notification-btn" title="通知">
          <Bell size={18} />
          {/* <div className="notification-badge" /> */}
        </button>

        {/* 用戶菜單 */}
        <div className="user-menu">
          <button
            className="user-avatar-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowUserMenu(!showUserMenu);
            }}
          >
            <div className="user-avatar">
              {user?.imageUrl ? (
                <img 
                  src={user.imageUrl} 
                  alt={user.fullName || 'User'} 
                  style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }}
                />
              ) : (
                user?.firstName?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.fullName || user?.firstName || 'User'}</div>
              <div className="user-role">{user?.primaryEmailAddress?.emailAddress || '管理員'}</div>
            </div>
            <ChevronDown size={14} className="dropdown-icon" />
          </button>

          {showUserMenu && (
            <div className="user-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="dropdown-item">
                <User size={16} />
                <span>個人資料</span>
              </div>
              <div className="dropdown-item">
                <Settings size={16} />
                <span>系統設定</span>
              </div>
              <div className="dropdown-divider" />
              <div 
                className="dropdown-item"
                onClick={() => window.open('http://localhost:8000/docs', '_blank')}
              >
                <FileText size={16} />
                <span>API 文檔</span>
              </div>
              <div className="dropdown-divider" />
              <div 
                className="dropdown-item danger"
                onClick={() => signOut()}
              >
                <LogOut size={16} />
                <span>登出</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
