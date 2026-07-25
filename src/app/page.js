"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon, SendHorizontalIcon, Volume2Icon } from "lucide-react";

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
import { GREETING_AUDIO, GREETING_TEXT, PRIVACY_TEXT } from "@/lib/greeting";

const OWNER = {
  name: "Raiyan Memon",
  firstName: "Raiyan",
  initials: "RM",
  role: "Full Stack Developer & Team Lead",
};

// The assistant is deliberately a separate persona, not Raiyan himself: the
// avatar is not his likeness, so having it claim to be him reads as a mismatch.
// Her name stays out of the header — the page is selling Raiyan, not her.
const ASSISTANT = "Zaira";

// The clearest signal of what a visitor may ask. Phrased the way a recruiter
// would say it, not as a feature list.
const PROMPTS = [
  "What's Raiyan's background?",
  "What tech does he work with?",
  "Tell me about a recent project",
  "What is he looking for next?",
  "How can I reach him?",
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
  const [avatarReady, setAvatarReady] = useState(false);
  const [greetingBlocked, setGreetingBlocked] = useState(false);
  // True only once sound has genuinely been confirmed audible — not merely
  // attempted — so the CTA doesn't declare success during a still-muted
  // autoplay probe.
  const [greetingHeard, setGreetingHeard] = useState(false);
  const [greetingAttempted, setGreetingAttempted] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [greetingPlaying, setGreetingPlaying] = useState(false);
  // Lazy initializer, not a bare value: this component's first render happens
  // on the server, where navigator doesn't exist at all.
  const [isOnline, setIsOnline] = useState(
    () =>
      // typeof navigator === "undefined" ? true : navigator.onLine,
      true,
  );
  const audioRef = useRef(null);
  const greetingAudioRef = useRef(null);
  const speechBlobUrlRef = useRef(null);
  const inputRef = useRef(null);

  function resetPage() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (greetingAudioRef.current) {
      greetingAudioRef.current.pause();
      greetingAudioRef.current.currentTime = 0;
    }

    if (speechBlobUrlRef.current) {
      URL.revokeObjectURL(speechBlobUrlRef.current);
      speechBlobUrlRef.current = null;
    }

    setText("");
    setIsLoading(false);
    setError(null);
    setAudioUrl(null);
    setLastAsked(null);
    setAnswer(null);
    setGreetingBlocked(false);
    setGreetingHeard(false);
    setGreetingAttempted(false);
    setInteracted(false);
  }

  const { analyser, resume } = useAudioAnalyser(audioRef);
  // A second, independent tap: the hook keys its graph off the element itself,
  // so the greeting audio gets its own analyser rather than sharing the one
  // wired to the response <audio> element above.
  const { analyser: greetingAnalyser, resume: resumeGreeting } =
    useAudioAnalyser(greetingAudioRef);

  // Whichever is actually making sound drives the mouth. Only one of the two
  // ever plays at once — starting a response pauses the greeting.
  const activeAnalyser = greetingPlaying ? greetingAnalyser : analyser;

  // Release the previous blob when a new one replaces it, and on unmount.
  useEffect(() => {
    return () => {
      if (speechBlobUrlRef.current)
        URL.revokeObjectURL(speechBlobUrlRef.current);
    };
  }, []);

  // navigator.onLine only reflects the network interface (Wi-Fi/ethernet up
  // or down) — it can't confirm the internet itself is reachable, since no
  // browser API does that. It still catches the common real cases: Wi-Fi
  // switched off, airplane mode, a dropped connection.
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!avatarReady || interacted || greetingAttempted) return;

    const audio = greetingAudioRef.current;
    if (!audio) return;

    const timer = window.setTimeout(() => {
      audio.muted = true;
      audio.currentTime = 0;

      // Best-effort: without a real user gesture this typically stays
      // suspended, which is exactly why analyser data (and so lip-sync) reads
      // as silence until the visitor actually interacts.
      resumeGreeting();

      audio
        .play()
        .then(() => {
          audio.muted = false;
          setGreetingBlocked(false);
          setGreetingHeard(true);
        })
        .catch(() => setGreetingBlocked(true))
        .finally(() => setGreetingAttempted(true));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [avatarReady, interacted, greetingAttempted, resumeGreeting]);

  useEffect(() => {
    if (!audioUrl) return;

    const audio = audioRef.current;
    if (!audio) return;

    audio.play().catch(() => {
      // This is the response audio; if playback fails it should not
      // affect the greeting blocked UI.
    });
  }, [audioUrl]);

  useEffect(() => {
    if (!avatarReady || interacted || !greetingBlocked) return;

    const audio = greetingAudioRef.current;
    if (!audio) return;

    const retry = () => {
      if (interacted) return;

      audio.muted = true;
      audio.currentTime = 0;
      resumeGreeting();

      audio
        .play()
        .then(() => {
          audio.muted = false;
          setGreetingBlocked(false);
          setGreetingHeard(true);
        })
        .catch(() => {
          setGreetingAttempted(true);
        });
    };

    const handleFocus = () => retry();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") retry();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [avatarReady, interacted, greetingBlocked, resumeGreeting]);

  async function handleSubmit(event) {
    event.preventDefault();

    const value = text.trim();
    if (!value || isLoading) return;

    // Caught before spending a request (and a slice of the rate limit) on
    // something guaranteed to fail. Nothing else changes — the question stays
    // in the box exactly as typed, ready to resend once back online.
    if (!isOnline) {
      setError(
        "I can't reach the internet from here, so I can't hear you right now — check your connection and send that again.",
      );
      return;
    }

    setInteracted(true);
    if (greetingAudioRef.current) {
      greetingAudioRef.current.pause();
      greetingAudioRef.current.currentTime = 0;
    }
    setIsLoading(true);
    setError(null);
    setLastAsked(value);
    setAnswer(null);
    setText("");

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

      const blob = await speech.blob();
      if (speechBlobUrlRef.current) {
        URL.revokeObjectURL(speechBlobUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(blob);
      speechBlobUrlRef.current = objectUrl;
      setAudioUrl(objectUrl);
    } catch (err) {
      // fetch() itself throws a TypeError for a network failure (dropped
      // Wi-Fi, DNS gone, etc.) — distinct from the Error instances thrown
      // above carrying a real server message, so this can't misfire on those.
      const networkLost = err instanceof TypeError;

      setError(
        networkLost
          ? "I lost the connection partway through — check you're online and send that again."
          : err.message,
      );
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
    setInteracted(true);
    if (greetingAudioRef.current) {
      greetingAudioRef.current.pause();
      greetingAudioRef.current.currentTime = 0;
    }
    setText(prompt);
    inputRef.current?.focus();
  }

  async function playGreeting() {
    const audio = greetingAudioRef.current;
    if (!audio) return;

    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }

    // A real click, so this is the one path guaranteed to unlock both the
    // element and the analyser's AudioContext behind it.
    await resumeGreeting();

    // The failed auto-attempt below leaves the element muted forever — it
    // only unmutes on success, never on the (normal, expected) rejection —
    // so without this, a genuine click plays silently: the play event still
    // fires and the avatar still reacts, but no sound reaches the speakers.
    audio.muted = false;
    audio.currentTime = 0;
    audio
      .play()
      .then(() => {
        setGreetingBlocked(false);
        setGreetingHeard(true);
      })
      .catch(() => setGreetingBlocked(true));
  }

  return (
    // Split rather than stacked: overlaying a header and greeting on the avatar
    // ate the stage from both ends. Side by side on desktop, avatar over panel
    // on phones.
    <div className="grid h-dvh min-w-0 grid-rows-[38vh_1fr] overflow-hidden lg:grid-cols-[1fr_27rem] lg:grid-rows-1">
      <div className="relative min-h-0 min-w-0 overflow-hidden bg-linear-to-b from-muted/30 to-muted/70">
        <Avatar
          analyser={activeAnalyser}
          thinking={isLoading}
          greeting={greetingPlaying}
          name={ASSISTANT}
          onReady={() => setAvatarReady(true)}
          className="absolute inset-0"
        />
      </div>

      <aside className="flex min-h-0 min-w-0 flex-col border-t bg-card lg:border-t-0 lg:border-l">
        <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
              {OWNER.initials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold">
                  {OWNER.name}
                </h1>
                <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  AI
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {OWNER.role}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Kept small and permanent once sound is confirmed working — the
                big CTA below only needs to exist until that first listen. */}
            {greetingHeard && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={playGreeting}
                title="Replay Zaira's introduction"
                aria-label="Replay Zaira's introduction"
                className="size-8"
              >
                <Volume2Icon className="size-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetPage}
            >
              Reset
            </Button>
          </div>
        </header>

        {/* Proactive, not just a reaction to a failed send — this appears the
            moment the network interface goes down, in Zaira's own voice like
            every other message here. */}
        {!isOnline && (
          <p
            role="status"
            className="border-b bg-destructive/10 px-4 py-2 text-center text-xs text-destructive sm:px-6"
          >
            I&apos;ve lost your internet connection, so I can&apos;t hear or
            answer anything right now.
          </p>
        )}

        {/* Scrolls independently. This is where answers will go. */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
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
              Hi, I&apos;m {ASSISTANT} — {OWNER.firstName}&apos;s AI assistant.
              Ask me about his experience, projects or skills and I&apos;ll
              answer out loud.
            </p>
          )}

          {/* Kept on screen after asking: without a conversation history there
              is nothing else to come back to, so these stay the way forward. */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Try asking
            </p>

            {/* Wrapped rather than stacked — five chips in a column was the
                single biggest waste of height on a phone. */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
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

            {/* Most first-time visitors will land here: browsers block
                autoplay-with-sound almost universally, so for many people this
                click is the only way they ever hear Zaira at all — styled as
                the primary thing it actually is, not a minor fallback link.
                Collapses for good the moment sound is confirmed audible. */}
            {!interacted && !greetingHeard && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-3.5 text-sm">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/10">
                    <Volume2Icon className="size-4 text-foreground/70" />
                  </span>
                  <p className="pt-1 leading-snug text-muted-foreground">
                    {GREETING_TEXT}
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={playGreeting}
                  size="sm"
                  className="w-full"
                >
                  {greetingPlaying ? (
                    <>
                      <Volume2Icon className="animate-pulse" />
                      Playing…
                    </>
                  ) : greetingBlocked ? (
                    "Tap to hear Zaira"
                  ) : (
                    "Play greeting"
                  )}
                </Button>

                {greetingBlocked && (
                  <p className="text-xs text-muted-foreground">
                    Your browser blocks sound until you interact with the page —
                    that&apos;s normal, not a bug. Tap the button above to hear
                    her.
                  </p>
                )}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">{PRIVACY_TEXT}</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 border-t px-4 py-3 sm:gap-3 sm:px-6 sm:py-4"
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
              placeholder={`Ask ${ASSISTANT} about ${OWNER.firstName}…`}
              aria-label={`Ask a question about ${OWNER.name}`}
              className="h-16 min-h-16 resize-none overflow-y-auto pr-12 field-sizing-fixed sm:h-20 sm:min-h-20"
            />

            <Button
              type="submit"
              size="icon"
              disabled={!text.trim() || isLoading || !isOnline}
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

          {/* The whole row disappears while one voice is enabled — a dropdown
              with a single choice is clutter. Uncomment entries in VOICES and
              it comes back on its own. */}
          {VOICES.length > 1 && (
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
          )}

          {/* Always mounted and hidden: the Web Audio graph binds to this node. */}
          <audio
            ref={audioRef}
            src={audioUrl ?? undefined}
            playsInline
            className="hidden"
          />
          <audio
            ref={greetingAudioRef}
            src={GREETING_AUDIO}
            preload="auto"
            // The real signal for whether the greeting is audible right now —
            // more trustworthy than inferring it from play()'s resolved
            // promise, which can resolve for a muted, silent attempt too.
            onPlay={() => setGreetingPlaying(true)}
            onPause={() => setGreetingPlaying(false)}
            onEnded={() => setGreetingPlaying(false)}
            className="hidden"
          />
        </form>
      </aside>
    </div>
  );
}
