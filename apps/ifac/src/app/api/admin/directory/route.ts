import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@elkdonis/auth-server";
import { canManageIfac } from "@/lib/data";
import {
  listAllDirectory,
  createProfile,
  updateProfile,
  deleteProfile,
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
  revalidatePath("/admin/directory");
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
  return NextResponse.json({ profiles: await listAllDirectory() });
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

  const parsed = parseInput(body);
  if ("error" in parsed) return NextResponse.json(parsed, { status: 400 });

  try {
    const profile = await updateProfile(id, parsed);
    if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    revalidate(profile.slug);
    return NextResponse.json({ profile });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
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
