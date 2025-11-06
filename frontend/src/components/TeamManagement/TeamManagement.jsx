import { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Search } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { usePermissions } from '../../hooks/usePermissions';
import CreateTeamModal from './CreateTeamModal';
import EditTeamModal from './EditTeamModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function TeamManagement() {
  const { isAdmin } = usePermissions();
  const { getToken } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await getToken();
      
      const response = await fetch(`${API_URL}/api/teams`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }
      
      const data = await response.json();
      setTeams(data);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (teamData) => {
    try {
      const token = await getToken();
      
      const response = await fetch(`${API_URL}/api/teams`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(teamData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create team');
      }
      
      const result = await response.json();
      console.log('Team created:', result);
      
      await fetchTeams();
      setShowCreateModal(false);
      
      alert(`團隊「${teamData.name}」創建成功！\n你已自動成為該團隊的 ADMIN。`);
      
      // 強制刷新頁面讓 Clerk 重新載入最新的 metadata
      window.location.reload();
      
    } catch (error) {
      console.error('Failed to create team:', error);
      alert('創建團隊失敗：' + error.message);
      throw error;
    }
  };

  const handleUpdateTeam = async (teamId, teamData) => {
    try {
      const token = await getToken();
      
      const response = await fetch(`${API_URL}/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(teamData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update team');
      }
      
      await fetchTeams();
      setShowEditModal(false);
      setSelectedTeam(null);
    } catch (error) {
      console.error('Failed to update team:', error);
      alert('更新團隊失敗：' + error.message);
      throw error;
    }
  };

  const handleDeleteTeam = async (team) => {
    if (!confirm(`確定要刪除團隊「${team.name}」嗎？\n\n警告：請確保已移除所有成員，否則可能導致用戶權限錯誤。`)) {
      return;
    }
    
    try {
      const token = await getToken();
      
      const response = await fetch(`${API_URL}/api/teams/${team.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete team');
      }
      
      await fetchTeams();
    } catch (error) {
      console.error('Failed to delete team:', error);
      alert('刪除團隊失敗：' + error.message);
    }
  };

  const filteredTeams = teams.filter(team => {
    const query = searchQuery.toLowerCase();
    return (
      team.name?.toLowerCase().includes(query) ||
      team.description?.toLowerCase().includes(query) ||
      team.id?.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      {/* 頁面標題 */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>
            <Users size={24} /> 團隊管理
          </h2>
          {isAdmin && (
            <button 
              className="btn"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={18} />
              創建團隊
            </button>
          )}
        </div>

        {/* 搜尋框 */}
        <div className="search-box" style={{ maxWidth: '400px', marginBottom: '20px' }}>
          <Search className="search-icon" size={18} />
          <input
            type="search"
            className="search-input"
            placeholder="搜尋團隊..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 錯誤提示 */}
      {error && (
        <div className="section">
          <div className="error-message">
            ❌ {error}
          </div>
        </div>
      )}

      {/* 團隊列表 */}
      <div className="section">
        {loading ? (
          <div className="loading">載入團隊列表...</div>
        ) : filteredTeams.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            {searchQuery ? '沒有找到符合的團隊' : '還沒有團隊'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {filteredTeams.map(team => (
              <div 
                key={team.id}
                style={{
                  padding: '20px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '12px',
                  border: `2px solid ${team.color}40`,
                  position: 'relative'
                }}
              >
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    marginBottom: '8px'
                  }}>
                    {team.icon && <span style={{ fontSize: '24px' }}>{team.icon}</span>}
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: '18px',
                      color: team.color
                    }}>
                      {team.name}
                    </h3>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                    ID: {team.id}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {team.description || '無描述'}
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    {team.member_count || 0} 個成員
                  </div>
                  
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => {
                          setSelectedTeam(team);
                          setShowEditModal(true);
                        }}
                        title="編輯團隊"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => handleDeleteTeam(team)}
                        title="刪除團隊"
                        style={{
                          color: 'var(--accent-danger)',
                          borderColor: 'var(--accent-danger)'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 創建團隊 Modal */}
      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateTeam}
        />
      )}

      {/* 編輯團隊 Modal */}
      {showEditModal && selectedTeam && (
        <EditTeamModal
          team={selectedTeam}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTeam(null);
          }}
          onSave={(data) => handleUpdateTeam(selectedTeam.id, data)}
        />
      )}
    </div>
  );
}

