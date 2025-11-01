"""
用戶管理 API 路由 - Per-Team Roles 架構
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from pydantic import BaseModel
from clerk_auth import verify_clerk_token, get_user_role_in_team, get_user_teams, get_all_user_team_roles, get_highest_role, check_permission, NAMESPACE, clerk_client

router = APIRouter(prefix="/api/users", tags=["users"])

class UpdateTeamRoleRequest(BaseModel):
    team_id: str
    role: str

class AddToTeamRequest(BaseModel):
    team_id: str
    role: str

@router.get("")
async def list_users(current_user: Dict[str, Any] = Depends(verify_clerk_token)):
    """
    獲取所有用戶列表
    需要至少是 MANAGER（在任一團隊）
    """
    # 檢查用戶的最高角色
    if not check_permission(current_user, "MANAGER"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    try:
        users_response = clerk_client.users.list(request={
            "limit": 100,
            "offset": 0
        })
        
        users = []
        for user in users_response:
            primary_email = None
            if user.email_addresses and len(user.email_addresses) > 0:
                primary_email = user.email_addresses[0].email_address if hasattr(user.email_addresses[0], 'email_address') else str(user.email_addresses[0])
            
            users.append({
                "id": user.id,
                "email": primary_email,
                "firstName": user.first_name,
                "lastName": user.last_name,
                "imageUrl": user.image_url,
                "publicMetadata": user.public_metadata or {},
                "createdAt": user.created_at,
                "lastSignInAt": user.last_sign_in_at
            })
        
        print(f"✅ Returning {len(users)} users")
        return users
            
    except Exception as e:
        print(f"❌ Failed to fetch users: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")

@router.put("/{user_id}/team-role")
async def update_team_role(
    user_id: str,
    data: UpdateTeamRoleRequest,
    current_user: Dict[str, Any] = Depends(verify_clerk_token)
):
    """
    更新用戶在特定團隊的角色
    
    規則：
    - 只能編輯你所在團隊的成員
    - ADMIN 可以設置任何角色
    - MANAGER 不能設置或編輯 ADMIN/MANAGER
    """
    
    # === 1. 驗證角色 ===
    valid_roles = ["ADMIN", "MANAGER", "DEVELOPER", "VIEWER"]
    if data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")
    
    # === 2. 獲取當前用戶在該團隊的角色 ===
    my_role_in_team = get_user_role_in_team(current_user, data.team_id)
    
    if not my_role_in_team:
        raise HTTPException(
            status_code=403,
            detail=f"You are not a member of team: {data.team_id}"
        )
    
    if my_role_in_team not in ["ADMIN", "MANAGER"]:
        raise HTTPException(
            status_code=403,
            detail="Only ADMIN or MANAGER can manage team members"
        )
    
    # === 3. 獲取目標用戶信息 ===
    try:
        target_user = clerk_client.users.get(user_id=user_id)
        target_metadata = dict(target_user.public_metadata or {})
        target_team_roles = target_metadata.get(f"{NAMESPACE}:teamRoles", {})
        target_role_in_team = target_team_roles.get(data.team_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user: {str(e)}")
    
    # === 4. MANAGER 的限制 ===
    if my_role_in_team == "MANAGER":
        # MANAGER 不能設置 ADMIN 或 MANAGER 角色
        if data.role in ["ADMIN", "MANAGER"]:
            raise HTTPException(
                status_code=403,
                detail="MANAGER cannot assign ADMIN or MANAGER roles"
            )
        
        # MANAGER 不能編輯 ADMIN 或 MANAGER
        if target_role_in_team in ["ADMIN", "MANAGER"]:
            raise HTTPException(
                status_code=403,
                detail="MANAGER cannot edit users with ADMIN or MANAGER role in this team"
            )
    
    # === 5. 更新該團隊的角色 ===
    team_roles = target_metadata.get(f"{NAMESPACE}:teamRoles", {})
    team_roles[data.team_id] = data.role
    
    updated_metadata = target_metadata.copy()
    updated_metadata[f"{NAMESPACE}:teamRoles"] = team_roles
    
    try:
        clerk_client.users.update_metadata(
            user_id=user_id,
            public_metadata=updated_metadata
        )
        
        print(f"✅ Updated user {user_id} in team {data.team_id}: role={data.role}")
        return {
            "success": True,
            "user_id": user_id,
            "team_id": data.team_id,
            "role": data.role
        }
    
    except Exception as e:
        print(f"❌ Failed to update user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update user: {str(e)}")

@router.post("/{user_id}/team-membership")
async def add_user_to_team(
    user_id: str,
    data: AddToTeamRequest,
    current_user: Dict[str, Any] = Depends(verify_clerk_token)
):
    """
    添加用戶到團隊並分配角色
    
    規則：
    - 只有該團隊的 ADMIN/MANAGER 可以添加成員
    - MANAGER 不能添加 ADMIN/MANAGER 角色
    """
    
    # === 1. 驗證角色 ===
    valid_roles = ["ADMIN", "MANAGER", "DEVELOPER", "VIEWER"]
    if data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")
    
    # === 2. 檢查當前用戶在該團隊的權限 ===
    my_role_in_team = get_user_role_in_team(current_user, data.team_id)
    
    if not my_role_in_team:
        raise HTTPException(
            status_code=403,
            detail=f"You are not a member of team: {data.team_id}"
        )
    
    if my_role_in_team not in ["ADMIN", "MANAGER"]:
        raise HTTPException(
            status_code=403,
            detail="Only ADMIN or MANAGER can add team members"
        )
    
    # === 3. MANAGER 限制 ===
    if my_role_in_team == "MANAGER" and data.role in ["ADMIN", "MANAGER"]:
        raise HTTPException(
            status_code=403,
            detail="MANAGER cannot assign ADMIN or MANAGER roles"
        )
    
    # === 4. 獲取目標用戶並添加到團隊 ===
    try:
        target_user = clerk_client.users.get(user_id=user_id)
        target_metadata = dict(target_user.public_metadata or {})
        team_roles = target_metadata.get(f"{NAMESPACE}:teamRoles", {})
        
        # 檢查是否已在團隊
        if data.team_id in team_roles:
            raise HTTPException(
                status_code=400,
                detail=f"User is already a member of team: {data.team_id}"
            )
        
        # 添加到團隊
        team_roles[data.team_id] = data.role
        
        updated_metadata = target_metadata.copy()
        updated_metadata[f"{NAMESPACE}:teamRoles"] = team_roles
        
        clerk_client.users.update_metadata(
            user_id=user_id,
            public_metadata=updated_metadata
        )
        
        print(f"✅ Added user {user_id} to team {data.team_id} as {data.role}")
        return {
            "success": True,
            "user_id": user_id,
            "team_id": data.team_id,
            "role": data.role
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to add user to team: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add user to team: {str(e)}")

@router.delete("/{user_id}/team-membership/{team_id}")
async def remove_user_from_team(
    user_id: str,
    team_id: str,
    current_user: Dict[str, Any] = Depends(verify_clerk_token)
):
    """
    從團隊移除用戶
    
    規則：
    - 只有該團隊的 ADMIN/MANAGER 可以移除成員
    - MANAGER 不能移除 ADMIN/MANAGER
    """
    
    # === 1. 檢查當前用戶在該團隊的權限 ===
    my_role_in_team = get_user_role_in_team(current_user, team_id)
    
    if not my_role_in_team:
        raise HTTPException(
            status_code=403,
            detail=f"You are not a member of team: {team_id}"
        )
    
    if my_role_in_team not in ["ADMIN", "MANAGER"]:
        raise HTTPException(
            status_code=403,
            detail="Only ADMIN or MANAGER can remove team members"
        )
    
    # === 2. 獲取目標用戶 ===
    try:
        target_user = clerk_client.users.get(user_id=user_id)
        target_metadata = dict(target_user.public_metadata or {})
        team_roles = target_metadata.get(f"{NAMESPACE}:teamRoles", {})
        target_role_in_team = team_roles.get(team_id)
        
        if not target_role_in_team:
            raise HTTPException(
                status_code=404,
                detail=f"User is not a member of team: {team_id}"
            )
        
        # === 3. MANAGER 限制 ===
        if my_role_in_team == "MANAGER" and target_role_in_team in ["ADMIN", "MANAGER"]:
            raise HTTPException(
                status_code=403,
                detail="MANAGER cannot remove users with ADMIN or MANAGER role"
            )
        
        # === 4. 從團隊移除 ===
        del team_roles[team_id]
        
        updated_metadata = target_metadata.copy()
        updated_metadata[f"{NAMESPACE}:teamRoles"] = team_roles
        
        clerk_client.users.update_metadata(
            user_id=user_id,
            public_metadata=updated_metadata
        )
        
        print(f"✅ Removed user {user_id} from team {team_id}")
        return {
            "success": True,
            "user_id": user_id,
            "team_id": team_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to remove user from team: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to remove user from team: {str(e)}")
