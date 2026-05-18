import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Sparkles, Settings as SettingsIcon } from "lucide-react";
import { useI18n } from "../contexts/I18nContext";
import api from "../lib/api";
import { cn } from "../lib/utils";

const MODEL_OPTIONS = [
  { value: "claude", label: "Claude Sonnet 4.5", provider: "Anthropic" },
  { value: "gpt-5.2", label: "GPT-5.2 (mới nhất)", provider: "OpenAI" },
  { value: "gpt-5.1", label: "GPT-5.1", provider: "OpenAI" },
  { value: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
];

function getSessionId() {
  let sid = localStorage.getItem("chat_session_id");
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("chat_session_id", sid);
  }
  return sid;
}

export default function ChatWidget() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(() => localStorage.getItem("chat_model") || "claude");
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef(null);
  const sessionIdRef = useRef(getSessionId());

  useEffect(() => {
    localStorage.setItem("chat_model", model);
  }, [model]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content }]);
    setLoading(true);
    try {
      const { data } = await api.post("/chat", {
        session_id: sessionIdRef.current,
        message: content,
        model,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: lang === "vi"
          ? "Xin lỗi, hiện chưa kết nối được với AI. Vui lòng thử lại sau."
          : "Sorry, AI service is unavailable. Please try again later.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full bg-terracotta text-white shadow-xl",
          "flex items-center justify-center hover:bg-terracotta-hover transition-all",
          "hover:scale-105"
        )}
        data-testid="chat-floating-button"
        aria-label="Open AI Assistant"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[100] w-[92vw] sm:w-[400px] h-[560px] max-h-[80vh] bg-white border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
          data-testid="chat-panel"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-bamboo text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div className="flex-1">
              <div className="font-heading font-semibold text-sm">{t("chat.title")}</div>
              <div className="text-[11px] text-white/70">{MODEL_OPTIONS.find((m) => m.value === model)?.label || "AI"}</div>
            </div>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="p-1 rounded hover:bg-white/10"
              data-testid="chat-settings"
              aria-label="Settings"
            >
              <SettingsIcon size={16} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-white/10"
              data-testid="chat-close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {showSettings && (
            <div className="px-4 py-3 bg-cream/60 border-b border-border">
              <div className="text-xs font-medium text-ink-secondary mb-2">{t("chat.model")}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {MODEL_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setModel(m.value)}
                    className={cn(
                      "text-left text-xs px-2.5 py-1.5 rounded border transition-colors",
                      model === m.value
                        ? "bg-bamboo text-white border-bamboo"
                        : "bg-white border-border text-ink hover:border-bamboo/60"
                    )}
                    data-testid={`chat-model-${m.value}`}
                  >
                    <div className="font-medium leading-tight">{m.label}</div>
                    <div className="text-[10px] opacity-70 leading-tight">{m.provider}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-cream/30"
            data-testid="chat-messages"
          >
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="bg-white p-3 rounded-lg border border-border text-sm text-ink leading-relaxed">
                  {t("chat.welcome")}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium">
                  {lang === "vi" ? "Gợi ý" : "Suggestions"}
                </div>
                <div className="flex flex-col gap-2">
                  {t("chat.suggestions").map((s, i) => (
                    <button
                      key={i}
                      onClick={() => send(s)}
                      className="text-left text-xs px-3 py-2 bg-white border border-border rounded-lg hover:border-bamboo hover:bg-cream transition-colors"
                      data-testid={`chat-suggestion-${i}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-bamboo text-white rounded-br-sm"
                      : "bg-white border border-border text-ink rounded-bl-sm"
                  )}
                  data-testid={`chat-message-${m.role}`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl bg-white border border-border text-sm text-ink-muted">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-bamboo animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-bamboo animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-bamboo animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border bg-white">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={t("chat.placeholder")}
                className="flex-1 h-10 px-3 text-sm border border-border rounded-lg focus:border-bamboo focus:ring-1 focus:ring-bamboo outline-none"
                data-testid="chat-input"
              />
              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="w-10 h-10 rounded-lg bg-bamboo text-white flex items-center justify-center hover:bg-bamboo-hover disabled:opacity-40"
                data-testid="chat-send-button"
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
