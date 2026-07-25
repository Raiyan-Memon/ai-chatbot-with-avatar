/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev-only: allow loading /_next assets when the app is opened over the LAN
  // IP or 127.0.0.1 instead of localhost, otherwise the client JS is blocked
  // and the page never hydrates.
  allowedDevOrigins: ["127.0.0.1", "192.168.1.11"],

  // Files in public/ are served no-cache by default because their names are not
  // content-hashed. The model never changes without also changing name, so it
  // is safe to cache hard — first visit pays, repeat visits are instant.
  async headers() {
    return [
      {
        source: "/avatar-optimized.glb",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/greeting.mp3",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
