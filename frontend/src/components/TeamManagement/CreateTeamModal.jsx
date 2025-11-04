import { useState } from 'react';
import { Users } from 'lucide-react';

export default function CreateTeamModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    color: '#3b82f6',
    icon: '👥'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.id || !formData.name) {
      alert('請填寫團隊 ID 和名稱');
      return;
    }
    
    // 驗證 ID 格式（只允許小寫字母、數字、連字號）
    if (!/^[a-z0-9-]+$/.test(formData.id)) {
      alert('團隊 ID 只能包含小寫字母、數字和連字號');
      return;
    }
    
    try {
      setSaving(true);
      await onSave(formData);
    } catch (error) {
      // 錯誤已在父組件處理
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Users size={24} />
            創建新團隊
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 團隊 ID */}
          <div className="form-group">
            <label>
              團隊 ID <span style={{ color: 'var(--accent-danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase() })}
              placeholder="例如：marketing-team"
              required
              pattern="[a-z0-9-]+"
              title="只能包含小寫字母、數字和連字號"
            />
            <small>只能包含小寫字母、數字和連字號，創建後不可修改</small>
          </div>

          {/* 團隊名稱 */}
          <div className="form-group">
            <label>
              團隊名稱 <span style={{ color: 'var(--accent-danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：Marketing Team"
              required
            />
          </div>

          {/* 描述 */}
          <div className="form-group">
            <label>描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="團隊的簡短描述..."
              rows="3"
            />
          </div>

          {/* 顏色和圖標 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>顏色</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                style={{ width: '100%', height: '40px', cursor: 'pointer' }}
              />
            </div>

            <div className="form-group">
              <label>圖標 Emoji</label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="👥"
                maxLength="2"
              />
            </div>
          </div>

          {/* 預覽 */}
          <div style={{
            padding: '16px',
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: `2px solid ${formData.color}40`,
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
              預覽：
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>{formData.icon || '👥'}</span>
              <span style={{ fontWeight: 600, color: formData.color }}>
                {formData.name || '團隊名稱'}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {formData.description || '無描述'}
            </div>
          </div>

          {/* 按鈕 */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button 
              type="button"
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={saving}
            >
              取消
            </button>
            <button 
              type="submit"
              className="btn"
              disabled={saving || !formData.id || !formData.name}
            >
              {saving ? '創建中...' : '創建團隊'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

