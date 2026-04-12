import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from Supabase storage
  images: {
    domains: ["xktgwkbllmsjmrbkxaow.supabase.co"],
  },
};

export default nextConfig;
