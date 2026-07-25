"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon, SendHorizontalIcon } from "lucide-react";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAudioAnalyser } from "@/hooks/use-audio-analyser";

const OWNER = {
  name: "Raiyan Memon",
  firstName: "Raiyan",
  initials: "RM",
  role: "Full Stack Developer & Team Lead",
};

// The clearest signal of what a visitor may ask. Phrased the way a recruiter
// would say it, not as a feature list.
const PROMPTS = [
  "What's your background?",
  "What tech do you work with?",
  "Tell me about a recent project",
  "What are you looking for next?",
  "How can I reach you?",
];

// Neural2 leads, and is therefore the default. Chirp 3 HD sounds better but
// measured ~4.2s to synthesise a typical answer against ~1.2s for Neural2, and
// three extra seconds of silence costs more than the extra polish buys.
const VOICES = [
  // { value: "en-US-Neural2-F", label: "Neural2 F — female" },
  // { value: "en-US-Neural2-D", label: "Neural2 D — male" },
  { value: "en-US-Neural2-C", label: "Neural2 C — female" },
  // { value: "en-US-Chirp3-HD-Aoede", label: "Aoede — warm female (slower)" },
  // { value: "en-US-Chirp3-HD-Puck", label: "Puck — bright male (slower)" },
  // { value: "en-US-Chirp3-HD-Charon", label: "Charon — deep male (slower)" },
];

const MAX_CHARS = 5000;

export default function Home() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(VOICES[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [lastAsked, setLastAsked] = useState(null);
  const [answer, setAnswer] = useState(null);
  const audioRef = useRef(null);
  const inputRef = useRef(null);

  const { analyser, resume } = useAudioAnalyser(audioRef);

  // Release the previous blob when a new one replaces it, and on unmount.
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Play as soon as fresh audio arrives. Allowed, since this follows a click.
  useEffect(() => {
    if (audioUrl) audioRef.current?.play().catch(() => {});
  }, [audioUrl]);

  async function handleSubmit(event) {
    event.preventDefault();

    const value = text.trim();
    if (!value || isLoading) return;

    setIsLoading(true);
    setError(null);
    setLastAsked(value);
    setAnswer(null);
    // Cleared on send, as every chat does — the question is echoed in the
    // panel above, so nothing is lost.
    setText("");

    // The AudioContext starts suspended; this click is the gesture that frees it.
    await resume();

    let reply = null;

    try {
      const chat = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: value }),
      });

      const result = await chat.json().catch(() => null);
      if (!chat.ok) throw new Error(result?.error ?? "Could not get an answer");

      reply = result.answer;
      // Shown before the audio is ready: reading should never wait on speech.
      setAnswer(reply);

      const speech = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply, voice }),
      });

      if (!speech.ok) {
        const details = await speech.json().catch(() => null);
        throw new Error(details?.error ?? "Could not generate the audio");
      }

      setAudioUrl(URL.createObjectURL(await speech.blob()));
    } catch (err) {
      setError(err.message);
      // Only worth restoring if nothing came back — once there is an answer on
      // screen, refilling the box would just look like the question failed.
      if (!reply) setText(value);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(event) {
    // Enter sends, Shift+Enter breaks the line — the convention every chat
    // interface uses, so visitors never have to be told.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  function askPrompt(prompt) {
    setText(prompt);
    inputRef.current?.focus();
  }

  return (
    // Split rather than stacked: overlaying a header and greeting on the avatar
    // ate the stage from both ends. Side by side on desktop, avatar over panel
    // on phones.
    <div className="grid h-dvh min-w-0 grid-rows-[38vh_1fr] overflow-hidden lg:grid-cols-[1fr_27rem] lg:grid-rows-1">
      <div className="relative min-h-0 min-w-0 overflow-hidden bg-linear-to-b from-muted/30 to-muted/70">
        <Avatar
          analyser={analyser}
          thinking={isLoading}
          className="absolute inset-0"
        />
      </div>

      <aside className="flex min-h-0 min-w-0 flex-col border-t bg-card lg:border-t-0 lg:border-l">
        <header className="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
            {OWNER.initials}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold">{OWNER.name}</h1>
              <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                AI
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {OWNER.role}
            </p>
          </div>
        </header>

        {/* Scrolls independently. This is where answers will go. */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-6">
          {lastAsked ? (
            <div className="flex flex-col gap-3">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-foreground px-3.5 py-2.5 text-sm text-background">
                {lastAsked}
              </div>

              {answer ? (
                <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
                  {answer}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Thinking…</p>
              )}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Hi — I&apos;m {OWNER.firstName}&apos;s AI assistant. Ask about his
              experience, projects or skills and I&apos;ll answer out loud.
            </p>
          )}

          {/* Kept on screen after asking: without a conversation history there
              is nothing else to come back to, so these stay the way forward. */}
          <div className="flex flex-col items-start gap-2">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Try asking
            </p>
            {PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => askPrompt(prompt)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 border-t px-5 py-4 sm:px-6"
        >
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="relative">
            <Textarea
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={MAX_CHARS}
              rows={2}
              placeholder={`Ask me anything about ${OWNER.firstName}…`}
              aria-label={`Ask a question about ${OWNER.name}`}
              className="h-20 min-h-20 resize-none overflow-y-auto pr-12 field-sizing-fixed"
            />

            <Button
              type="submit"
              size="icon"
              disabled={!text.trim() || isLoading}
              aria-label="Send question"
              className="absolute right-2 bottom-2 size-8 rounded-full"
            >
              {isLoading ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <SendHorizontalIcon />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Select
              items={VOICES}
              value={voice}
              onValueChange={(next) => setVoice(next)}
            >
              <SelectTrigger
                aria-label="Voice"
                size="sm"
                className="h-8 w-auto min-w-0 max-w-44 text-xs text-muted-foreground"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="shrink-0 text-[11px] text-muted-foreground">
              Enter to send
            </p>
          </div>

          {/* Always mounted and hidden: the Web Audio graph binds to this node. */}
          <audio
            ref={audioRef}
            src={audioUrl ?? undefined}
            className="hidden"
          />
        </form>
      </aside>
    </div>
  );
}
