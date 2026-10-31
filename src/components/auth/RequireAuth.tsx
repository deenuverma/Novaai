import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { NovaLogo } from '../brand/NovaLogo.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F4F6F4] text-[#111916] dark:bg-[#0B0F0E] dark:text-[#F2F6F4]">
        <NovaLogo size="md" />
        <div className="flex items-center gap-2 text-xs font-medium text-[#52645B] dark:text-[#94A89E]">
          <Loader2 className="h-4 w-4 animate-spin text-[#10B981]" />
          <span>Verifying your NOVAAI workspace session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/signup"
        state={{
          from: `${location.pathname}${location.search}`,
          requireAuthNotice: true,
        }}
        replace
      />
    );
  }

  return <>{children}</>;
}
