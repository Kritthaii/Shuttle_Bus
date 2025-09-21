import { Link, NavLink, useLocation } from "react-router-dom";
import { NAV_ITEMS } from "../nav/navConfig.js";
import { canAll, canAny } from "../../auth/PermHelper.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";

export default function Navbar() {
  const { me } = useAuth();
  const { pathname } = useLocation();
  const perms = me?.permissions || [];
  const { logout } = useAuth();
  {
    console.log("me in Navbar", me);
  }
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.requireAll && !canAll(perms, ...item.requireAll)) return false;
    if (item.requireAny && !canAny(perms, ...item.requireAny)) return false;
    return true;
  });
  return (
    <aside>
      <div>
        <nav>
          <div className="bg-red-800 p-4 flex justify-center items-center">
            <h1 className="text-2xl font-bold text-white text-center">
              MUT
              <br />
              SHUTTLE
              <br />
              BUS
            </h1>
          </div>
          <hr />

          <NavLink
            to="/"
            style={({ isActive }) => ({
              display: "flex",
              gap: 8,
              padding: 8,
              backgroundColor: isActive ? "#ddd" : "transparent",
            })}
          >
            <span>🏠</span>
            <span>Home</span>
          </NavLink>
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path || "/notfound"}
              style={({ isActive }) => ({
                display: "flex",
                gap: 8,
                padding: 8,
                backgroundColor: isActive ? "#ddd" : "transparent",
              })}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          {visibleNavItems.length === 0 && (
            <div style={{ color: "#888" }}>ไม่มีเมนูสำหรับสิทธิ์ของคุณ5555</div>
          )}
        </nav>
        <div>
          <button
            type="button"
            onClick={logout}
            className="m-4 p-2 bg-red-800 text-white rounded hover:bg-red-700 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
