/**
 * API 服務層
 * 封裝所有後端 API 調用
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ==================== Token API ====================

export const createToken = async (data) => {
  const response = await fetch(`${API_URL}/api/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create token');
  }
  return response.json();
};

export const listTokens = async () => {
  const response = await fetch(`${API_URL}/api/tokens`);
  if (!response.ok) throw new Error('Failed to fetch tokens');
  return response.json();
};

export const updateToken = async (id, data) => {
  const response = await fetch(`${API_URL}/api/tokens/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update token');
  }
  return response.json();
};

export const deleteToken = async (id) => {
  const response = await fetch(`${API_URL}/api/tokens/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete token');
  return response.json();
};

// ==================== Route API ====================

export const createRoute = async (data) => {
  const response = await fetch(`${API_URL}/api/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create route');
  }
  return response.json();
};

export const listRoutes = async () => {
  const response = await fetch(`${API_URL}/api/routes`);
  if (!response.ok) throw new Error('Failed to fetch routes');
  return response.json();
};

export const updateRoute = async (id, data) => {
  const response = await fetch(`${API_URL}/api/routes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update route');
  }
  return response.json();
};

export const deleteRoute = async (id) => {
  const response = await fetch(`${API_URL}/api/routes/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete route');
  return response.json();
};

export const listTags = async () => {
  const response = await fetch(`${API_URL}/api/routes/tags`);
  if (!response.ok) throw new Error('Failed to fetch tags');
  return response.json();
};

// ==================== Stats API ====================

export const getStats = async () => {
  const response = await fetch(`${API_URL}/api/stats`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
};

export const getHealth = async () => {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) throw new Error('Backend unhealthy');
  return response.json();
};

// ==================== User Management API (Per-Team Roles) ====================

/**
 * 更新用戶在特定團隊的角色
 */
export const updateUserTeamRole = async (userId, teamId, role, token) => {
  const response = await fetch(`${API_URL}/api/users/${userId}/team-role`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ team_id: teamId, role })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update team role');
  }
  
  return response.json();
};

/**
 * 添加用戶到團隊
 */
export const addUserToTeam = async (userId, teamId, role, token) => {
  const response = await fetch(`${API_URL}/api/users/${userId}/team-membership`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ team_id: teamId, role })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to add user to team');
  }
  
  return response.json();
};

/**
 * 從團隊移除用戶
 */
export const removeUserFromTeam = async (userId, teamId, token) => {
  const response = await fetch(`${API_URL}/api/users/${userId}/team-membership/${teamId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to remove user from team');
  }
  
  return response.json();
};
