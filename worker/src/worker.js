/**
 * Cloudflare Worker - API Gateway
 * 
 * 職責:
 * 1. 驗證 API Key
 * 2. 路由轉發
 * 3. 返回響應
 * 
 * 注意: 此代碼幾乎永遠不需要修改!
 * 所有配置都在 KV 中,由管理系統動態更新。
 */

export default {
  async fetch(request, env, ctx) {
    try {
      // 1. 提取 API Key
      const apiKey = request.headers.get('X-API-Key');
      
      if (!apiKey) {
        return jsonResponse({
          error: 'Missing API Key',
          message: 'Please provide X-API-Key header'
        }, 401);
      }
      
      // 2. 計算 token hash (與後端一致的算法)
      const tokenHash = await sha256(apiKey);
      
      // 3. 從 KV 查詢 token
      const tokenData = await env.TOKENS.get(`token:${tokenHash}`, { type: 'json' });
      
      if (!tokenData) {
        return jsonResponse({
          error: 'Invalid API Key',
          message: 'The provided API Key is invalid or has been revoked'
        }, 401);
      }
      
      // 4. 檢查過期
      if (tokenData.expires_at) {
        const expiresAt = new Date(tokenData.expires_at);
        if (expiresAt < new Date()) {
          return jsonResponse({
            error: 'Token Expired',
            message: 'The API Key has expired'
          }, 401);
        }
      }
      
      // 5. 獲取路由映射
      const routes = await env.TOKENS.get('routes', { type: 'json' });
      
      if (!routes || Object.keys(routes).length === 0) {
        return jsonResponse({
          error: 'Routes Not Configured',
          message: 'No routes have been configured'
        }, 500);
      }
      
      // 6. 匹配路由
      const url = new URL(request.url);
      let backend = null;
      let matchedPath = null;
      let routeTags = [];
      
      // 按路徑長度降序排序,確保最具體的路徑優先匹配
      const sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length);
      
      let routeAuth = null;
      
      for (const path of sortedPaths) {
        if (url.pathname.startsWith(path)) {
          const routeData = routes[path];
          // 支持新舊兩種格式
          if (typeof routeData === 'string') {
            // 舊格式: {path: "url"}
            backend = routeData;
            routeTags = [];
            routeAuth = null;
          } else {
            // 新格式: {path: {url: "url", tags: [...], auth: {...}}}
            backend = routeData.url;
            routeTags = routeData.tags || [];
            routeAuth = routeData.auth || null;
          }
          matchedPath = path;
          break;
        }
      }
      
      if (!backend) {
        return jsonResponse({
          error: 'Route Not Found',
          message: `No route configured for ${url.pathname}`
        }, 404);
      }
      
      // 7. 檢查權限範圍 (Scopes)
      // 支持三種權限模式:
      // 1. '*' - 全部權限
      // 2. 具體路徑 (如 'image') - 匹配 /api/image
      // 3. 標籤權限 (如 'tag:media') - 匹配所有包含該標籤的路由
      
      const scopes = tokenData.scopes || [];
      
      // 如果有 * 權限，直接通過
      if (scopes.includes('*')) {
        // 有全部權限，通過
      } else {
        // 提取服務名稱 (例如 /api/image -> image)
        const pathParts = matchedPath.split('/').filter(s => s);
        const serviceName = pathParts.length >= 2 ? pathParts[1] : null;
        
        let hasPermission = false;
        
        // 檢查具體路徑權限
        if (serviceName && scopes.includes(serviceName)) {
          hasPermission = true;
        }
        
        // 檢查標籤權限
        if (!hasPermission && routeTags.length > 0) {
          // 獲取所有 tag: 開頭的 scopes
          const tagScopes = scopes
            .filter(s => s.startsWith('tag:'))
            .map(s => s.substring(4)); // 移除 'tag:' 前綴
          
          // 檢查路由的 tags 是否包含任一 token scope
          const hasTagMatch = tagScopes.some(tagScope => routeTags.includes(tagScope));
          
          if (hasTagMatch) {
            hasPermission = true;
          }
        }
        
        if (!hasPermission) {
          return jsonResponse({
            error: 'Permission Denied',
            message: `Token does not have permission for '${serviceName}'. Available scopes: ${scopes.join(', ')}`
          }, 403);
        }
      }
      
      // 8. 構建後端 URL
      // 移除匹配的路徑前綴
      const backendPath = url.pathname.substring(matchedPath.length);
      const backendUrl = backend + backendPath + url.search;
      
      // 9. 準備後端請求的 headers（添加後端認證）
      const backendHeaders = new Headers(request.headers);
      
      // 添加後端微服務認證
      if (routeAuth && routeAuth.type && routeAuth.type !== 'none') {
        const authType = routeAuth.type;
        const authConfig = routeAuth.config || {};
        
        try {
          switch (authType) {
            case 'bearer':
              // Bearer Token 認證
              // 先嘗試從 env 讀取（wrangler secret），再從 KV 讀取（UI 設定）
              let bearerToken = env[authConfig.token_ref];
              if (!bearerToken && authConfig.token_ref) {
                const secretData = await env.TOKENS.get(`secret:${authConfig.token_ref}`, { type: 'json' });
                bearerToken = secretData?.value;
              }
              if (bearerToken) {
                backendHeaders.set('Authorization', `Bearer ${bearerToken}`);
              }
              break;
            
            case 'api-key':
              // API Key 認證
              let apiKey = env[authConfig.key_ref];
              if (!apiKey && authConfig.key_ref) {
                const secretData = await env.TOKENS.get(`secret:${authConfig.key_ref}`, { type: 'json' });
                apiKey = secretData?.value;
              }
              if (apiKey) {
                const headerName = authConfig.header_name || 'X-API-Key';
                backendHeaders.set(headerName, apiKey);
              }
              break;
            
            case 'basic':
              // Basic Auth 認證
              let username = env[authConfig.username_ref];
              let password = env[authConfig.password_ref];
              
              if (!username && authConfig.username_ref) {
                const secretData = await env.TOKENS.get(`secret:${authConfig.username_ref}`, { type: 'json' });
                username = secretData?.value;
              }
              if (!password && authConfig.password_ref) {
                const secretData = await env.TOKENS.get(`secret:${authConfig.password_ref}`, { type: 'json' });
                password = secretData?.value;
              }
              
              if (username && password) {
                const credentials = btoa(`${username}:${password}`);
                backendHeaders.set('Authorization', `Basic ${credentials}`);
              }
              break;
          }
        } catch (error) {
          console.error('Backend auth error:', error);
          // 繼續轉發，但沒有後端認證
        }
      }
      
      // 10. 準備 body (buffer 化，支援 redirect)
      let bodyContent = null;
      if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        // 將 stream 轉為 buffer，讓 body 可以在 redirect 時重用
        bodyContent = await request.arrayBuffer();
      }
      
      // 11. 轉發請求
      const backendRequest = new Request(backendUrl, {
        method: request.method,
        headers: backendHeaders,
        body: bodyContent,
        redirect: 'manual'  // 手動處理 redirect
      });
      
      // 12. 發送請求並計時
      const startTime = Date.now();
      const backendResponse = await fetch(backendRequest);
      const responseTime = Date.now() - startTime;
      
      // 13. 處理 redirect (3xx 狀態碼)
      let finalResponse = backendResponse;
      
      if (backendResponse.status >= 300 && backendResponse.status < 400) {
        const location = backendResponse.headers.get('Location');
        
        if (location) {
          // 將後端的 Location 轉換為 Gateway URL
          const requestUrl = new URL(request.url);
          const rewrittenLocation = rewriteLocationHeader(
            location,
            backend,
            matchedPath,
            requestUrl.hostname
          );
          
          // 創建新的可變 Headers 對象並複製所有 headers
          const newHeaders = new Headers(backendResponse.headers);
          // 修改 Location header 為 Gateway URL
          newHeaders.set('Location', rewrittenLocation);
          
          // 創建新 response
          finalResponse = new Response(backendResponse.body, {
            status: backendResponse.status,
            statusText: backendResponse.statusText,
            headers: newHeaders
          });
        }
      }
      
      // 14. 記錄 Token 使用情況（異步，不阻塞響應）
      // 使用 ctx.waitUntil 確保在響應返回後繼續執行
      ctx.waitUntil(
        logTokenUsage({
          tokenHash,
          routePath: matchedPath,
          responseStatus: finalResponse.status,
          responseTime,
          ipAddress: request.headers.get('cf-connecting-ip'),
          userAgent: request.headers.get('user-agent'),
          requestMethod: request.method,
          errorMessage: finalResponse.ok ? null : `HTTP ${finalResponse.status}`
        }, env)
      );
      
      return finalResponse;
      
    } catch (error) {
      return jsonResponse({
        error: 'Internal Server Error',
        message: error.message,
        stack: error.stack
      }, 500);
    }
  }
};

