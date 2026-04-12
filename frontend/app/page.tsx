"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/dashboard");
      } else {
        router.replace("/auth/login");
      }
    });
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#080809",
      fontFamily: "DM Mono, monospace", color: "#35343d",
      fontSize: 13, letterSpacing: "2px", textTransform: "uppercase",
    }}>
      Loading
    </div>
  );
}
