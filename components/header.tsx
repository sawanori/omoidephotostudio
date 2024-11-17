'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserNav } from '@/components/user-nav';
import { useAuth } from '@/components/auth/auth-provider';

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold">
          想ひ出写真館
        </Link>
        <nav className="flex items-center gap-4">
          {user?.role === 'admin' && (
            <Button variant="ghost" asChild>
              <Link href="/admin">管理画面</Link>
            </Button>
          )}
          <UserNav />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}