import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import UserLayout from "../../components/UserLayout";
import { useI18n } from "../../contexts/I18nContext";
import { instanceService } from "../../services/instanceService";
import {
  chatCompletionsStream,
  type ChatMessage,
} from "../../services/chatService";
import type { Instance } from "../../types/instance";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const InstanceChatPage: React.FC = () => {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamContent, scrollToBottom]);

  // Load instance info
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const inst = await instanceService.getInstance(Number(id));
        setInstance(inst);
      } catch (err: any) {
        setError(err?.response?.data?.error || "Failed to load instance");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !id || streaming) return;

    setInput("");
    setError(null);

    const userMessage: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    setStreaming(true);
    setStreamContent("");

    const abortController = new AbortController();
    abortRef.current = abortController;

    let fullContent = "";
    try {
      for await (const chunk of chatCompletionsStream(
        Number(id),
        updatedMessages,
        abortController.signal,
      )) {
        if (chunk.done) break;
        fullContent += chunk.content;
        setStreamContent(fullContent);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: fullContent },
      ]);
      setStreamContent("");
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "Failed to get response");
    } finally {
      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, id, messages, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    setStreaming(false);
    if (streamContent) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: streamContent },
      ]);
      setStreamContent("");
    }
  };

  if (loading) {
    return (
      <UserLayout title="Chat">
        <div className="flex items-center justify-center h-[calc(100vh-120px)]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
        </div>
      </UserLayout>
    );
  }

  if (error && !instance) {
    return (
      <UserLayout title="Chat">
        <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] gap-4 px-6">
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={() => navigate("/instances")}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
          >
            Back to instances
          </button>
        </div>
      </UserLayout>
    );
  }

  const canChat =
    instance?.status === "running" &&
    (instance?.type === "openclaw" || instance?.type === "hermes");

  return (
    <UserLayout title={`Chat - ${instance?.name || ""}`}>
      <div className="flex h-[calc(100vh-60px)] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/instances/${id}`)}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">
                {instance?.name}
              </h1>
              <span className="text-xs text-gray-500">
                {canChat ? t("instances.chatReady") : instance?.status === "running" ? t("instances.chatUnsupportedType") : t("instances.chatNotRunning")}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-6">
          {messages.length === 0 && !streaming && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 rounded-full bg-blue-100 p-4">
                <svg className="h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-700">Chat with your instance</h2>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Send a message to start a conversation with {instance?.name}.
              </p>
            </div>
          )}

          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-white text-gray-800 shadow-sm ring-1 ring-gray-100"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {streamContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-gray-100">
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamContent}
                    </ReactMarkdown>
                  </div>
                  <span className="inline-block h-4 w-2 animate-pulse rounded bg-blue-500 align-text-bottom" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 font-medium underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-gray-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!canChat || streaming}
              placeholder={
                !canChat
                  ? instance?.status !== "running"
                    ? "Instance must be running to chat"
                    : "This instance type does not support chat"
                  : streaming
                    ? "Waiting for response..."
                    : "Type a message... (Enter to send)"
              }
              rows={1}
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {streaming ? (
              <button
                onClick={stopStreaming}
                className="flex h-[44px] w-[44px] items-center justify-center rounded-xl bg-red-500 text-white hover:bg-red-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim() || !canChat}
                className="flex h-[44px] w-[44px] items-center justify-center rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[11px] text-gray-400">
            Responses are powered by your instance's AI model. Press Enter to send, Shift+Enter for new line.
          </p>
        </div>
      </div>
    </UserLayout>
  );
};

export default InstanceChatPage;
