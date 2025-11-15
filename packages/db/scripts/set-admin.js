const postgres = require('postgres');

(async () => {
  try {
    const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:Ea4thway@localhost:5432/elkdonis_dev');

    console.log('\n🔧 Setting gurudharamsingh@gmail.com as admin...\n');

    await sql`
      UPDATE users
      SET is_admin = true
      WHERE email = 'gurudharamsingh@gmail.com'
    `;

    console.log('✅ Updated user to admin status');

    // Verify
    const users = await sql`
      SELECT id, email, display_name, is_admin
      FROM users
      WHERE email IN ('justin.gillisb@gmail.com', 'gurudharamsingh@gmail.com')
      ORDER BY email
    `;
    console.log('\n📋 Updated users:');
    console.table(users);

    await sql.end({ timeout: 5 });
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
