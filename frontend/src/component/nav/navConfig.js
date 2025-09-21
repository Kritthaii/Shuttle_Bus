// src/nav/navConfig.js
export const NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Admin-Dashboard",
    path: "/admindashboard",
    icon: "🏠",
    requireAll: ["CanViewAdminDashboard"],
  },
  {
    key: "userDashboard",
    label: "Dashboard",
    path: "/userdashboard",
    icon: "📝",
    requireAll: ["CanReservation"],
  },
  {
    key: "emp",
    label: "จัดการพนักงาน",
    // path: "/employees",
    icon: "🧑‍💼",
    requireAll: ["CanManageEmployee"],
  },
  {
    key: "drv",
    label: "จัดการคนขับ",
    // path: "/drivers",
    icon: "🚖",
    requireAll: ["CanManageDriver"],
  },
  {
    key: "routes",
    label: "จัดการเส้นทาง",
    // path: "/routes",
    icon: "🗺️",
    requireAny: ["CanManageRoutes", "CanViewReports"],
  },
  {
    key: "report",
    label: "รายงาน",
    // path: "/reports",
    icon: "📊",
    requireAll: ["CanViewReports"],
  },
  {
    key: "perms",
    label: "สิทธิ์การใช้งาน",
    // path: "/permissions",
    icon: "🔐",
    requireAll: ["CanManagePermissions"],
  },
  {
    key: "booking",
    label: "การจอง",
    path: "/bookings",
    icon: "📝",
    requireAll: ["CanReservation"],
  },
];
