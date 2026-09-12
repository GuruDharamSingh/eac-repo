# Swiss Ephemeris data files

Binary ephemeris data from Astrodienst, built from JPL DE441. Downloaded
2026-09-11 from the upstream distribution:
<https://github.com/aloistr/swisseph/tree/master/ephe>.

| File | Contents | Range |
|---|---|---|
| `sepl_18.se1` | Planets (Sun–Pluto) | 1800–2399 |
| `semo_18.se1` | Moon | 1800–2399 |
| `seas_18.se1` | Main asteroids, incl. Chiron | 1800–2399 |

Without these, Swiss Ephemeris falls back to its built-in Moshier model — which
is what the astrologychart2 prototype always ran on. Moshier is accurate to well
under an arc-second for the planets, so the visible gain here is not precision
for its own sake:

- positions agree with astro.com and other Swiss-Ephemeris services exactly;
- Chiron and the asteroids become available at all (they have no Moshier model);
- the lunar nodes and lunar-based points are computed from real lunar data.

A date outside 1800–2399 still works: Swiss Ephemeris silently falls back to
Moshier for it, and `ChartResult.ephemeris` reports which was used.

To cover earlier dates, add the neighbouring files (`sepl_12.se1` etc., 1200–1799)
from the same source; the engine picks up whatever is in this directory.

**Licence.** The Swiss Ephemeris is dual-licensed by Astrodienst AG under the
AGPL 3.0 or a paid professional licence — these data files included. Running it
as a public web service under the AGPL obliges us to offer users the source of
the application. Decide the licensing position before Elastrocal is public.
