"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LogOut, Sparkles, Calendar, FileText } from "lucide-react";
import type { Meeting, Post } from "@elkdonis/types";
import { MeetingCard } from "./meeting-card";
import { PostCard } from "./post-card";
import { CreateMeetingForm } from "./create-meeting-form";
import { CreatePostForm } from "./create-post-form";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface FeedClientProps {
  initialFeed: Array<{
    type: "meeting" | "post";
    data: Meeting | Post;
    createdAt: Date;
  }>;
}

export function FeedClient({ initialFeed }: FeedClientProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("meeting");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const closeSheet = () => setSheetOpen(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            <h1 className="text-lg font-semibold">InnerGathering</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-2xl px-4 py-6">
        <div className="space-y-6 pb-24">
          {/* Page Header */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Feed</h2>
            <p className="text-sm text-muted-foreground">
              Upcoming meetings and community posts
            </p>
          </div>

          <Separator />

          {/* Feed Items */}
          {initialFeed.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No posts or meetings yet. Create one to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {initialFeed.map((item, index) =>
                item.type === "meeting" ? (
                  <MeetingCard
                    key={`meeting-${item.data.id}-${index}`}
                    meeting={item.data as Meeting}
                  />
                ) : (
                  <PostCard
                    key={`post-${item.data.id}-${index}`}
                    post={item.data as Post}
                  />
                )
              )}
            </div>
          )}
        </div>

        {/* Floating Action Button */}
        <div className="fixed bottom-6 right-6 z-50">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                size="lg"
                className="h-14 w-14 rounded-full shadow-lg"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[90vh]">
              <SheetHeader>
                <SheetTitle>Create New</SheetTitle>
                <SheetDescription>
                  Create a new meeting or post for the community
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="meeting" className="gap-2">
                      <Calendar className="h-4 w-4" />
                      Meeting
                    </TabsTrigger>
                    <TabsTrigger value="post" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Post
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="meeting" className="mt-6">
                    <ScrollArea className="h-[calc(90vh-12rem)]">
                      <CreateMeetingForm onSuccess={closeSheet} />
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="post" className="mt-6">
                    <ScrollArea className="h-[calc(90vh-12rem)]">
                      <CreatePostForm onSuccess={closeSheet} />
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </main>
    </div>
  );
}
