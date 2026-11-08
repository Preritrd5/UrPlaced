"use strict";
"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Lightbulb,
  BookOpen,
  HelpCircle,
  RotateCcw,
  Compass,
  AlertCircle,
  CheckCircle,
  Copy,
  Check,
} from "lucide-react";
import { BrandLoader } from "@/components/common/brand-loader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { FeatureLockedCard } from "@/components/ui/feature-locked-card";
import { FormattedAIResponse } from "@/components/ai/formatted-ai-response";

interface Message {
  role: "user" | "model";
  content: string;
  mode?: string;
  suggestedFollowUps?: string[];
}

export default function StudentAITutorPage() {
  const { isPlatformAdmin, isLoading: isLoadingAuth, tenant } = useAuthContext();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      content:
        "Welcome! I am your AI Placement Study Tutor. Ask me any question regarding DSA, programming concepts, aptitude, or interview problem-solving strategies.",
      suggestedFollowUps: [
        "Explain the time complexity of QuickSort vs MergeSort",
        "How do I solve two-pointer problems efficiently?",
        "Give me an analogy for dynamic programming state transitions",
      ],
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [activeMode, setActiveMode] = useState<"EXPLAIN" | "HINT" | "ANALOGY" | "PRACTICE">("EXPLAIN");
  const [topic, setTopic] = useState("Algorithms & Data Structures");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remainingQuota, setRemainingQuota] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCopyResponse = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    setInputMessage("");
    setErrorMessage(null);

    const userMsg: Message = { role: "user", content: text, mode: activeMode };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ai/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          mode: activeMode,
          topic,
          history: historyPayload,
          conversationId: conversationId || undefined,
        }),
      });

      const remainingHeader = res.headers.get("X-RateLimit-Remaining");
      if (remainingHeader) {
        setRemainingQuota(remainingHeader);
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to receive tutor explanation.");
      }

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      const modelMsg: Message = {
        role: "model",
        content: data.response,
        mode: data.mode,
        suggestedFollowUps: data.suggestedFollowUps || [],
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
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

  const handleResetConversation = () => {
    setConversationId(null);
    setMessages([
      {
        role: "model",
        content:
          "Conversation reset. What topic or problem would you like to master next?",
        suggestedFollowUps: [
          "Explain Dijkstra's shortest path algorithm step-by-step",
          "What are the top 5 mistakes students make in sliding window questions?",
          "Explain how database B-Trees work using a real-world analogy",
        ],
      },
    ]);
  };

  const isEntitled =
    isPlatformAdmin || (tenant?.entitlements ? tenant.entitlements["ai_tutor_assistant"] !== false : true);

  if (!isLoadingAuth && !isEntitled) {
    return (
      <FeatureLockedCard
        featureName="Floating AI Placement Tutor"
        featureKey="ai_tutor_assistant"
        description="The interactive AI Placement Tutor is not included in your college's current subscription plan."
        recommendedPlan="Campus Growth"
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#F8F7F3] border border-[#DDDCD5] p-6 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-[#5052C9]/10 text-[#5052C9]">
              <Sparkles className="w-5 h-5 text-[#5052C9]" />
            </span>
            <h1 className="text-2xl font-bold font-outfit text-[#24283A]">
              AI Placement Study Tutor
            </h1>
          </div>
          <p className="text-sm font-inter text-[#292D40]/80">
            Personalized, step-by-step concept explanations, guided hints, and practice recommendations grounded in real placement topics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {remainingQuota !== null && (
            <Badge variant="outline" className="text-xs border-[#DDDCD5] text-[#292D40]/70 bg-[#FBFAF7]">
              {remainingQuota} requests remaining
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetConversation}
            className="border-[#DDDCD5] text-[#24283A] hover:bg-[#EDECE7]"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            New Session
          </Button>
        </div>
      </div>

      {/* Mode Selection Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#292D40]/70 uppercase tracking-wider mr-1">
          Assistance Mode:
        </span>
        <button
          onClick={() => setActiveMode("EXPLAIN")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            activeMode === "EXPLAIN"
              ? "bg-[#5052C9] text-white shadow-sm"
              : "bg-[#F8F7F3] text-[#24283A] border border-[#DDDCD5] hover:bg-[#EDECE7]"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Step-by-Step Explanation
        </button>
        <button
          onClick={() => setActiveMode("HINT")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            activeMode === "HINT"
              ? "bg-[#5052C9] text-white shadow-sm"
              : "bg-[#F8F7F3] text-[#24283A] border border-[#DDDCD5] hover:bg-[#EDECE7]"
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Guided Hint (No Spoilers)
        </button>
        <button
          onClick={() => setActiveMode("ANALOGY")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            activeMode === "ANALOGY"
              ? "bg-[#5052C9] text-white shadow-sm"
              : "bg-[#F8F7F3] text-[#24283A] border border-[#DDDCD5] hover:bg-[#EDECE7]"
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Real-World Analogy
        </button>
        <button
          onClick={() => setActiveMode("PRACTICE")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            activeMode === "PRACTICE"
              ? "bg-[#5052C9] text-white shadow-sm"
              : "bg-[#F8F7F3] text-[#24283A] border border-[#DDDCD5] hover:bg-[#EDECE7]"
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          Targeted Practice Strategy
        </button>
      </div>

      {/* Main Conversation Container */}
      <div className="bg-[#F8F7F3] border border-[#DDDCD5] rounded-xl shadow-sm flex flex-col min-h-[500px] max-h-[700px]">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase tracking-wider">
                  {msg.role === "user" ? "You" : "UrPlaced AI Tutor"}
                </span>
                {msg.mode && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-[#DDDCD5] text-[#292D40]/70">
                    {msg.mode}
                  </Badge>
                )}
              </div>

              <div
                className={`p-4 md:p-5 rounded-2xl max-w-[95%] md:max-w-[88%] text-sm leading-relaxed font-inter relative group shadow-sm ${
                  msg.role === "user"
                    ? "bg-[#5052C9] text-white rounded-tr-none whitespace-pre-wrap"
                    : "bg-[#FBFAF7] dark:bg-[#1B1E2A] text-[#24283A] dark:text-[#F2F1F8] border border-[#DDDCD5] dark:border-[#303548] rounded-tl-none"
                }`}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <>
                    <FormattedAIResponse content={msg.content} />
                    <button
                      onClick={() => handleCopyResponse(msg.content, idx)}
                      type="button"
                      className="absolute right-2.5 top-2.5 p-1.5 rounded-lg bg-[#EDECE7]/60 hover:bg-[#DDDCD5] dark:bg-[#252A3A] dark:hover:bg-[#303548] text-[#292D40]/60 dark:text-[#B9BDCD] opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                      title="Copy response markdown"
                      aria-label="Copy response markdown"
                    >
                      {copiedIdx === idx ? (
                        <Check className="w-3.5 h-3.5 text-[#2E8F86]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </>
                )}
              </div>

              {/* Follow-up suggestions */}
              {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 max-w-[85%]">
                  {msg.suggestedFollowUps.map((fu, fIdx) => (
                    <button
                      key={fIdx}
                      onClick={() => handleSendMessage(fu)}
                      disabled={isLoading}
                      className="text-xs bg-[#EDECE7] hover:bg-[#DDDCD5] text-[#24283A] px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 border border-[#DDDCD5]"
                    >
                      <Sparkles className="w-3 h-3 text-[#5052C9]" />
                      <span>{fu}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex flex-col items-start space-y-2">
              <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase tracking-wider px-1">
                UrPlaced AI Tutor
              </span>
              <div className="bg-[#FBFAF7] border border-[#DDDCD5] p-4 rounded-xl rounded-tl-none shadow-sm flex items-center gap-2 text-sm text-[#292D40]">
                <BrandLoader size="inline" className="mr-1" />
                <span>Formulating personalized pedagogical explanation...</span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-[#DDDCD5] bg-[#FBFAF7] rounded-b-xl">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your tutor anything (e.g. 'How does dynamic programming work?', 'Give me a hint for binary search')..."
                rows={2}
                disabled={isLoading}
                className="w-full resize-none p-3 text-sm bg-white dark:bg-[#151821] border border-[#DDDCD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5052C9]/30 focus:border-[#5052C9] text-[#24283A] placeholder-[#292D40]/40 transition-all font-inter"
              />
            </div>
            <Button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputMessage.trim()}
              className="bg-[#5052C9] hover:bg-[#4345B0] text-white px-4 h-11 shrink-0 font-medium"
            >
              {isLoading ? (
                <BrandLoader size="button" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1.5" />
                  Ask Tutor
                </>
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#292D40]/60 mt-2 px-1">
            <span>Press Enter to send, Shift + Enter for a new line</span>
            <span>Grounding: Verified UrPlaced syllabus & placement question banks</span>
          </div>
        </div>
      </div>
    </div>
  );
}
