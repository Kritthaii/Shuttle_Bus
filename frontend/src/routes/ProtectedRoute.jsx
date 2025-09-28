import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { canAll, canAny } from "../auth/PermHelper.jsx";

export default function ProtectedRoute({ needAll = [], needAny = [] }) {
  const { me, loading } = useAuth();
  const perms = me?.permissions || [];
  console.log("permission in protected ROute", perms);
  if (loading) return <div>Loading...</div>;
  if (!me) {
    return <Navigate to={"/login"} replace />;
  }
  if (needAll.length && !canAll(perms, ...needAll)) {
    return <Navigate to={"/unauthorized"} replace />;
  }
  if (needAny.length && !canAny(perms, ...needAny)) {
    return <Navigate to={"/unauthorized"} replace />;
  }

  return <Outlet />;
}
