// Which props each data block's resolver fills in (katie's pattern). Pure
// data: the save action removes these keys before a page is stored
// (stripResolvedKeys from @elkdonis/blocks/record), so fetched rows never
// become page content. A key here must never equal a prop name.

export const RESOLVED_KEYS: Record<string, readonly string[]> = {
  "he-enneagram": ["placement"],
  "he-course": ["course"],
  "thread-feed": ["items"],
  // Round 3. he-service's route keys are injected at render, never stored; listed so a save can never keep them.
  "he-shelf": ["items"],
  "he-forum": ["topics"],
  "he-person": ["person"],
  "he-service": ["service", "booking", "routeSlug", "routeQuery"],
};
