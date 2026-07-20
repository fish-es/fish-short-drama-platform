import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg', '@ffmpeg-installer/win32-x64', '@ffmpeg-installer/linux-x64', '@ffmpeg-installer/darwin-x64', 'sql.js'],
};

export default nextConfig;
