import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { RequireAuth } from './components/auth/RequireAuth.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { ChatPage } from './pages/ChatPage.tsx';
import { CVMakerPage } from './pages/CVMakerPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { LiveConversationPage } from './pages/LiveConversationPage.tsx';
import { NotesLibraryPage } from './pages/NotesLibraryPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { UploadNotePage } from './pages/UploadNotePage.tsx';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Overview Gateway & Signup / Login Only — Zero Unauthenticated Feature Usage */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage defaultMode="login" />} />
            <Route path="/signup" element={<AuthPage defaultMode="signup" />} />

            {/* Every Single Feature Route Strictly Requires Signup / Authentication */}
            <Route
              path="/home"
              element={
                <RequireAuth>
                  <HomePage />
                </RequireAuth>
              }
            />
            <Route
              path="/live"
              element={
                <RequireAuth>
                  <LiveConversationPage />
                </RequireAuth>
              }
            />
            <Route
              path="/chat"
              element={
                <RequireAuth>
                  <ChatPage />
                </RequireAuth>
              }
            />
            <Route
              path="/notes"
              element={
                <RequireAuth>
                  <NotesLibraryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/notes/upload"
              element={
                <RequireAuth>
                  <UploadNotePage />
                </RequireAuth>
              }
            />
            <Route
              path="/cv"
              element={
                <RequireAuth>
                  <CVMakerPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />

            {/* Exclusive Owner Admin Console (deenuverma238@gmail.com only) */}
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminDashboardPage />
                </RequireAuth>
              }
            />

            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
          <Toaster position="top-right" richColors closeButton />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
