import React, { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { QrReader } from "react-qr-reader";
const fmtDate = (dt) => new Date(dt).toLocaleDateString();
const fmtTime = (dt) =>
  new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// lazy โหลดกล้อง (ทำให้หน้าโหลดเร็วขึ้น และ fallback ได้ถ้า lib ยังไม่พร้อม)
// const {QrReader} = React.lazy(() => import("react-qr-reader"));

export default function DriverManifest() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const routeId = params.get("routeId");
  const round = params.get("round");
  const scheduleDateTime = params.get("scheduleDateTime"); // ควรเป็น ISO string

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    passengers: [],
    boardTally: {},
    alightTally: {},
  });
  const [scanOpen, setScanOpen] = useState(false);
  const [manualId, setManualId] = useState("");
  const [lastMsg, setLastMsg] = useState("");
  const [finishData, setFinishData] = useState(null);
  const validParams = routeId && round && scheduleDateTime;

  const load = async () => {
    if (!validParams) return;
    setLoading(true);
    try {
      const res = await api.get("/driver/manifest", {
        params: {
          routeId,
          round,
          scheduleDateTime, // ส่ง ISO ตรงๆ ฝั่ง backend แปลงเวลาเทียบ TZ แล้ว (ตามที่เราคุยกันก่อนหน้า)
        },
      });
      console.log("ลูกค้า", res.data);
      setData(res.data || { passengers: [], boardTally: {}, alightTally: {} });
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || "โหลดรายชื่อผู้โดยสารไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [routeId, round, scheduleDateTime]);

  const onCheckin = async (qrText) => {
    try {
      await api.post("/driver/checkin", { qrText });
      setLastMsg(`เช็คอินสำเร็จ #${qrText}`);
      alert("เช็คอินสำเร็จ");
      await load();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || "เช็คอินไม่สำเร็จ");
      setLastMsg(e.response?.data?.message || "เช็คอินไม่สำเร็จ");
    }
  };

  // รับค่าจากกล้อง (เป็น text) — สมมติ QR เก็บ reservationId ตรง ๆ
  const handleScan = (text) => {
    if (!text) return;
    // ตัดช่องว่าง/รูปแบบอื่น ๆ ออก
    const raw = String(text).trim();

    // ถ้า QR เก็บ JSON เช่น {"reservationId":123}
    let qrText = raw;
    console.log("qrText = ", qrText);
    if (qrText) onCheckin(qrText);
  };

  const onFinish = async () => {
    if (!window.confirm("ยืนยันปิดงานรอบนี้?")) return;
    try {
      const res = await api.post("/driver/finish", {
        routeId,
        round,
        scheduleDateTime,
      });
      setFinishData(res.data); // ⬅️ เก็บข้อมูลไว้แสดงใน popup
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || "ปิดงานไม่สำเร็จ");
    }
  };

  const header = useMemo(
    () => ({
      routeId,
      round,
      scheduleDateTime,
    }),
    [routeId, round, scheduleDateTime]
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">รายชื่อผู้โดยสาร</h1>
        <button
          onClick={() => navigate("/driver-dashboard")}
          className="px-3 py-2 rounded border"
        >
          ← ย้อนกลับ
        </button>
      </div>

      {!validParams && <div>พารามิเตอร์ไม่ครบ</div>}

      <div className="mb-4 text-sm">
        <div>Route ID: {header.routeId}</div>
        <div>รอบ: {header.round}</div>
        <div>
          วันที่ {fmtDate(header.scheduleDateTime)} เวลา{" "}
          {fmtTime(header.scheduleDateTime)}
        </div>
      </div>
      {/* แถบแสดงเส้นทางตั้งแต่ต้นจนจบ */}

      {loading && <div>กำลังโหลด...</div>}

      {!loading && (
        <>
          {(data.routeStops?.length ?? 0) > 0 && (
            <div className="mb-4 p-3 bg-white border rounded">
              <div className="font-semibold mb-2">เส้นทางที่ต้องไป</div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {data.routeStops.map((st, i) => (
                  <React.Fragment key={st.order}>
                    <span className="px-2 py-1 bg-gray-100 rounded border">
                      {st.order}. {st.name}
                    </span>
                    {i !== data.routeStops.length - 1 && <span>→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
          {/* ปุ่มเครื่องมือ */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setScanOpen(true)}
              className="px-3 py-2 rounded bg-black text-white hover:bg-white hover:text-black border"
            >
              เปิดสแกน
            </button>

            <div className="flex items-center gap-2">
              <input
                className="border rounded px-2 py-2 w-48"
                placeholder="กรอกรหัส QR"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
              />
              <button
                onClick={() => manualId && onCheckin(manualId)}
                className="px-3 py-2 rounded bg-green-700 text-white hover:bg-green-600"
              >
                เช็คอิน (manual)
              </button>
            </div>

            <button
              onClick={onFinish}
              className="px-3 py-2 rounded bg-red-700 text-white hover:bg-red-600"
            >
              ปิดงาน
            </button>
          </div>

          {lastMsg && (
            <div className="mb-3 text-sm text-blue-700">{lastMsg}</div>
          )}

          {/* ตารางผู้โดยสาร */}
          <div className="overflow-x-auto border rounded bg-white">
            <table className="table-auto w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">ชื่อ-สกุล</th>
                  <th className="px-2 py-2 text-left">ขึ้น</th>
                  <th className="px-2 py-2 text-left">ลง</th>
                  <th className="px-2 py-2 text-left">จำนวน</th>
                  <th className="px-2 py-2 text-left">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {data.passengers.map((p, idx) => (
                  <tr key={p.reservationId} className="border-t">
                    <td className="px-2 py-2">{idx + 1}</td>
                    <td className="px-2 py-2">
                      {p.FIRSTNAME} {p.LASTNAME}
                    </td>
                    <td className="px-2 py-2">
                      {p.PICKUPSTOPORDER}.{p.PICKUPNAME}
                    </td>
                    <td className="px-2 py-2">
                      {p.DROPOFFSTOPORDER}.{p.DROPOFFNAME}
                    </td>
                    <td className="px-2 py-2">{p.PASSENGERCOUNT}</td>
                    <td className="px-2 py-2">
                      {p.CHECKINTIME ? (
                        <span className="text-green-700">Checked-in</span>
                      ) : (
                        <span className="text-gray-500">รอขึ้น</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.passengers.length === 0 && (
                  <tr>
                    <td
                      className="px-2 py-3 text-center text-gray-500"
                      colSpan={6}
                    >
                      ไม่มีผู้โดยสารในรอบนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Tally ต่อป้าย */}
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {/* ขึ้นต่อป้าย */}
            <div className="border rounded p-3 bg-white">
              <div className="font-semibold mb-2">จำนวน “ขึ้น” ต่อป้าย</div>
              {Object.keys(data.boardList || {}).length === 0 ? (
                <div className="text-gray-500">-</div>
              ) : (
                Object.entries(data.boardList).map(([stopKey, arr]) => (
                  <div key={stopKey} className="mb-3">
                    <div className="font-medium">
                      <span className="text-l">ป้ายที่</span> {stopKey} • รวม{" "}
                      {data.boardTally?.[stopKey] ?? 0}
                    </div>
                    <ul className="list-disc pl-6 text-sm">
                      {arr.map((p, idx) => (
                        <li key={idx}>
                          {p.fullName} — {p.count} ที่นั่ง{"  "}
                          {
                            <span className="text-l text-amber-950 font-bold">
                              {p.statusId == 1
                                ? "ยังไม่ได้ขึ้นรถ"
                                : p.statusId == 5
                                ? "ขึ้นรถแล้ว"
                                : ""}
                            </span>
                          }
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
            {/* ลงต่อป้าย */}
            <div className="border rounded p-3 bg-white">
              <div className="font-semibold mb-2">จำนวน “ลง” ต่อป้าย</div>
              {Object.keys(data.alightList || {}).length === 0 ? (
                <div className="text-gray-500">-</div>
              ) : (
                Object.entries(data.alightList).map(([stopKey, arr]) => (
                  <div key={stopKey} className="mb-3">
                    <div className="font-medium">
                      <span className="text-l">ป้ายที่</span> {stopKey} • รวม{" "}
                      {data.alightTally?.[stopKey] ?? 0}
                    </div>
                    <ul className="list-disc pl-6 text-sm">
                      {arr.map((p, idx) => (
                        <li key={idx}>
                          {p.fullName} — {p.count} ที่นั่ง
                        </li>
                      ))}
                    </ul>
                    {}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Popup สแกน QR */}
      {scanOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-[95vw] max-w-md rounded shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">สแกน QR</div>
              <button
                onClick={() => setScanOpen(false)}
                className="px-2 py-1 border rounded"
              >
                ✕ ปิด
              </button>
            </div>

            <div className="text-xs text-gray-600 mb-2">
              ให้กล้องเล็ง QR แล้วรอขึ้นข้อความเช็คอินสำเร็จ
            </div>

            <div className="border rounded overflow-hidden">
              <Suspense fallback={<div className="p-4">กำลังเปิดกล้อง...</div>}>
                <QrReader
                  constraints={{ facingMode: "environment" }}
                  onResult={(result, error) => {
                    if (!!result) {
                      handleScan(result?.text || "");
                    }
                    if (!!error) {
                      // เงียบไว้เพื่อไม่ให้พ่น error รัว ๆ
                    }
                  }}
                  style={{ width: "100%" }}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
      {/* Popup สรุปผลหลังปิดงาน */}
      {finishData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-[95vw] max-w-2xl rounded shadow-lg p-6 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-semibold mb-4 text-center">
              สรุปผลการเดินทาง
            </h2>

            <div className="text-center mb-4">
              <p>
                ขึ้นจริงทั้งหมด:{" "}
                <span className="font-bold text-green-700">
                  {finishData.onboard}
                </span>{" "}
                คน
              </p>
              <p>
                ไม่มา (NoShow):{" "}
                <span className="font-bold text-red-700">
                  {finishData.noshow}
                </span>{" "}
                คน
              </p>
            </div>

            <div className="border rounded p-3 bg-gray-50">
              <table className="table-auto w-full text-sm border">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="px-2 py-2 text-left">ชื่อ-สกุล</th>
                    <th className="px-2 py-2 text-left">ขึ้นที่</th>
                    <th className="px-2 py-2 text-left">ลงที่</th>
                    <th className="px-2 py-2 text-center">จำนวน</th>
                    <th className="px-2 py-2 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {finishData.passengerList.map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">
                        {p.FIRSTNAME} {p.LASTNAME}
                      </td>
                      <td className="px-2 py-1">{p.PICKUPNAME}</td>
                      <td className="px-2 py-1">{p.DROPOFFNAME}</td>
                      <td className="px-2 py-1 text-center">
                        {p.PASSENGERCOUNT}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {p.STATUS === "Onboard" ? (
                          <span className="text-green-700 font-semibold">
                            มา
                          </span>
                        ) : (
                          <span className="text-red-600 font-semibold">
                            ไม่มา
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                onClick={() => {
                  setFinishData(null);
                  navigate("/driver-dashboard");
                }}
                className="px-4 py-2 bg-black text-white rounded hover:bg-gray-700"
              >
                กลับหน้าตารางงาน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
