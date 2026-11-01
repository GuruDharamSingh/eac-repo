/** The fields the status page needs; matches DeletionRequest in @elkdonis/services (cms-ui does not depend on it). */
export interface DeletionStatusRequest {
  confirmationCode: string;
  status: "received" | "completed" | "nothing_to_delete" | "declined";
  source: "site" | "meta" | "threads" | "instagram";
  createdAt: Date;
  completedAt: Date | null;
}

const LABELS: Record<DeletionStatusRequest["status"], { title: string; body: string }> = {
  received: {
    title: "Received",
    body: "We have your request. An organiser will remove the account and its data, and this page will say so. Allow up to thirty days.",
  },
  completed: {
    title: "Completed",
    body: "The data covered by this request has been deleted. Backups overwrite on their own schedule, within a year.",
  },
  nothing_to_delete: {
    title: "Nothing to delete",
    body: "We looked and found no account or data matching this request.",
  },
  declined: {
    title: "Not completed",
    body: "We could not complete this request. Write to us with the confirmation code and we will explain.",
  },
};

/** Status of one deletion request, found by its confirmation code. */
export function DeletionStatus({ request, contactEmail }: { request: DeletionStatusRequest; contactEmail: string }) {
  const label = LABELS[request.status] ?? LABELS.received;
  const when = (d: Date) => new Date(d).toISOString().slice(0, 10);
  return (
    <div className="eac-policy eac-policy-status">
      <p className="eac-policy-code">
        Confirmation code <code>{request.confirmationCode}</code>
      </p>
      <h2>{label.title}</h2>
      <p>{label.body}</p>
      <dl>
        <dt>Requested</dt>
        <dd>{when(request.createdAt)}</dd>
        {request.completedAt && (
          <>
            <dt>Resolved</dt>
            <dd>{when(request.completedAt)}</dd>
          </>
        )}
        <dt>Source</dt>
        <dd>{request.source === "meta" ? "Facebook" : request.source === "threads" ? "Threads" : request.source === "instagram" ? "Instagram" : "this site"}</dd>
      </dl>
      <p>
        Questions: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>, quoting the code.
      </p>
    </div>
  );
}
