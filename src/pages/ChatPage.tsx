import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Globe,
  History,
  Loader2,
  Moon,
  Plus,
  Radio,
  Send,
  Square,
  Sun,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { NovaLogo } from '../components/brand/NovaLogo.tsx';
import { AppShell } from '../components/layout/AppShell.tsx';
import { LiveVoiceModal } from '../components/chat/LiveVoiceModal.tsx';
import { MarkdownRenderer } from '../components/chat/MarkdownRenderer.tsx';
import { Nova3DScene } from '../components/three/Nova3DScene.tsx';
import { Button } from '../components/ui/button.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { useSpeech } from '../hooks/useSpeech.ts';
import { unlockLiveAudioEngine } from '../lib/liveAudioEngine.ts';
import { chatApi } from '../services/api.ts';
import type { ChatMessage, ChatSummary } from '../types/models.ts';
import { formatShortDate } from '../lib/utils.ts';

const SUPPORTED_LANGUAGES = [
  { value: 'auto', label: 'Auto-Detect Language' },
  { value: 'English', label: 'English' },
  { value: 'Hindi', label: 'Hindi (हिन्दी)' },
  { value: 'Hinglish', label: 'Hinglish' },
  { value: 'Spanish', label: 'Spanish' },
  { value: 'French', label: 'French' },
  { value: 'German', label: 'German' },
  { value: 'Arabic', label: 'Arabic' },
  { value: 'Bengali', label: 'Bengali' },
  { value: 'Tamil', label: 'Tamil' },
  { value: 'Japanese', label: 'Japanese' },
];

const STARTER_PROMPTS = [
  'What is the capital of India, and what makes it historically significant?',
  'Who developed and created NOVAAI?',
  'Mujhe Dijkstra shortest path algorithm Hinglish mein example ke saath samjhao.',
  'How do I write measurable impact bullet points for an ATS software engineering CV?',
];

