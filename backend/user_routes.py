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
            
            # 安全地轉換 public_metadata
            import json
            if user.public_metadata:
                if isinstance(user.public_metadata, dict):
                    safe_metadata = dict(user.public_metadata)
                else:
                    safe_metadata = json.loads(json.dumps(user.public_metadata))
            else:
                safe_metadata = {}
            
            users.append({
                "id": user.id,
                "email": primary_email,
                "firstName": user.first_name,
                "lastName": user.last_name,
                "imageUrl": user.image_url,
                "publicMetadata": safe_metadata,
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
        import json
        target_user = clerk_client.users.get(user_id=user_id)
        # 安全地轉換 public_metadata
        if target_user.public_metadata:
            if isinstance(target_user.public_metadata, dict):
                target_metadata = dict(target_user.public_metadata)
            else:
                target_metadata = json.loads(json.dumps(target_user.public_metadata))
        else:
            target_metadata = {}
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
    team_roles = dict(target_metadata.get(f"{NAMESPACE}:teamRoles", {}))  # 複製一份！
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
    highest_role = get_highest_role(current_user)
    
    # 如果不是該團隊成員
    if not my_role_in_team:
        # 檢查是否可以認領空團隊
        if highest_role == "ADMIN":
            # 檢查團隊是否為空
            users_response = clerk_client.users.list(request={"limit": 100})
            
            team_members = []
            for user in users_response:
                team_roles = (user.public_metadata or {}).get(f"{NAMESPACE}:teamRoles", {})
                if data.team_id in team_roles:
                    team_members.append(user.id)
            
            if len(team_members) > 0:
                raise HTTPException(
                    status_code=403,
                    detail=f"You are not a member of team: {data.team_id}"
                )
            # 空團隊，允許認領
            print(f"✅ Empty team {data.team_id} can be claimed by ADMIN")
        else:
            raise HTTPException(
                status_code=403,
                detail=f"You are not a member of team: {data.team_id}"
            )
    elif my_role_in_team not in ["ADMIN", "MANAGER"]:
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
        import json
        target_user = clerk_client.users.get(user_id=user_id)
        # 安全地轉換 public_metadata
        if target_user.public_metadata:
            if isinstance(target_user.public_metadata, dict):
                target_metadata = dict(target_user.public_metadata)
            else:
                target_metadata = json.loads(json.dumps(target_user.public_metadata))
        else:
            target_metadata = {}
        team_roles = dict(target_metadata.get(f"{NAMESPACE}:teamRoles", {}))  # 複製一份！
        
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
        import json
        target_user = clerk_client.users.get(user_id=user_id)
        # 安全地轉換 public_metadata
        if target_user.public_metadata:
            if isinstance(target_user.public_metadata, dict):
                target_metadata = dict(target_user.public_metadata)
            else:
                target_metadata = json.loads(json.dumps(target_user.public_metadata))
        else:
            target_metadata = {}
        team_roles = dict(target_metadata.get(f"{NAMESPACE}:teamRoles", {}))  # 複製一份！
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
        # Clerk 的 update_metadata 是 merge 行為
        # 要刪除 nested key，必須設置為 null
        
        # 獲取完整的現有 metadata（已在上面轉換過）
        current_metadata = target_metadata
        current_team_roles = dict(current_metadata.get(f"{NAMESPACE}:teamRoles", {}))  # 複製一份！
        
        print(f"🔍 Current teamRoles: {current_team_roles}")
        
        # 設置該團隊的角色為 null（表示刪除）
        update_payload = {
            f"{NAMESPACE}:teamRoles": {
                **current_team_roles,
                team_id: None  # ← 設置為 None 來刪除
            }
        }
        
        print(f"🔍 Update payload: {update_payload}")
        
        clerk_client.users.update_metadata(
            user_id=user_id,
            public_metadata=update_payload
        )
        
        print(f"✅ Removed user {user_id} from team {team_id} (set to null)")
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
