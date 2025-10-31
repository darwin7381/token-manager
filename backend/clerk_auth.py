"""
Clerk 認證和權限驗證
"""
from fastapi import HTTPException, Request, Header
from typing import Dict, Any, Optional
import os
import httpx
from dotenv import load_dotenv
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions

# 確保環境變數已載入
load_dotenv()

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
NAMESPACE = "tokenManager"

# 檢查 Secret Key 是否存在
if not CLERK_SECRET_KEY:
    raise ValueError("CLERK_SECRET_KEY not found in environment variables")

print(f"✅ Clerk Secret Key loaded: {CLERK_SECRET_KEY[:20]}...")

# 初始化 Clerk SDK
clerk_client = Clerk(bearer_auth=CLERK_SECRET_KEY)

async def verify_clerk_token(request: Request) -> Dict[str, Any]:
    """
    驗證 Clerk session token 並返回用戶資訊
    使用官方 Clerk SDK
    """
    try:
        # 獲取 Authorization header
        auth_header = request.headers.get('authorization', '')
        print(f"🔍 Authorization header: {auth_header[:50] if auth_header else 'None'}...")
        
        # 構建 httpx.Request
        httpx_request = httpx.Request(
            method=request.method,
            url=str(request.url),
            headers=request.headers.raw
        )
        
        print(f"🔍 Authenticating request to: {request.url}")
        
        # 使用 Clerk SDK 的 authenticate_request
        request_state = clerk_client.authenticate_request(
            httpx_request,
            AuthenticateRequestOptions(
                authorized_parties=['http://localhost:5173']
            )
        )
        
        print(f"🔍 Request state - is_signed_in: {request_state.is_signed_in}")
        print(f"🔍 Request state - reason: {request_state.reason}")
        print(f"🔍 Request state - payload: {request_state.payload}")
        
        if not request_state.is_signed_in:
            raise HTTPException(
                status_code=401, 
                detail=f"User not signed in. Reason: {request_state.reason}"
            )
        
        # 從 payload 獲取用戶 ID
        if not request_state.payload:
            raise HTTPException(status_code=401, detail="Invalid token: missing payload")
        
        user_id = request_state.payload.get("sub")  # JWT 標準中 user_id 在 sub claim
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user ID")
        
        print(f"✅ User authenticated: {user_id}")
        
        # 獲取用戶完整資訊
        user = clerk_client.users.get(user_id=user_id)
        
        # 轉換為字典
        user_data = {
            "id": user.id,
            "email_addresses": user.email_addresses,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "image_url": user.image_url,
            "public_metadata": user.public_metadata or {},
            "private_metadata": user.private_metadata or {}
        }
        
        return user_data
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Authentication error: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

def get_user_role(user: Dict[str, Any]) -> str:
    """獲取用戶角色"""
    return user.get("public_metadata", {}).get(f"{NAMESPACE}:role", "VIEWER")

def get_user_team(user: Dict[str, Any]) -> Optional[str]:
    """獲取用戶團隊"""
    return user.get("public_metadata", {}).get(f"{NAMESPACE}:team")

def check_permission(user: Dict[str, Any], required_role: str) -> bool:
    """
    檢查用戶是否有足夠的權限
    角色層級：VIEWER < DEVELOPER < MANAGER < ADMIN
    """
    role = get_user_role(user)
    
    hierarchy = ["VIEWER", "DEVELOPER", "MANAGER", "ADMIN"]
    
    if role not in hierarchy or required_role not in hierarchy:
        return False
    
    user_level = hierarchy.index(role)
    required_level = hierarchy.index(required_role)
    
    return user_level >= required_level

