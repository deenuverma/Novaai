import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ZoyaStyleLiveExperience } from '../components/chat/ZoyaStyleLiveExperience.tsx';
import { useAuth } from '../context/AuthContext.tsx';

export function LiveConversationPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  return (
    <ZoyaStyleLiveExperience
      open
      mode="standalone"
      initialLanguage="Hindi"
      onExit={() => navigate('/home')}
      onSyncTurn={() => {
        refreshProfile();
      }}
    />
  );
}
