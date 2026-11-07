#!/usr/bin/env python3
# Writes an env file for a one-off sunjay container from `docker compose config --format json sunjay` on stdin:
# the service's own settings, a read-only database session, the reminder scheduler off (it mails), and the mail,
# Stripe, Nextcloud admin and service keys blank. Holds the database password: mode 600, delete after use.
import json, os, sys
env = json.load(sys.stdin)["services"]["sunjay"]["environment"]
# postgres.js passes unknown URL parameters as startup parameters, so every session refuses writes.
env["DATABASE_URL"] += ("&" if "?" in env["DATABASE_URL"] else "?") + "default_transaction_read_only=on"
for k in ("SENDGRID_API_KEY", "STRIPE_SECRET_KEY", "NEXTCLOUD_ADMIN_PASSWORD", "CONNECTIONS_KEY", "SUPABASE_SERVICE_KEY"):
    env[k] = ""
env.update(DISABLE_REMINDER_SCHEDULER="1", NEXT_TELEMETRY_DISABLED="1", HOME="/tmp")
fd = os.open(sys.argv[1], os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w") as f:
    for k, v in env.items():
        f.write(f"{k}={v}\n")
