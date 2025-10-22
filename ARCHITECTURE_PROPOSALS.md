# Architecture Proposals for EAC Multi-Tenant Network

## Current Stack
- **Next.js** monorepo with Turbo
- **PostgreSQL** for data persistence
- **Supabase** for auth & websockets
- **Nextcloud** for media storage
- **Nginx** reverse proxy

## Proposal 1: Shared Database with Schema Isolation

### Architecture
```
┌─────────────────────────────────────────┐
│          Supabase Auth (SSO)            │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│            Mother App                    │
│  (Admin Dashboard & Data Aggregator)     │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         PostgreSQL Database              │
│  ┌────────────────────────────────────┐ │
│  │ public schema (shared auth/users)   │ │
│  ├────────────────────────────────────┤ │
│  │ mother schema (aggregated data)     │ │
│  ├────────────────────────────────────┤ │
│  │ org_1 schema                        │ │
│  ├────────────────────────────────────┤ │
│  │ org_2 schema                        │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Implementation
```typescript
// packages/db/src/tenant-manager.ts
export class TenantManager {
  async setTenant(orgId: string) {
    await prisma.$executeRaw`SET search_path TO ${orgId}, public`;
  }

  async aggregateData() {
    // Mother app can query across schemas
    return prisma.$queryRaw`
      SELECT * FROM org_1.posts
      UNION ALL
      SELECT * FROM org_2.posts
    `;
  }
}
```

### Pros
- **Simple SSO**: Single user table, easy auth management
- **Fast queries**: All data in one database, efficient JOINs
- **Easy aggregation**: Mother app can query across schemas directly
- **Cost-effective**: Single database instance
- **Transactional consistency**: ACID across all tenants

### Cons
- **Scaling limits**: All orgs share same database resources
- **Migration complexity**: Schema changes must propagate to all tenant schemas
- **Security risk**: Potential for cross-tenant data leaks if misconfigured
- **Backup complexity**: Can't backup individual tenants easily
- **Performance isolation**: One heavy tenant affects others

---

## Proposal 2: Database-per-Tenant with Federation Layer

### Architecture
```
┌─────────────────────────────────────────┐
│          Supabase Auth (SSO)            │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│            Mother App                    │
│         (Control Plane)                  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│        Federation Service                │
│    (GraphQL Federation/Hasura)          │
└──────────┬────────┬────────┬────────────┘
           │        │        │
    ┌──────▼──┐ ┌──▼────┐ ┌▼──────┐
    │ DB_org1 │ │DB_org2│ │DB_orgN│
    └─────────┘ └───────┘ └───────┘
```

### Implementation
```typescript
// packages/db/src/federation.ts
export class DatabaseFederation {
  private connections: Map<string, PrismaClient>;

  async getClient(orgId: string): Promise<PrismaClient> {
    if (!this.connections.has(orgId)) {
      const dbUrl = await this.getOrgDatabaseUrl(orgId);
      this.connections.set(orgId, new PrismaClient({
        datasources: { db: { url: dbUrl } }
      }));
    }
    return this.connections.get(orgId)!;
  }

  async federatedQuery(query: string) {
    // Use GraphQL federation or custom aggregation
    const results = await Promise.all(
      Array.from(this.connections.keys()).map(orgId =>
        this.connections.get(orgId).$queryRaw(query)
      )
    );
    return this.mergeResults(results);
  }
}
```

### Pros
- **True isolation**: Complete data separation between tenants
- **Independent scaling**: Each org can scale independently
- **Easy compliance**: Data residency/GDPR per tenant
- **Simple backups**: Backup/restore individual orgs
- **Performance isolation**: Heavy users don't affect others

### Cons
- **Complex infrastructure**: Many databases to manage
- **Higher costs**: Multiple database instances
- **Complex aggregation**: Need federation layer for cross-org queries
- **Connection pooling**: Managing many database connections
- **Migration overhead**: Updates must run on each database

---

## Proposal 3: Hybrid Event-Driven Architecture

### Architecture
```
┌─────────────────────────────────────────┐
│          Supabase Auth (SSO)            │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│            Mother App                    │
│    (Command Center + Analytics)          │
└─────────┬──────────────┬─────────────────┘
          │              │
    Write │         Read │
          │              │
┌─────────▼────────┐ ┌──▼─────────────────┐
│   Event Store    │ │  Materialized Views │
│  (PostgreSQL)    │ │   (Read Models)     │
└─────────┬────────┘ └────────────────────┘
          │
    ┌─────▼──────────────┐
    │  Message Queue     │
    │ (Redis/RabbitMQ)   │
    └────┬──────┬────────┘
         │      │
    ┌────▼──┐ ┌▼─────┐
    │ App 1 │ │ App N│
    └───────┘ └──────┘
```

### Implementation
```typescript
// packages/core/src/event-bus.ts
export interface DomainEvent {
  id: string;
  orgId: string;
  type: string;
  payload: any;
  timestamp: Date;
}

export class EventBus {
  async publish(event: DomainEvent) {
    // Store event
    await prisma.events.create({ data: event });

    // Publish to subscribers
    await redis.publish(`org:${event.orgId}`, JSON.stringify(event));

    // Update materialized views
    await this.updateReadModels(event);
  }

  async replay(orgId: string, fromDate?: Date) {
    // Rebuild state from events
    const events = await prisma.events.findMany({
      where: { orgId, timestamp: { gte: fromDate } }
    });
    return this.buildStateFromEvents(events);
  }
}

// packages/core/src/cqrs.ts
export class CommandHandler {
  async createPost(orgId: string, data: PostData) {
    const event = {
      type: 'POST_CREATED',
      orgId,
      payload: data,
      timestamp: new Date()
    };

    await this.eventBus.publish(event);
    // Mother app automatically receives via subscription
  }
}
```

### Pros
- **Flexible architecture**: Easy to add new apps/features
- **Real-time sync**: Events propagate instantly
- **Audit trail**: Complete history of all changes
- **Eventual consistency**: Apps can work offline
- **Microservices ready**: Each app can be deployed independently
- **Time travel**: Can rebuild state at any point

### Cons
- **Complex to implement**: Requires understanding of event sourcing
- **Eventual consistency**: Not immediately consistent
- **Storage overhead**: Storing all events forever
- **Complex queries**: Need to maintain read models
- **Debugging difficulty**: Distributed system complexity

---

## Recommendation

For your use case, I recommend **Proposal 3 (Hybrid Event-Driven)** with these modifications:

1. **Start simple**: Begin with shared PostgreSQL but design with events from day one
2. **Progressive enhancement**: Add message queue when you need real-time
3. **Gradual isolation**: Move heavy tenants to separate databases as needed

### Initial Implementation Path:

```typescript
// Start with this simple structure
// packages/core/src/multi-tenant.ts

export class MultiTenantCore {
  // Phase 1: Shared DB with event logging
  async executeCommand(orgId: string, command: Command) {
    const result = await this.processCommand(command);
    await this.logEvent(orgId, command, result);
    return result;
  }

  // Phase 2: Add real-time when needed
  async addRealtimeSync() {
    // Add Redis/Supabase Realtime
  }

  // Phase 3: Federation when scaling
  async enableFederation(orgId: string) {
    // Move org to dedicated database
  }
}
```

This gives you:
- **Quick start** with minimal complexity
- **Future-proof** architecture
- **Gradual migration** path as you grow
- **Mother app** naturally aggregates via event stream
- **Single sign-on** via Supabase Auth