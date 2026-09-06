import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { SearchModal } from '@/components/features/search/SearchModal';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

export function AppShell() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const searchOpen = useUIStore((s) => s.searchOpen);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [searchOpen, setSearchOpen]);

  return (
    <div className="min-h-screen bg-[color:var(--plane-0)]">
      <Sidebar />
      {/*
        The rail displaces the content only from `lg` upward. Below that it is
        an off-canvas drawer that slides *over* the page, because a 240 px
        margin on a 375 px phone left 135 px to put an interface in — which is
        why every page looked broken on a handset regardless of its own layout.
      */}
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[margin] duration-settle ease-instrument',
          collapsed ? 'lg:ml-14' : 'lg:ml-60',
        )}
      >
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
