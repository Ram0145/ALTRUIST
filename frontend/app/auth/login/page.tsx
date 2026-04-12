"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";

const C = {
  bg: "#080809", s0: "#0c0c0f", s1: "#101014", s2: "#161619",
  border: "#1c1c22", borderHi: "#28282f",
  text: "#e2ddd6", t2: "#6a6978", t3: "#35343d",
  gold: "#b87c2e", goldDim: "rgba(184,124,46,0.10)",
  green: "#2d8056", red: "#8a3530",
};

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

export default function LoginPage() {
  const router   = useRouter();
  const supabase = createSupabaseClient();

  const [mode,     setMode]     = useState<"login" | "signup">("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error,    setError]    = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) return setError("Please fill in all fields.");
    if (mode === "signup" && !name.trim())  return setError("Please enter your name.");
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
      }
      router.replace("/dashboard");
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    setGLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: C.s2, border: `1px solid ${C.border}`,
    borderRadius: 7, color: C.text, fontFamily: "DM Sans, sans-serif",
    fontSize: 14, padding: "11px 14px", outline: "none",
    transition: "border-color .15s",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "stretch" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }
        .fu { animation: fadeUp .45s ease both; }
        .d1{animation-delay:.05s} .d2{animation-delay:.12s} .d3{animation-delay:.19s}
        .d4{animation-delay:.26s} .d5{animation-delay:.33s}
        .inp:focus { border-color: ${C.gold} !important; }
        .inp::placeholder { color: ${C.t3}; }
        @media(max-width:720px) { .left { display: none !important; } }
      `}</style>

      {/* LEFT — brand */}
      <div className="left" style={{
        flex: "0 0 52%", position: "relative", overflow: "hidden",
        borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "48px 52px",
      }}>
        {/* Grid lines */}
        {[120,240,360,480].map(x => <div key={x} style={{position:"absolute",left:x,top:0,width:1,height:"100%",background:C.border,opacity:.5}}/>)}
        {[140,280,420].map(y => <div key={y} style={{position:"absolute",top:y,left:0,height:1,width:"100%",background:C.border,opacity:.5}}/>)}

        {/* Ambient glow */}
        <div style={{position:"absolute",top:-120,right:-80,width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle, rgba(184,124,46,0.06) 0%, transparent 70%)",pointerEvents:"none"}}/>

        <div style={{fontFamily:"Syne,sans-serif",fontSize:22,fontWeight:800,letterSpacing:"2px",textTransform:"uppercase"}}>
          ALTRU<span style={{color:C.gold}}>IST</span>
        </div>

        <div>
          <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:"clamp(48px,5.5vw,76px)",lineHeight:1.05,color:C.text,marginBottom:24,letterSpacing:"-2px"}}>
            Build<br/>better<br/><span style={{color:C.gold}}>habits.</span>
          </div>
          <div style={{fontFamily:"Lora,serif",fontStyle:"italic",fontSize:15,color:C.t2,marginBottom:36}}>
            track what matters. show up every day.
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {["Daily log","Habit tracking","Planner","Weekly stats","AI coach (soon)"].map(f => (
              <div key={f} style={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:4,padding:"5px 12px",fontSize:11,color:C.t2,letterSpacing:".5px"}}>{f}</div>
            ))}
          </div>
        </div>

        <div style={{fontSize:11,color:C.t3}}>© 2025 ALTRUIST · Your data stays yours</div>
      </div>

      {/* RIGHT — form */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 24px"}}>
        <div style={{width:"100%",maxWidth:380}}>

          <div className="fu d1" style={{marginBottom:32}}>
            <div style={{fontFamily:"Syne,sans-serif",fontSize:20,fontWeight:700,marginBottom:6}}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </div>
            <div style={{fontSize:13,color:C.t2}}>
              {mode === "login" ? "Sign in to continue your streak." : "Start tracking. Build something real."}
            </div>
          </div>

          {/* Google */}
          <div className="fu d2" style={{marginBottom:20}}>
            <button onClick={handleGoogle} disabled={gLoading} style={{
              width:"100%",background:C.s2,border:`1px solid ${C.border}`,color:C.text,
              fontFamily:"DM Sans,sans-serif",fontSize:14,fontWeight:500,padding:"11px",
              borderRadius:7,cursor:"pointer",display:"flex",alignItems:"center",
              justifyContent:"center",gap:10,transition:"all .18s",opacity:gLoading?.6:1,
            }}>
              {gLoading ? <span style={{color:C.t2,fontSize:13}}>Redirecting…</span>
                : <><GoogleIcon/><span>Continue with Google</span></>}
            </button>
          </div>

          {/* Divider */}
          <div className="fu d3" style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <div style={{flex:1,height:1,background:C.border}}/>
            <span style={{fontSize:11,color:C.t3,letterSpacing:"1px"}}>or</span>
            <div style={{flex:1,height:1,background:C.border}}/>
          </div>

          {/* Fields */}
          <div className="fu d4" style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
            {mode === "signup" && (
              <div>
                <div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:7}}>Full name</div>
                <input className="inp" type="text" value={name}
                  onChange={e => { setName(e.target.value); setError(""); }}
                  placeholder="Your name" style={inputStyle}/>
              </div>
            )}
            <div>
              <div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:7}}>Email</div>
              <input className="inp" type="email" value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                placeholder="you@email.com" style={inputStyle}/>
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                <div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px"}}>Password</div>
                {mode === "login" && (
                  <button onClick={async () => {
                    if (!email) return setError("Enter your email first.");
                    await supabase.auth.resetPasswordForEmail(email);
                    setError("Reset link sent — check your inbox.");
                  }} style={{background:"none",border:"none",color:C.gold,fontSize:11,cursor:"pointer"}}>
                    Forgot password?
                  </button>
                )}
              </div>
              <div style={{position:"relative"}}>
                <input className="inp" type={showPass?"text":"password"} value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder={mode === "signup" ? "Min. 8 characters" : "••••••••"}
                  style={{...inputStyle,paddingRight:50}}/>
                <button onClick={() => setShowPass(v => !v)} style={{
                  position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                  background:"none",border:"none",color:C.t3,cursor:"pointer",fontSize:11,letterSpacing:".5px",
                }}>
                  {showPass ? "hide" : "show"}
                </button>
              </div>
            </div>

            {error && (
              <div style={{fontSize:12,color:"#c97070",background:"rgba(138,53,48,.1)",border:"1px solid rgba(138,53,48,.3)",borderRadius:6,padding:"8px 12px"}}>
                {error}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="fu d5" style={{marginBottom:20}}>
            <button onClick={handleSubmit} disabled={loading} style={{
              width:"100%",background:C.gold,border:"none",color:C.bg,
              fontFamily:"DM Sans,sans-serif",fontSize:14,fontWeight:600,
              padding:"13px",borderRadius:7,cursor:loading?"default":"pointer",
              letterSpacing:".4px",transition:"all .18s",opacity:loading?.7:1,
            }}>
              {loading
                ? (mode==="login" ? "Signing in…" : "Creating account…")
                : (mode==="login" ? "Sign in" : "Create account")
              }
            </button>
          </div>

          <div style={{textAlign:"center",fontSize:13,color:C.t2}}>
            {mode === "login"
              ? <>Don't have an account?{" "}<button onClick={() => { setMode("signup"); setError(""); }} style={{background:"none",border:"none",color:C.gold,cursor:"pointer",fontSize:13}}>Sign up</button></>
              : <>Already have an account?{" "}<button onClick={() => { setMode("login"); setError(""); }} style={{background:"none",border:"none",color:C.gold,cursor:"pointer",fontSize:13}}>Sign in</button></>
            }
          </div>

          {mode === "signup" && (
            <div style={{marginTop:20,textAlign:"center",fontSize:11,color:C.t3,lineHeight:1.7}}>
              By signing up you agree to our{" "}
              <span style={{color:C.t2,cursor:"pointer"}}>Terms</span> and{" "}
              <span style={{color:C.t2,cursor:"pointer"}}>Privacy Policy</span>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
