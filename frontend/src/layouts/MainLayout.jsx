import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../component/nav/Navbar.jsx";
function MainLayout() {
  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 h-screen bg-gray-100 p-4">
        <Outlet />
      </main>
    </div>
  );
}

export default MainLayout;
