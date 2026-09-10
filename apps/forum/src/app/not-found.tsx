import { hrefs } from "@/lib/site";

export default function NotFound() {
  return (
    <div className="gf-empty" style={{ textAlign: "left" }}>
      <p>There's no such page on the board.</p>
      <p><a href={hrefs.root()} style={{ color: "var(--sf-accent)", fontWeight: 600 }}>← Boards</a></p>
    </div>
  );
}
