/**
 * Test script for Nextcloud integration
 * Run with: npx tsx src/test-nextcloud.ts
 */

import { webdavService, userService, talkService } from './lib/nextcloud';

async function testNextcloudIntegration() {
  console.log('🚀 Testing Nextcloud Integration...\n');

  try {
    // Test 1: WebDAV - Create folder structure
    console.log('📁 Test 1: Creating organization folders...');
    try {
      await webdavService.createDirectory('EAC_Network');
      await webdavService.createOrgFolders('elkdonis');
      await webdavService.createOrgFolders('sunjay');
      await webdavService.createOrgFolders('guru-dharam');
      console.log('✅ Organization folders created successfully\n');
    } catch (error: any) {
      console.log('⚠️  Folders may already exist:', error.message, '\n');
    }

    // Test 2: List directory contents
    console.log('📋 Test 2: Listing root directory...');
    const files = await webdavService.listDirectory('');
    console.log(`Found ${files.length} items in root:`);
    files.slice(0, 5).forEach(file => {
      console.log(`  - ${file.type === 'directory' ? '📁' : '📄'} ${file.basename}`);
    });
    console.log('');

    // Test 3: User creation
    console.log('👤 Test 3: Creating test user...');
    try {
      const userCreated = await userService.createUser({
        userid: 'test-user-' + Date.now(),
        password: 'TestPassword123!',
        displayName: 'Test User',
        email: 'test@example.com',
        groups: ['elkdonis'],
      });
      console.log(`✅ Test user created: ${userCreated}\n`);
    } catch (error: any) {
      console.log('⚠️  User creation issue:', error.message, '\n');
    }

    // Test 4: Talk room creation
    console.log('💬 Test 4: Creating Talk room...');
    try {
      const room = await talkService.createRoom({
        roomType: 3, // Public
        roomName: 'Test Meeting Room',
      });
      console.log(`✅ Talk room created with token: ${room.token}`);
      console.log(`   Access URL: http://localhost:8080/index.php/call/${room.token}\n`);
    } catch (error: any) {
      console.log('⚠️  Talk room creation issue:', error.message, '\n');
    }

    // Test 5: Check specific organization folder
    console.log('🔍 Test 5: Checking elkdonis organization folder...');
    const orgPath = 'EAC_Network/elkdonis';
    const exists = await webdavService.exists(orgPath);
    if (exists) {
      const orgContents = await webdavService.listDirectory(orgPath);
      console.log(`✅ Elkdonis folder exists with ${orgContents.length} items:`);
      orgContents.forEach(item => {
        console.log(`  - ${item.type === 'directory' ? '📁' : '📄'} ${item.basename}`);
      });
    } else {
      console.log('❌ Elkdonis folder not found');
    }

    console.log('\n✨ Nextcloud integration tests completed!');
    console.log(`\nNextcloud is accessible at: ${process.env.NEXTCLOUD_URL || 'http://localhost:8080'}`);
    console.log(`Login with: ${process.env.NEXTCLOUD_ADMIN_USER || 'admin'} / <password from env>`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
testNextcloudIntegration();