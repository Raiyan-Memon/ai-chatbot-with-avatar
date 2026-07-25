/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev-only: allow loading /_next assets when the app is opened over the LAN
  // IP or 127.0.0.1 instead of localhost, otherwise the client JS is blocked
  // and the page never hydrates.
  allowedDevOrigins: ["127.0.0.1", "192.168.1.11"],
};

export default nextConfig;
