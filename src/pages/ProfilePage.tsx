import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  LogOut,
  Moon,
  Save,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { toast } from 'sonner';
import { NovaLogo } from '../components/brand/NovaLogo.tsx';
import { AppShell } from '../components/layout/AppShell.tsx';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { formatShortDate } from '../lib/utils.ts';
import { authApi, cvApi } from '../services/api.ts';
import { isOwnerAdminUser, type CVRecord } from '../types/models.ts';

export function ProfilePage() {
  const { user, stats, loading, logout, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [savedCVs, setSavedCVs] = useState<CVRecord[]>([]);

  const isOwnerAdmin = isOwnerAdminUser(user);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAvatar(user.avatar || '');
      cvApi
        .listCVs(1)
        .then((res) => setSavedCVs(res.items))
        .catch(() => undefined);
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error('Name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    try {
      await authApi.updateMe({
        name: name.trim(),
        avatar: avatar.trim() ? avatar.trim() : null,
      });
      await refreshProfile();
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await authApi.updatePassword(newPassword);
      setNewPassword('');
      await refreshProfile();
      toast.success(res.message || 'Password updated.');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update password.'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out of NOVAAI.');
    navigate('/');
  };

  if (!loading && !user) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[75vh] max-w-md flex-col items-center justify-center px-6 text-center">
          <NovaLogo size="lg" />
          <h1 className="mt-4 font-display text-2xl font-bold text-[#111916] dark:text-[#F2F6F4]">
            Your NOVAAI Profile
          </h1>
          <p className="mt-2 text-sm text-[#52645B] dark:text-[#94A89E]">
            Sign in to manage your account settings, saved chats, uploaded study notes, and ATS resumes.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link
              to="/login"
              state={{ from: '/profile' }}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#059669] px-5 text-sm font-semibold text-white hover:bg-[#047857] dark:bg-[#10B981] dark:text-[#061510]"
            >
              Sign In
            </Link>
            <Button variant="outline" onClick={toggleTheme}>
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#D4A373]" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-10 space-y-8">
        <div className="flex flex-col justify-between gap-4 border-b border-[#DCE3DF] pb-6 sm:flex-row sm:items-center dark:border-[#23312B]">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111916] dark:text-[#F2F6F4]">
              Account &amp; Workspace Settings
            </h1>
            <p className="mt-1 text-sm text-[#52645B] dark:text-[#94A89E]">
              Manage your personal profile, sign-in security, appearance preferences, and saved career documents.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isOwnerAdmin && (
              <Link
                to="/admin"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#9A633A] px-3.5 text-xs font-semibold text-white hover:bg-[#784B2A] dark:bg-[#C8956B] dark:text-[#160E07] dark:hover:bg-[#D4A373] whitespace-nowrap"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Admin Panel</span>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={toggleTheme}>
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#D4A373]" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 text-[#BE123C] dark:text-[#FDA4AF]" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Exclusive Owner Admin Banner (visible ONLY to deenuverma238@gmail.com) */}
        {isOwnerAdmin && (
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#C8956B]/50 bg-[#FAF5EF] p-5 sm:flex-row sm:items-center dark:border-[#C8956B]/40 dark:bg-[#191410]">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-[#9A633A] dark:text-[#E8C3A3]">
                <ShieldCheck className="h-4 w-4 text-[#C8956B]" />
                <span>Creator &amp; Owner Access Verified</span>
              </p>
              <p className="mt-1 text-sm text-[#4A5B53] dark:text-[#C2CEC8]">
                Manage all NOVAAI users, emails, signups, uploaded academic notes, AI chats, and ATS resumes from your private dashboard.
              </p>
            </div>
            <Link
              to="/admin"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#9A633A] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#784B2A] dark:bg-[#C8956B] dark:text-[#160E07] dark:hover:bg-[#D4A373] whitespace-nowrap shrink-0"
            >
              Open Admin Dashboard
            </Link>
          </div>
        )}

        {/* Tabular-Nums Activity Summary */}
        <div className="nova-3d-card grid grid-cols-3 gap-4 rounded-2xl p-5">
          <div>
            <p className="font-display text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
              {stats.chats}
            </p>
            <p className="mt-0.5 text-xs text-[#52645B] dark:text-[#94A89E]">
              Saved Chats
            </p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold tabular-nums text-[#9A633A] dark:text-[#D4A373]">
              {stats.notes}
            </p>
            <p className="mt-0.5 text-xs text-[#52645B] dark:text-[#94A89E]">
              Uploaded Notes
            </p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
              {stats.cvs}
            </p>
            <p className="mt-0.5 text-xs text-[#52645B] dark:text-[#94A89E]">
              Saved ATS CVs
            </p>
          </div>
        </div>

        {/* Profile Form */}
        {user && (
          <form
            onSubmit={handleUpdateProfile}
            className="nova-3d-card space-y-4 rounded-2xl p-6"
          >
            <h2 className="font-display text-lg font-semibold text-[#111916] dark:text-[#F2F6F4]">
              Profile Details
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]">
                  Display Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]">
                  Email Address
                </label>
                <Input value={user.email} disabled />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]">
                  Avatar Image URL (optional)
                </label>
                <Input
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DCE3DF] pt-4 text-xs text-[#52645B] dark:border-[#23312B] dark:text-[#94A89E]">
              <span>
                Member since {formatShortDate(user.createdAt)} · Signed in via{' '}
                {user.authProvider === 'google'
                  ? 'Google OAuth'
                  : 'Email & Password'}
              </span>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>Save Profile</span>
              </Button>
            </div>
          </form>
        )}

        {/* Password & Direct Login Security */}
        {user && (
          <form
            onSubmit={handleUpdatePassword}
            className="nova-3d-card space-y-4 rounded-2xl p-6"
          >
            <div>
              <h2 className="font-display text-lg font-semibold text-[#111916] dark:text-[#F2F6F4]">
                {user.hasPassword
                  ? 'Update Account Password'
                  : 'Set Password for Email Login'}
              </h2>
              <p className="mt-0.5 text-xs text-[#52645B] dark:text-[#94A89E]">
                {user.hasPassword
                  ? 'Change the password used to sign in directly with your email address.'
                  : 'Add a password so you can sign in with Email & Password in addition to Google.'}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (minimum 6 characters)"
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-2.5 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#52645B] hover:bg-[#EAEEEC] dark:text-[#94A89E] dark:hover:bg-[#18221E] cursor-pointer"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={savingPassword || newPassword.length < 6}
                className="shrink-0"
              >
                {savingPassword ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <KeyRound className="h-3.5 w-3.5" />
                )}
                <span>
                  {user.hasPassword ? 'Update Password' : 'Set Password'}
                </span>
              </Button>
            </div>
          </form>
        )}

        {/* Saved CVs Quick List */}
        <div className="nova-3d-card rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[#111916] dark:text-[#F2F6F4]">
              Your Saved Resumes
            </h2>
            <Link
              to="/cv"
              className="text-xs font-semibold text-[#059669] hover:underline dark:text-[#34D399]"
            >
              Open CV Maker
            </Link>
          </div>

          {savedCVs.length === 0 ? (
            <p className="mt-4 text-sm text-[#52645B] dark:text-[#94A89E]">
              You have not saved any CVs yet. Create one in the ATS CV Maker.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-[#DCE3DF] dark:divide-[#23312B]">
              {savedCVs.map((cv) => (
                <div
                  key={cv.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#111916] dark:text-[#F2F6F4]">
                      {cv.title}
                    </p>
                    <p className="text-xs text-[#52645B] dark:text-[#94A89E]">
                      Template: {cv.templateId} · Updated{' '}
                      {formatShortDate(cv.updatedAt)}
                    </p>
                  </div>
                  <Link
                    to={`/cv?id=${cv.id}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#C2CEC8] bg-[#F4F6F4] px-3 text-xs font-medium text-[#111916] hover:border-[#059669] dark:border-[#2A3933] dark:bg-[#18221E] dark:text-[#F2F6F4] dark:hover:border-[#10B981] whitespace-nowrap shrink-0"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Edit / PDF</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