export function ChatPage() {
  const { user, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('auto');
  const [streaming, setStreaming] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const handledInitialPromptRef = useRef<string | null>(null);

  const {
    ttsSupported,
    speakingMessageId,
    toggleSpeakText,
  } = useSpeech(language);

  const loadChats = useCallback(async () => {
    if (!user) return;
    setChatsLoading(true);
    try {
      const res = await chatApi.listChats(1);
      setChats(res.items);
    } catch (err) {
      console.error('Failed to load chats:', err);
    } finally {
      setChatsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadChats();
    } else {
      setChats([]);
      setActiveChatId(null);
    }
  }, [user, loadChats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const handleSelectChat = async (chatId: number) => {
    if (streaming) return;
    setActiveChatId(chatId);
    setMobileHistoryOpen(false);
    setMessagesLoading(true);
    try {
      const res = await chatApi.getChat(chatId);
      setMessages(res.chat.messages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load chat.');
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleNewChat = () => {
    if (streaming) {
      abortRef.current?.abort();
      setStreaming(false);
    }
    setActiveChatId(null);
    setMessages([]);
    setMobileHistoryOpen(false);
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: number) => {
    e.stopPropagation();
    try {
      await chatApi.deleteChat(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
      }
      refreshProfile();
      toast.success('Conversation deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete chat.');
    }
  };

  const handleOpenLiveVoice = () => {
    void unlockLiveAudioEngine();
    setLiveVoiceOpen(true);
  };

  const handleSyncVoiceTurn = useCallback(
    (payload: {
      chatId: number;
      title: string;
      userMessage?: ChatMessage;
      assistantMessage?: ChatMessage;
    }) => {
      if (payload.chatId > 0) {
        setActiveChatId(payload.chatId);
        if (user) {
          setChats((prev) => {
            const exists = prev.some((c) => c.id === payload.chatId);
            if (exists) return prev;
            return [
              {
                id: payload.chatId,
                userId: user.uid,
                title: payload.title || 'Live Voice Chat',
                createdAt: new Date().toISOString(),
              },
              ...prev,
            ];
          });
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        if (
          payload.userMessage &&
          !next.some((m) => m.id === payload.userMessage?.id)
        ) {
          next.push(payload.userMessage);
        }
        if (
          payload.assistantMessage &&
          !next.some((m) => m.id === payload.assistantMessage?.id)
        ) {
          next.push(payload.assistantMessage);
        }
        return next;
      });

      if (user) {
        refreshProfile();
      }
    },
    [user, refreshProfile]
  );

  const handleSend = async (overridePrompt?: string) => {
    const promptText = (overridePrompt ?? input).trim();
    if (!promptText || streaming) return;

    const priorTurns = messages
      .filter((m) => m.content && m.content.trim().length > 0)
      .slice(-16)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    setInput('');
    const tempUserId = `temp-user-${Date.now()}`;
    const tempAssistantId = `temp-ai-${Date.now()}`;

    const optimisticUser: ChatMessage = {
      id: tempUserId,
      chatId: activeChatId || 0,
      role: 'user',
      content: promptText,
      language,
      createdAt: new Date().toISOString(),
    };

    const optimisticAssistant: ChatMessage = {
      id: tempAssistantId,
      chatId: activeChatId || 0,
      role: 'assistant',
      content: '',
      language,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await chatApi.streamMessage(
        {
          chatId: user ? activeChatId : null,
          message: promptText,
          language,
          history: user ? undefined : priorTurns,
        },
        {
          onMeta: (meta) => {
            if (user && meta.chatId > 0) {
              setActiveChatId(meta.chatId);
              setChats((prev) => {
                const exists = prev.some((c) => c.id === meta.chatId);
                if (exists) return prev;
                return [
                  {
                    id: meta.chatId,
                    userId: user.uid,
                    title: meta.title,
                    createdAt: new Date().toISOString(),
                  },
                  ...prev,
                ];
              });
            }
          },
          onToken: (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, content: m.content + delta }
                  : m
              )
            );
          },
          onDone: (done) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === tempAssistantId ? done.message : m))
            );
            if (user) {
              refreshProfile();
            }
          },
          onError: (errMsg) => {
            toast.error(errMsg);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId && !m.content
                  ? { ...m, content: `Unable to generate response: ${errMsg}` }
                  : m
              )
            );
          },
        },
        controller.signal
      );
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : 'Chat request failed.';
        toast.error(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantId && !m.content
              ? { ...m, content: `Unable to complete response: ${msg}` }
              : m
          )
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  useEffect(() => {
    const liveFlag = searchParams.get('live');
    if (liveFlag === '1') {
      const next = new URLSearchParams(searchParams);
      next.delete('live');
      setSearchParams(next, { replace: true });
      setLiveVoiceOpen(true);
    }

    const initialQuery = searchParams.get('q')?.trim();
    if (
      initialQuery &&
      handledInitialPromptRef.current !== initialQuery &&
      !streaming
    ) {
      handledInitialPromptRef.current = initialQuery;
      setSearchParams({}, { replace: true });
      void handleSend(initialQuery);
    }
  }, [searchParams, setSearchParams, streaming]);

  return (
    <AppShell fullHeight>
      <div className="relative flex h-full w-full overflow-hidden">
        {/* Desktop Chat History Sidebar */}
        <div className="hidden lg:flex w-64 shrink-0 flex-col border-r border-[#DCE3DF] bg-white text-[#111916] dark:border-[#212E29] dark:bg-[#0E1513] dark:text-[#F2F6F4]">
          <div className="flex h-14 items-center justify-between border-b border-[#DCE3DF] px-4 dark:border-[#212E29]">
            <span className="text-xs font-semibold tracking-wide text-[#52645B] dark:text-[#94A89E]">
              Conversations
            </span>
            <Button size="sm" variant="default" onClick={handleNewChat}>
              <Plus className="h-3.5 w-3.5" />
              <span>New Chat</span>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
            {!user ? (
              <div className="rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] p-4 text-center dark:border-[#24342E] dark:bg-[#141D1A]">
                <p className="text-xs leading-relaxed text-[#52645B] dark:text-[#94A89E]">
                  Sign in to save and sync your AI voice &amp; text conversations.
                </p>
                <Link
                  to="/signup"
                  state={{ from: '/chat', requireAuthNotice: true }}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-lg bg-[#059669] px-3 text-xs font-semibold text-white hover:bg-[#047857] dark:bg-[#10B981] dark:text-[#061510] whitespace-nowrap"
                >
                  Create Free Account
                </Link>
              </div>
            ) : chatsLoading ? (
              <div className="space-y-2 p-2">
                <div className="h-9 rounded-xl bg-[#EAEEEC] dark:bg-[#16201D]" />
                <div className="h-9 rounded-xl bg-[#EAEEEC] dark:bg-[#16201D]" />
                <div className="h-9 rounded-xl bg-[#EAEEEC] dark:bg-[#16201D]" />
              </div>
            ) : chats.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-[#52645B] dark:text-[#94A89E]">
                Your saved conversations will appear here.
              </p>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleSelectChat(chat.id)}
                  className={`group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs cursor-pointer transition-colors ${
                    activeChatId === chat.id
                      ? 'bg-[#ECFDF5] font-semibold text-[#065F46] border border-[#10B981]/40 dark:bg-[#10261F] dark:text-[#6EE7B7] dark:border-[#10B981]/35'
                      : 'text-[#4A5B53] hover:bg-[#EAEEEC] hover:text-[#111916] dark:text-[#9AB0A6] dark:hover:bg-[#16201D] dark:hover:text-[#F2F6F4]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{chat.title}</p>
                    <p className="mt-0.5 text-[10px] text-[#6B8076] dark:text-[#7D9187] tabular-nums">
                      {formatShortDate(chat.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete conversation"
                    onClick={(e) => handleDeleteChat(e, chat.id)}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-lg p-1 text-[#6B8076] hover:text-[#BE123C] dark:text-[#84998F] dark:hover:text-[#FDA4AF] cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mobile / Tablet History Drawer */}
        {mobileHistoryOpen && (
          <div
            className="fixed inset-0 z-50 flex lg:hidden bg-black/65"
            onClick={() => setMobileHistoryOpen(false)}
          >
            <div
              className="flex h-full w-72 max-w-[85vw] flex-col bg-white text-[#111916] border-r border-[#DCE3DF] dark:bg-[#0E1513] dark:text-[#F2F6F4] dark:border-[#23312B]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-14 items-center justify-between border-b border-[#DCE3DF] px-4 dark:border-[#212E29]">
                <NovaLogo size="sm" />
                <button
                  type="button"
                  onClick={() => setMobileHistoryOpen(false)}
                  aria-label="Close chat history"
                  className="rounded-xl p-1.5 text-[#52645B] hover:bg-[#EAEEEC] dark:text-[#94A89E] dark:hover:bg-[#16201D]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-3 border-b border-[#DCE3DF] dark:border-[#212E29]">
                <Button
                  size="sm"
                  variant="default"
                  className="w-full"
                  onClick={handleNewChat}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Conversation</span>
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                {chats.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[#52645B] dark:text-[#94A89E]">
                    No saved chats yet.
                  </p>
                ) : (
                  chats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => handleSelectChat(chat.id)}
                      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs cursor-pointer ${
                        activeChatId === chat.id
                          ? 'bg-[#ECFDF5] font-semibold text-[#065F46] dark:bg-[#10261F] dark:text-[#6EE7B7]'
                          : 'text-[#4A5B53] hover:bg-[#EAEEEC] dark:text-[#9AB0A6] dark:hover:bg-[#16201D]'
                      }`}
                    >
                      <span className="truncate">{chat.title}</span>
                      <button
                        type="button"
                        aria-label="Delete chat"
                        onClick={(e) => handleDeleteChat(e, chat.id)}
                        className="p-1 text-[#6B8076] hover:text-[#BE123C] dark:text-[#84998F] dark:hover:text-[#FDA4AF]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#F4F6F4] text-[#111916] dark:bg-[#0B0F0E] dark:text-[#F2F6F4]">
          {/* Chat Header — Identical Controls & Colors on Laptop and Mobile */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE3DF] bg-white px-3.5 py-2.5 sm:px-6 dark:border-[#212E29] dark:bg-[#0F1614]">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setMobileHistoryOpen(true)}
                aria-label="Open chat history"
                className="inline-flex lg:hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] text-[#4A5B53] dark:border-[#263831] dark:bg-[#16201D] dark:text-[#DCE6E1] cursor-pointer"
              >
                <History className="h-4 w-4" />
              </button>
              <NovaLogo size="sm" markOnly className="md:hidden shrink-0" />
              <h1 className="truncate font-display text-sm sm:text-base font-bold text-[#111916] dark:text-[#F2F6F4]">
                {activeChatId
                  ? chats.find((c) => c.id === activeChatId)?.title || 'NOVAAI Chat'
                  : 'NOVAAI Live & Chat'}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenLiveVoice}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#059669] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#047857] dark:bg-[#10B981] dark:text-[#061510] dark:hover:bg-[#34D399] cursor-pointer whitespace-nowrap"
              >
                <Radio className="h-3.5 w-3.5 shrink-0" />
                <span>Live Talk</span>
              </button>

              <div className="flex items-center gap-1 rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] px-2 py-1.5 dark:border-[#263831] dark:bg-[#15201C]">
                <Globe className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399] shrink-0" />
                <select
                  aria-label="Reply language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="max-w-[116px] sm:max-w-none bg-transparent text-xs font-medium text-[#111916] dark:text-[#F2F6F4] focus:outline-none cursor-pointer"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option
                      key={lang.value}
                      value={lang.value}
                      className="bg-white text-[#111916] dark:bg-[#0F1614] dark:text-[#F2F6F4]"
                    >
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleNewChat}
                className="lg:hidden px-2.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </Button>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={
                  theme === 'dark'
                    ? 'Switch to light mode'
                    : 'Switch to dark mode'
                }
                className="inline-flex md:hidden h-9 w-9 items-center justify-center rounded-xl border border-[#DCE3DF] bg-[#F4F6F4] text-[#4A5B53] dark:border-[#263630] dark:bg-[#16201D] dark:text-[#94A89E] cursor-pointer"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4 text-[#D4A373]" />
                ) : (
                  <Moon className="h-4 w-4 text-[#4A5B53]" />
                )}
              </button>
            </div>
          </div>

          {/* Messages Viewport */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-6">
              {messagesLoading ? (
                <div className="flex h-48 items-center justify-center gap-2 text-sm text-[#52645B] dark:text-[#94A89E]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#10B981]" />
                  <span>Loading conversation...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-4 sm:py-8">
                  <div className="nova-3d-card grid grid-cols-1 items-center gap-6 rounded-3xl p-5 sm:p-7 md:grid-cols-12">
                    <div className="md:col-span-7">
                      <NovaLogo size="md" />
                      <h2 className="mt-4 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111916] dark:text-[#F2F6F4] [text-wrap:balance]">
                        Talk live in natural Hindi or ask anything in any language.
                      </h2>
                      <p className="mt-2.5 text-sm leading-relaxed text-[#52645B] dark:text-[#94A89E]">
                        Always-On Hands-Free Live Voice — open once and converse continuously like a real human without repeated mic clicks, in Hindi, Hinglish, or English.
                      </p>
                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <Button
                          variant="default"
                          size="lg"
                          onClick={handleOpenLiveVoice}
                        >
                          <Radio className="h-4 w-4" />
                          <span>Open Hands-Free Live Talk</span>
                        </Button>
                      </div>
                    </div>

                    <div
                      onClick={handleOpenLiveVoice}
                      title="Click to open Always-On Hands-Free Live Voice"
                      className="h-52 w-full md:col-span-5 sm:h-60 cursor-pointer"
                    >
                      <Nova3DScene
                        className="h-full w-full"
                        voiceState="idle"
                        interactive
                      />
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleSend(prompt)}
                        className="nova-3d-card rounded-2xl p-4 text-left text-xs sm:text-sm font-medium text-[#2C3A34] dark:text-[#E6EEEA] cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const isSpeaking = speakingMessageId === msg.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={
                          isUser
                            ? 'max-w-[85%] sm:max-w-[75%] rounded-2xl bg-[#059669] px-4 py-3 text-sm font-medium text-white dark:bg-[#065F46] dark:border dark:border-[#10B981]/35 dark:text-[#ECFDF5]'
                            : 'nova-3d-card w-full rounded-2xl p-4 sm:p-5'
                        }
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </p>
                        ) : (
                          <div>
                            <div className="mb-2.5 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <NovaLogo size="sm" markOnly className="scale-90" />
                                <span className="font-display text-xs font-bold text-[#111916] dark:text-[#F2F6F4]">
                                  NOVAAI
                                </span>
                              </div>
                              {ttsSupported && msg.content && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleSpeakText(msg.id, msg.content)
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#DCE3DF] bg-[#F4F6F4] px-2.5 py-1 text-xs font-medium text-[#2C3A34] hover:border-[#059669] dark:border-[#263831] dark:bg-[#18221E] dark:text-[#DCE6E1] dark:hover:border-[#10B981] cursor-pointer whitespace-nowrap"
                                >
                                  {isSpeaking ? (
                                    <>
                                      <VolumeX className="h-3.5 w-3.5 text-[#C8956B]" />
                                      <span>Stop Audio</span>
                                    </>
                                  ) : (
                                    <>
                                      <Volume2 className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399]" />
                                      <span>Listen</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>

                            {msg.content ? (
                              <MarkdownRenderer content={msg.content} />
                            ) : (
                              <div className="flex items-center gap-2 py-1 text-xs text-[#52645B] dark:text-[#94A89E]">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#10B981]" />
                                <span>Generating response...</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Composer Bar */}
          <div className="shrink-0 border-t border-[#DCE3DF] bg-white px-4 py-3 sm:px-6 dark:border-[#212E29] dark:bg-[#0F1614]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="mx-auto flex max-w-3xl items-end gap-2"
            >
              <button
                type="button"
                onClick={handleOpenLiveVoice}
                aria-label="Open Always-On Hands-Free Live Voice"
                title="Always-On Hands-Free Live Voice"
                className="inline-flex h-10 items-center gap-1.5 shrink-0 rounded-xl border border-[#C8956B]/55 bg-[#FAF5EF] px-3 text-xs font-semibold text-[#784B2A] transition-colors hover:bg-[#F3E6D8] dark:border-[#C8956B]/45 dark:bg-[#1B1612] dark:text-[#E8C3A3] dark:hover:bg-[#261E18] cursor-pointer whitespace-nowrap"
              >
                <Radio className="h-4 w-4 text-[#C8956B]" />
                <span className="hidden sm:inline">Live Talk</span>
              </button>

              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Type a message or open Live Talk for continuous hands-free Hindi/English voice..."
                className="max-h-36 min-h-[42px] flex-1 resize-none rounded-xl border border-[#C2CEC8] bg-[#F4F6F4] px-3.5 py-2.5 text-sm text-[#111916] placeholder:text-[#6B8076] focus:border-[#059669] focus:bg-white focus:outline-none dark:border-[#2A3933] dark:bg-[#131B18] dark:text-[#F2F6F4] dark:focus:border-[#10B981]"
              />

              {streaming ? (
                <Button
                  type="button"
                  variant="crimson"
                  onClick={handleStopStreaming}
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>Stop</span>
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="default"
                  disabled={!input.trim()}
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Send</span>
                </Button>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Full-Screen Live Human Voice Conversation Modal */}
      <LiveVoiceModal
        open={liveVoiceOpen}
        onClose={() => setLiveVoiceOpen(false)}
        language={language}
        activeChatId={activeChatId}
        onSyncTurn={handleSyncVoiceTurn}
      />
    </AppShell>
  );
}
