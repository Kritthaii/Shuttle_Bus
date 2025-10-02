import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../auth/AuthContext.jsx";
import { QRModal } from "../../component/QRModel.jsx";
const fmtDate = (dt) => new Date(dt).toLocaleDateString();
const fmtTime = (dt) =>
  new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ---- วาง QRModal ด้านบนไฟล์นี้หรือแยกไฟล์ก็ได้ ----
// (นำโค้ด QRModal ด้านบนมาแปะไว้)

export default function MyBooking() {
  const { me } = useAuth();
  const [status, setStatus] = useState("upcoming");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // เก็บ QR dataURL แบบต่อรายการ และสถานะ modal
  const [qrById, setQrById] = useState({}); // { [reservationId]: dataUrl }
  const [qrOpenId, setQrOpenId] = useState(null); // id ที่กำลังเปิด modal
  const [qrText, SetQrText] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/my-reservations`, { params: { status } });
      setItems(res.data || []);
      console.log("item", res.data);
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

  const openQr = async (reservationId) => {
    try {
      if (!qrById[reservationId]) {
        const res = await api.get(`/booking/qrcode/${reservationId}`);
        setQrById((p) => ({ ...p, [reservationId]: res.data.dataUrl }));
        SetQrText((p) => ({ ...p, [reservationId]: res.data.qrCode }));
      }
      setQrOpenId(reservationId);
    } catch (e) {
      console.error(e);
      alert("โหลด QR ไม่สำเร็จ");
    }
  };

  const closeQr = () => setQrOpenId(null);

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
            className="border rounded p-4 flex gap-2 md:flex-row md:items-center md:justify-between bg-white"
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
                ผู้โดยสาร {it.passengerCount} ที่นั่ง • สถานะ{" "}
                {it.statusId === 2
                  ? "เสร็จสิ้น"
                  : it.statusId === 3
                  ? "ยกเลิก"
                  : it.statusId === 4
                  ? "ไม่มา"
                  : it.statusId === 1
                  ? "จองแล้ว"
                  : it.statusId === 5
                  ? "เช็คอินแล้ว"
                  : ""}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {it.statusId === 1 && (
                <button
                  disabled={!it.canCancel}
                  onClick={() => onCancel(it.reservationId)}
                  className="px-3 py-2 rounded bg-red-700 text-white disabled:hidden"
                >
                  ยกเลิก
                </button>
              )}

              <button
                onClick={() => openQr(it.reservationId)}
                className="px-3 py-2 rounded border text-white bg-black hover:bg-white hover:text-black"
              >
                ดู QR
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal แสดง QR */}
      <QRModal
        open={qrOpenId !== null}
        title="QR เช็คอิน"
        dataUrl={qrById[qrOpenId]}
        qrText={qrText[qrOpenId]}
        onClose={closeQr}
      />
    </div>
  );
}
