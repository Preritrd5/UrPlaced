"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type {
  VoiceInputState,
  ISpeechRecognition,
  ISpeechRecognitionEvent,
  ISpeechRecognitionErrorEvent,
} from "../types/speech-recognition";

export interface UseSpeechRecognitionOptions {
  onFinalTranscript: (text: string) => void;
  preferredLanguage?: string;
  maxLength?: number;
  currentLength?: number;
}

export interface UseSpeechRecognitionReturn {
  state: VoiceInputState;
  isSupported: boolean;
  interimTranscript: string;
  errorMessage: string | null;
  startListening: () => void;
  stopListening: () => void;
  clearError: () => void;
}

/**
 * Safe Browser Speech Recognition Resolution
 */
function resolveSpeechRecognitionConstructor(): (new () => ISpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const win = window as any;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function useSpeechRecognition({
  onFinalTranscript,
  preferredLanguage,
  maxLength = 5000,
  currentLength = 0,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [state, setState] = useState<VoiceInputState>("IDLE");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const isIntentionalStopRef = useRef(false);
  const pendingInterimRef = useRef("");

  // Keep latest callbacks/values in refs to avoid stale closures in recognition event listeners
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  onFinalTranscriptRef.current = onFinalTranscript;

  const currentLengthRef = useRef(currentLength);
  currentLengthRef.current = currentLength;

  const maxLengthRef = useRef(maxLength);
  maxLengthRef.current = maxLength;

  // Browser capability detection & real-time permission status observer
  useEffect(() => {
    const Ctor = resolveSpeechRecognitionConstructor();
    if (Ctor) {
      setIsSupported(true);
      setState("IDLE");
    } else {
      setIsSupported(false);
      setState("UNSUPPORTED");
    }

    // Real-time permission observer: if user enables mic in Chrome settings, clear error immediately
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((permStatus) => {
          permStatus.onchange = () => {
            if (permStatus.state === "granted") {
              setErrorMessage(null);
              setState("IDLE");
            }
          };
        })
        .catch(() => {
          // Unsupported query in some browsers, safe to ignore
        });
    }
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
    if (resolveSpeechRecognitionConstructor()) {
      setState("IDLE");
    } else {
      setState("UNSUPPORTED");
    }
  }, []);

  const stopListening = useCallback(() => {
    isIntentionalStopRef.current = true;
    if (recognitionRef.current) {
      setState("PROCESSING");
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("[SpeechRecognition] stop notice:", err);
      }
    } else {
      setState("IDLE");
      setInterimTranscript("");
    }
  }, []);

  const startListening = useCallback(async () => {
    const Ctor = resolveSpeechRecognitionConstructor();
    if (!Ctor) {
      setState("UNSUPPORTED");
      setErrorMessage("Voice input is not supported in this browser. You can still type your answer.");
      return;
    }

    // Check if character limit already exceeded
    if (currentLengthRef.current >= maxLengthRef.current) {
      setErrorMessage(`Response has reached the maximum ${maxLengthRef.current} character limit.`);
      setState("ERROR");
      return;
    }

    // Clean up any stale existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Safe discard
      }
      recognitionRef.current = null;
    }

    isIntentionalStopRef.current = false;
    pendingInterimRef.current = "";
    setInterimTranscript("");
    setErrorMessage(null);

    // Proactively request / verify microphone permission via getUserMedia if available
    if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (mediaErr: any) {
        if (
          mediaErr?.name === "NotAllowedError" ||
          mediaErr?.name === "PermissionDeniedError" ||
          mediaErr?.message?.includes("Permission denied") ||
          mediaErr?.message?.includes("not-allowed")
        ) {
          setErrorMessage(
            "Microphone access was denied. Turn on the Microphone toggle in your address bar (tune/lock icon) and click Retry."
          );
          setState("ERROR");
          return;
        }
        if (mediaErr?.name === "NotFoundError" || mediaErr?.name === "DevicesNotFoundError") {
          setErrorMessage("No microphone was found. Please ensure a microphone is connected and enabled.");
          setState("ERROR");
          return;
        }
      }
    }

    try {
      const recognition = new Ctor();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Locale determination: preferred -> browser locale -> en-IN -> en-US
      const locale =
        preferredLanguage ||
        (typeof navigator !== "undefined" && navigator.language) ||
        "en-IN";
      recognition.lang = locale;

      recognition.onstart = () => {
        setState("LISTENING");
      };

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        let interimText = "";
        let finalizedChunk = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcriptChunk = res[0]?.transcript || "";

          if (res.isFinal) {
            finalizedChunk += (finalizedChunk ? " " : "") + transcriptChunk.trim();
          } else {
            interimText += (interimText ? " " : "") + transcriptChunk;
          }
        }

        // Handle finalized speech
        if (finalizedChunk.trim()) {
          const trimmed = finalizedChunk.trim();
          const remainingSpace = maxLengthRef.current - currentLengthRef.current;

          if (remainingSpace <= 0) {
            // Reached limit
            setErrorMessage(`Response limit of ${maxLengthRef.current} characters reached.`);
            stopListening();
            return;
          }

          const allowedChunk = trimmed.slice(0, remainingSpace);
          onFinalTranscriptRef.current(allowedChunk);
          pendingInterimRef.current = "";
          setInterimTranscript("");

          if (trimmed.length > remainingSpace) {
            setErrorMessage(`Response reached the ${maxLengthRef.current} character limit.`);
            stopListening();
          }
        } else {
          // Update live interim feedback
          pendingInterimRef.current = interimText;
          setInterimTranscript(interimText);
        }
      };

      recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        const errorKey = event.error || "unknown";

        if (isIntentionalStopRef.current && (errorKey === "aborted" || errorKey === "no-speech")) {
          // User deliberately stopped, ignore
          return;
        }

        let userFriendlyMsg = "Voice recognition encountered an error. Your existing answer is preserved.";

        switch (errorKey) {
          case "not-allowed":
          case "service-not-allowed":
            userFriendlyMsg = "Microphone access was denied. Turn on the Microphone toggle in your address bar (tune/lock icon) and click Retry.";
            break;
          case "audio-capture":
            userFriendlyMsg = "No microphone was found. Please ensure a microphone is connected and enabled.";
            break;
          case "no-speech":
            userFriendlyMsg = "No speech was detected. Please try speaking closer to your microphone.";
            break;
          case "network":
            userFriendlyMsg = "Speech recognition network error occurred. Please check your internet connection.";
            break;
          case "aborted":
            // Non-critical stop
            return;
          default:
            userFriendlyMsg = `Voice recognition notice: ${event.message || errorKey}`;
        }

        setErrorMessage(userFriendlyMsg);
        setState("ERROR");
      };

      recognition.onend = () => {
        // If there was pending interim speech when stopped, flush it
        const pending = pendingInterimRef.current.trim();
        if (pending && !isIntentionalStopRef.current) {
          const remainingSpace = maxLengthRef.current - currentLengthRef.current;
          if (remainingSpace > 0) {
            onFinalTranscriptRef.current(pending.slice(0, remainingSpace));
          }
        }

        pendingInterimRef.current = "";
        setInterimTranscript("");
        recognitionRef.current = null;

        // Transition back to IDLE unless an error was set
        setState((current) => (current === "ERROR" ? "ERROR" : "IDLE"));
      };

      recognition.start();
    } catch (err: any) {
      console.warn("[SpeechRecognition] start exception:", err);
      setState("ERROR");
      setErrorMessage(
        err?.message?.includes("not-allowed")
          ? "Microphone access was blocked. Please enable it in browser settings."
          : "Unable to start voice input. Please try typing your answer."
      );
    }
  }, [preferredLanguage, stopListening]);

  // Clean up recognition instance and listeners on unmount or session navigation
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Safe discard on unmount
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    state,
    isSupported,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
    clearError,
  };
}
