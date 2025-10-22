"use client";

import { useEffect, useState } from "react";
import { PostForm, type PostFormData } from "@elkdonis/ui";
import { createPostAction } from "@/lib/actions";
import { authClient } from "@/lib/auth-client";

interface CreatePostFormProps {
  onSuccess?: () => void;
}

export function CreatePostForm({ onSuccess }: CreatePostFormProps) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get current auth user and fetch corresponding app user ID
    const fetchUserId = async () => {
      const { user, error } = await authClient.getUser();

      if (error || !user) {
        console.error('Auth error:', error);
        return;
      }

      const token = authClient.getToken();
      if (!token) {
        console.error('No token found');
        return;
      }

      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:9998';
        const url = `${supabaseUrl}/users?auth_user_id=eq.${user.id}&select=id`;

        const response = await fetch(url, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (data && data.length > 0) {
          setUserId(data[0].id);
        } else {
          console.error('No user found in database');
        }
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

