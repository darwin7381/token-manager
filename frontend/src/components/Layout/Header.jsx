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
          
          {/* 搜尋結果下拉框 - 改進版 */}
          {showSearchResults && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: '480px',
              maxWidth: '600px',
              background: theme === 'dark' 
                ? 'rgba(31, 41, 55, 0.95)' 
                : 'rgba(255, 255, 255, 0.95)',
              border: theme === 'dark' 
                ? '1px solid rgba(75, 85, 99, 0.8)' 
                : '1px solid rgba(229, 231, 235, 0.8)',
              borderRadius: '12px',
              boxShadow: theme === 'dark'
                ? '0 10px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.3)'
                : '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
              maxHeight: '500px',
              overflowY: 'auto',
              zIndex: 1000,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)'
            }}>
              {searchLoading ? (
                <div style={{ 
                  padding: '32px', 
                  textAlign: 'center', 
                  color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    border: theme === 'dark' 
                      ? '3px solid rgba(75, 85, 99, 0.5)' 
                      : '3px solid #e5e7eb',
                    borderTop: '3px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>搜尋中...</span>
                </div>
              ) : (searchResults.tokens.length === 0 && searchResults.routes.length === 0) ? (
                <div style={{ 
                  padding: '32px', 
                  textAlign: 'center', 
                  color: theme === 'dark' ? '#6b7280' : '#9ca3af',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '32px', opacity: 0.5 }}>🔍</div>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: theme === 'dark' ? '#9ca3af' : '#6b7280' 
                  }}>
                    沒有找到匹配的結果
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: theme === 'dark' ? '#6b7280' : '#9ca3af' 
                  }}>
                    試試其他關鍵字
                  </div>
                </div>
              ) : (
                <>
                  {/* Token 搜尋結果 */}
                  {searchResults.tokens.length > 0 && (
                    <div style={{ marginBottom: searchResults.routes.length > 0 ? '8px' : '0' }}>
                      <div style={{ 
                        padding: '12px 16px', 
                        fontSize: '13px', 
                        fontWeight: '600', 
                        color: theme === 'dark' ? '#d1d5db' : '#374151',
                        background: theme === 'dark'
                          ? 'linear-gradient(to right, rgba(55, 65, 81, 0.6), rgba(31, 41, 55, 0.6))'
                          : 'linear-gradient(to right, rgba(249, 250, 251, 0.8), rgba(255, 255, 255, 0.8))',
                        borderBottom: theme === 'dark' 
                          ? '1px solid rgba(75, 85, 99, 0.5)' 
                          : '1px solid rgba(229, 231, 235, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)'
                      }}>
                        <span style={{ fontSize: '16px' }}>🔑</span>
                        <span>Token</span>
                        <span style={{ 
                          marginLeft: 'auto',
                          fontSize: '11px',
                          fontWeight: '500',
                          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                          background: theme === 'dark' 
                            ? 'rgba(55, 65, 81, 0.8)' 
                            : 'rgba(243, 244, 246, 0.8)',
                          padding: '2px 8px',
                          borderRadius: '10px'
                        }}>
                          {searchResults.tokens.length}
                        </span>
                      </div>
                      {searchResults.tokens.map((token, index) => (
                        <div
                          key={token.id}
                          onClick={() => handleSearchResultClick('token', token)}
                          style={{
                            padding: '14px 16px',
                            cursor: 'pointer',
                            borderBottom: index < searchResults.tokens.length - 1 
                              ? (theme === 'dark' ? '1px solid rgba(75, 85, 99, 0.3)' : '1px solid rgba(243, 244, 246, 0.8)') 
                              : 'none',
                            transition: 'all 0.2s ease',
                            background: 'transparent'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme === 'dark' 
                              ? 'rgba(59, 130, 246, 0.15)' 
                              : 'rgba(240, 249, 255, 0.8)';
                            e.currentTarget.style.paddingLeft = '20px';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.paddingLeft = '16px';
                          }}
                        >
                          <div style={{ 
                            fontWeight: '600', 
                            fontSize: '14px', 
                            marginBottom: '6px',
                            color: theme === 'dark' ? '#f3f4f6' : '#111827',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span>{token.name}</span>
                            {token.status === 'active' && (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '500',
                                color: theme === 'dark' ? '#6ee7b7' : '#059669',
                                background: theme === 'dark' 
                                  ? 'rgba(110, 231, 183, 0.2)' 
                                  : 'rgba(209, 250, 229, 0.8)',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                活躍
                              </span>
                            )}
                          </div>
                          {token.description && (
                            <div style={{ 
                              fontSize: '12px', 
                              color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                              marginBottom: '6px',
                              lineHeight: '1.5'
                            }}>
                              {token.description}
                            </div>
                          )}
                          {token.scopes && token.scopes.length > 0 && (
                            <div style={{ 
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '4px',
                              marginTop: '6px'
                            }}>
                              {token.scopes.slice(0, 4).map((scope, i) => (
                                <span key={i} style={{
                                  fontSize: '10px',
                                  color: theme === 'dark' ? '#d1d5db' : '#4b5563',
                                  background: theme === 'dark' 
                                    ? 'rgba(75, 85, 99, 0.5)' 
                                    : 'rgba(243, 244, 246, 0.8)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontFamily: 'monospace'
                                }}>
                                  {scope}
                                </span>
                              ))}
                              {token.scopes.length > 4 && (
                                <span style={{
                                  fontSize: '10px',
                                  color: theme === 'dark' ? '#6b7280' : '#9ca3af',
                                  padding: '2px 6px'
                                }}>
                                  +{token.scopes.length - 4}
                                </span>
                              )}
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
                        padding: '12px 16px', 
                        fontSize: '13px', 
                        fontWeight: '600', 
                        color: theme === 'dark' ? '#d1d5db' : '#374151',
                        background: theme === 'dark'
                          ? 'linear-gradient(to right, rgba(55, 65, 81, 0.6), rgba(31, 41, 55, 0.6))'
                          : 'linear-gradient(to right, rgba(249, 250, 251, 0.8), rgba(255, 255, 255, 0.8))',
                        borderBottom: theme === 'dark' 
                          ? '1px solid rgba(75, 85, 99, 0.5)' 
                          : '1px solid rgba(229, 231, 235, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)'
                      }}>
                        <span style={{ fontSize: '16px' }}>🛣️</span>
                        <span>路由</span>
                        <span style={{ 
                          marginLeft: 'auto',
                          fontSize: '11px',
                          fontWeight: '500',
                          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                          background: theme === 'dark' 
                            ? 'rgba(55, 65, 81, 0.8)' 
                            : 'rgba(243, 244, 246, 0.8)',
                          padding: '2px 8px',
                          borderRadius: '10px'
                        }}>
                          {searchResults.routes.length}
                        </span>
                      </div>
                      {searchResults.routes.map((route, index) => (
                        <div
                          key={route.id}
                          onClick={() => handleSearchResultClick('route', route)}
                          style={{
                            padding: '14px 16px',
                            cursor: 'pointer',
                            borderBottom: index < searchResults.routes.length - 1 
                              ? (theme === 'dark' ? '1px solid rgba(75, 85, 99, 0.3)' : '1px solid rgba(243, 244, 246, 0.8)') 
                              : 'none',
                            transition: 'all 0.2s ease',
                            background: 'transparent'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme === 'dark' 
                              ? 'rgba(251, 191, 36, 0.15)' 
                              : 'rgba(254, 243, 199, 0.8)';
                            e.currentTarget.style.paddingLeft = '20px';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.paddingLeft = '16px';
                          }}
                        >
                          <div style={{ 
                            fontWeight: '600', 
                            fontSize: '14px', 
                            marginBottom: '6px',
                            color: theme === 'dark' ? '#f3f4f6' : '#111827',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span>{route.name || route.path}</span>
                          </div>
                          <div style={{ 
                            fontSize: '12px', 
                            color: theme === 'dark' ? '#6ee7b7' : '#059669',
                            fontFamily: 'SF Mono, Consolas, Monaco, monospace',
                            background: theme === 'dark' 
                              ? 'rgba(16, 185, 129, 0.2)' 
                              : 'rgba(240, 253, 244, 0.8)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            marginBottom: '6px'
                          }}>
                            {route.path}
                          </div>
                          {route.description && (
                            <div style={{ 
                              fontSize: '12px', 
                              color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                              lineHeight: '1.5'
                            }}>
                              {route.description}
                            </div>
                          )}
                          {route.tags && route.tags.length > 0 && (
                            <div style={{ 
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '4px',
                              marginTop: '6px'
                            }}>
                              {route.tags.slice(0, 4).map((tag, i) => (
                                <span key={i} style={{
                                  fontSize: '10px',
                                  color: theme === 'dark' ? '#fbbf24' : '#f59e0b',
                                  background: theme === 'dark' 
                                    ? 'rgba(251, 191, 36, 0.2)' 
                                    : 'rgba(254, 243, 199, 0.8)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: '500'
                                }}>
                                  #{tag}
                                </span>
                              ))}
                              {route.tags.length > 4 && (
                                <span style={{
                                  fontSize: '10px',
                                  color: theme === 'dark' ? '#6b7280' : '#9ca3af',
                                  padding: '2px 6px'
                                }}>
                                  +{route.tags.length - 4}
                                </span>
                              )}
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
