import React, { useState, useEffect } from "react";
import api from "../../services/api";

function PositionPermissionManage() {
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [positionPerms, setPositionPerms] = useState({}); // เก็บ { posId: Set([...]) }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ps, perms] = await Promise.all([
          api.get("/positions"),
          api.get("/permissions"),
        ]);
        setPositions(ps.data);
        setPermissions(perms.data);

        // โหลดสิทธิ์ทั้งหมดของทุกตำแหน่ง
        const permsByPos = {};
        for (let pos of ps.data) {
          const res = await api.get(`/positions/${pos.POSITIONID}/permissions`);
          permsByPos[pos.POSITIONID] = new Set(
            res.data.map((p) => p.PERMISSIONID)
          );
        }
        console.log("Position Permissions:", permsByPos);
        setPositionPerms(permsByPos);
      } catch (error) {
        console.error("Error fetching permissions:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (posId, permId) => {
    setPositionPerms((prev) => {
      const next = { ...prev };
      const set = new Set(next[posId] || []);
      if (set.has(permId)) set.delete(permId);
      else set.add(permId);
      next[posId] = set;
      return next;
    });
  };

  const onSave = async () => {
    try {
      for (let posId of Object.keys(positionPerms)) {
        const permissionIds = Array.from(positionPerms[posId]);
        await api.put(`/positions/${posId}/permissions`, { permissionIds });
      }
      alert("บันทึกสิทธิ์เรียบร้อย");
    } catch (error) {
      console.error("Error saving permissions:", error);
      alert("บันทึกสิทธิ์ไม่สำเร็จ");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>การจัดการสิทธิ์ของตำแหน่ง</h1>
      <div className="p-4 bg-white shadow w-full  border border-gray-600 ">
        <p>จัดการสิทธิ์การเข้าถึงระบบ</p>
        <div className="overflow-x-auto w-full h-96  ">
          <table className="table-auto border-collapse border w-full text-center ">
            <thead className="bg-gray-200">
              <tr className="border ">
                <th className="px-2 py-2  bg-red-800 z-100  text-white">
                  ตำแหน่ง
                </th>
                {permissions.map((perm) => (
                  <th
                    key={perm.PERMISSIONID}
                    className="sticky top-0 px-2  bg-red-800 text-xs text-white"
                  >
                    {perm.PERMISSIONNAME}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr
                  key={position.POSITIONID}
                  className="border hover:bg-gray-100  gap-2"
                >
                  <td className="px-2 py-2 sticky left-0 bg-gray-100 text-xs">
                    {position.POSITIONNAME}
                  </td>
                  {permissions.map((perm) => (
                    <td key={perm.PERMISSIONID} className="px-2">
                      <input
                        type="checkbox"
                        checked={
                          positionPerms[position.POSITIONID]?.has(
                            perm.PERMISSIONID
                          ) || false
                        }
                        onChange={() =>
                          toggle(position.POSITIONID, perm.PERMISSIONID)
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={onSave}
          className="mt-4 p-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default PositionPermissionManage;
