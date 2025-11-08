#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
from clerk_backend_api import Clerk
import json

load_dotenv()
clerk = Clerk(bearer_auth=os.getenv('CLERK_SECRET_KEY'))

# 使用 Jessica 測試（從之前的測試她已經在 7 個團隊了）
target_id = "user_317xqVWRqqOeY3TOkGRVMy86J00"
NAMESPACE = "tokenManager"

# 獲取初始狀態
initial_user = clerk.users.get(user_id=target_id)
initial_teams = list((initial_user.public_metadata or {}).get(f'{NAMESPACE}:teamRoles', {}).keys())

print("=" * 70)
print("測試新的幂等邏輯")
print("=" * 70)
print(f"\n初始團隊: {initial_teams}")
print(f"初始團隊數: {len(initial_teams)}")

# 嘗試「添加」已存在的團隊（應該變成更新）
test_teams = initial_teams[:3]  # 取前 3 個已存在的團隊

print(f"\n測試添加已存在的團隊: {test_teams}")
print("（應該自動變成更新，不報錯）\n")

for i, team_id in enumerate(test_teams, 1):
    print(f"{i}. 處理 {team_id}...")
    
    try:
        # 重新獲取
        user = clerk.users.get(user_id=target_id)
        
        # 轉換
        if user.public_metadata:
            if isinstance(user.public_metadata, dict):
                meta = dict(user.public_metadata)
            else:
                meta = json.loads(json.dumps(user.public_metadata))
        else:
            meta = {}
        
        # 深層複製
        team_roles = dict(meta.get(f'{NAMESPACE}:teamRoles', {}))
        
        # 「添加」（即使已存在）
        old_role = team_roles.get(team_id, '無')
        team_roles[team_id] = 'VIEWER'
        
        updated_meta = meta.copy()
        updated_meta[f'{NAMESPACE}:teamRoles'] = team_roles
        
        clerk.users.update_metadata(
            user_id=target_id,
            public_metadata=updated_meta
        )
        
        print(f"   ✅ 成功（{old_role} → VIEWER）")
        
    except Exception as e:
        print(f"   ❌ 失敗: {e}")

# 驗證
final_user = clerk.users.get(user_id=target_id)
final_teams = (final_user.public_metadata or {}).get(f'{NAMESPACE}:teamRoles', {})
print(f"\n最終結果:")
for team, role in sorted(final_teams.items()):
    print(f"  {team}: {role}")

print(f"\n✅ 測試完成")
