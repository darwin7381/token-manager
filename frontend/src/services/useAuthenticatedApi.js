/**
 * 帶認證的 API Hook
 * 使用 Clerk 的 session token
 */

import { useAuth } from '@clerk/clerk-react';
import { createAuthenticatedFetch } from './apiClient';

export const useAuthenticatedApi = () => {
  const { getToken } = useAuth();
  const authenticatedFetch = createAuthenticatedFetch(getToken);

  return {
    // ==================== Token API ====================
    createToken: async (data) => {
      return authenticatedFetch('/api/tokens', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    listTokens: async () => {
      return authenticatedFetch('/api/tokens');
    },

    updateToken: async (id, data) => {
      return authenticatedFetch(`/api/tokens/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    deleteToken: async (id) => {
      return authenticatedFetch(`/api/tokens/${id}`, {
        method: 'DELETE',
      });
    },

    // ==================== Route API ====================
    createRoute: async (data) => {
      return authenticatedFetch('/api/routes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    listRoutes: async () => {
      return authenticatedFetch('/api/routes');
    },

    updateRoute: async (id, data) => {
      return authenticatedFetch(`/api/routes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    deleteRoute: async (id) => {
      return authenticatedFetch(`/api/routes/${id}`, {
        method: 'DELETE',
      });
    },

    listTags: async () => {
      return authenticatedFetch('/api/routes/tags');
    },

    // ==================== Stats API ====================
    getStats: async () => {
      return authenticatedFetch('/api/stats');
    },
  };
};

