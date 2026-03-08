import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api";
export default function LoginPage() {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const { login } = useAuth(); const navigate = useNavigate();
  const handleLogin = async (e) => { e.preventDefault(); setError(""); setLoading(true); try { const res = await api.post("/auth/login", { username, password }); login(res.data.token, res.data.username); navigate("/"); } catch (err) { setError(err.response?.data?.error || "Login failed."); } finally { setLoading(false); } };
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4" style={{ backgroundImage: "radial-gradient(ellipse at 30% 50%, rgba(255,122,10,0.06) 0%, transparent 60%)" }}>
      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8"><div className="text-5xl mb-4">🍩</div><h1 className="font-display text-3xl font-bold text-white tracking-tight">TULCE TRACKER</h1><p className="text-gray-500 text-sm mt-1">Mandazi debt management, sorted.</p></div>
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Username</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" required className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-tulce-500 text-sm" /></div>
            <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-tulce-500 text-sm" /></div>
            {error && <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-4 py-2.5 rounded-lg">{error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-tulce-500 hover:bg-tulce-400 disabled:bg-tulce-700 text-white font-display font-semibold py-2.5 rounded-lg text-sm">{loading ? "Logging in..." : "Login →"}</button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-600 mt-4">First time? Run the seed command in README.md</p>
      </div>
    </div>
  );
}
