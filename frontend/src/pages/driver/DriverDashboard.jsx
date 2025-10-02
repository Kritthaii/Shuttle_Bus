// src/pages/driver/DriverDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const fmtDate = (dt) => new Date(dt).toLocaleDateString();
const fmtTime = (dt) =>
  new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function DriverDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // ตัวอย่างช่วงเวลา (วันนี้ถึงพรุ่งนี้)
      const today = new Date();
      const from = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).toISOString();
      const to = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 7
      ).toISOString();

      const res = await api.get("/driver/my-jobs", { params: { from, to } });
      setJobs(res.data || []);
    } catch (e) {
      console.error(e);
      alert("โหลดตารางงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // มีงาน Running อยู่ไหม?
  const hasRunning = useMemo(
    () => jobs.some((j) => j.status === "Running"),
    [jobs]
  );

  const onStart = async (job) => {
    try {
      await api.post("/driver/start", {
        routeId: job.routeId,
        round: job.round,
        scheduleDateTime: job.scheduleDateTime,
      });
      await load(); // รีเฟรชสถานะให้เป็น Running
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || "เริ่มงานไม่สำเร็จ");
    }
  };

  // เปิดหน้า Manifest; ถ้า wantScan = true ให้เปิดโหมดสแกนทันที
  const goManifest = (job, wantScan = false) => {
    const q = new URLSearchParams({
      routeId: job.routeId,
      round: job.round,
      scheduleDateTime: new Date(job.scheduleDateTime).toISOString(),
      scan: wantScan ? "1" : "0",
    }).toString();
    navigate(`/driver/job?${q}`);
  };

  if (loading) return <div className="p-6">กำลังโหลด…</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">งานของฉัน</h1>

      {jobs.map((job, idx) => {
        const isRunning = job.status === "Running";
        const canStart = job.status === "Pending" && !hasRunning;

        return (
          <div
            key={`${job.routeId}|${job.round}|${job.scheduleDateTime}|${idx}`}
            className="border rounded p-4 mb-4 bg-white"
          >
            <div className="font-semibold">{job.routeName}</div>
            {job.routeStops && job.routeStops.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                <div className="font-semibold">จุดจอดรับส่ง</div>
                <ul className="flex ">
                  {job.routeStops.map((stop) => (
                    <li key={stop.order} className="pr-2">
                      {stop.order}. {stop.name}
                      <span className="pl-1.5">➜</span>
                    </li>
                  ))}
                  <li>สิ้นสุดเส้นทางรอบนี้</li>
                </ul>
              </div>
            )}
            <div className="text-sm text-gray-700">
              รอบ {job.round} • วันที่ {fmtDate(job.scheduleDateTime)} เวลา{" "}
              {fmtTime(job.scheduleDateTime)}
            </div>
            <div className="text-sm">ทะเบียนรถ: {job.plateNumber}</div>
            <div className="text-sm mt-1">
              สถานะงาน:{" "}
              <span className={isRunning ? "text-green-700" : "text-gray-700"}>
                {job.status}
              </span>
            </div>

            <div className="mt-3 flex gap-2">
              {/* ถ้าเป็น Running ให้แสดงปุ่มสแกนแทนปุ่มเริ่มงาน */}
              {isRunning ? (
                <button
                  className="px-4 py-2 rounded bg-green-700 text-white hover:bg-green-600 hid"
                  onClick={() => goManifest(job, true)}
                >
                  สแกน QR
                </button>
              ) : (
                <button
                  className={`px-4 py-2 rounded ${
                    canStart
                      ? "bg-green-700 hover:bg-green-600 text-white"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed"
                  }`}
                  onClick={() => canStart && onStart(job)}
                  disabled={!canStart}
                  title={
                    !canStart
                      ? hasRunning
                        ? "มีงานที่กำลังทำอยู่ จึงเริ่มงานอื่นไม่ได้"
                        : "งานนี้เริ่มไม่ได้"
                      : ""
                  }
                >
                  เริ่มงาน
                </button>
              )}

              {/* ปุ่มดูผู้โดยสาร/ไปหน้า Manifest ได้ตลอด */}
              <button
                className="px-4 py-2 rounded bg-black text-white hover:bg-white hover:text-black border"
                onClick={() => goManifest(job, false)}
              >
                ดูผู้โดยสาร
              </button>
            </div>
          </div>
        );
      })}

      {jobs.length === 0 && (
        <div className="text-gray-500">วันนี้ยังไม่มีงาน</div>
      )}
    </div>
  );
}
