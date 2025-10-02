import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
export default function Home() {
  const { me } = useAuth();
  const perms = me?.permissions || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white text-gray-900">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-red-700 text-white grid place-items-center font-bold">
              BUS
            </div>
            <span className="font-semibold">MUT Shuttle Bus</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
              จองรถรับ–ส่ง <span className="text-red-700">ง่าย</span> เช็คอิน
              <span className="text-red-700">ไว</span> เดินทางสะดวกทุกวัน
            </h1>
            <p className="mt-4 text-gray-600">
              ระบบ Shuttle Bus สำหรับนักศึกษาและบุคลากร
              จองรอบ–ดูคิว–สแกน&nbsp;QR เพื่อขึ้นรถได้ในคลิกเดียว
            </p>
            <div className="mt-6 flex flex-wrap gap-3"></div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border shadow-sm bg-white p-4">
              <div className="rounded-xl bg-gray-900 text-white p-4">
                <div className="text-sm opacity-80">สแกนเช็คอิน</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[...Array(9)].map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-lg bg-gray-800/60"
                    />
                  ))}
                </div>
                <div className="mt-4 text-right">
                  <span className="inline-block px-3 py-1 rounded bg-green-600 text-xs">
                    Ready
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-red-50 border text-red-800">
                  จองรอบ
                  <div className="font-semibold">11:30</div>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 border text-blue-800">
                  สถานะ
                  <div className="font-semibold">Reserved</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 border text-emerald-800">
                  ที่นั่ง
                  <div className="font-semibold">2</div>
                </div>
              </div>
            </div>
            <div className="absolute -z-10 -top-10 -right-10 h-40 w-40 rounded-full bg-red-200/60 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl md:text-2xl font-bold mb-6">ฟีเจอร์หลัก</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              title: "จองรอบสะดวก",
              desc: "เลือกเส้นทาง–เวลารถได้อย่างรวดเร็ว พร้อมสรุปที่นั่ง",
              icon: "🚌",
            },
            {
              title: "QR สำหรับเช็คอิน",
              desc: "สร้าง QR อัตโนมัติ ใช้แสกนขึ้นรถได้ทันที",
              icon: "� QR",
            },
            {
              title: "ประวัติ & สถานะ",
              desc: "ดูรายการที่กำลังจะถึง/เสร็จแล้ว/ยกเลิก ได้ในที่เดียว",
              icon: "📋",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border bg-white p-5 hover:shadow-sm transition"
            >
              <div className="text-2xl">{f.icon}</div>
              <div className="mt-3 font-semibold">{f.title}</div>
              <div className="text-sm text-gray-600">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl md:text-2xl font-bold mb-6">
          เริ่มใช้งานอย่างไร?
        </h2>
        <ol className="grid md:grid-cols-4 gap-4 text-sm">
          {[
            "เข้าสู่ระบบด้วยบัญชีของคุณ",
            "เลือกเส้นทางและรอบเวลา",
            "ยืนยันการจองเพื่อรับ QR",
            "แสดง QR ให้คนขับสแกนเพื่อขึ้นรถ",
          ].map((step, i) => (
            <li
              key={i}
              className="rounded-xl border bg-white p-4 flex items-start gap-3"
            >
              <span className="h-6 w-6 mt-0.5 rounded-full bg-red-700 text-white grid place-items-center text-xs">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Quick roles */}

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-gray-500 flex flex-wrap items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} MUT Shuttle Bus</div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-gray-700">
              นโยบายความเป็นส่วนตัว
            </a>
            <a href="#" className="hover:text-gray-700">
              เงื่อนไขการใช้งาน
            </a>
            <a href="#" className="hover:text-gray-700">
              ติดต่อเรา
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function RoleCard({ title, desc, to, cta }) {
  return (
    <div className="rounded-xl border bg-white p-6 flex flex-col">
      <div className="font-semibold text-lg">{title}</div>
      <div className="text-sm text-gray-600 mt-1 flex-1">{desc}</div>
      <div className="mt-4">
        <Link
          to={to}
          className="inline-block px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
