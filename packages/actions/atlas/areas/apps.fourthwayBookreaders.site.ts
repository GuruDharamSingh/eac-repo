import type { Area, Capability } from '../types';

// fourthwayBookreaders site: round 2 curator, 2026-11-16. Conventions: atlas/JOURNAL.md. Generated from a structured definition.

const capabilities: Capability[] = [
  {
    "area": "fourthway.site",
    "scope": "person",
    "risk": [
      "none"
    ],
    "id": "fourthway-logout",
    "label": "Sign out",
    "does": "Ends the session.",
    "class": "internal",
    "actors": [
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/auth/logout/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleLogout"
        ]
      },
      {
        "key": "api:apps/admin/src/app/api/auth/logout/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleLogout"
        ],
        "address": {
          "app": "admin",
          "path": "/",
          "how": "the Logout item of the user menu in components/admin-shell.tsx"
        },
        "note": "POST is the shared global sign-out."
      },
    ],
    "status": "unverifiable: the session cookie is cleared",
    "drift": "Thin wrapper over handleLogout; same in the other apps where the route is not a bare re-export.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (fourthwayBookreaders, admin). Differences by app:\n- admin (was admin-logout): the GET handler in the same file is NOT shared (only a plain signOut).",
    "canonical": "auth-server logout handler (shared)",
    "verified": "2026-11-16 read app/api/auth/*/route.ts, app/api/center/{follow,connections}/route.ts, app/api/pulse/route.ts, app/api/threads/[id]/rsvp/route.ts, components/rsvp-button.tsx, components/login-form.tsx",
    "open": "admin (admin-logout): SECURITY: auth/logout/route.ts:8-21 GET (not an inventory host) signs out with a plain supabase signOut, never markSignedOutEverywhere, and redirects to post_logout_redirect_uri with no check against an allow-list: an open redirect, and a GET that anyone can trigger cross-site to log a person out. The shared handleLogoutRedirect (auth-server api-routes.ts:454) only allows paths."
  },
];

export default { capabilities, ignored: [] } satisfies Area;
