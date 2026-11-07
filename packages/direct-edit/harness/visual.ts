import { mountClickThrough, readLayers, addressOf, atAddress, layerChain, sectionOf } from "/app/packages/direct-edit/src/index";
(window as any).api = { readLayers, addressOf, atAddress, layerChain, sectionOf };
(window as any).log = [];
(window as any).ct = mountClickThrough({ rectHit: location.hash === "#rect" ? () => [document.getElementById("page")!] : undefined, onSelect: (el, a) => (window as any).log.push(a) });
