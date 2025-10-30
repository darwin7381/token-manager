import { useState } from 'react';
import { Plus } from 'lucide-react';
import { createRoute } from '../../services/api';
import TagInput from './TagInput';

export default function RouteForm({ onRouteCreated }) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [backendUrl, setBackendUrl] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createRoute({
        name,
        path,
        backend_url: backendUrl,
        description,
        tags,
      });
      
      setName('');
      setPath('');
      setBackendUrl('');
      setDescription('');
      setTags([]);
      
      if (onRouteCreated) onRouteCreated();
    } catch (error) {
      alert('錯誤: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section">
      <h2><Plus size={20} /> 新增微服務路由</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>名稱 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如: 圖片處理服務"
            required
          />
        </div>

        <div className="form-group">
          <label>路徑 * (必須以 / 開頭)</label>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="例如: /api/image"
            pattern="^/.*"
            required
          />
        </div>

        <div className="form-group">
          <label>後端 URL *</label>
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="例如: https://image-service.railway.app"
            required
          />
        </div>

        <div className="form-group">
          <label>描述</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如: 圖片處理服務"
          />
        </div>

        <div className="form-group">
          <label>標籤/分類</label>
          <TagInput tags={tags} onChange={setTags} />
          <small>用於權限分組管理，例如: media, premium, internal</small>
        </div>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? '新增中...' : '新增路由'}
        </button>
      </form>
    </div>
  );
}

