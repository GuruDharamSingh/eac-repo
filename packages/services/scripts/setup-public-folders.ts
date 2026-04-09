/**
 * Script to set up public folders for all existing organizations
 * Run with: tsx packages/services/scripts/setup-public-folders.ts
 */
import { db } from '@elkdonis/db';
import { createOrgFolders } from '../src/nextcloud';

async function setupPublicFolders() {
  console.log('🚀 Setting up public folders for all organizations...\n');

  try {
    // Get all organizations
    const orgs = await db`
      SELECT id, name FROM organizations
    `;

    console.log(`Found ${orgs.length} organizations\n`);

    for (const org of orgs) {
      console.log(`📁 Setting up folders for: ${org.name} (${org.id})`);
      
      const success = await createOrgFolders(org.id);
      
      if (success) {
        console.log(`✅ Successfully set up folders for ${org.name}\n`);
      } else {
        console.log(`❌ Failed to set up folders for ${org.name}\n`);
      }
    }

    console.log('✨ Setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up public folders:', error);
    process.exit(1);
  }
}

setupPublicFolders();
