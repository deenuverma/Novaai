import React from 'react';
import { ZoyaStyleLiveExperience } from './ZoyaStyleLiveExperience.tsx';
import type { ChatMessage } from '../../types/models.ts';

interface LiveVoiceModalProps {
  open: boolean;
  onClose: () => void;
  language: string;
  activeChatId: number | null;
  onSyncTurn: (payload: {
    chatId: number;
    title: string;
    userMessage?: ChatMessage;
    assistantMessage?: ChatMessage;
  }) => void;
}

export function LiveVoiceModal({
  open,
  onClose,
  language,
  activeChatId,
  onSyncTurn,
}: LiveVoiceModalProps) {
  if (!open) return null;

  return (
    <ZoyaStyleLiveExperience
      open={open}
      mode="modal"
      onExit={onClose}
      initialLanguage={!language || language === 'auto' ? 'Hindi' : language}
      activeChatId={activeChatId}
      onSyncTurn={onSyncTurn}
    />
  );
}
