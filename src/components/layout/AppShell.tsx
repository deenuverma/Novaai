import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  FileText,
  Home,
  Lock,
  LogIn,
  Menu,
  MessageSquare,
  Moon,
  Radio,
  ShieldCheck,
  Sun,
  Upload,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { NovaLogo } from '../brand/NovaLogo.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { unlockLiveAudioEngine } from '../../lib/liveAudioEngine.ts';
import { cn } from '../../lib/utils.ts';
import { isOwnerAdminUser } from '../../types/models.ts';

interface AppShellProps {
  children: React.ReactNode;
  fullHeight?: boolean;
}

export function AppShell({ children, fullHeight = false }: AppShellProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isOwnerAdmin = isOwnerAdminUser(user);

  const navItems = user
    ? [
        { to: '/home', label: 'Home', shortLabel: 'Home', icon: Home },
        {
          to: '/live',
          label: 'Live Conversation',
          shortLabel: 'Live',
          icon: Radio,
        },
        {
          to: '/chat',
          label: 'AI Chat',
          shortLabel: 'Chat',
          icon: MessageSquare,
        },
        {
          to: '/notes',
          label: 'Notes Library',
          shortLabel: 'Notes',
          icon: BookOpen,
        },
        {
          to: '/notes/upload',
          label: 'Upload Notes',
          shortLabel: 'Upload',
          icon: Upload,
        },
        { to: '/cv', label: 'CV Maker', shortLabel: 'CV', icon: FileText },
        { to: '/profile', label: 'Profile', shortLabel: 'Profile', icon: User },
        ...(isOwnerAdmin
          ? [
              {
                to: '/admin',
                label: 'Admin Panel',
                shortLabel: 'Admin',
                icon: ShieldCheck,
              },
            ]
          : []),
      ]
    : [
        { to: '/signup', label: 'Sign Up', shortLabel: 'Sign Up', icon: UserPlus },
        { to: '/login', label: 'Sign In', shortLabel: 'Sign In', icon: LogIn },
      ];

  const isActive = (path: string) => {
    if (path === '/home') return location.pathname === '/home';
    if (path === '/notes') return location.pathname === '/notes';
    if (path === '/notes/upload') return location.pathname === '/notes/upload';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen w-full bg-[#F4F6F4] text-[#111916] dark:bg-[#0B0F0E] dark:text-[#F2F6F4]">
      {/* Desktop Dual-Theme Architectural Sidebar (>= 768px) */}
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-[#DCE3DF] bg-white text-[#111916] dark:border-[#212E29] dark:bg-[#0F1614] dark:text-[#F2F6F4]">
        <div className="flex h-16 items-center justify-between border-b border-[#DCE3DF] px-5 dark:border-[#212E29]">
          <Link to={user ? '/home' : '/'} className="focus-visible:outline-none">
            <NovaLogo size="md" />
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] text-[#4A5B53] transition-colors hover:border-[#059669] hover:text-[#111916] dark:border-[#263630] dark:bg-[#16201D] dark:text-[#94A89E] dark:hover:border-[#10B981] dark:hover:text-[#F2F6F4] cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-[#D4A373]" />
            ) : (
              <Moon className="h-4 w-4 text-[#4A5B53]" />
            )}
          </button>
        </div>

        <nav
          className="flex-1 space-y-1.5 overflow-y-auto p-3.5"
          aria-label="Workspace navigation"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            const isAdminItem = item.to === '/admin';
            const isLiveItem = item.to === '/live';
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => {
                  if (isLiveItem) {
                    void unlockLiveAudioEngine();
                  }
                }}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap',
                  active
                    ? 'bg-[#059669] text-white font-semibold dark:bg-[#10B981] dark:text-[#061510]'
                    : isAdminItem
                      ? 'border border-[#C8956B]/40 bg-[#FAF5EF] text-[#9A633A] hover:bg-[#F3E6D8] dark:border-[#C8956B]/35 dark:bg-[#1B1612] dark:text-[#E8C3A3] dark:hover:bg-[#261E18]'
                      : 'text-[#4A5B53] hover:bg-[#EAEEEC] hover:text-[#111916] dark:text-[#9AB0A6] dark:hover:bg-[#16201D] dark:hover:text-[#F2F6F4]'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active
                      ? 'text-current'
                      : isAdminItem
                        ? 'text-[#C8956B]'
                        : 'text-[#059669] dark:text-[#34D399]'
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {user && (
            <Link
              to="/live"
              onClick={() => void unlockLiveAudioEngine()}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[#C8956B]/55 bg-[#FAF5EF] px-3.5 py-2.5 text-xs font-semibold text-[#784B2A] transition-colors hover:bg-[#F3E6D8] dark:border-[#C8956B]/45 dark:bg-[#1B1612] dark:text-[#E8C3A3] dark:hover:bg-[#261E18] whitespace-nowrap"
            >
              <Radio className="h-3.5 w-3.5 text-[#C8956B]" />
              <span>Live Hindi Voice Talk</span>
            </Link>
          )}

          {!user && (
            <div className="mt-4 rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] p-3.5 text-xs text-[#4A5B53] dark:border-[#24342E] dark:bg-[#141D1A] dark:text-[#94A89E]">
              <p className="flex items-center gap-1.5 font-semibold text-[#111916] dark:text-[#F2F6F4]">
                <Lock className="h-3.5 w-3.5 shrink-0 text-[#C8956B]" />
                <span>Sign Up Required</span>
              </p>
              <p className="mt-1 leading-relaxed">
                Create a free account to unlock all NOVAAI features.
              </p>
            </div>
          )}
        </nav>

        <div className="border-t border-[#DCE3DF] p-4 dark:border-[#212E29]">
          {user ? (
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] p-2.5 transition-colors hover:border-[#059669] dark:border-[#24342E] dark:bg-[#141D1A] dark:hover:border-[#10B981]"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-[#10B981]"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#059669] text-xs font-bold text-white dark:bg-[#10B981] dark:text-[#061510]">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#111916] dark:text-[#F2F6F4]">
                  {user.name}
                </p>
                <p className="truncate text-xs text-[#52645B] dark:text-[#94A89E]">
                  {user.email}
                </p>
              </div>
            </Link>
          ) : (
            <div className="space-y-2">
              <Link
                to="/signup"
                className="flex h-10 w-full items-center justify-center rounded-xl bg-[#059669] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#047857] dark:bg-[#10B981] dark:text-[#061510] dark:hover:bg-[#34D399] whitespace-nowrap"
              >
                Create Free Account
              </Link>
              <Link
                to="/login"
                className="flex h-9 w-full items-center justify-center rounded-xl border border-[#C2CEC8] bg-white px-4 text-xs font-semibold text-[#111916] transition-colors hover:bg-[#EAEEEC] dark:border-[#2A3933] dark:bg-[#141D1A] dark:text-[#F2F6F4] dark:hover:bg-[#1C2824] whitespace-nowrap"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Full-Feature Slide-Out Navigation Drawer (< 768px) — Exact Same Features & Colors as Laptop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-[#060908]/75 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            className="flex h-full w-72 max-w-[85vw] flex-col border-r border-[#DCE3DF] bg-white text-[#111916] dark:border-[#212E29] dark:bg-[#0F1614] dark:text-[#F2F6F4]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between border-b border-[#DCE3DF] px-4 dark:border-[#212E29]">
              <Link
                to={user ? '/home' : '/'}
                onClick={() => setMobileMenuOpen(false)}
                className="focus-visible:outline-none"
              >
                <NovaLogo size="sm" />
              </Link>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={
                    theme === 'dark'
                      ? 'Switch to light mode'
                      : 'Switch to dark mode'
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] text-[#4A5B53] dark:border-[#263630] dark:bg-[#16201D] dark:text-[#94A89E] cursor-pointer"
                >
                  {theme === 'dark' ? (
                    <Sun className="h-4 w-4 text-[#D4A373]" />
                  ) : (
                    <Moon className="h-4 w-4 text-[#4A5B53]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close workspace navigation"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] text-[#4A5B53] dark:border-[#263630] dark:bg-[#16201D] dark:text-[#94A89E] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <nav
              className="flex-1 space-y-1.5 overflow-y-auto p-3.5"
              aria-label="Mobile full workspace menu"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                const isAdminItem = item.to === '/admin';
                const isLiveItem = item.to === '/live';
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (isLiveItem) {
                        void unlockLiveAudioEngine();
                      }
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap',
                      active
                        ? 'bg-[#059669] text-white font-semibold dark:bg-[#10B981] dark:text-[#061510]'
                        : isAdminItem
                          ? 'border border-[#C8956B]/40 bg-[#FAF5EF] text-[#9A633A] hover:bg-[#F3E6D8] dark:border-[#C8956B]/35 dark:bg-[#1B1612] dark:text-[#E8C3A3] dark:hover:bg-[#261E18]'
                          : 'text-[#4A5B53] hover:bg-[#EAEEEC] hover:text-[#111916] dark:text-[#9AB0A6] dark:hover:bg-[#16201D] dark:hover:text-[#F2F6F4]'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        active
                          ? 'text-current'
                          : isAdminItem
                            ? 'text-[#C8956B]'
                            : 'text-[#059669] dark:text-[#34D399]'
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {user && (
                <Link
                  to="/live"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void unlockLiveAudioEngine();
                  }}
                  className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[#C8956B]/55 bg-[#FAF5EF] px-3.5 py-2.5 text-xs font-semibold text-[#784B2A] transition-colors hover:bg-[#F3E6D8] dark:border-[#C8956B]/45 dark:bg-[#1B1612] dark:text-[#E8C3A3] dark:hover:bg-[#261E18] whitespace-nowrap"
                >
                  <Radio className="h-3.5 w-3.5 text-[#C8956B]" />
                  <span>Live Hindi Voice Talk</span>
                </Link>
              )}
            </nav>

            <div className="border-t border-[#DCE3DF] p-4 dark:border-[#212E29]">
              {user ? (
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] p-2.5 transition-colors hover:border-[#059669] dark:border-[#24342E] dark:bg-[#141D1A] dark:hover:border-[#10B981]"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-[#10B981]"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#059669] text-xs font-bold text-white dark:bg-[#10B981] dark:text-[#061510]">
                      {user.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#111916] dark:text-[#F2F6F4]">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-[#52645B] dark:text-[#94A89E]">
                      {user.email}
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="space-y-2">
                  <Link
                    to="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex h-10 w-full items-center justify-center rounded-xl bg-[#059669] px-4 text-xs font-semibold text-white dark:bg-[#10B981] dark:text-[#061510] whitespace-nowrap"
                  >
                    Create Free Account
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          fullHeight
            ? 'h-[100dvh] md:h-screen overflow-hidden'
            : 'min-h-screen pb-16 md:pb-0'
        )}
      >
        {!fullHeight && (
          <div className="border-b border-[#DCE3DF] bg-white text-[#111916] dark:border-[#212E29] dark:bg-[#0F1614] dark:text-[#F2F6F4] md:hidden">
            <div className="flex h-14 items-center justify-between gap-2 px-4">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open full workspace menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] text-[#4A5B53] hover:border-[#059669] dark:border-[#263630] dark:bg-[#16201D] dark:text-[#DCE6E1] cursor-pointer"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <Link
                  to={user ? '/home' : '/'}
                  className="focus-visible:outline-none"
                >
                  <NovaLogo size="sm" />
                </Link>
              </div>

              <div className="flex items-center gap-2">
                {user && (
                  <Link
                    to="/live"
                    onClick={() => void unlockLiveAudioEngine()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#C8956B]/55 bg-[#FAF5EF] px-2.5 text-xs font-semibold text-[#784B2A] dark:border-[#C8956B]/45 dark:bg-[#1B1612] dark:text-[#E8C3A3] whitespace-nowrap"
                  >
                    <Radio className="h-3.5 w-3.5 text-[#C8956B]" />
                    <span>Live</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={
                    theme === 'dark'
                      ? 'Switch to light mode'
                      : 'Switch to dark mode'
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] text-[#4A5B53] dark:border-[#263630] dark:bg-[#16201D] dark:text-[#94A89E] cursor-pointer"
                >
                  {theme === 'dark' ? (
                    <Sun className="h-4 w-4 text-[#D4A373]" />
                  ) : (
                    <Moon className="h-4 w-4 text-[#4A5B53]" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'flex-1 min-w-0',
            fullHeight ? 'overflow-hidden pb-14 md:pb-0' : ''
          )}
        >
          {children}
        </motion.main>
      </div>

      {/* Mobile Bottom Navigation (< 768px) — Every Core Feature Accessible on Both Mobile & Laptop */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around overflow-x-auto border-t border-[#DCE3DF] bg-white px-1 dark:border-[#212E29] dark:bg-[#0F1614] md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => {
                if (item.to === '/live') {
                  void unlockLiveAudioEngine();
                }
              }}
              className={cn(
                'flex h-full min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold transition-colors whitespace-nowrap',
                active
                  ? 'text-[#059669] dark:text-[#34D399]'
                  : item.to === '/admin'
                    ? 'text-[#9A633A] dark:text-[#D4A373]'
                    : 'text-[#52645B] hover:text-[#111916] dark:text-[#94A89E] dark:hover:text-[#F2F6F4]'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
