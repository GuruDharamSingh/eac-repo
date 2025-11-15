const postgres = require('postgres');

(async () => {
  try {
    const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:Ea4thway@localhost:5432/elkdonis_dev');

    console.log('\n📋 Users Table:');
    const users = await sql`SELECT id, email, display_name, is_admin FROM users ORDER BY email`;
    console.table(users);

    console.log('\n📋 Organizations Table:');
    const orgs = await sql`SELECT * FROM organizations ORDER BY id`;
    console.table(orgs);

    console.log('\n📋 User-Organizations Table:');
    const userOrgs = await sql`
      SELECT uo.user_id, u.email, uo.org_id, o.name as org_name, uo.role, uo.joined_at
      FROM user_organizations uo
      JOIN users u ON u.id = uo.user_id
      JOIN organizations o ON o.id = uo.org_id
      ORDER BY o.id, u.email
    `;
    console.table(userOrgs);

    await sql.end({ timeout: 5 });
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
