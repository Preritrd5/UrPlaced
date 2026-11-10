"use client";

import React, { useEffect } from "react";
import { Mic, MicOff, Square, AlertCircle, Sparkles, Volume2, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/common/brand-loader";
import { toast } from "@/components/ui/dialog-system";
import {
  useSpeechRecognition,
  UseSpeechRecognitionOptions,
} from "@/modules/mock-interview/hooks/use-speech-recognition";

export interface MockInterviewSpeechControlProps {
  onAppendTranscript: (chunk: string) => void;
  currentLength: number;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
}

export function MockInterviewSpeechControl({
  onAppendTranscript,
  currentLength,
  maxLength = 5000,
  disabled = false,
  className = "",
}: MockInterviewSpeechControlProps) {
  const {
    state,
    isSupported,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
    clearError,
  } = useSpeechRecognition({
    onFinalTranscript: onAppendTranscript,
    maxLength,
    currentLength,
    preferredLanguage: "en-IN",
  });

  // Handle Toggle
  const handleToggleListening = () => {
    if (disabled) return;
    if (state === "LISTENING") {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className={`inline-flex flex-col items-end gap-1.5 ${className}`}>
      {/* Primary Microphone Trigger Button */}
      <div className="flex items-center gap-2">
        {state === "LISTENING" && (
          <span
            className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 animate-pulse select-none font-mono"
            aria-live="polite"
            role="status"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Listening...
          </span>
        )}

        <Button
          type="button"
          onClick={handleToggleListening}
          disabled={disabled || state === "PROCESSING" || (!isSupported && state === "UNSUPPORTED")}
          size="sm"
          variant={state === "LISTENING" ? "destructive" : "outline"}
          className={`h-8 px-2.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            state === "LISTENING"
              ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:border-red-600 dark:text-red-300 ring-2 ring-red-400/30"
              : state === "PROCESSING"
              ? "bg-[#EDECE7] text-[#292D40]/60 border-[#DDDCD5] cursor-wait"
              : !isSupported
              ? "bg-[#EDECE7]/40 text-[#292D40]/40 border-[#DDDCD5]/60 cursor-not-allowed"
              : "bg-[#FBFAF7] hover:bg-[#EDECE7] text-[#24283A] border-[#DDDCD5] hover:border-[#5052C9]/40 hover:text-[#5052C9]"
          }`}
          title={
            !isSupported
              ? "Voice input is not supported in this browser. You can still type your answer."
              : state === "LISTENING"
              ? "Click to stop dictation"
              : "Click to speak your answer"
          }
          aria-label={
            !isSupported
              ? "Voice input not supported"
              : state === "LISTENING"
              ? "Stop listening"
              : "Start voice input"
          }
        >
          {state === "PROCESSING" ? (
            <>
              <BrandLoader size="inline" />
              <span>Finalizing...</span>
            </>
          ) : state === "LISTENING" ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current text-red-600" />
              <span>Stop Dictating</span>
            </>
          ) : !isSupported ? (
            <>
              <MicOff className="w-3.5 h-3.5 text-[#292D40]/40" />
              <span>Voice Unsupported</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5 text-[#5052C9]" />
              <span>Voice Answer</span>
            </>
          )}
        </Button>
      </div>

      {/* Live Interim Transcript Bubble */}
      {state === "LISTENING" && interimTranscript && (
        <div
          className="max-w-md text-left px-3 py-1.5 rounded-lg bg-[#5052C9]/10 border border-[#5052C9]/25 text-[#24283A] dark:text-[#EDECE7] text-xs leading-snug flex items-start gap-1.5 shadow-xs animate-in fade-in"
          role="region"
          aria-label="Live speech transcription"
        >
          <Volume2 className="w-3.5 h-3.5 text-[#5052C9] shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-[#5052C9] text-[11px] uppercase mr-1">
              Hearing:
            </span>
            <span className="italic">&ldquo;{interimTranscript}&rdquo;</span>
          </div>
        </div>
      )}

      {/* Non-blocking Error Display with Retry */}
      {state === "ERROR" && errorMessage && (
        <div className="flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700/50 shadow-xs animate-in fade-in max-w-lg">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="flex-1 leading-tight">{errorMessage}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => startListening()}
              type="button"
              className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-200/60 hover:bg-amber-200 dark:bg-amber-800/40 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
              title="Retry microphone connection"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Retry</span>
            </button>
            <button
              onClick={clearError}
              type="button"
              className="p-1 text-amber-700 hover:text-amber-950 dark:text-amber-300 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              title="Dismiss notice"
              aria-label="Dismiss notice"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
