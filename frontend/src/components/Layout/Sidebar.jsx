import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Key, 
  Route, 
  BarChart3, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  Shield,
  Database,
  Globe,
  FileText,
  Users,
  Activity,
  FileSearch,
  ChevronDown
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

export default function Sidebar({ collapsed, onToggleCollapse }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState({});
  const { canAccessUserManagement } = usePermissions();
  
  // 從當前 URL 判斷 active tab
  const getActiveTab = () => {
    const path = location.pathname.split('/')[1]; // 取得第一層路徑
    return path || 'stats'; // 預設為 stats
  };
  
  const activeTab = getActiveTab();

  const toggleSection = (sectionId) => {
    if (collapsed) return; // 收合時不展開子菜單
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const menuSections = [
    {
      title: 'DASHBOARD',
      items: [
        { 
          id: 'dashboard', 
          icon: LayoutDashboard, 
          label: '總覽 Dashboard',
          path: '/dashboard'
        },
        { 
          id: 'usage-analytics', 
          icon: BarChart3, 
          label: 'API 使用分析',
          path: '/usage-analytics',
          subItems: [
            {
              id: 'token-usage-list',
              label: 'Token 使用詳情',
              path: '/token-usage'
            },
            {
              id: 'route-usage-list',
              label: '路由調用統計',
              path: '/route-usage-list'
            }
          ]
        },
        { 
          id: 'system-health', 
          icon: Activity, 
          label: '系統健康監控',
          path: '/system-health'
        },
        { 
          id: 'audit-logs', 
          icon: FileSearch, 
          label: '審計日誌',
          path: '/audit-logs'
        },
      ]
    },
    {
      title: '主要功能',
      items: [
        { 
          id: 'tokens', 
          icon: Key, 
          label: 'Token 管理',
          badge: null,
          path: '/tokens'
        },
        { 
          id: 'routes', 
          icon: Route, 
          label: '路由管理',
          path: '/routes'
        },
      ]
    },
    {
      title: '系統管理',
      items: [
        { 
          id: 'stats', 
          icon: BarChart3, 
          label: '統計分析',
          path: '/stats'
        },
        // 只有 ADMIN 和 MANAGER 才能看到用戶管理和團隊管理
        ...(canAccessUserManagement() ? [
          {
            id: 'users',
            icon: Users,
            label: '用戶管理',
            path: '/users'
          },
          {
            id: 'teams',
            icon: Users,
            label: '團隊管理',
            path: '/teams'
          }
        ] : []),
        { 
          id: 'settings', 
          icon: Settings, 
          label: '系統設定',
          onClick: () => alert('系統設定功能開發中...')
        },
      ]
    }
  ];

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div 
          className="sidebar-logo-container"
          onClick={() => navigate('/dashboard')}
          style={{ 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flex: 1
          }}
          title="返回首頁"
        >
          <div className="sidebar-logo">🔐</div>
          {!collapsed && (
            <div className="sidebar-brand">
              <div className="sidebar-title">Token Manager</div>
              <div className="sidebar-subtitle">API 集中管理系統</div>
            </div>
          )}
        </div>
        <button 
          className="sidebar-toggle" 
          onClick={onToggleCollapse}
          title={collapsed ? '展開側邊欄' : '收合側邊欄'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Menu */}
      <div className="sidebar-menu">
        {menuSections.map((section, sectionIdx) => (
          <div key={sectionIdx}>
            {!collapsed && <div className="menu-section-title">{section.title}</div>}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || location.pathname === item.path;
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isExpanded = expandedSections[item.id];

              return (
                <div key={item.id}>
                  {/* 主菜單項 */}
                  <div
                    className={`menu-item ${isActive ? 'active' : ''} ${hasSubItems ? 'has-sub' : ''}`}
                    onClick={() => {
                      if (hasSubItems) {
                        toggleSection(item.id);
                        // 如果有路徑，也導航到該頁面
                        if (item.path) {
                          navigate(item.path);
                        }
                      } else if (item.path) {
                        navigate(item.path);
                      } else if (item.onClick) {
                        item.onClick();
                      }
                    }}
                    title={collapsed ? item.label : ''}
                  >
                    <span className="menu-icon">
                      <Icon size={20} />
                    </span>
                    <span className="menu-label">{item.label}</span>
                    {item.badge && !collapsed && (
                      <span className="menu-badge">{item.badge}</span>
                    )}
                    {hasSubItems && !collapsed && (
                      <span className={`menu-arrow ${isExpanded ? 'expanded' : ''}`}>
                        <ChevronDown size={16} />
                      </span>
                    )}
                  </div>

                  {/* 子菜單 */}
                  {hasSubItems && isExpanded && !collapsed && (
                    <div className="submenu">
                      {item.subItems.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = location.pathname === subItem.path;
                        return (
                          <div
                            key={subItem.id}
                            className={`submenu-item ${isSubActive ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (subItem.path) {
                                navigate(subItem.path);
                              } else if (subItem.external) {
                                window.open(subItem.external, '_blank');
                              } else if (subItem.onClick) {
                                subItem.onClick();
                              }
                            }}
                          >
                            {SubIcon && <SubIcon size={16} />}
                            <span>{subItem.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        {!collapsed && <div className="sidebar-version">v1.2.0 Professional</div>}
        {collapsed && <div className="sidebar-version">v1.2</div>}
      </div>
    </div>
  );
}
