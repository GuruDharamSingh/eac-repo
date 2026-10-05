// ============================================================================
// The line a person block shows in the EDITOR when it has nothing to draw:
// the section is switched off in the person's page settings, or it is empty.
// Visitors never see it — a person page hides an empty section (PersonPage
// does the same with its slots).
// ============================================================================

export type PuckContext = { isEditing?: boolean } | undefined;

export function PersonBlockNote({ puck, children }: { puck: PuckContext; children: string }) {
  if (!puck?.isEditing) return null;
  return (
    <div className="eac-person-panel blk-person-section blk-person-note">
      <p className="eac-person-empty">{children}</p>
    </div>
  );
}
