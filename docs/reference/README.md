# Reference docs

Current state of each subsystem. Written 2026-09-23 from the archived reports
and session notes, then checked against the code, the live schema and the
running containers. Each file has a "Last verified" date and an Open items
section; claims that could not be checked are labelled **assumed** or **unknown**.

| Area (`/orient` name) | Doc | Covers |
|---|---|---|
| `apps` | [apps.md](apps.md) | Every app: purpose, org, port, mode, domain, status, traps |
| `packages` | [packages.md](packages.md) | Every shared package: purpose, build mode, consumers; package conventions |
| `data-model` | [data-model.md](data-model.md) | Multi-tenancy, migrations, `threads` and kinds, feeds, gathers, wiki data, sanitising |
| `identity` | [identity-and-tenancy.md](identity-and-tenancy.md) | GoTrue, SSO broker, users/identities, roles and tiers, org domains, authorisation |
| `commerce` | [commerce.md](commerce.md) | Stores, payee model, agreements, ledger, Stripe Connect, checkout |
| `nextcloud` | [nextcloud.md](nextcloud.md) | Storage tree, provisioning, ACL sync, calendars, Deck, Talk, forum sync, media |
| `email` | [email.md](email.md) | Sending, per-org identity, templates, inbound, newsletter, DNS records |
| `frontend-ui` | [frontend-ui.md](frontend-ui.md) | UI stacks, primitives, tokens, CSS layers, contrast, surfaces, 3D |
| `authoring` | [authoring.md](authoring.md) | Puck + blocks, Silex, template binding, pens |
| `workshops` | [workshops-and-lms.md](workshops-and-lms.md) | Workshops, RSVP and enrolment, rota, LMS (Sophia) |
| `ops` | [ops.md](ops.md) | Docker, image, builds and deploys, edge, DNS, backups |
| `testing` | [testing.md](testing.md) | How to verify: rendering, sessions, headers, screenshots |

Keep these current: when a change alters how a subsystem works, edit its doc
in the same change and bump "Last verified".
