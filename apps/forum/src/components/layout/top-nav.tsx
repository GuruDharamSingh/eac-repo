'use client';

import Link from 'next/link';
import { PenSquare, ChevronDown, Menu, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

const navLinks = [
  { href: '/', label: 'Discussions' },
  { href: '/?type=meeting', label: 'Gatherings' },
];

export function TopNav() {
  return (
    <header className="sticky top-0 z-50 w-full" style={{ background: 'hsl(24, 18%, 10%)' }}>
      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center gap-6">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <ScrollText
              className="w-5 h-5"
              style={{ color: 'hsl(36, 55%, 52%)' }}
            />
            <span
              className="text-lg font-serif font-semibold tracking-wide"
              style={{ color: 'hsl(36, 55%, 62%)' }}
            >
              EAC Forum
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm rounded-md transition-colors"
                style={{ color: 'hsl(38, 12%, 62%)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'hsl(38, 18%, 88%)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'hsl(38, 12%, 62%)')}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              asChild
              size="sm"
              className="hidden sm:flex gap-1.5 text-xs border-0"
              style={{ background: 'hsl(350, 42%, 26%)', color: 'hsl(38, 22%, 94%)' }}
            >
              <Link href="/create">
                <PenSquare className="w-3.5 h-3.5" />
                New Post
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 p-1.5 rounded-lg transition-colors hover:bg-white/5">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src="" />
                    <AvatarFallback
                      className="text-xs font-medium"
                      style={{ background: 'hsl(350, 42%, 26%)', color: 'hsl(38, 22%, 94%)' }}
                    >
                      ?
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-3 h-3" style={{ color: 'hsl(38, 12%, 52%)' }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem asChild>
                  <Link href="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8 hover:bg-white/5"
                  style={{ color: 'hsl(38, 12%, 62%)' }}
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-60 border-l"
                style={{ background: 'hsl(24, 18%, 10%)', color: 'hsl(38, 18%, 88%)', borderColor: 'hsl(24, 12%, 20%)' }}
              >
                <div className="flex flex-col gap-1 mt-8">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="px-3 py-2 text-sm rounded-md hover:bg-white/5 transition-colors"
                      style={{ color: 'hsl(38, 12%, 72%)' }}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <Separator className="my-2" style={{ background: 'hsl(24, 12%, 20%)' }} />
                  <Link
                    href="/create"
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-white/5 transition-colors"
                    style={{ color: 'hsl(36, 55%, 55%)' }}
                  >
                    <PenSquare className="w-4 h-4" />
                    New Post
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
      {/* Gold accent line */}
      <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, hsl(36, 55%, 42%, 0.5), transparent)' }} />
    </header>
  );
}
