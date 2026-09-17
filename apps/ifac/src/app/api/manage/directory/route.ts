import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@elkdonis/auth-server";
import { canManageIfac } from "@/lib/data";
import {
  listAllDirectory,
  createProfile,
  updateProfile,
  deleteProfile,
  listAssignableMembers,
  assignProfile,
  setProfileVisibility,
  type DirectoryInput,
} from "@/lib/directory-admin";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseInput(body: Record<string, unknown>): DirectoryInput | { error: string } {
  const name = String(body.name ?? "").trim();
  if (!name) return { error: "Name is required." };

  const kind = body.kind === "dealer" ? "dealer" : "artist";
  const slug = slugify(String(body.slug ?? "") || name);
  if (!slug) return { error: "Could not derive a slug from the name." };

  const status = body.status === "draft" ? "draft" : "published";

  const bio = Array.isArray(body.bio)
    ? body.bio.map(String).map((s) => s.trim()).filter(Boolean)
    : [];

  const artworks = Array.isArray(body.artworks)
    ? body.artworks
        .map((w) =>
          w && typeof w === "object"
            ? { filename: String((w as { filename?: unknown }).filename ?? "").trim(), title: String((w as { title?: unknown }).title ?? "").trim() }
            : null
        )
        .filter((w): w is { filename: string; title: string } => Boolean(w && w.filename))
    : [];

  const links = Array.isArray(body.links)
    ? body.links
        .map((l) =>
          l && typeof l === "object"
            ? { label: String((l as { label?: unknown }).label ?? "").trim(), href: String((l as { href?: unknown }).href ?? "").trim() }
            : null
        )
        .filter((l): l is { label: string; href: string } => Boolean(l && l.href))
    : [];

  return {
    slug,
    kind,
    name,
    role: String(body.role ?? "").trim(),
    bio,
    portrait_url: String(body.portrait_url ?? "").trim(),
    artworks,
    links,
    email: String(body.email ?? "").trim(),
    website: String(body.website ?? "").trim(),
    status,
    sort_order: typeof body.sort_order === "number" ? body.sort_order : undefined,
  };
}

function revalidate(slug?: string) {
  revalidatePath("/");
  revalidatePath("/manage/directory");
  revalidatePath("/manage/people");
  if (slug) {
    revalidatePath(`/artists/${slug}`);
    revalidatePath(`/dealers/${slug}`);
  }
}

export async function GET() {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [profiles, assignableMembers] = await Promise.all([listAllDirectory(), listAssignableMembers()]);
  return NextResponse.json({ profiles, assignableMembers });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = parseInput(body);
  if ("error" in parsed) return NextResponse.json(parsed, { status: 400 });

  try {
    const profile = await createProfile(parsed);
    revalidate(profile.slug);
    return NextResponse.json({ profile });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: `A profile with slug "${parsed.slug}" already exists.` }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create profile." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  // "This unclaimed row is actually this real, signed-up member" — the
  // admin-confirmed counterpart to the artist claiming it themself on
  // ArtDirect. Merges immediately; no separate consent step, matching how
  // this admin console already treats every other roster edit.
  if (body.action === "assign") {
    const memberId = String(body.memberId ?? "");
    if (!memberId) return NextResponse.json({ error: "memberId is required." }, { status: 400 });
    const result = await assignProfile(id, memberId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    revalidate();
    const [profiles, assignableMembers] = await Promise.all([listAllDirectory(), listAssignableMembers()]);
    return NextResponse.json({ ok: true, profiles, assignableMembers });
  }

  // "Take this artist off the page" — one field, one click from the roster,
  // without going through parseInput and so without any chance of a half-filled
  // edit form overwriting their bio on the way past. Reversible: the row, their
  // account and their portfolio are all untouched.
  if (body.action === "visibility") {
    const isPublic = body.isPublic === true;
    const ok = await setProfileVisibility(id, isPublic);
    if (!ok) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    revalidate();
    const [profiles, assignableMembers] = await Promise.all([listAllDirectory(), listAssignableMembers()]);
    return NextResponse.json({ ok: true, profiles, assignableMembers });
  }

  const parsed = parseInput(body);
  if ("error" in parsed) return NextResponse.json(parsed, { status: 400 });

  try {
    const profile = await updateProfile(id, parsed);
    if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    revalidate(profile.slug);
    return NextResponse.json({ profile });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "reserved_slug") {
      return NextResponse.json({ error: `"${parsed.slug}" is a reserved word and can't be a profile URL.` }, { status: 400 });
    }
    if (msg === "invalid_slug") {
      return NextResponse.json({ error: "Could not derive a valid slug." }, { status: 400 });
    }
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: `A profile with slug "${parsed.slug}" already exists.` }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not update profile." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const ok = await deleteProfile(id);
  if (!ok) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  revalidate();
  return NextResponse.json({ ok: true });
}
