"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import AltruistApp from "@/components/dashboard/AltruistApp";
import type { User } from "@supabase/supabase-js";

export default function DashboardPage() {
  const router   = useRouter();
  const supabase = createSupabaseClient();
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/auth/login"); return; }
      setUser(data.session.user);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/auth/login");
    });
    return () => listener.subscription.unsubscribe();
  }, [router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  if (loading || !user) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#080809", fontFamily:"DM Mono,monospace", color:"#35343d", fontSize:13, letterSpacing:"2px", textTransform:"uppercase" }}>
      Loading
    </div>
  );

  return <AltruistApp user={user} onSignOut={handleSignOut} />;
}