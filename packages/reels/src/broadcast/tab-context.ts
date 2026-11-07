'use client';

// The console's or desk's tab id, for panels a host page puts in their
// `extra` slot (a server page cannot hand a client component a function, so
// the slot takes an element and the id comes through here). Panels use it as
// the lease holder's tab id: the page already holds the studio's lease.

import * as React from 'react';

export const BroadcastTabContext = React.createContext<string | null>(null);

export const useBroadcastTab = () => React.useContext(BroadcastTabContext);
