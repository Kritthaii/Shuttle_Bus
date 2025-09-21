// src/pages/Dashboard.jsx
import { useAuth } from "../../auth/AuthContext.jsx";
import { canAll, canAny } from "../../auth/PermHelper.jsx";

export default function AdminDashboard() {
  const { me } = useAuth();
  const perms = me?.permissions ?? [];

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard</h1>
      <p>
        สวัสดีคุณ {me?.firstname} {me?.lastname}
      </p>

      <div style={{ marginTop: 20 }}>
        {/* ตัวอย่าง section สำหรับจัดการพนักงาน */}
        {canAll(me.permissions, "CanManageEmployee") && (
          <section style={boxStyle}>
            <h2>👩‍💼 จัดการพนักงาน</h2>
            <p>คุณสามารถเพิ่ม/แก้ไข/ลบข้อมูลพนักงานได้</p>
            <button>ไปที่หน้าพนักงาน</button>
          </section>
        )}

        {/* ตัวอย่าง section สำหรับจัดการคนขับ */}
        {canAll(me.permissions, "CanManageDriver") && (
          <section style={boxStyle}>
            <h2>🚖 จัดการคนขับ</h2>
            <p>ดูและจัดตารางงานของคนขับได้</p>
            <button>ไปที่หน้าคนขับ</button>
          </section>
        )}

        {/* ตัวอย่าง section สำหรับดูรายงาน */}
        {canAll(me.permissions, "CanViewReports") && (
          <section style={boxStyle}>
            <h2>📊 รายงาน</h2>
            <p>ดูสรุปข้อมูลการเดินทาง การจอง และสถิติ</p>
            <button>ไปที่หน้ารายงาน</button>
          </section>
        )}

        {/* ตัวอย่าง section สำหรับการจอง */}
        {canAny(me.permissions, [
          "CanReservation",
          "CanManageReservations",
        ]) && (
          <section style={boxStyle}>
            <h2>📝 การจอง</h2>
            <p>คุณสามารถทำการจอง หรือจัดการการจองได้</p>
            <button>ไปที่หน้าการจอง</button>
          </section>
        )}

        {/* ถ้า user ไม่มีสิทธิ์พิเศษเลย */}
        {perms.length === 0 && (
          <section style={boxStyle}>
            <p>คุณไม่มีสิทธิ์ใช้งานพิเศษ</p>
          </section>
        )}
      </div>
    </div>
  );
}

const boxStyle = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
  background: "#f9f9f9",
};
