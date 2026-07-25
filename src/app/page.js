"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon, Volume2Icon } from "lucide-react";

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
  const audioRef = useRef(null);

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
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      handleSubmit(event);
    }
  }

  // A grid with an explicit 1fr row, not flex: the stage needs a definite
  // height for R3F to measure, and flex-basis alone leaves it short.
  return (
    <div className="grid h-dvh grid-cols-1 grid-rows-[1fr_auto] overflow-hidden">
      {/* Stage: everything left over after the controls claim their height. */}
      <div className="relative min-h-0 overflow-hidden bg-linear-to-b from-muted/20 to-muted/60">
        <Avatar analyser={analyser} className="absolute inset-0" />

        <div className="pointer-events-none absolute top-5 left-6">
          <p className="text-sm font-medium text-foreground/80">AI Avatar</p>
          <p className="text-xs text-muted-foreground">by Raiyan Memon</p>
        </div>
      </div>

      <div className="border-t bg-card/90 backdrop-blur-sm">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-6 py-5"
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
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={MAX_CHARS}
              rows={2}
              placeholder="Type something for your avatar to say…"
              aria-label="Text to speak"
              className="h-24 min-h-24 resize-none overflow-y-auto pb-7 field-sizing-fixed"
            />
            <span className="pointer-events-none absolute right-3 bottom-2 text-xs tabular-nums text-muted-foreground">
              {text.length} / {MAX_CHARS}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Select
              items={VOICES}
              value={voice}
              onValueChange={(next) => setVoice(next)}
            >
              {/* min-w-0 and w-auto beat the component's own w-fit, which
                  otherwise stops the row shrinking on narrow screens. */}
              <SelectTrigger
                aria-label="Voice"
                className="h-9 w-auto min-w-0 flex-1"
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

            <Button
              type="submit"
              size="lg"
              disabled={!text.trim() || isLoading}
              className="px-6"
            >
              {isLoading ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  Generating
                </>
              ) : (
                <>
                  <Volume2Icon />
                  Speak
                </>
              )}
            </Button>
          </div>

          {/* Always mounted and hidden: the Web Audio graph binds to this node. */}
          <audio
            ref={audioRef}
            src={audioUrl ?? undefined}
            className="hidden"
          />
        </form>
      </div>
    </div>
  );
}
