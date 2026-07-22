import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg', '@ffmpeg-installer/win32-x64', '@ffmpeg-installer/linux-x64', '@ffmpeg-installer/darwin-x64', 'sql.js'],
  allowedDevOrigins: ['172.17.64.1'],
};

export default nextConfig;
