const postgres = require('postgres');

(async () => {
  try {
    const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:Ea4thway@localhost:5432/elkdonis_dev');

    console.log('\n🔧 Setting up blog admin relationships...\n');

    const justinId = 'eb464e4b-fa0e-430c-b1c0-11ee685ff8fe';
    const guruDharamId = '978c7972-eef7-4655-aa11-ea310f6f378e';

    // Justin as admin (guide) for Sunjay blog
    await sql`
      INSERT INTO user_organizations (user_id, org_id, role)
      VALUES (${justinId}, 'sunjay', 'guide')
      ON CONFLICT (user_id, org_id)
      DO UPDATE SET role = 'guide'
    `;
    console.log('✅ Set justin.gillisb@gmail.com as GUIDE for Sunjay blog');

    // Guru Dharam as admin (guide) for Guru Dharam blog
    await sql`
      INSERT INTO user_organizations (user_id, org_id, role)
      VALUES (${guruDharamId}, 'guru-dharam', 'guide')
      ON CONFLICT (user_id, org_id)
      DO UPDATE SET role = 'guide'
    `;
    console.log('✅ Set gurudharamsingh@gmail.com as GUIDE for Guru Dharam blog');

    // Verify the changes
    console.log('\n📋 Verification - User-Organizations relationships:');
    const relations = await sql`
      SELECT uo.user_id, u.email, uo.org_id, o.name as org_name, uo.role
      FROM user_organizations uo
      JOIN users u ON u.id = uo.user_id
      JOIN organizations o ON o.id = uo.org_id
      ORDER BY o.id, u.email
    `;
    console.table(relations);

    console.log('\n✅ Blog admin setup complete!\n');

    await sql.end({ timeout: 5 });
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
