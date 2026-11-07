#!/usr/bin/env python3
"""Table of a run-browsers.sh output folder: one row per profile and driver, from the logs.

    results.py <outdir> [--fails]      --fails also lists each FAIL and ACTION-FAIL line
"""
import json
import re
import sys
from pathlib import Path


def read(log):
    t = log.read_text(errors="replace")
    pass_, fail = 0, 0
    m = re.findall(r"^pass (\d+) fail (\d+)\s*$", t, re.M)
    finished = bool(m)
    if m:
        pass_, fail = map(int, m[-1])
    else:
        # A driver that stopped early never prints its total; count what it did print.
        pass_ = len(re.findall(r"^\s*(?:TRACE )?ok\b", t, re.M))
        fail = len(re.findall(r"^\s*(?:TRACE )?FAIL\b", t, re.M))
    tally = re.findall(r"^TRACE tally (\{.*\})$", t, re.M)
    tally = json.loads(tally[-1]) if tally else {}
    fails = [x.strip() for x in t.splitlines() if re.match(r"^\s*(?:TRACE )?FAIL\b", x)]
    actions = [x.strip() for x in t.splitlines() if x.startswith("ACTION-FAIL")]
    stop = [x.strip() for x in t.splitlines() if x.startswith(("ERR", "BENCH-TIMEOUT"))]
    return dict(pass_=pass_, fail=fail, finished=finished, tally=tally, fails=fails, actions=actions, stop=stop)


def main():
    out = Path(sys.argv[1])
    show = "--fails" in sys.argv
    rows = []
    for d in sorted(p for p in out.iterdir() if p.is_dir()):
        for log in sorted(d.glob("*.log")):
            r = read(log)
            rows.append((d.name, log.stem, r))
    widths = (20, 22)
    print(f"{'profile':<{widths[0]}} {'driver':<{widths[1]}} {'pass':>5} {'fail':>5} {'blocked':>8} {'synthetic':>10}  end")
    lines = []
    for prof, drv, r in rows:
        end = "complete" if r["finished"] else ("; ".join(r["stop"])[:70] or "no total printed")
        print(f"{prof:<{widths[0]}} {drv:<{widths[1]}} {r['pass_']:>5} {r['fail']:>5} {r['tally'].get('actionFail', len(r['actions'])):>8} {r['tally'].get('synthetic', 0):>10}  {end}")
        lines.append("\t".join(str(x) for x in (prof, drv, r["pass_"], r["fail"], len(r["actions"]), r["tally"].get("synthetic", 0), end)))
    (out / "results.tsv").write_text("profile\tdriver\tpass\tfail\tblocked\tsynthetic\tend\n" + "\n".join(lines) + "\n")
    if show:
        for prof, drv, r in rows:
            if r["fails"] or r["actions"] or r["stop"]:
                print(f"\n== {prof} {drv}")
                for x in r["actions"] + r["fails"] + r["stop"]:
                    print("  " + x[:260])


if __name__ == "__main__":
    main()
