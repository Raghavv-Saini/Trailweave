"use client";

import React, { useState, useRef, useEffect } from "react";
import { Compass, X, Send, Bot } from "lucide-react";
import { useTrip } from "@/context/TripContext";
import { ReplanProposalCard, ReplanProposalData } from "./ReplanProposalCard";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  replan_proposal?: ReplanProposalData | null;
  acknowledged_events?: string[];
  timestamp: string;
}

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  "I'm tired, can we skip the fort and find a rooftop tea shop nearby?",
  "Add Master Mohanlal miniature art studio after lunch",
  "What is the dress etiquette for Jagdish Temple?",
  "Where is the best sunset spot near Lake Pichola?",
];

export function AIChatDrawer({ isOpen, onClose }: AIChatDrawerProps) {
  const { revision, sendCompanionMessage, refreshTrip } = useTrip();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial_welcome",
      sender: "ai",
      text: "Khamma Ghani! I'm your cultured Udaipur companion. How can I adapt your route, skip a stop, or find hidden artisan workshops for you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendCompanionMessage(textToSend);

      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: "ai",
        text: response.response_narrative,
        replan_proposal: response.replan_proposal as ReplanProposalData | null,
        acknowledged_events: response.acknowledged_events,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          sender: "ai",
          text: "Khamma Ghani! I had temporary trouble reaching the planning engine. Please check your connection or try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E8E4DC] flex items-center justify-between bg-[#FBF9F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1E3A5F] text-white flex items-center justify-center shadow-xs">
              <Compass className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-serif font-medium text-[#191C1E] text-sm">Gemini Companion</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] border border-[#1E3A5F]/20">
                  Rev {revision}
                </span>
              </div>
              <p className="text-[10px] text-[#7A746B] font-medium">
                Cultured Local Companion • Udaipur
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div className="flex items-start gap-1.5 max-w-[92%]">
                {m.sender === "ai" && (
                  <div className="w-6 h-6 rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    m.sender === "user"
                      ? "bg-[#1E3A5F] text-white rounded-br-xs"
                      : "bg-[#FBF9F5] text-[#191C1E] rounded-bl-xs border border-[#E8E4DC]"
                  }`}
                >
                  <p>{m.text}</p>

                  {/* Embedded interactive ReplanProposalCard */}
                  {m.replan_proposal && (
                    <ReplanProposalCard
                      proposal={m.replan_proposal}
                      onAccepted={() => {
                        refreshTrip();
                      }}
                    />
                  )}

                  <div
                    className={`mt-1 text-[9px] font-medium ${
                      m.sender === "user" ? "text-white/60 text-right" : "text-[#7A746B]"
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Loading typing indicator */}
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-[#7A746B] animate-pulse pl-1">
              <Bot className="w-4 h-4 text-[#1E3A5F]" />
              <span>Companion is consulting Udaipur routes & artisan hours...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Prompt Pills */}
        <div className="px-3 py-2 border-t border-[#E8E4DC] bg-[#FBF9F5] overflow-x-auto flex gap-1.5 scrollbar-none">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white border border-[#E8E4DC] text-[10px] text-[#191C1E] hover:border-[#1E3A5F] hover:text-[#1E3A5F] transition-colors cursor-pointer shrink-0 font-medium"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input box */}
        <div className="p-3 border-t border-[#E8E4DC] flex items-center gap-2 bg-white">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask companion to skip, adapt stops, or find crafts..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#FBF9F5] text-xs border border-[#E8E4DC] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl bg-[#1E3A5F] text-white hover:bg-[#152943] transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
