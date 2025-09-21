import React from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { canAll, canAny } from "../../auth/PermHelper.jsx";
function UsersManage() {
  const { me } = useAuth();
  const perms = me?.permissions ?? [];

  return (
    <div>
      <h1>Welcome to Users Management</h1>
    </div>
  );
}

export default UsersManage;
