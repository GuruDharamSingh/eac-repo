"use client";

import { useEffect, useState } from "react";
import { PostForm, type PostFormData } from "@elkdonis/ui";
import { createPostAction } from "@/lib/actions";
import { getSession } from "@elkdonis/auth-client";

interface CreatePostFormProps {
  onSuccess?: () => void;
}

export function CreatePostForm({ onSuccess }: CreatePostFormProps) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get current auth user
    const fetchUserId = async () => {
      try {
        const { user } = await getSession();

        if (!user) {
          console.error('No user session found');
          return;
        }

        // Use user ID directly from session
        setUserId(user.id);
      } catch (err) {
        console.error('Error fetching user ID:', err);
      }
    };

    fetchUserId();
  }, []);

  const handleSubmit = async (formData: PostFormData) => {
    if (!userId) {
      throw new Error("You must be logged in to create a post");
    }

    // Map visibility to match database format
    const visibilityMap = {
      PUBLIC: "public" as const,
      ORGANIZATION: "org" as const,
      INVITE_ONLY: "network" as const,
    };

    await createPostAction({
      userId: userId,
      title: formData.title,
      body: formData.body,
      excerpt: formData.excerpt || undefined,
      visibility: visibilityMap[formData.visibility],
    });
  };

  return <PostForm onSubmit={handleSubmit} onSuccess={onSuccess} />;
}

