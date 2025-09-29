import React, { useEffect, useState } from "react";
import api from "../../services/api";

function PositionManage() {
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [mode, setMode] = useState("create"); // 'create' | 'edit'
  const [editId, setEditId] = useState(null); // POSITIONID ที่กำลังแก้

  // ✅ ใช้ useEffect เดียวพอ: โหลดข้อมูลจาก endpoint ที่ถูกต้อง
  useEffect(() => {
    loadPositions();
  }, []);

  const loadPositions = async () => {
    setLoading(true);
    try {
      const pos = await api.get("/positions"); // ← ใช้ /positions ให้ตรงกับ backend
      setPositions(pos.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setMode("create");
    setEditId(null);
    setNewName("");
    setShowModal(true);
  };

  const openEdit = (pos) => {
    setMode("edit");
    setEditId(pos.POSITIONID);
    setNewName(pos.POSITIONNAME || ""); // ตั้งค่าเริ่มต้นให้กล่องข้อความ
    setShowModal(true);
  };

  const handleSave = async () => {
    const name = newName.trim();
    if (!name) return alert("กรุณากรอกชื่อตำแหน่ง");

    try {
      if (mode === "create") {
        await api.post("/positions", { POSITIONNAME: name });
      } else {
        await api.put(`/positions/${editId}`, { POSITIONNAME: name }); // ← แก้เป็น /positions/{id}
      }

      setNewName("");
      setShowModal(false);
      await loadPositions();
      alert("บันทึกสำเร็จ");
    } catch (e) {
      console.error(e);
      alert("บันทึกไม่สำเร็จ");
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`ต้องการลบตำแหน่ง "${name || id}" ใช่ไหม?`)) return;

    try {
      await api.delete(`/positions/${id}`);
      await loadPositions();
      alert("ลบสำเร็จ");
    } catch (e) {
      console.error(e);
      alert("ลบไม่สำเร็จ");
    }
  };

  return (
    <div className="p-4">
      {/* Header card */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              จัดการตำแหน่ง
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              จัดการข้อมูลตำแหน่งงานในองค์กร
            </p>
          </div>

          <button
            onClick={openCreate}
            type="button"
            className="rounded-md bg-red-800 px-4 py-2 text-white hover:bg-red-700"
          >
            เพิ่มตำแหน่งใหม่
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full table-auto">
          <thead className="sticky top-0 bg-gray-100">
            <tr className="text-left text-sm text-gray-700">
              <th className="px-4 py-3 font-medium">ตำแหน่ง</th>
              <th className="px-4 py-3 font-medium">จำนวนพนักงาน</th>
              <th className="px-4 py-3 font-medium">จัดการ</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                {/* 🔧 colSpan ให้เท่าจำนวนคอลัมน์จริง = 3 */}
                <td className="px-4 py-6 text-center text-gray-500" colSpan={3}>
                  กำลังโหลด...
                </td>
              </tr>
            ) : positions.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={3}>
                  ไม่มีข้อมูลตำแหน่ง
                </td>
              </tr>
            ) : (
              positions.map((pos, idx) => (
                <tr
                  key={pos.POSITIONID}
                  className={
                    idx % 2
                      ? "bg-gray-50 hover:bg-gray-100"
                      : "hover:bg-gray-100"
                  }
                >
                  <td className="px-4 py-3 text-gray-900">
                    {pos.POSITIONNAME}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{pos.NOOFEMP}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <button
                      className="rounded-md bg-red-800 px-4 py-2 mx-0.5 text-white hover:bg-red-700"
                      onClick={() => openEdit(pos)}
                    >
                      แก้ไข
                    </button>
                    <button
                      className="rounded-md bg-red-800 px-4 py-2 mx-0.5 text-white hover:bg-red-700"
                      onClick={() =>
                        handleDelete(pos.POSITIONID, pos.POSITIONNAME)
                      }
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          {" "}
          {/* พื้นหลังทึบเล็กน้อย */}
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold">
              {mode === "edit" ? "แก้ไขตำแหน่ง" : "เพิ่มตำแหน่งใหม่"}
            </h2>
            <input
              type="text"
              placeholder="ชื่อตำแหน่ง"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus // ✅ โฟกัสอัตโนมัติ ช่วยให้พิมพ์ได้ทันที
              className="mb-4 w-full rounded border px-3 py-2 focus:outline-none focus:ring focus:ring-red-300"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="rounded bg-gray-300 px-4 py-2 hover:bg-gray-400"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                className="rounded bg-red-800 px-4 py-2 text-white hover:bg-red-700"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PositionManage;
