import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../component/nav/Navbar.jsx";
function MainLayout() {
  return (
    <div className="flex min-h-screen grid-cols-[16rem_1fr] bg-gray-100">
      <Navbar />
      <main className="flex-1 h-screen bg-gray-100 p-4 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default MainLayout;
