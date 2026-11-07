// Which props each data block's resolver fills in (sunjay's pattern). Pure
// data: the save action removes these keys before a page is stored
// (stripResolvedKeys from @elkdonis/blocks/record), so the editor's fetched
// rows never become page content. A key here must never equal a prop name.

export const RESOLVED_KEYS: Record<string, readonly string[]> = {
  "ktp-artwork-grid": ["pieces", "bound", "hrefBase"],
  "ktp-piece": ["item", "placement", "sampled", "ownPiece", "cardOn", "hrefBase"],
  "ktp-piece-details": ["item", "nav", "sampled"],
  "thread-feed": ["items"],
};
