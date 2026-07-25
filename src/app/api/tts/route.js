import { clientIp, rateLimit } from "@/lib/rate-limit";

const SYNTHESIZE_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

// Google rejects input longer than 5000 bytes.
const MAX_CHARS = 5000;

// Same window as /api/chat: normally one TTS call follows one chat call, but
// this route is reachable on its own, so it needs its own guard against being
// hit directly and running up the Google Cloud bill.
const RATE_LIMIT = { limit: 20, windowMs: 15 * 60 * 1000 };

export async function POST(request) {
  const { allowed, retryAfterSeconds } = rateLimit(
    `tts:${clientIp(request)}`,
    RATE_LIMIT,
  );

  if (!allowed) {
    return Response.json(
      { error: "Too many requests — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const apiKey = process.env.GOOGLE_TEXT_TO_SPEECH_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "GOOGLE_TEXT_TO_SPEECH_API_KEY is not set in .env.local" },
      { status: 500 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  const voice = body.voice ?? "en-US-Chirp3-HD-Aoede";

  if (!text) {
    return Response.json({ error: "Nothing to say — add some text first" }, { status: 400 });
  }

  if (text.length > MAX_CHARS) {
    return Response.json(
      { error: `Text is ${text.length} characters, the limit is ${MAX_CHARS}` },
      { status: 400 },
    );
  }

  // "en-US-Chirp3-HD-Aoede" -> "en-US"
  const languageCode = voice.split("-").slice(0, 2).join("-");

  const response = await fetch(`${SYNTHESIZE_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode, name: voice },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });

  if (!response.ok) {
    const details = await response.json().catch(() => null);
    return Response.json(
      { error: details?.error?.message ?? "Google rejected the request" },
      { status: response.status },
    );
  }

  const { audioContent } = await response.json();

  return new Response(Buffer.from(audioContent, "base64"), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
