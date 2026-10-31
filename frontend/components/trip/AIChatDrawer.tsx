"use client";

import React, { useState } from "react";
import { Sparkles, X, Send } from "lucide-react";

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIChatDrawer({ isOpen, onClose }: AIChatDrawerProps) {
  const [messages, setMessages] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    {
      sender: "ai",
      text: "Khamma Ghani! I'm your cultured Udaipur companion. How can I adapt your route or find hidden artisans for you today?",
    },
  ]);
  const [input, setInput] = useState("");

  if (!isOpen) return null;

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setInput("");

    // Stub reply simulating Gemini Flash tool evaluation
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `I heard: "${userMsg}". I've evaluated your time window and budget headroom against verified Udaipur studios.`,
        },
      ]);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#E05A2B] text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-neutral-900 text-sm">Gemini Companion</h2>
              <p className="text-[10px] text-neutral-500 font-medium">Cultured Local Companion</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-2xl text-xs ${
                  m.sender === "user"
                    ? "bg-neutral-900 text-white rounded-br-xs"
                    : "bg-neutral-100 text-neutral-800 rounded-bl-xs"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-neutral-100 flex items-center gap-2 bg-white">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask companion to adjust stops or suggest crafts..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-neutral-100 text-xs border-0 focus:outline-none focus:ring-2 focus:ring-[#E05A2B]/40"
          />
          <button
            onClick={handleSend}
            className="p-2.5 rounded-xl bg-[#E05A2B] text-white hover:bg-[#c94d23] transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
