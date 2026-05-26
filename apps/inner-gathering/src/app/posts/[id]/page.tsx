import { use } from "react";
import { notFound } from "next/navigation";
import { getPostById } from "@/lib/data";
import { getReplies } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";
import { PostDetails } from "@/components/post-details";

export default function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const post = use(getPostById(id));

  if (!post) {
    notFound();
  }

  const [replies, session] = use(
    Promise.all([getReplies(id, "post", "oldest"), getServerSession()])
  );

  const serializedReplies = JSON.parse(JSON.stringify(replies));

  const currentUser = session?.user
    ? {
        id: session.user.id,
        displayName: session.user.email?.split("@")[0] ?? null,
        initials: session.user.email?.substring(0, 2).toUpperCase() ?? null,
      }
    : null;

  return (
    <PostDetails
      post={post}
      replies={serializedReplies}
      currentUser={currentUser}
    />
  );
}
