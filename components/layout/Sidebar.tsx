'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog, Transition } from '@headlessui/react';
import { LayoutDashboard, Target, Building2, Users, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { Logo } from '@/components/layout/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { useSession } from '@/components/providers/SessionProvider';
import { ROLE_LABELS } from '@/lib/constants';
import { api } from '@/lib/api-client';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  show: boolean;
}

function useNavItems(): { main: NavItem[]; admin: NavItem[] } {
  const { can } = useSession();
  return {
    main: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
      { href: '/leads', label: 'Leads', icon: Target, show: can('leads.view') },
      { href: '/clients', label: 'Clients', icon: Building2, show: can('clients.view') },
    ],
    admin: [{ href: '/users', label: 'User management', icon: Users, show: can('users.view') }],
  };
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors',
        active ? 'bg-navaro-green text-navaro-heath' : 'text-navaro-green hover:bg-navaro-hover'
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
      {item.label}
    </Link>
  );
}

function SidebarContent() {
  const { main, admin } = useNavItems();
  const { user } = useSession();

  async function handleLogout() {
    await api.post('/api/auth/logout');
    window.location.href = '/login';
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-navaro-line px-6">
        <Logo height={40} />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {main.filter((i) => i.show).map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        {admin.some((i) => i.show) && (
          <>
            <p className="px-3 pb-1 pt-4 text-label text-navaro-muted">Administration</p>
            {admin.filter((i) => i.show).map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </>
        )}
      </nav>
      <div className="flex items-center gap-3 border-t border-navaro-line p-4">
        <Avatar firstName={user.firstName} lastName={user.lastName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-navaro-green">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-label text-navaro-muted">{ROLE_LABELS[user.role]}</p>
        </div>
        <IconButton aria-label="Log out" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
        </IconButton>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[264px] lg:flex-col lg:border-r lg:border-navaro-line lg:bg-white">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-40 lg:hidden" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-navaro-ink/40" aria-hidden="true" />
        </Transition.Child>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="-translate-x-full"
          enterTo="translate-x-0"
          leave="ease-in duration-100"
          leaveFrom="translate-x-0"
          leaveTo="-translate-x-full"
        >
          <Dialog.Panel className="fixed inset-y-0 left-0 z-40 w-[264px] bg-white">
            <SidebarContent />
          </Dialog.Panel>
        </Transition.Child>
      </Dialog>
    </Transition>
  );
}
