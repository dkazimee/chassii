import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Wrench, RotateCcw, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Car {
  id: number;
  make: string;
  model: string;
  year: number;
  engine?: string | null;
  transmission?: string | null;
}

interface AIMechanicChatProps {
  car: Car;
}

const SUGGESTED_QUESTIONS = [
  "What are the most common issues with this car?",
  "What maintenance should I do at this mileage?",
  "How can I improve performance on this build?",
  "What should I check if I hear a knocking noise?",
];

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm ${
        isUser ? "bg-red-600" : "bg-gray-900"
      }`}>
        {isUser
          ? <User className="h-4 w-4 text-white" />
          : <Bot className="h-4 w-4 text-white" />
        }
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? "bg-red-600 text-white rounded-tr-sm"
          : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
      }`}>
        {message.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-gray-900 shadow-sm">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function buildPostContent(messages: Message[], car: Car): { title: string; body: string } {
  const firstUser = messages.find(m => m.role === "user");
  const lastAI = [...messages].reverse().find(m => m.role === "assistant");

  const rawTitle = firstUser?.content.trim() ?? "AI Mechanic solution";
  const title = rawTitle.length > 120 ? rawTitle.slice(0, 117) + "…" : rawTitle;

  const lines: string[] = [];
  lines.push(`**Problem:** ${firstUser?.content ?? ""}`);
  lines.push("");

  if (messages.length > 2) {
    lines.push("**Conversation:**");
    lines.push("");
    for (const m of messages.slice(0, -1)) {
      lines.push(m.role === "user" ? `> **Me:** ${m.content}` : `> **AI Mechanic:** ${m.content}`);
      lines.push("");
    }
  }

  lines.push(`**Solution:**`);
  lines.push(lastAI?.content ?? "");
  lines.push("");
  lines.push(`---`);
  lines.push(`*Found using the AI Mechanic on my ${car.year} ${car.make} ${car.model}.*`);

  return { title, body: lines.join("\n") };
}

export default function AIMechanicChat({ car }: AIMechanicChatProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTitle, setShareTitle] = useState("");
  const [shareBody, setShareBody] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, isStreaming]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;

    setInput("");
    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsStreaming(true);
    setStreamingContent("");

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/ai/cars/${car.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("Request failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                accumulated += data.content;
                setStreamingContent(accumulated);
              }
              if (data.done) {
                setMessages(prev => [...prev, { role: "assistant", content: accumulated }]);
                setStreamingContent("");
                setIsStreaming(false);
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again."
        }]);
      }
      setStreamingContent("");
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const reset = () => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setStreamingContent("");
    setIsStreaming(false);
    setInput("");
  };

  const openShare = () => {
    const { title, body } = buildPostContent(messages, car);
    setShareTitle(title);
    setShareBody(body);
    setShareOpen(true);
  };

  const submitShare = async () => {
    if (!shareTitle.trim() || !shareBody.trim()) return;
    setIsPosting(true);
    try {
      const r = await fetch("/api/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: shareTitle.trim(),
          body: shareBody.trim(),
          category: "tech_help",
          make: car.make,
          model: car.model,
          year: car.year,
          tags: ["ai-mechanic", car.make.toLowerCase(), car.model.toLowerCase()],
        }),
      });
      if (!r.ok) throw new Error("Failed to post");
      const post = await r.json();
      setShareOpen(false);
      toast({ title: "Posted to Discussions!", description: "Your fix is now live for the community." });
      setLocation(`/posts/${post.id}`);
    } catch {
      toast({ title: "Couldn't post", description: "Something went wrong. Try again.", variant: "destructive" });
    } finally {
      setIsPosting(false);
    }
  };

  const hasMessages = messages.length > 0 || isStreaming;
  const canShare = messages.some(m => m.role === "assistant") && !isStreaming;

  return (
    <>
      <div className="flex flex-col h-full bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gray-900 text-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-red-600 flex items-center justify-center">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">AI Mechanic</p>
              <p className="text-xs text-gray-400">{car.year} {car.make} {car.model} specialist</p>
            </div>
          </div>
          {hasMessages && (
            <div className="flex items-center gap-1.5">
              {canShare && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openShare}
                  className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full h-8 px-3 gap-1.5 text-xs font-medium"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share Fix
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full h-8 w-8 p-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0"
          style={{ maxHeight: "420px" }}
        >
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-6">
              <div className="text-center">
                <div className="h-14 w-14 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-4">
                  <Bot className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 text-base">
                  Your {car.year} {car.make} {car.model} Specialist
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xs">
                  Ask anything about your car — diagnostics, maintenance, performance, or troubleshooting.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-left text-sm px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50 transition-colors text-gray-700 font-medium"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              {isStreaming && streamingContent && (
                <MessageBubble message={{ role: "assistant", content: streamingContent }} />
              )}
              {isStreaming && !streamingContent && <TypingIndicator />}
            </>
          )}
        </div>

        {/* Share prompt — shows after first AI reply */}
        {canShare && (
          <div className="px-5 py-3 bg-green-50 border-t border-green-100 flex items-center justify-between gap-3">
            <p className="text-sm text-green-700 font-medium">Did this fix your issue?</p>
            <Button
              size="sm"
              onClick={openShare}
              className="rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold gap-1.5 h-8 px-3"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share with Community
            </Button>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about your ${car.make} ${car.model}…`}
              className="resize-none min-h-[44px] max-h-32 rounded-xl border-gray-200 focus:border-red-300 focus:ring-red-100 text-sm"
              rows={1}
              disabled={isStreaming}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-11 w-11 rounded-xl bg-red-600 hover:bg-red-700 flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Powered by AI · Always consult a certified mechanic for safety-critical repairs
          </p>
        </div>
      </div>

      {/* Share to Discussions Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-green-600" />
              Share Fix to Discussions
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              Help other {car.make} {car.model} owners with the same problem. Review and edit before posting.
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Title</label>
              <Input
                value={shareTitle}
                onChange={e => setShareTitle(e.target.value)}
                placeholder="Describe the problem you solved…"
                className="text-sm"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Post</label>
              <Textarea
                value={shareBody}
                onChange={e => setShareBody(e.target.value)}
                className="text-sm min-h-[220px] font-mono resize-none"
                placeholder="Describe the problem and solution…"
              />
              <p className="text-xs text-gray-400">You can edit the content above before posting.</p>
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <DialogClose asChild>
              <Button variant="outline" className="rounded-full">Cancel</Button>
            </DialogClose>
            <Button
              onClick={submitShare}
              disabled={isPosting || !shareTitle.trim() || !shareBody.trim()}
              className="rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold gap-2"
            >
              <Share2 className="h-4 w-4" />
              {isPosting ? "Posting…" : "Post to Discussions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
