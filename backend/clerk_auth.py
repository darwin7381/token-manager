"""
Clerk 認證和權限驗證 - Per-Team Roles 架構
"""
from fastapi import HTTPException, Request
from typing import Dict, Any, Optional
import os
import httpx
from dotenv import load_dotenv
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions

load_dotenv()

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
NAMESPACE = "tokenManager"

if not CLERK_SECRET_KEY:
    raise ValueError("CLERK_SECRET_KEY not found in environment variables")

print(f"✅ Clerk Secret Key loaded: {CLERK_SECRET_KEY[:20]}...")

# 初始化 Clerk SDK
clerk_client = Clerk(bearer_auth=CLERK_SECRET_KEY)

async def verify_clerk_token(request: Request) -> Dict[str, Any]:
    """驗證 Clerk session token 並返回用戶資訊"""
    try:
        auth_header = request.headers.get('authorization', '')
        print(f"🔍 Authorization header: {auth_header[:50] if auth_header else 'None'}...")
        
        httpx_request = httpx.Request(
            method=request.method,
            url=str(request.url),
            headers=request.headers.raw
        )
        
        print(f"🔍 Authenticating request to: {request.url}")
        
        request_state = clerk_client.authenticate_request(
            httpx_request,
            AuthenticateRequestOptions(
                authorized_parties=['http://localhost:5173']
            )
        )
        
        print(f"🔍 Request state - is_signed_in: {request_state.is_signed_in}")
        
        if not request_state.is_signed_in:
            raise HTTPException(
                status_code=401, 
                detail=f"User not signed in. Reason: {request_state.reason}"
            )
        
        if not request_state.payload:
            raise HTTPException(status_code=401, detail="Invalid token: missing payload")
        
        user_id = request_state.payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user ID")
        
        print(f"✅ User authenticated: {user_id}")
        
        user = clerk_client.users.get(user_id=user_id)
        
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

# ==================== Per-Team Roles Helper Functions ====================

def get_user_role_in_team(user: Dict[str, Any], team_id: str) -> Optional[str]:
    """
    獲取用戶在特定團隊的角色
    
    Args:
        user: 用戶數據（包含 public_metadata）
        team_id: 團隊 ID
    
    Returns:
        該用戶在該團隊的角色，如果不在該團隊則返回 None
    """
    team_roles = user.get("public_metadata", {}).get(f"{NAMESPACE}:teamRoles", {})
    return team_roles.get(team_id)

def get_user_teams(user: Dict[str, Any]) -> list[str]:
    """
    獲取用戶所在的所有團隊
    
    Returns:
        團隊 ID 列表
    """
    team_roles = user.get("public_metadata", {}).get(f"{NAMESPACE}:teamRoles", {})
    return list(team_roles.keys())

def get_all_user_team_roles(user: Dict[str, Any]) -> Dict[str, str]:
    """
    獲取用戶的所有團隊角色映射
    
    Returns:
        字典 {team_id: role}
    """
    return user.get("public_metadata", {}).get(f"{NAMESPACE}:teamRoles", {})

def get_highest_role(user: Dict[str, Any]) -> str:
    """
    獲取用戶的最高角色（用於全局權限檢查，如頁面訪問）
    
    Returns:
        最高角色（ADMIN > MANAGER > DEVELOPER > VIEWER）
    """
    team_roles = user.get("public_metadata", {}).get(f"{NAMESPACE}:teamRoles", {})
    
    if not team_roles:
        return "VIEWER"
    
    hierarchy = ["VIEWER", "DEVELOPER", "MANAGER", "ADMIN"]
    highest = "VIEWER"
    
    for role in team_roles.values():
        if role in hierarchy:
            role_level = hierarchy.index(role)
            highest_level = hierarchy.index(highest)
            if role_level > highest_level:
                highest = role
    
    return highest

def check_permission(user: Dict[str, Any], required_role: str) -> bool:
    """
    檢查用戶的最高角色是否滿足要求
    用於頁面級別的訪問控制
    
    Args:
        user: 用戶數據
        required_role: 需要的最低角色
    
    Returns:
        是否有足夠權限
    """
    user_highest_role = get_highest_role(user)
    
    hierarchy = ["VIEWER", "DEVELOPER", "MANAGER", "ADMIN"]
    
    if user_highest_role not in hierarchy or required_role not in hierarchy:
        return False
    
    user_level = hierarchy.index(user_highest_role)
    required_level = hierarchy.index(required_role)
    
    return user_level >= required_level
