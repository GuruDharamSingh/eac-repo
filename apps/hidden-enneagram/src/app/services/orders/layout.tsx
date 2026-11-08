/** The eTransfer receipts keep the reading measure they always had (was services/layout.tsx until round 3). */
export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-[880px] px-6 py-16 font-sans">{children}</main>;
}
