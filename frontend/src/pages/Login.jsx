import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
axios.defaults.withCredentials = true;

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="e items-center flex flex-col  border-2 border-gray-300 w-120 h-100 rounded shadow-lg bg-white">
        <div className="mb-4 text-center bg-red-800 w-full p-4 text-white rounded">
          <h1 className="text-2xl font-bold text-white text-center">
            {" "}
            MUT
            <br />
            SHUTTLE
            <br />
            BUS
          </h1>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-center">Login</h1>
        </div>
        {error && (
          <p className="error" style={{ color: "red" }}>
            {error}
          </p>
        )}
        <div className="pt-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 ">
            <div className="">
              <label htmlFor="username">username:</label>
              <input
                type="text"
                id="username"
                name="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                }}
                required
                className="border border-black bg-gray-200 rounded-l p-0.5"
              />
            </div>
            <div>
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                required
                className="border border-black bg-gray-200 rounded-l p-0.5"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-red-800 text-white p-2 rounded hover:bg-red-700 cursor-pointer"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
