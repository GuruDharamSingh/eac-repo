import type { ActableStore, OpenableOrg } from "@elkdonis/commerce/queries";
import { Button } from "@/components/ui/button";
import { selectStoreAction } from "../actions";
import { OpenOrgStoreButton } from "./open-org-store-button";

/**
 * Which store the studio is showing, and the others the person could switch
 * to — their own, org stores they are on the roll of, and orgs they own that
 * have no store yet. This is the shape ArtDirect (one person, many orgs) and
 * the org hubs (one org, many people) both mirror.
 */
export function StoreSwitcher({
  current,
  stores,
  openable,
}: {
  current: ActableStore;
  stores: ActableStore[];
  openable: OpenableOrg[];
}) {
  const others = stores.filter((s) => s.id !== current.id);
  const canOpen = openable.filter((o) => !o.storeId);
  if (others.length === 0 && canOpen.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Acting for</span>
      <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1 font-medium">
        {current.displayName ?? "Your store"}
        <span className="ml-1.5 text-xs text-muted-foreground">
          {current.ownerKind === "org" ? `org · ${current.myRole}` : "you"}
        </span>
      </span>
      {others.map((s) => (
        <form key={s.id} action={selectStoreAction.bind(null, s.id)}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            title={s.status !== "active" ? `Store is ${s.status}` : undefined}
          >
            {s.displayName ?? "Store"}
            {s.status !== "active" && (
              <span className="ml-1 text-xs text-muted-foreground">({s.status})</span>
            )}
          </Button>
        </form>
      ))}
      {canOpen.map((o) => (
        <OpenOrgStoreButton key={o.orgId} orgId={o.orgId} label={`Open a store for ${o.name}`} />
      ))}
    </div>
  );
}
