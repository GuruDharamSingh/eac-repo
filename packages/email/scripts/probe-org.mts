/**
 * The org a database-writing probe script may write to.
 *
 * `test-layers.mts` and `test-suite.mts` write, then clean up, rows in the
 * production database (`elkdonis_dev` is the only app database). Until
 * 2026-10-10 both wrote to org `ifac`, where `clearOrgTemplate('ifac',
 * 'welcome')` would have deleted a real override. They now refuse to run
 * unless given `--org probe-<name>`: a sentinel id with the `probe-` prefix,
 * which no organisation uses (checked 2026-10-10: 0 `organizations` rows).
 * `email_template_settings` has no foreign key on `org_id`; other tables the
 * suite touches may, in which case the suite fails before writing.
 * (claude, 2026-10-10)
 */
export function probeOrg(argv: string[] = process.argv.slice(2)): string {
  let value: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--org') value = argv[i + 1];
    else if (arg.startsWith('--org=')) value = arg.slice('--org='.length);
  }
  if (!value || !/^probe-[a-z0-9_-]+$/i.test(value)) {
    console.error(
      'Refusing to run: this script writes to the production database.\n' +
        'Pass --org probe-<name>, a sentinel org id beginning with "probe-".'
    );
    process.exit(2);
  }
  return value;
}
