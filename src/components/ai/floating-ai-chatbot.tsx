"use strict";
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Send,
  X,
  Minus,
  RotateCcw,
  Sparkles,
  Loader2,
  AlertCircle,
  MoreVertical,
  Move,
  Check,
  Copy,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
  suggestedFollowUps?: string[];
  isError?: boolean;
}

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY_POS = "urplaced_chatbot_position";
const STORAGE_KEY_HISTORY = "urplaced_chat_history_";

export function FloatingAIChatbot() {
  const pathname = usePathname();
  const auth = useAuthContext();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Position & Drag State
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  const currentPosRef = useRef<Position>({ x: -1, y: -1 });
  const launcherRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; posX: number; posY: number } | null>(null);
  const hasMovedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const buttonSize = typeof window !== "undefined" && window.innerWidth < 640 ? 60 : 70;
  const margin = 16;

  useEffect(() => {
    currentPosRef.current = position;
  }, [position]);

  // 1. Initial Position Setup & Persistence
  useEffect(() => {
    if (typeof window === "undefined") return;

    const defaultX = window.innerWidth - buttonSize - 24;
    const defaultY = window.innerHeight - buttonSize - 24;

    try {
      const saved = localStorage.getItem(STORAGE_KEY_POS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          // Clamp to current viewport
          const clampedX = Math.min(window.innerWidth - buttonSize - margin, Math.max(margin, parsed.x));
          const clampedY = Math.min(window.innerHeight - buttonSize - margin, Math.max(margin, parsed.y));
          setPosition({ x: clampedX, y: clampedY });
          setHasHydrated(true);
          return;
        }
      }
    } catch {
      // Fallback
    }

    setPosition({ x: defaultX, y: defaultY });
    setHasHydrated(true);
  }, [buttonSize]);

  // 2. Viewport Resize Clamping
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (prev.x < 0 || prev.y < 0) return prev;
        const clampedX = Math.min(window.innerWidth - buttonSize - margin, Math.max(margin, prev.x));
        const clampedY = Math.min(window.innerHeight - buttonSize - margin, Math.max(margin, prev.y));
        return { x: clampedX, y: clampedY };
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [buttonSize]);

  // 3. User-Specific Conversation Session Storage
  useEffect(() => {
    if (!auth.userId) {
      setMessages([]);
      return;
    }

    try {
      const savedChat = sessionStorage.getItem(`${STORAGE_KEY_HISTORY}${auth.userId}`);
      if (savedChat) {
        const parsed = JSON.parse(savedChat);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Default contextual welcome message based on role
    const isStudent = auth.accountCategory === "STUDENT" || auth.role === "STUDENT";
    const welcomeText = isStudent
      ? "Hi there! I am your UrPlaced AI Study & Placement Tutor. Ask me any concept questions, get hints on problems, or ask for targeted preparation advice."
      : "Welcome! I am your UrPlaced AI Placement Advisor. How can I assist with placement drives, question banks, or student preparation today?";

    setMessages([
      {
        id: "msg-welcome",
        role: "model",
        content: welcomeText,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [auth.userId, auth.accountCategory, auth.role]);

  // Persist messages in sessionStorage per user
  useEffect(() => {
    if (!auth.userId || messages.length === 0) return;
    try {
      sessionStorage.setItem(`${STORAGE_KEY_HISTORY}${auth.userId}`, JSON.stringify(messages));
    } catch {
      // Fallback if quota exceeded
    }
  }, [messages, auth.userId]);

  // 4. Auto-scroll on new message
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  // Keyboard close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // 5. Drag Pointer Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only main click
    e.stopPropagation();
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    hasMovedRef.current = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.pointerX;
      const dy = moveEvent.clientY - dragStartRef.current.pointerY;

      if (!hasMovedRef.current && Math.hypot(dx, dy) > 6) {
        hasMovedRef.current = true;
        setIsDragging(true);
      }

      if (hasMovedRef.current) {
        const newX = Math.min(
          window.innerWidth - buttonSize - margin,
          Math.max(margin, dragStartRef.current.posX + dx)
        );
        const newY = Math.min(
          window.innerHeight - buttonSize - margin,
          Math.max(margin, dragStartRef.current.posY + dy)
        );
        currentPosRef.current = { x: newX, y: newY };
        setPosition({ x: newX, y: newY });
      }
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      if (hasMovedRef.current) {
        // Drag finished — persist coordinates
        try {
          localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(currentPosRef.current));
        } catch {
          // Fallback
        }
        setTimeout(() => {
          setIsDragging(false);
          hasMovedRef.current = false;
        }, 100);
      } else {
        setIsDragging(false);
      }

      dragStartRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setIsOpen((prev) => !prev);
    setIsMinimized(false);
  };

  const resetPosition = () => {
    const defaultX = window.innerWidth - buttonSize - 24;
    const defaultY = window.innerHeight - buttonSize - 24;
    setPosition({ x: defaultX, y: defaultY });
    try {
      localStorage.removeItem(STORAGE_KEY_POS);
    } catch {
      // Fallback
    }
    setShowMenu(false);
  };

  const resetConversation = () => {
    const isStudent = auth.accountCategory === "STUDENT" || auth.role === "STUDENT";
    setMessages([
      {
        id: "msg-welcome-reset",
        role: "model",
        content: isStudent
          ? "Session restarted. What concept or problem can I help you master next?"
          : "Session restarted. How can I assist your placement operations?",
        timestamp: new Date().toISOString(),
      },
    ]);
    if (auth.userId) {
      try {
        sessionStorage.removeItem(`${STORAGE_KEY_HISTORY}${auth.userId}`);
      } catch {
        // Fallback
      }
    }
    setShowMenu(false);
  };

  // 6. Context-Aware Prompt Suggestions
  const getContextualSuggestions = useCallback(() => {
    const isStudent = auth.accountCategory === "STUDENT" || auth.role === "STUDENT";

    if (pathname.includes("/mistakes")) {
      return [
        "Explain my top conceptual mistake",
        "How should I structure my spaced revision?",
        "Tips to avoid tricky runtime errors",
      ];
    }
    if (pathname.includes("/drives")) {
      return [
        "What are typical coding rounds in campus drives?",
        "How do I prepare for technical interviews?",
        "What questions are commonly asked in system design?",
      ];
    }
    if (pathname.includes("/questions")) {
      return [
        "Explain the intuition for sliding window technique",
        "How to compute recurrence relations in dynamic programming",
        "Explain Dijkstra's shortest path algorithm",
      ];
    }
    if (pathname.includes("/analytics")) {
      return [
        "Explain cohort readiness index factors",
        "Which skills show highest placement impact?",
        "How to design targeted remedial workshops?",
      ];
    }

    if (isStudent) {
      return [
        "Explain QuickSort vs MergeSort complexity",
        "How do I solve two-pointer problems?",
        "Give me a hint for binary search on answer",
      ];
    }

    return [
      "Explain cohort readiness metrics",
      "How to evaluate question bank quality?",
      "Preparation roadmap for Tier-1 drives",
    ];
  }, [pathname, auth.accountCategory, auth.role]);

  // 7. Message Submission Handler
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    setInputMessage("");
    setErrorMessage(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Assemble history payload
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Inquire context from current route
      let topicContext = "General Placement Preparation";
      if (pathname.includes("/mistakes")) topicContext = "Mistake Bank & Concept Revision";
      if (pathname.includes("/drives")) topicContext = "Recruitment Drive Readiness";
      if (pathname.includes("/questions")) topicContext = "Question Bank & Algorithms";
      if (pathname.includes("/analytics")) topicContext = "Placement Intelligence & Cohort Analytics";

      const res = await fetch("/api/ai/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          mode: "EXPLAIN",
          topic: topicContext,
          history: historyPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to receive response from AI Assistant.");
      }

      const modelMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: "model",
        content: data.response || "No response received.",
        timestamp: new Date().toISOString(),
        suggestedFollowUps: data.suggestedFollowUps || [],
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      const errText = err.message || "An unexpected error occurred.";
      setErrorMessage(errText);
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "model",
        content: `Error: ${errText}`,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!hasHydrated || position.x < 0) return null;

  // 8. Panel Positioning Math (Smart Docking near Launcher)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const panelWidth = isMobile ? Math.min(window.innerWidth - 32, 400) : 390;
  const panelHeight = isMobile ? Math.min(window.innerHeight - 32, 580) : 560;

  // Horizontal placement: align to launcher
  let panelLeft = position.x;
  if (position.x > window.innerWidth / 2) {
    // Launcher on right side: dock panel to the left of launcher
    panelLeft = position.x + buttonSize - panelWidth;
  }
  // Clamp horizontally
  panelLeft = Math.min(window.innerWidth - panelWidth - margin, Math.max(margin, panelLeft));

  // Vertical placement: open above or below launcher
  let panelTop = position.y - panelHeight - 12;
  if (position.y <= window.innerHeight / 2) {
    // Launcher near top: open below
    panelTop = position.y + buttonSize + 12;
  }
  // Clamp vertically
  panelTop = Math.min(window.innerHeight - panelHeight - margin, Math.max(margin, panelTop));

  return (
    <>
      {/* 9. Floating Draggable Launcher Button */}
      <div
        ref={launcherRef}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        className={`fixed top-0 left-0 z-50 select-none cursor-grab active:cursor-grabbing transition-shadow ${
          isDragging ? "scale-105" : ""
        }`}
        title="Drag to reposition • Click to chat"
      >
        <div className="relative group">
          {/* Circular Button Container */}
          <button
            type="button"
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            aria-label={isOpen ? "Close UrPlaced AI Assistant" : "Open UrPlaced AI Assistant"}
            aria-expanded={isOpen}
            className={`rounded-full flex items-center justify-center bg-white dark:bg-[#1B1E2A] shadow-[0_8px_30px_rgb(36,40,58,0.18)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_12px_36px_rgb(80,82,201,0.28)] border-2 transition-all p-1.5 focus:outline-none focus:ring-4 focus:ring-[#5052C9]/30 ${
              isOpen
                ? "border-[#5052C9] ring-2 ring-[#5052C9]/20"
                : "border-[#5052C9]/40 hover:border-[#5052C9]"
            }`}
            style={{
              width: buttonSize,
              height: buttonSize,
            }}
          >
            {/* Approved Chatbot Image */}
            <Image
              src="/assets/urplaced-ai-chatbot.png"
              alt="UrPlaced AI Assistant"
              width={56}
              height={56}
              priority
              className="w-full h-full object-contain pointer-events-none select-none transition-transform group-hover:scale-105"
              draggable={false}
            />

            {/* Active Glow Indicator */}
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E8F86] opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#2E8F86] border-2 border-white dark:border-[#1B1E2A]" />
            </span>
          </button>

          {/* Tooltip on Desktop Hover */}
          {!isOpen && !isDragging && (
            <div className="hidden sm:block absolute right-full top-1/2 -translate-y-1/2 mr-3 px-2.5 py-1.5 bg-[#24283A] text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-inter">
              Ask UrPlaced AI
              <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-[#24283A]" />
            </div>
          )}
        </div>
      </div>

      {/* 10. Expanded Chatbot Panel */}
      {isOpen && (
        <div
          style={{
            transform: `translate3d(${panelLeft}px, ${panelTop}px, 0)`,
            width: panelWidth,
            height: isMinimized ? "auto" : panelHeight,
          }}
          className="fixed top-0 left-0 z-50 bg-[#F8F7F3] border border-[#DDDCD5] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ease-out font-inter"
        >
          {/* Header */}
          <div className="p-3.5 px-4 bg-[#FBFAF7] border-b border-[#DDDCD5] flex items-center justify-between select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white dark:bg-[#151821] border border-[#DDDCD5] p-0.5 flex items-center justify-center shrink-0 shadow-sm">
                <Image
                  src="/assets/urplaced-ai-chatbot.png"
                  alt="UrPlaced AI"
                  width={28}
                  height={28}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold font-outfit text-[#24283A] leading-tight truncate">
                    UrPlaced AI
                  </h3>
                </div>
                <p className="text-[11px] text-[#292D40]/70 truncate leading-none mt-0.5">
                  Your placement &amp; learning assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Menu Button */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu((prev) => !prev)}
                  className="p-1.5 text-[#292D40]/60 hover:text-[#24283A] rounded-lg hover:bg-[#EDECE7] transition-colors"
                  aria-label="Chatbot Options"
                  title="Options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#222636] border border-[#DDDCD5] rounded-xl shadow-lg p-1 z-10 text-xs text-[#24283A] space-y-0.5">
                    <button
                      onClick={resetConversation}
                      className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-[#F8F7F3] flex items-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#5052C9]" />
                      New Conversation
                    </button>
                    <button
                      onClick={resetPosition}
                      className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-[#F8F7F3] flex items-center gap-2"
                    >
                      <Move className="w-3.5 h-3.5 text-[#2E8F86]" />
                      Reset Launcher Position
                    </button>
                  </div>
                )}
              </div>

              {/* Minimize */}
              <button
                onClick={() => setIsMinimized((prev) => !prev)}
                className="p-1.5 text-[#292D40]/60 hover:text-[#24283A] rounded-lg hover:bg-[#EDECE7] transition-colors"
                aria-label={isMinimized ? "Maximize Chat" : "Minimize Chat"}
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                <Minus className="w-4 h-4" />
              </button>

              {/* Close */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-[#292D40]/60 hover:text-[#24283A] rounded-lg hover:bg-[#EDECE7] transition-colors"
                aria-label="Close Chatbot"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Conversation Area (Hidden when minimized) */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#F8F7F3]">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-semibold text-[#292D40]/60 uppercase tracking-wider">
                        {msg.role === "user" ? "You" : "UrPlaced AI"}
                      </span>
                      <span className="text-[9px] text-[#292D40]/40">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div
                      className={`relative group p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed max-w-[88%] whitespace-pre-wrap break-words ${
                        msg.role === "user"
                          ? "bg-gradient-to-r from-[#7779D8] to-[#5052C9] text-white rounded-tr-none shadow-sm"
                          : msg.isError
                          ? "bg-red-50 text-red-800 border border-red-200 rounded-tl-none"
                          : "bg-[#FBFAF7] text-[#24283A] border border-[#DDDCD5] rounded-tl-none shadow-sm"
                      }`}
                    >
                      {msg.content}

                      {/* Copy button for model responses */}
                      {msg.role === "model" && !msg.isError && (
                        <button
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="absolute right-2 top-2 p-1 rounded bg-[#EDECE7]/60 hover:bg-[#EDECE7] text-[#292D40]/60 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Copy response"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Suggested follow-up buttons */}
                    {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 max-w-[88%]">
                        {msg.suggestedFollowUps.map((fu, fIdx) => (
                          <button
                            key={fIdx}
                            onClick={() => handleSendMessage(fu)}
                            disabled={isLoading}
                            className="text-[11px] bg-[#FBFAF7] hover:bg-[#EDECE7] text-[#24283A] px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 border border-[#DDDCD5]"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-[#5052C9]" />
                            <span>{fu}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading state */}
                {isLoading && (
                  <div className="flex flex-col items-start space-y-1">
                    <span className="text-[10px] font-semibold text-[#292D40]/60 uppercase tracking-wider px-1">
                      UrPlaced AI
                    </span>
                    <div className="bg-[#FBFAF7] border border-[#DDDCD5] p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 text-xs text-[#292D40]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5052C9]" />
                      <span>Formulating response...</span>
                    </div>
                  </div>
                )}

                {/* Contextual quick suggestion chips (when only welcome message is present) */}
                {messages.length === 1 && !isLoading && (
                  <div className="pt-2 space-y-2">
                    <div className="text-[11px] font-semibold text-[#292D40]/60 uppercase tracking-wider px-1">
                      Suggested prompts for this page:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {getContextualSuggestions().map((sug, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(sug)}
                          className="text-xs bg-white dark:bg-[#151821] hover:bg-[#EDECE7] dark:hover:bg-[#252A3A] text-[#24283A] px-3 py-1.5 rounded-xl border border-[#DDDCD5] transition-colors flex items-center gap-1.5 text-left shadow-sm"
                        >
                          <Sparkles className="w-3 h-3 text-[#5052C9] shrink-0" />
                          <span>{sug}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Error banner */}
              {errorMessage && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="truncate">{errorMessage}</span>
                  </div>
                  <button
                    onClick={() => handleSendMessage()}
                    className="text-[11px] underline font-medium hover:text-red-900 shrink-0 ml-2"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Message Composer */}
              <div className="p-3 border-t border-[#DDDCD5] bg-[#FBFAF7]">
                <div className="flex items-end gap-2 bg-white dark:bg-[#151821] border border-[#DDDCD5] rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-[#5052C9]/30 focus-within:border-[#5052C9] transition-all">
                  <textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask UrPlaced AI anything..."
                    rows={1}
                    disabled={isLoading}
                    className="flex-1 max-h-24 resize-none p-1.5 text-xs sm:text-sm bg-transparent outline-none text-[#24283A] placeholder-[#292D40]/40 font-inter"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={isLoading || !inputMessage.trim()}
                    className="p-2 rounded-lg bg-[#5052C9] hover:bg-[#4345B0] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0"
                    aria-label="Send message"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#292D40]/50 mt-1.5 px-1">
                  <span>Enter to send • Shift+Enter for new line</span>
                  <span>Grounded in UrPlaced</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
