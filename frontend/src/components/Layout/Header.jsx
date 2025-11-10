import { useState, useEffect, useRef } from 'react';
import { Search, Bell, Sun, Moon, User, Settings, LogOut, FileText, ChevronDown, X } from 'lucide-react';
import { useUser, useClerk, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { getHealth } from '../../services/api';

export default function Header() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking');
  const [theme, setTheme] = useState('light');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ tokens: [], routes: [] });
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

  useEffect(() => {
    // 點擊外部關閉搜尋結果
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };
    
    if (showSearchResults) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSearchResults]);

  useEffect(() => {
    // 實現搜尋功能
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults({ tokens: [], routes: [] });
        setShowSearchResults(false);
        return;
      }

      setSearchLoading(true);
      setShowSearchResults(true);

      try {
        const token = await getToken();
        const query = searchQuery.toLowerCase();

        // 並行獲取 tokens 和 routes
        const [tokensResponse, routesResponse] = await Promise.all([
          fetch(`${API_URL}/api/tokens`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/routes`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        if (tokensResponse.ok && routesResponse.ok) {
          const tokens = await tokensResponse.json();
          const routes = await routesResponse.json();

          // 過濾匹配的 tokens
          const matchedTokens = tokens.filter(t => 
            (t.name && t.name.toLowerCase().includes(query)) ||
            (t.description && t.description.toLowerCase().includes(query)) ||
            (t.scopes && t.scopes.some(s => s.toLowerCase().includes(query)))
          ).slice(0, 5); // 只顯示前 5 個

          // 過濾匹配的 routes
          const matchedRoutes = routes.filter(r => 
            (r.name && r.name.toLowerCase().includes(query)) ||
            r.path.toLowerCase().includes(query) ||
            (r.description && r.description.toLowerCase().includes(query)) ||
            (r.tags && r.tags.some(tag => tag.toLowerCase().includes(query)))
          ).slice(0, 5); // 只顯示前 5 個

          setSearchResults({ tokens: matchedTokens, routes: matchedRoutes });
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setSearchLoading(false);
      }
    };

    // 防抖處理
    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, getToken]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleSearchResultClick = (type, item) => {
    if (type === 'token') {
      navigate(`/token-usage/${item.id}`);
    } else if (type === 'route') {
      navigate(`/route-usage?path=${encodeURIComponent(item.path)}`);
    }
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setShowSearchResults(false);
  };

  return (
    <div className="header">
      <div className="header-left">
        <div className="header-title">API Token 管理系統</div>
      </div>

      <div className="header-right">
        {/* 搜尋框 */}
        <div className="search-box" ref={searchRef} style={{ position: 'relative' }}>
          <Search className="search-icon" size={18} />
          <input
            type="search"
            className="search-input"
            placeholder="搜尋 Token 或路由..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery && setShowSearchResults(true)}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="清除搜尋"
            >
              <X size={16} />
            </button>
          )}
          
          {/* 搜尋結果下拉框 */}
          {showSearchResults && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              maxHeight: '400px',
              overflowY: 'auto',
              zIndex: 1000
            }}>
              {searchLoading ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
                  搜尋中...
                </div>
              ) : (searchResults.tokens.length === 0 && searchResults.routes.length === 0) ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
                  沒有找到匹配的結果
                </div>
              ) : (
                <>
                  {/* Token 搜尋結果 */}
                  {searchResults.tokens.length > 0 && (
                    <div>
                      <div style={{ 
                        padding: '8px 12px', 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        color: '#6b7280',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        🔑 Token ({searchResults.tokens.length})
                      </div>
                      {searchResults.tokens.map((token) => (
                        <div
                          key={token.id}
                          onClick={() => handleSearchResultClick('token', token)}
                          style={{
                            padding: '12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f3f4f6',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ fontWeight: '500', fontSize: '14px', marginBottom: '4px' }}>
                            {token.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {token.description || '無描述'}
                          </div>
                          {token.scopes && token.scopes.length > 0 && (
                            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                              範圍: {token.scopes.slice(0, 3).join(', ')}
                              {token.scopes.length > 3 && '...'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Route 搜尋結果 */}
                  {searchResults.routes.length > 0 && (
                    <div>
                      <div style={{ 
                        padding: '8px 12px', 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        color: '#6b7280',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        🛣️ 路由 ({searchResults.routes.length})
                      </div>
                      {searchResults.routes.map((route) => (
                        <div
                          key={route.id}
                          onClick={() => handleSearchResultClick('route', route)}
                          style={{
                            padding: '12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f3f4f6',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ fontWeight: '500', fontSize: '14px', marginBottom: '4px' }}>
                            {route.name || route.path}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>
                            {route.path}
                          </div>
                          {route.description && (
                            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                              {route.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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
                onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/docs`, '_blank')}
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
