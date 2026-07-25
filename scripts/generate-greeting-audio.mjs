import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GREETING_TEXT } from "../src/lib/greeting.js";

function loadEnvKey() {
  const envKey = process.env.GOOGLE_TEXT_TO_SPEECH_API_KEY;
  if (envKey) return envKey;

  const scriptPath = fileURLToPath(import.meta.url);
  const root = path.dirname(path.dirname(scriptPath));
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return null;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^GOOGLE_TEXT_TO_SPEECH_API_KEY=(.*)$/);
    if (match) return match[1].trim();
  }
  return null;
}

const apiKey = loadEnvKey();
if (!apiKey) {
  console.error(
    "GOOGLE_TEXT_TO_SPEECH_API_KEY is not set in environment or .env.local.",
  );
  process.exit(1);
}

const SYNTHESIZE_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const voice = "en-US-Neural2-C";
const languageCode = voice.split("-").slice(0, 2).join("-");
const scriptPath = fileURLToPath(import.meta.url);
const output = path.join(
  path.dirname(scriptPath),
  "..",
  "public",
  "greeting.mp3",
);

const response = await fetch(`${SYNTHESIZE_URL}?key=${apiKey}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    input: { text: GREETING_TEXT },
    voice: { languageCode, name: voice },
    audioConfig: { audioEncoding: "MP3" },
  }),
});

if (!response.ok) {
  const details = await response.json().catch(() => null);
  console.error("Google TTS request failed", details);
  process.exit(1);
}

const data = await response.json();
const audioContent = data.audioContent;
if (!audioContent) {
  console.error("No audioContent returned from Google TTS.");
  process.exit(1);
}

const buffer = Buffer.from(audioContent, "base64");
fs.writeFileSync(output, buffer);
console.log(`Wrote ${output}`);
