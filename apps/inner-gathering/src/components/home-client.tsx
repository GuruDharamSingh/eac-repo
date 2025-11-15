"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  BookOpen,
  Plus,
  LogOut,
  Sparkles,
  MessageCircle,
  TrendingUp,
  Clock,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import type { Meeting, Post } from "@elkdonis/types";
import { supabase } from "@/lib/supabase";

interface HomeClientProps {
  upcomingMeetings: Array<{
    type: "meeting";
    data: Meeting;
    createdAt: Date;
  }>;
  recentPosts: Array<{
    type: "post";
    data: Post;
    createdAt: Date;
  }>;
}

export function HomeClient({ upcomingMeetings, recentPosts }: HomeClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const quickActions = [
    {
      title: "New Meeting",
      description: "Schedule a gathering",
      icon: Calendar,
      color: "bg-blue-50 text-blue-600",
      onClick: () => router.push("/feed?create=meeting"),
    },
    {
      title: "Create Post",
      description: "Share your thoughts",
      icon: MessageCircle,
      color: "bg-purple-50 text-purple-600",
      onClick: () => router.push("/feed?create=post"),
    },
    {
      title: "View Feed",
      description: "See all activity",
      icon: TrendingUp,
      color: "bg-green-50 text-green-600",
      onClick: () => router.push("/feed"),
    },
    {
      title: "Community",
      description: "Connect with others",
      icon: Users,
      color: "bg-orange-50 text-orange-600",
      onClick: () => router.push("/community"),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-indigo-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">InnerGathering</h1>
                <p className="text-xs text-gray-500">Connect & Grow Together</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-600"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pb-32">
        {/* Welcome Section */}
        <Card className="mb-6 border-0 shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome Back!</CardTitle>
            <CardDescription className="text-indigo-100">
              {upcomingMeetings.length} upcoming meetings • {recentPosts.length} new posts
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {quickActions.map((action, index) => (
            <Card
              key={index}
              className="cursor-pointer hover:shadow-md transition-shadow border-0 shadow-sm"
              onClick={action.onClick}
            >
              <CardContent className="p-4">
                <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center mb-3`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{action.title}</h3>
                <p className="text-xs text-gray-500">{action.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Upcoming Meetings */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">Upcoming Meetings</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/feed")}
                  >
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingMeetings.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No upcoming meetings
                  </p>
                ) : (
                  upcomingMeetings.map((item) => {
                    const meeting = item.data as Meeting;
                    return (
                      <div
                        key={meeting.id}
                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => router.push(`/meeting/${meeting.id}`)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-sm flex-1">
                            {meeting.title}
                          </h4>
                          <Badge variant="secondary" className="ml-2">
                            {meeting.visibility}
                          </Badge>
                        </div>
                        {meeting.start_time && (
                          <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                            <Clock className="h-3 w-3" />
                            {new Date(meeting.start_time).toLocaleDateString()}
                          </div>
                        )}
                        {meeting.location && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <MapPin className="h-3 w-3" />
                            {meeting.location}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Recent Posts */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-purple-600" />
                    <CardTitle className="text-lg">Recent Posts</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/feed")}
                  >
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentPosts.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No recent posts
                  </p>
                ) : (
                  recentPosts.map((item) => {
                    const post = item.data as Post;
                    return (
                      <div
                        key={post.id}
                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => router.push(`/post/${post.id}`)}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {post.author_name?.[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold text-sm truncate">
                                {post.title}
                              </h4>
                              <Badge variant="secondary" className="ml-2 shrink-0">
                                {post.visibility}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">
                              by {post.author_name || "Anonymous"}
                            </p>
                            {post.excerpt && (
                              <p className="text-sm text-gray-700 line-clamp-2">
                                {post.excerpt}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>
                  Latest updates from your community
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[...upcomingMeetings, ...recentPosts]
                    .sort((a, b) =>
                      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={index}>
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            item.type === "meeting" ? "bg-blue-600" : "bg-purple-600"
                          }`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {item.type === "meeting"
                                ? (item.data as Meeting).title
                                : (item.data as Post).title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0">
                            {item.type}
                          </Badge>
                        </div>
                        {index < 4 && <Separator className="my-3" />}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating Action Button - positioned above bottom nav */}
      <div className="fixed bottom-24 right-6 z-50">
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700"
          onClick={() => router.push("/feed?create=true")}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
