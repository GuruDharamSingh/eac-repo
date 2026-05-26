'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Title,
  Text,
  Stack,
  Paper,
  Button,
  Group,
  Badge,
  Loader,
  Center,
  Select,
  Table,
  TextInput,
  Textarea,
  Modal,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Receipt, RefreshCw, CheckCircle } from 'lucide-react';

interface OrderRow {
  id: string;
  number: string;
  customerEmail: string;
  customerName: string | null;
  status: string;
  paymentMethod: string;
  paymentReference: string | null;
  totalMinor: number;
  currency: string;
  createdAt: string;
  paymentDueAt: string | null;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All orders' },
  { value: 'awaiting_etransfer', label: 'Awaiting eTransfer' },
  { value: 'payment_received', label: 'Payment received' },
  { value: 'paid', label: 'Paid' },
  { value: 'fulfilled', label: 'Shipped' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLOR: Record<string, string> = {
  awaiting_etransfer: 'yellow',
  payment_received: 'blue',
  paid: 'teal',
  fulfilled: 'green',
  completed: 'green',
  cancelled: 'gray',
  refunded: 'gray',
};

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(
    minor / 100
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('awaiting_etransfer');
  const [modalOpened, modal] = useDisclosure(false);
  const [active, setActive] = useState<OrderRow | null>(null);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?status=${status}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const openConfirm = (order: OrderRow) => {
    setActive(order);
    setReference(order.paymentReference ?? '');
    setNotes('');
    setError(null);
    modal.open();
  };

  const confirmPayment = async () => {
    if (!active) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: active.id,
          paymentReference: reference || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not confirm payment');
        return;
      }
      modal.close();
      await load();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="lg">
        <Group gap="xs">
          <Receipt size={28} />
          <Title order={1}>Orders</Title>
        </Group>
        <Group>
          <Select
            data={STATUS_OPTIONS}
            value={status}
            onChange={(v) => setStatus(v ?? 'all')}
            w={220}
          />
          <Button
            variant="light"
            leftSection={<RefreshCw size={16} />}
            onClick={() => void load()}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      <Text c="dimmed" mb="lg">
        Art-Auction commerce orders. Use “Confirm eTransfer” once an artist has
        verified that the buyer’s Interac transfer landed — this marks the order
        paid, decrements inventory, and records the artist payout.
      </Text>

      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : orders.length === 0 ? (
        <Paper withBorder p="xl" ta="center">
          <Text c="dimmed">No orders for this filter.</Text>
        </Paper>
      ) : (
        <Paper withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order</Table.Th>
                <Table.Th>Customer</Table.Th>
                <Table.Th>Total</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Placed</Table.Th>
                <Table.Th>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {orders.map((o) => (
                <Table.Tr key={o.id}>
                  <Table.Td>
                    <Text fw={600}>{o.number}</Text>
                    {o.paymentReference && (
                      <Text size="xs" c="dimmed">
                        ref {o.paymentReference}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{o.customerName ?? '—'}</Text>
                    <Text size="xs" c="dimmed">
                      {o.customerEmail}
                    </Text>
                  </Table.Td>
                  <Table.Td>{money(o.totalMinor, o.currency)}</Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COLOR[o.status] ?? 'gray'} variant="light">
                      {o.status.replace(/_/g, ' ')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(o.createdAt).toLocaleDateString('en-CA')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {['awaiting_etransfer', 'payment_received', 'pending_payment'].includes(
                      o.status
                    ) ? (
                      <Button
                        size="xs"
                        leftSection={<CheckCircle size={14} />}
                        onClick={() => openConfirm(o)}
                      >
                        Confirm eTransfer
                      </Button>
                    ) : (
                      <Text size="xs" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Modal
        opened={modalOpened}
        onClose={modal.close}
        title={`Confirm payment for ${active?.number ?? ''}`}
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Only confirm once the artist has verified the Interac eTransfer was
            received. This marks the order paid and is hard to reverse.
          </Text>
          <TextInput
            label="Payment reference (optional)"
            description="Interac confirmation number, if you have it"
            value={reference}
            onChange={(e) => setReference(e.currentTarget.value)}
          />
          <Textarea
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={modal.close}>
              Cancel
            </Button>
            <Button
              color="teal"
              loading={submitting}
              leftSection={<CheckCircle size={16} />}
              onClick={() => void confirmPayment()}
            >
              Mark as paid
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
