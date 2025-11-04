import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { updateRoute } from '../../services/api';
import TagInput from './TagInput';

export default function EditRouteModal({ route, onClose, onSaved }) {
  const { getToken } = useAuth();
  const [name, setName] = useState(route.name || '');
  const [backendUrl, setBackendUrl] = useState(route.backend_url);
  const [description, setDescription] = useState(route.description || '');
  const [tags, setTags] = useState(route.tags || []);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getToken();
      await updateRoute(route.id, {
        name,
        backend_url: backendUrl,
        description,
        tags,
      }, token);
      onSaved();
    } catch (error) {
      alert('更新失敗: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>編輯路由</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>名稱 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>路徑 (不可修改)</label>
            <input type="text" value={route.path} disabled />
          </div>

          <div className="form-group">
            <label>後端 URL *</label>
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>標籤/分類</label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          <div style={{ marginTop: '20px' }}>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

