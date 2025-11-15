const postgres = require('postgres');

(async () => {
  try {
    const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/elkdonis_dev');
    const rows = await sql`
      SELECT id, email
      FROM users
      WHERE email IN ('justin.gillisb@gmail.com', 'gurudharamsingh@gmail.com')
    `;
    console.log(JSON.stringify(rows, null, 2));
    await sql.end({ timeout: 5 });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
