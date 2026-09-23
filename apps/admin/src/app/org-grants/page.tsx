'use client';

import { useEffect, useState } from 'react';
import { Container, Title, Text, Paper, Table, Switch, Badge, Loader, Center, Alert } from '@mantine/core';

interface OrgGrantRow {
  orgId: string;
  orgName: string;
  granted: boolean;
  grantedAt: string | null;
  ownerCount: number;
}

/**
 * Which orgs' owners may manage their own members' Nextcloud access, from
 * their own site (/manage/cloud on IFAC). Switching an org on gives its
 * OWNERS — not guides or members — a view of who is linked and a "Sync now".
 */
export default function OrgGrantsPage() {
  const [orgs, setOrgs] = useState<OrgGrantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/organizations/grants', { credentials: 'include' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? 'Could not load organizations');
    setOrgs(body.orgs);
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(orgId: string, granted: boolean) {
    setSaving(orgId);
    setError(null);
    const res = await fetch('/api/organizations/grants', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orgId, granted }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(body.error ?? 'Could not save');
    await load();
    setSaving(null);
  }

  return (
    <Container size="md" py="xl">
      <Title order={2}>Owner access to Nextcloud</Title>
      <Text c="dimmed" mb="lg">
        Lets an organization&apos;s owners see which of their members are linked to Nextcloud and
        request a sync from their own site. The sync runs on the host every 10 minutes.
      </Text>
      {error && <Alert color="red" mb="md">{error}</Alert>}
      {!orgs ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <Paper withBorder>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Organization</Table.Th>
                <Table.Th>Owners</Table.Th>
                <Table.Th>Allowed</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {orgs.map((o) => (
                <Table.Tr key={o.orgId}>
                  <Table.Td>
                    <Text fw={600}>{o.orgName}</Text>
                    <Text size="xs" c="dimmed">{o.orgId}</Text>
                  </Table.Td>
                  <Table.Td>
                    {o.ownerCount > 0 ? o.ownerCount : <Badge color="orange" variant="light">no owner</Badge>}
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      checked={o.granted}
                      disabled={saving === o.orgId}
                      onChange={(e) => toggle(o.orgId, e.currentTarget.checked)}
                      aria-label={`Allow ${o.orgName} owners to manage Nextcloud access`}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Container>
  );
}
