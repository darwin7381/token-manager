/**
 * API 服務層
 * 封裝所有後端 API 調用
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ==================== Token API ====================

export const createToken = async (data, token) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/tokens`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create token');
  }
  return response.json();
};

export const listTokens = async (token) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/tokens`, {
    headers
  });
  if (!response.ok) throw new Error('Failed to fetch tokens');
  return response.json();
};

export const updateToken = async (id, data, token) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/tokens/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update token');
  }
  return response.json();
};

export const deleteToken = async (id, token) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/tokens/${id}`, {
    method: 'DELETE',
    headers
  });
  if (!response.ok) throw new Error('Failed to delete token');
  return response.json();
};

export const revealToken = async (id, token) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/tokens/${id}/reveal`, {
    headers
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to reveal token');
  }
  return response.json();
};

// ==================== Route API ====================

export const createRoute = async (data, token) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/routes`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create route');
  }
  return response.json();
};

export const listRoutes = async (token) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/routes`, {
    headers
  });
  if (!response.ok) throw new Error('Failed to fetch routes');
  return response.json();
};

export const updateRoute = async (id, data, token) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/routes/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update route');
  }
  return response.json();
};

export const deleteRoute = async (id, token) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/routes/${id}`, {
    method: 'DELETE',
    headers
  });
  if (!response.ok) throw new Error('Failed to delete route');
  return response.json();
};

export const listTags = async (token) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/routes/tags`, {
    headers
  });
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

// ==================== Team Management API ====================

/**
 * 獲取所有團隊
 */
export const fetchTeams = async (token) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/teams`, {
    headers
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch teams');
  }
  
  return response.json();
};

/**
 * 創建團隊
 */
export const createTeam = async (data, token) => {
  const response = await fetch(`${API_URL}/api/teams`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create team');
  }
  
  return response.json();
};

/**
 * 更新團隊
 */
export const updateTeam = async (teamId, data, token) => {
  const response = await fetch(`${API_URL}/api/teams/${teamId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update team');
  }
  
  return response.json();
};

/**
 * 刪除團隊
 */
export const deleteTeam = async (teamId, token) => {
  const response = await fetch(`${API_URL}/api/teams/${teamId}`, {
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
  
  return response.json();
};

/**
 * 獲取團隊成員
 */
export const getTeamMembers = async (teamId, token) => {
  const response = await fetch(`${API_URL}/api/teams/${teamId}/members`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch team members');
  }
  
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
    const detail = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail || error);
    throw new Error(detail || 'Failed to update team role');
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
    const detail = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail || error);
    throw new Error(detail || 'Failed to add user to team');
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
