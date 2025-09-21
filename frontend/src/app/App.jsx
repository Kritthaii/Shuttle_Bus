import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthProvider from "../auth/AuthContext";
import ProtectedRoute from "../routes/ProtectedRoute";
import MainLayout from "../layouts/MainLayout";
import Login from "../pages/Login";
import AdminDashboard from "../pages/admin/AdminDashboard";
import Home from "../pages/Home";
import Unauthorized from "../pages/Unauthorized";
import NotFound from "../pages/NotFound";
import Booking from "../pages/user/Booking";
import UserDashboard from "../pages/user/UserDashboard";
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* public */}
          <Route path="/login" element={<Login />} />

          {/* ต้องล็อกอินก่อนถึงเห็น layout + sidebar */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />
            </Route>

            {/* admin only */}
            <Route element={<MainLayout />}>
              <Route path="/admindashboard" element={<AdminDashboard />} />
            </Route>
            <Route element={<MainLayout />}>
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* user only */}
            <Route element={<MainLayout />}>
              <Route path="/bookings" element={<Booking />} />
            </Route>
            <Route element={<MainLayout />}>
              <Route path="/userdashboard" element={<UserDashboard />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
