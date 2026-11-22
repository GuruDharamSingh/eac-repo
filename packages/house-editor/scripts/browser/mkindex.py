import os
h = os.path.expanduser("~/scratch/door/h")
blocks = open(os.path.expanduser("~/eac/packages/blocks/src/blocks.css"), encoding="utf8").read()
page = open(h + "/site/page.html", encoding="utf8").read()
mp = open(h + "/site/map.json", encoding="utf8").read()
open(h + "/site/index.html", "w", encoding="utf8").write(
    "<!doctype html><html><head><meta charset=utf-8><title>door harness</title><style>html,body{margin:0}</style><style>" + blocks + "</style></head><body>" + page + "<div id=lens></div><script>window.__MAP__=" + mp + ";</script><script src=app.js></script></body></html>")
