/**
 * Round 3: /services/<slug> is a studio page that brings its own <main>
 * (lib/puck/render.tsx), and /services itself redirects to /readings, so this
 * layout adds nothing. The old reading-measure <main> moved to
 * services/orders/layout.tsx (the eTransfer receipts).
 */
export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
