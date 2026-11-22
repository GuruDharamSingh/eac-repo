import { AeonSigil } from "../../../../../hidden-enneagram/src/components/aeon/sigil";
import "./he-mock.css";

/** he-sigil is exactly <AeonSigil />; this draws the app's own component. */
export default function Mock() {
  return (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <AeonSigil />
    </div>
  );
}
