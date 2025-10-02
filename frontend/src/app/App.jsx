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
import MyBooking from "../pages/user/MyBooking.jsx";
import PositionPermissionManage from "../pages/admin/PositionPermissionManage";
import PositionManage from "../pages/admin/PositionManage";
import UsersManage from "../pages/admin/UsersManage.jsx";
import DriverDashboard from "../pages/driver/DriverDashboard.jsx";
import DriverManifest from "../pages/driver/DriverManifest.jsx";
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
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route element={<ProtectedRoute needAll={["CanReservation"]} />}>
              {/* user only */}
              <Route element={<MainLayout />}>
                <Route path="/bookings" element={<Booking />} />
              </Route>

              <Route element={<MainLayout />}>
                <Route path="/mybookings" element={<MyBooking />} />
              </Route>
            </Route>
          </Route>

          <Route
            element={<ProtectedRoute needAll={["CanViewAdminDashboard"]} />}
          >
            <Route element={<MainLayout />}>
              <Route path="/admindashboard" element={<AdminDashboard />} />
            </Route>
          </Route>
          <Route
            element={
              <ProtectedRoute needAll={["CanManagePositionPermissions"]} />
            }
          >
            <Route element={<MainLayout />}>
              <Route
                path="/position-permission-manage"
                element={<PositionPermissionManage />}
              />
            </Route>
          </Route>
          <Route
            element={
              <ProtectedRoute needAll={["CanManagePositionPermissions"]} />
            }
          >
            <Route element={<MainLayout />}>
              <Route path="/position-manage" element={<PositionManage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute needAll={["DriverPermission"]} />}>
            <Route element={<MainLayout />}>
              <Route path="/driver-dashboard" element={<DriverDashboard />} />
            </Route>
            <Route element={<MainLayout />}>
              <Route path="/driver/job" element={<DriverManifest />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute needAll={["CanManageEmployee"]} />}>
            <Route element={<MainLayout />}>
              <Route path="/employees" element={<UsersManage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
