import { useState, useEffect } from 'react';
import { listRoutes, listTags } from '../../services/api';

export default function ScopeSelector({ selectedScopes, onSave, onClose }) {
  const [routes, setRoutes] = useState([]);
  const [tags, setTags] = useState([]);
  const [selected, setSelected] = useState([...selectedScopes]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [routesData, tagsData] = await Promise.all([
          listRoutes(),
          listTags()
        ]);
        setRoutes(routesData);
        setTags(tagsData.tags || []);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  const toggleScope = (scope) => {
    setSelected(prev => {
      if (prev.includes(scope)) {
        return prev.filter(s => s !== scope);
      } else {
        const filtered = prev.filter(s => s !== '*');
        return [...filtered, scope];
      }
    });
  };

  const handleSave = () => {
    if (selected.length === 0) {
      onSave(['*']);
    } else {
      onSave(selected);
    }
  };

  // 提取唯一的服務名稱
  const serviceNames = [...new Set(routes.map(route => {
    const parts = route.path.split('/').filter(s => s);
    return parts.length >= 2 ? parts[1] : null;
  }).filter(Boolean))];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>選擇權限範圍</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div>
          <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#374151' }}>
            按路由名稱選擇
          </h3>
          <div className="scope-options">
            {routes.map(route => {
              const routeName = route.name || route.path;
              const serviceName = route.path.split('/').filter(s => s)[1];
              const isSelected = selected.includes(serviceName);
              
              return (
                <div
                  key={route.id}
                  className={`scope-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleScope(serviceName)}
                  title={`${route.name || ''} (${route.path})`}
                >
                  {route.name ? `${route.name} (${serviceName})` : serviceName}
                </div>
              );
            })}
          </div>

          <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#374151', marginTop: '24px' }}>
            按路徑選擇
          </h3>
          <div className="scope-options">
            {serviceNames.map(service => (
              <div
                key={service}
                className={`scope-option ${selected.includes(service) ? 'selected' : ''}`}
                onClick={() => toggleScope(service)}
              >
                {service}
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#374151', marginTop: '24px' }}>
            按標籤選擇
          </h3>
          <div className="scope-options">
            {tags.map(tag => {
              const tagScope = `tag:${tag}`;
              return (
                <div
                  key={tagScope}
                  className={`scope-option ${selected.includes(tagScope) ? 'selected' : ''}`}
                  onClick={() => toggleScope(tagScope)}
                >
                  🏷️ {tag}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
            <button className="btn" onClick={handleSave}>
              確定
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
