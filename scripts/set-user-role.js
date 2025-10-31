/**
 * 設定用戶角色的腳本
 * 使用 Clerk Backend API
 * 
 * 使用方式：
 * node scripts/set-user-role.js <user_id> <role> [team]
 * 
 * 範例：
 * node scripts/set-user-role.js user_xxx ADMIN
 * node scripts/set-user-role.js user_yyy MANAGER backend-team
 * node scripts/set-user-role.js user_zzz DEVELOPER frontend-team
 */

const NAMESPACE = 'tokenManager';
const VALID_ROLES = ['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER'];
const VALID_TEAMS = [
  'platform-team',
  'backend-team', 
  'frontend-team',
  'data-team',
  'devops-team'
];

// 解析命令行參數
const args = process.argv.slice(2);
const userId = args[0];
const role = args[1];
const team = args[2];

// 驗證參數
function validateArgs() {
  if (!userId) {
    console.error('❌ 錯誤：缺少 user_id');
    console.log('使用方式：node scripts/set-user-role.js <user_id> <role> [team]');
    process.exit(1);
  }
  
  if (!role) {
    console.error('❌ 錯誤：缺少 role');
    console.log('可用角色：', VALID_ROLES.join(', '));
    process.exit(1);
  }
  
  if (!VALID_ROLES.includes(role)) {
    console.error(`❌ 錯誤：無效的角色 "${role}"`);
    console.log('可用角色：', VALID_ROLES.join(', '));
    process.exit(1);
  }
  
  // MANAGER 和 DEVELOPER 必須指定團隊
  if (['MANAGER', 'DEVELOPER'].includes(role) && !team) {
    console.error(`❌ 錯誤：${role} 角色必須指定團隊`);
    console.log('可用團隊：', VALID_TEAMS.join(', '));
    process.exit(1);
  }
  
  if (team && !VALID_TEAMS.includes(team)) {
    console.error(`❌ 錯誤：無效的團隊 "${team}"`);
    console.log('可用團隊：', VALID_TEAMS.join(', '));
    process.exit(1);
  }
  
  // ADMIN 和 VIEWER 不需要團隊
  if (['ADMIN', 'VIEWER'].includes(role) && team) {
    console.warn(`⚠️  警告：${role} 角色不需要團隊，團隊設定將被忽略`);
  }
}

// 構建 metadata
function buildMetadata() {
  const metadata = {
    [`${NAMESPACE}:role`]: role,
    [`${NAMESPACE}:updatedAt`]: new Date().toISOString()
  };
  
  if (team && ['MANAGER', 'DEVELOPER'].includes(role)) {
    metadata[`${NAMESPACE}:team`] = team;
  }
  
  return metadata;
}

// 主函數
async function main() {
  validateArgs();
  
  const metadata = buildMetadata();
  
  console.log('\n📋 即將設定的 metadata：');
  console.log(JSON.stringify(metadata, null, 2));
  console.log('\n⚠️  請手動執行以下步驟：\n');
  console.log('1. 前往 Clerk Dashboard: https://dashboard.clerk.com');
  console.log('2. 選擇你的 Application');
  console.log('3. 點擊左側 "Users"');
  console.log(`4. 搜尋並選擇用戶: ${userId}`);
  console.log('5. 點擊 "Metadata" tab');
  console.log('6. 在 "Public metadata" 中添加以下內容：\n');
  console.log(JSON.stringify(metadata, null, 2));
  console.log('\n7. 點擊 "Save"\n');
  console.log('✅ 完成後，用戶的角色將會生效！');
  console.log('\n💡 提示：你也可以使用 Clerk Backend API 自動化這個過程');
  console.log('   參考文檔：https://clerk.com/docs/reference/backend-api\n');
}

main().catch(console.error);


