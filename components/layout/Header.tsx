'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu as MenuIcon, User, LogOut } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { IconButton } from '@/components/ui/IconButton';
import { useSession } from '@/components/providers/SessionProvider';
import { usePageHeader } from '@/components/layout/PageHeaderContext';
import { api } from '@/lib/api-client';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useSession();
  const { title } = usePageHeader();
  const router = useRouter();

  async function handleLogout() {
    await api.post('/api/auth/logout');
    window.location.href = '/login';
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-navaro-line bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <IconButton aria-label="Open menu" className="lg:hidden" onClick={onMenuClick}>
          <MenuIcon className="h-5 w-5" strokeWidth={1.75} />
        </IconButton>
        <h1 className="text-h3 text-navaro-green">{title}</h1>
      </div>

      <Menu
        trigger={
          <button type="button" className="flex items-center gap-2 rounded-control p-1 hover:bg-navaro-hover">
            <Avatar firstName={user.firstName} lastName={user.lastName} size={28} />
          </button>
        }
      >
        <MenuItem onClick={() => router.push('/profile')}>
          <User className="h-4 w-4" strokeWidth={1.75} />
          Profile
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Log out
        </MenuItem>
      </Menu>
    </header>
  );
}

export function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-navaro-muted hover:text-navaro-green">
      {children}
    </Link>
  );
}
