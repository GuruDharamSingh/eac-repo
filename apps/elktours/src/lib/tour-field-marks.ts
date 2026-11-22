// The Fields lens's marks on a tour's page (record:tour:<id>:<field>, record:tourstop:<id>:line). The page passes the tour's
// id only when the server found the viewer may edit it (TourPageData.fieldEditId); everyone else gets {} and so no attribute
// and no id in their HTML. Pure.

export type FieldMark = { "data-field"?: string };

export function tourMark(editId: string | null | undefined, field: "title" | "excerpt" | "goodToKnow" | "contact"): FieldMark {
  return editId ? { "data-field": `record:tour:${editId}:${field}` } : {};
}

export function stopMark(editId: string | null | undefined, stopId: string): FieldMark {
  return editId ? { "data-field": `record:tourstop:${stopId}:line` } : {};
}
