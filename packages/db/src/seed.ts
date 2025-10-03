import bcrypt from "bcrypt";
import { PrismaClient } from "./generated/prisma/index.js";
import type { Role as PrismaRole } from "./generated/prisma/index.js";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

const ORGANIZATIONS = [
  { key: "eac", name: "ELKDonus Arts Collective" },
  { key: "amritCanada", name: "Amrit Canada" },
  { key: "bookReaders", name: "Book Readers" },
] as const;

type OrgKey = (typeof ORGANIZATIONS)[number]["key"];

interface OrgInfo {
  id: string;
  name: string;
}

interface UserSeed {
  email: string;
  name: string;
  password: string;
  isSuperadmin?: boolean;
  orgMemberships: Array<{ orgKey: OrgKey; role: PrismaRole }>;
}

const USER_SEEDS: UserSeed[] = [
  {
    email: "gurudharamsingh@gmail.com",
    name: "Guru Dharam Singh",
    password: "E1w2A3f4",
    isSuperadmin: true,
    orgMemberships: [{ orgKey: "eac", role: "ADMIN" as PrismaRole }],
  },
];

async function ensureOrganizations(): Promise<Record<OrgKey, OrgInfo>> {
  const records = {} as Record<OrgKey, OrgInfo>;

  for (const org of ORGANIZATIONS) {
    const existing = await prisma.organization.findFirst({
      where: { name: org.name },
    });

    if (existing) {
      records[org.key] = { id: existing.id, name: existing.name };
      console.log(`[ORG] ready: ${existing.name} (${existing.id})`);
      continue;
    }

    const created = await prisma.organization.create({
      data: { name: org.name },
    });

    records[org.key] = { id: created.id, name: created.name };
    console.log(`[ORG] created: ${created.name} (${created.id})`);
  }

  return records;
}

async function ensureMembership(userId: string, orgId: string, role: PrismaRole) {
  const membership = await prisma.userOrganization.upsert({
    where: {
      userId_orgId: {
        userId,
        orgId,
      },
    },
    update: { role },
    create: { userId, orgId, role },
  });

  console.log(`[LINK] user ${userId} -> org ${orgId} as ${role}`);
  return membership;
}

async function ensureUsers(organizations: Record<OrgKey, OrgInfo>) {
  for (const seed of USER_SEEDS) {
    const passwordHash = await bcrypt.hash(seed.password, SALT_ROUNDS);

    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {
        name: seed.name,
        password: passwordHash,
        isSuperadmin: seed.isSuperadmin ?? false,
      },
      create: {
        name: seed.name,
        email: seed.email,
        password: passwordHash,
        isSuperadmin: seed.isSuperadmin ?? false,
      },
    });

    console.log(`[USER] ready: ${user.email} (${user.id})`);

    for (const membership of seed.orgMemberships) {
      const org = organizations[membership.orgKey];

      if (!org) {
        console.warn(
          `[WARN] skipping membership for ${seed.email}; organization "${membership.orgKey}" not found.`,
        );
        continue;
      }

      await ensureMembership(user.id, org.id, membership.role);
    }
  }
}

async function logSummary() {
  const users = await prisma.user.findMany({
    include: {
      organizations: {
        include: { org: true },
      },
    },
  });

  console.log("\nCurrent users:");
  for (const user of users) {
    const orgSummary =
      user.organizations.length > 0
        ? user.organizations
            .map(uo => `${uo.org.name} (${uo.role})`)
            .join(", ")
        : "none";

    console.log(`- ${user.name} <${user.email}> :: superadmin=${user.isSuperadmin}`);
    console.log(`  Organizations: ${orgSummary}`);
  }
}

async function main() {
  console.log("Starting database seeding...\n");

  const organizations = await ensureOrganizations();

  await ensureUsers(organizations);

  await logSummary();

  console.log("\nSeeding completed.");
}

main()
  .catch(error => {
    console.error("Error during seeding", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




