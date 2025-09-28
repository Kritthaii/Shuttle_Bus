import React, { useEffect, useState, useMemo } from "react";
import api from "../../services/api";
import { useAuth } from "../../auth/AuthContext.jsx";

const fmtDate = (dt) => new Date(dt).toLocaleDateString(); //ดึงเฉพาะวัน
const fmtTime = (dt) =>
  new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); //ดึงเฉพาะเวลา

function MyBooking() {
  const { me } = useAuth();
  const [status, setStatus] = useState("upcoming");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [qrById, setQrById] = useState({}); // reservationId  -> dataUrl

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/my-reservations`, { params: { status } });
      setItems(res.data || []);
    } catch (e) {
      console.error(e);
      alert("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (me) load();
    // eslint-disable-next-line
  }, [me, status]);

  /////ยกเลิกการจอง
  const onCancel = async (reservationId) => {
    if (!window.confirm("ยืนยันยกเลิกการจองนี้?")) return;
    try {
      await api.post(`/booking/cancel/${reservationId}`);
      await load();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || "ยกเลิกไม่สำเร็จ");
    }
  };

  ////////////// ดึง QR
  const getQr = async (reservationId) => {
    try {
      const res = await api.get(`/booking/qrcode/${reservationId}`);
      setQrById((p) => ({ ...p, [reservationId]: res.data.dataUrl }));
    } catch (e) {
      console.error(e);
      alert("โหลด QR ไม่สำเร็จ");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">รายการจองของฉัน</h1>

      <div className="flex gap-3 mb-4">
        {["upcoming", "completed", "cancelled", "all"].map((k) => (
          <button
            key={k}
            onClick={() => setStatus(k)}
            className={`px-3 py-2 rounded border ${
              status === k ? "bg-red-700 text-white" : "bg-white"
            }`}
          >
            {k === "upcoming"
              ? "กำลังจะถึง"
              : k === "completed"
              ? "เสร็จแล้ว"
              : k === "cancelled"
              ? "ถูกยกเลิก"
              : "ทั้งหมด"}
          </button>
        ))}
      </div>

      {loading && <div>กำลังโหลด...</div>}
      {!loading && items.length === 0 && (
        <div className="text-gray-500">ไม่มีข้อมูล</div>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <div
            key={it.reservationId}
            className="border rounded p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <div className="font-semibold">
                {it.routeName} • รอบ {it.round}
              </div>
              <div className="text-sm text-gray-700">
                วันที่ {fmtDate(it.scheduleDateTime)} เวลา{" "}
                {fmtTime(it.scheduleDateTime)}
              </div>
              <div className="text-sm">
                ขึ้น {it.pickup.order}.{it.pickup.name} → ลง {it.dropoff.order}.
                {it.dropoff.name}
              </div>
              <div className="text-xs text-gray-500">
                ผู้โดยสาร {it.passengerCount} ที่นั่ง • สถานะ {it.statusName}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* ปุ่มยกเลิก เฉพาะจองที่ยกเลิกได้ */}
              <button
                disabled={!it.canCancel}
                onClick={() => onCancel(it.reservationId)}
                className="px-3 py-2 rounded bg-red-700 text-white disabled:opacity-60"
              >
                ยกเลิก
              </button>

              {/* ปุ่มดู QR */}
              <button
                onClick={() => getQr(it.reservationId)}
                className="px-3 py-2 rounded border"
              >
                ดู QR
              </button>
            </div>

            {/* ถ้าโหลด QR มาแล้ว แปะภาพ */}
            {qrById[it.reservationId] && (
              <div className="mt-2">
                <img
                  alt="QR Code"
                  src={qrById[it.reservationId]}
                  className="w-40 h-40 border"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
export default MyBooking;