/**
 * 重寫 Location Header，將後端 URL 轉換為 Gateway URL
 * 
 * @param {string} location - 原始 Location header 值
 * @param {string} backendBaseUrl - 後端基礎 URL (如 https://md.blocktempo.ai)
 * @param {string} gatewayPrefix - Gateway 路徑前綴 (如 /api/hedgedoc)
 * @param {string} gatewayHostname - Gateway 域名 (如 api-gateway.cryptoxlab.workers.dev)
 * @returns {string} 重寫後的 Location URL
 */
function rewriteLocationHeader(location, backendBaseUrl, gatewayPrefix, gatewayHostname) {
  try {
    // 情況 1: 絕對 URL (https://backend.com/resource)
    if (location.startsWith('http://') || location.startsWith('https://')) {
      const locationUrl = new URL(location);
      const backendUrl = new URL(backendBaseUrl);
      
      // 只重寫同源的 Location（防止重寫外部 redirect）
      if (locationUrl.hostname === backendUrl.hostname) {
        // 構建 Gateway URL
        return `https://${gatewayHostname}${gatewayPrefix}${locationUrl.pathname}${locationUrl.search}${locationUrl.hash}`;
      }
      
      // 外部 URL 不重寫
      return location;
    }
    
    // 情況 2: 絕對路徑 (/resource)
    if (location.startsWith('/')) {
      return `https://${gatewayHostname}${gatewayPrefix}${location}`;
    }
    
    // 情況 3: 相對路徑 (resource 或 ./resource)
    // 保持原樣（讓瀏覽器基於當前 URL 解析）
    return location;
    
  } catch (error) {
    // 解析失敗，返回原始值
    console.error('Location rewrite error:', error);
    return location;
  }
}

/**
 * 計算 SHA256 hash
 */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * 返回 JSON 響應
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    }
  });
}

/**
 * 記錄 Token 使用情況到後端
 * 使用異步方式，不阻塞主請求
 */
async function logTokenUsage(usageData, env) {
  try {
    // 從環境變數獲取後端 URL
    // 生產環境: https://tapi.blocktempo.ai
    // 開發環境: http://localhost:8000
    const backendUrl = env.TOKEN_MANAGER_BACKEND || 'https://tapi.blocktempo.ai';
    
    const payload = {
      token_hash: usageData.tokenHash,
      route: usageData.routePath,
      timestamp: Date.now(),
      response_status: usageData.responseStatus,
      response_time_ms: usageData.responseTime,
      ip_address: usageData.ipAddress,
      user_agent: usageData.userAgent,
      request_method: usageData.requestMethod,
      error_message: usageData.errorMessage
    };
    
    const response = await fetch(`${backendUrl}/api/usage-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      // 5 秒超時，避免阻塞太久
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      console.error('Usage log failed:', response.status, await response.text());
    }
  } catch (error) {
    // 記錄失敗不影響主流程
    console.error('Failed to log token usage:', error.message);
  }
}

