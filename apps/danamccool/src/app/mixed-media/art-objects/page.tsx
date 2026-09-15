export const metadata = { title: "Art Objects" };

// Her real page had almost no caption text beyond the pieces' years — kept
// honest rather than inventing descriptions.
const OBJECTS = ["Hoop-La, 2022", "Hoop-La, 2020 — Interactive Wall Lamp, Hologram cast in resin", "2014", "2014", "2014", "2014", "2013", "2013"];

export default function ArtObjectsPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Art Objects</h1>
      <ul style={{ paddingLeft: "1.1rem" }}>
        {OBJECTS.map((o, i) => (
          <li key={i} style={{ marginBottom: "0.4rem" }}>
            {o}
          </li>
        ))}
      </ul>
    </article>
  );
}
