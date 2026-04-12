import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from Supabase storage
  images: {
    domains: ["your-project-id.supabase.co"],
  },
};

export default nextConfig;
