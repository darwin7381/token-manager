import { useState } from 'react';
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
  Users
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

export default function Sidebar({ activeTab, onTabChange, collapsed, onToggleCollapse }) {
  const [expandedSections, setExpandedSections] = useState({});
  const { canAccessUserManagement } = usePermissions();

  const toggleSection = (sectionId) => {
    if (collapsed) return; // 收合時不展開子菜單
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const menuSections = [
    {
      title: 'NAVIGATION',
      items: [
        { 
          id: 'dashboard', 
          icon: LayoutDashboard, 
          label: '儀表板',
          onClick: () => onTabChange('stats')
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
          onClick: () => onTabChange('tokens')
        },
        { 
          id: 'routes', 
          icon: Route, 
          label: '路由管理',
          onClick: () => onTabChange('routes')
        },
      ]
    },
    {
      title: '系統',
      items: [
        { 
          id: 'stats', 
          icon: BarChart3, 
          label: '統計分析',
          onClick: () => onTabChange('stats')
        },
        // 只有 ADMIN 和 MANAGER 才能看到用戶管理
        ...(canAccessUserManagement() ? [{
          id: 'users',
          icon: Users,
          label: '用戶管理',
          onClick: () => onTabChange('users')
        }] : []),
        {
          id: 'cloudflare',
          icon: Globe,
          label: 'Cloudflare',
          subItems: [
            { id: 'kv', icon: Database, label: 'KV Storage' },
            { id: 'worker', icon: Shield, label: 'Worker' },
          ]
        },
        {
          id: 'docs',
          icon: FileText,
          label: '文檔',
          subItems: [
            { id: 'api-docs', label: 'API 文檔', external: 'http://localhost:8000/docs' },
            { id: 'readme', label: 'README' },
          ]
        },
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
        <div className="sidebar-logo">🔐</div>
        <div className="sidebar-brand">
          <div className="sidebar-title">Token Manager</div>
          <div className="sidebar-subtitle">API 集中管理系統</div>
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
              const isActive = activeTab === item.id;
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
                        ›
                      </span>
                    )}
                  </div>

                  {/* 子菜單 */}
                  {hasSubItems && isExpanded && !collapsed && (
                    <div className="submenu">
                      {item.subItems.map((subItem) => {
                        const SubIcon = subItem.icon;
                        return (
                          <div
                            key={subItem.id}
                            className="submenu-item"
                            onClick={() => {
                              if (subItem.external) {
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
