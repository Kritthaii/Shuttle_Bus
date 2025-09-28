import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
const api = axios.create({
  baseURL: "http://localhost:5000",
  withCredentials: true,
});

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const response = await api.get("/api/me");
      setMe(response.data);
      console.log("me", response.data);
    } catch (error) {
      setMe(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const login = async (username, password) => {
    await api.post("/api/login", { username, password });
    await fetchMe();
  };

  const logout = async () => {
    await api.post("/api/logout");
    setMe(null);
  };
  return (
    <AuthContext.Provider value={{ me, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
