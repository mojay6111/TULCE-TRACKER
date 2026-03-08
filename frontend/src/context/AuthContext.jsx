import { createContext, useContext, useState } from "react";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("tulce_token"));
  const [username, setUsername] = useState(() => localStorage.getItem("tulce_user"));
  const login = (tok, user) => { localStorage.setItem("tulce_token", tok); localStorage.setItem("tulce_user", user); setToken(tok); setUsername(user); };
  const logout = () => { localStorage.removeItem("tulce_token"); localStorage.removeItem("tulce_user"); setToken(null); setUsername(null); };
  return <AuthContext.Provider value={{ token, username, login, logout, isLoggedIn: !!token }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
