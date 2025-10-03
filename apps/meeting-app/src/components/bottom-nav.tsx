"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Paper, Text } from "@mantine/core";
import { BarChart3, Calendar, Plus } from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { label: "Meetings", href: "/", icon: Calendar },
  { label: "New", href: "/new", icon: Plus },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <Paper
      shadow="sm"
      radius="xl"
      withBorder
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 border-gray-200 bg-white/90 backdrop-blur"
    >
      <div className="flex h-14 items-center justify-around px-2">
        {navItems.map(item => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900"}`}
            >
              <Icon className="h-5 w-5" />
              <Text size="xs" fw={500} truncate>
                {item.label}
              </Text>
            </Link>
          );
        })}
      </div>
    </Paper>
  );
}
