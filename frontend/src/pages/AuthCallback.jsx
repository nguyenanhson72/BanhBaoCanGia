import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const sessionId = params.get("session_id");

    if (!sessionId) {
      navigate("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        const { data } = await api.post(
          "/auth/session",
          {},
          { headers: { "X-Session-ID": sessionId } }
        );
        setUser(data);
        navigate("/dashboard", { replace: true, state: { user: data } });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream/30">
      <div className="w-14 h-14 rounded-xl bg-bamboo flex items-center justify-center text-white mb-4 animate-pulse">
        <Sparkles size={26} />
      </div>
      <p className="text-sm text-ink-secondary">Đang xác thực...</p>
    </div>
  );
}
