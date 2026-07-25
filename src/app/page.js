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
  initials: "RM",
  role: "Software Engineer",
};

// The single clearest signal of what a visitor is allowed to ask. Written as a
// recruiter would phrase it, not as a feature list.
const PROMPTS = [
  "What's your background?",
  "What tech do you work with?",
  "Tell me about a recent project",
  "What are you looking for next?",
  "How can I reach you?",
];

const VOICES = [
  { value: "en-US-Chirp3-HD-Aoede", label: "Aoede — warm female" },
  { value: "en-US-Chirp3-HD-Puck", label: "Puck — bright male" },
  { value: "en-US-Chirp3-HD-Charon", label: "Charon — deep male" },
  { value: "en-US-Chirp3-HD-Kore", label: "Kore — crisp female" },
  { value: "en-US-Neural2-F", label: "Neural2 F — female" },
  { value: "en-US-Neural2-D", label: "Neural2 D — male" },
];

const MAX_CHARS = 5000;

export default function Home() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(VOICES[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [hasAsked, setHasAsked] = useState(false);
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
    setHasAsked(true);

    // The AudioContext starts suspended; this click is the gesture that frees it.
    await resume();

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, voice }),
      });

      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.error ?? "Could not generate the audio");
      }

      setAudioUrl(URL.createObjectURL(await response.blob()));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(event) {
    // Enter sends, Shift+Enter makes a new line — the convention every chat
    // interface uses, so visitors do not have to be told.
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
    <div className="grid h-dvh min-w-0 grid-cols-1 grid-rows-[1fr_auto] overflow-hidden">
      <div className="relative min-h-0 overflow-hidden bg-linear-to-b from-muted/20 to-muted/60">
        <Avatar analyser={analyser} className="absolute inset-0" />

        {/* Identity, over a scrim so it stays legible against the avatar. */}
        <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-linear-to-b from-background/95 via-background/70 to-transparent px-5 pt-4 pb-10 sm:px-8 sm:pt-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
            {OWNER.initials}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold text-foreground">
                {OWNER.name}
              </h1>
              <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                AI
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {OWNER.role} · ask me anything about my work
            </p>
          </div>
        </header>

        {/* Greeting, retired once the visitor has actually asked something. */}
        {!hasAsked && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-background/95 via-background/70 to-transparent px-6 pt-12 pb-5 text-center">
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
              Hi — I&apos;m {OWNER.name.split(" ")[0]}&apos;s AI assistant. Ask
              about my experience, projects or skills and I&apos;ll answer out
              loud.
            </p>
          </div>
        )}
      </div>

      <div className="border-t bg-card/90 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-2xl px-4 pt-3 pb-4 sm:px-6 sm:pb-5">
          {/* Scrolls sideways rather than wrapping, so the row height is
              predictable and the stage above never reflows. */}
          <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => askPrompt(prompt)}
                className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
                placeholder={`Ask me anything about ${OWNER.name.split(" ")[0]}…`}
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
                  className="h-8 w-auto min-w-0 max-w-52 text-xs text-muted-foreground"
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
                Press Enter to send
              </p>
            </div>

            {/* Always mounted and hidden: the Web Audio graph binds to this node. */}
            <audio ref={audioRef} src={audioUrl ?? undefined} className="hidden" />
          </form>
        </div>
      </div>
    </div>
  );
}
