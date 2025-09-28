import React, { useEffect, useState } from "react";
import api from "../../services/api";
import axios from "axios";

const formatDT = (dt) => new Date(dt).toLocaleString();
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n)); //ค่าไม่เกิน high กับ low

function Booking() {
  const [stops, setStops] = useState([]);
  const [startStopId, setStartStopId] = useState("");
  const [endStopId, setEndStopId] = useState("");
  // const [startStop, setStartStop] = useState("");
  // const [endStop, setEndStop] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]); // ตัวเลือกการจอง
  const [qtyByKey, setQtyByKey] = useState({}); // key => จำนวนที่เลือกต่อแถว

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/stops");
        setStops(res.data || []); // [{STOPID, STOPNAME}]
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const onSearch = async (e) => {
    e.preventDefault();
    if (!startStopId || !endStopId) {
      alert("กรุณาใส่จุดขึ้นและจุดลง");
      return;
    }
    setLoading(true);
    setOptions([]);
    setQtyByKey({});
    try {
      //backend รับเป็น stopId
      const res = await api.post("/booking/options", {
        startStopId: Number(startStopId),
        endStopId: Number(endStopId),
      });
      setOptions(res.data || []);
    } catch (err) {
      console.error(err);
      alert("ค้นหาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const keyOf = (o) =>
    `${o.routeId}|${o.round}|${o.scheduleDateTime}|${o.plateNumber}|${o.stops}`;

  const setQty = (o, v) => {
    const key = keyOf(o);
    const max = Math.min(4, o.seatsLeft);
    const next = clamp(Number(v) || 0, 0, max);
    setQtyByKey((prev) => ({ ...prev, [key]: next }));
  };
  const doBook = async (o) => {
    const key = keyOf(o);
    const qty = Number(qtyByKey[key] || 0);
    if (qty <= 0) {
      alert("กรุณาระบุจำนวนที่นั่ง");
      return;
    }
    try {
      const res = await api.post("/booking/create", {
        routeId: o.routeId,
        round: o.round,
        scheduleDateTime: o.scheduleDateTime,
        startOrder: o.startOrder,
        endOrder: o.endOrder,
        passengerCount: qty,
      });

      alert(
        `จองสำเร็จ รหัสจอง ${res.data.reservationId || "-"}\nQR:${res.data.qr}`
      );
      setOptions((prev) =>
        prev.map((x) =>
          keyOf(x) === key
            ? { ...x, seatsLeft: Math.max(x.seatsLeft - qty, 0) }
            : x
        )
      );
      setQtyByKey((prev) => ({ ...prev, [key]: 0 }));
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || "จองไม่สำเร็จ";
      console.log(msg);
      alert(msg);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">การจอง</h1>

      <form
        onSubmit={onSearch}
        className="grid grid-cols-1 md:grid-cols-4 gap-3 max-w-4xl"
      >
        {/* จุดขึ้น */}
        <select
          className="border rounded px-3 py-2"
          value={startStopId}
          onChange={(e) => setStartStopId(e.target.value)}
        >
          <option value="">เลือกจุดขึ้น</option>
          {stops.map((s) => (
            <option key={s.STOPID} value={s.STOPID}>
              {s.STOPNAME}
            </option>
          ))}
        </select>

        {/* จุดลง */}
        <select
          className="border rounded px-3 py-2"
          value={endStopId}
          onChange={(e) => setEndStopId(e.target.value)}
        >
          <option value="">เลือกจุดลง</option>
          {stops.map((s) => (
            <option key={s.STOPID} value={s.STOPID}>
              {s.STOPNAME}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="bg-red-700 text-white rounded px-4 py-2 hover:bg-red-600"
          disabled={loading}
        >
          {loading ? "กำลังค้นหา..." : "ค้นหา"}
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {options.length === 0 && !loading && (
          <div className="text-gray-500">ยังไม่มีผลลัพธ์</div>
        )}

        {options.map((o) => {
          const key = keyOf(o);
          {
            console.log(key);
          }
          const maxCanBook = Math.min(4, o.seatsLeft);
          return (
            <div key={key} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{o.routeName}</div>
                  <div className="text-xl ">
                    {" "}
                    วันที่{" "}
                    {new Date(o.scheduleDateTime).toLocaleDateString("th-TH")}
                    <br />
                    เวลา{" "}
                    {new Date(o.scheduleDateTime).toLocaleTimeString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="text-sm text-gray-600">
                    รอบ {o.round} • รถป้ายทะเบียน {o.plateNumber}
                  </div>
                  <div className="text-sm">
                    ที่นั่งทั้งหมด {o.capacity} • เหลือ {o.seatsLeft}
                  </div>
                  {o.durationMinutes !== undefined && (
                    <div className="text-sm text-gray-700">
                      เวลาเดินทางโดยประมาณ:{" "}
                      {
                        o.durationText /* หรือ minutesToHHMM(o.durationMinutes) */
                      }
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    ป้ายที่ผ่าน:{" "}
                    {o.stops
                      .map((s) => `${s.STOPORDER}.${s.STOPNAME}`)
                      .join(" → ")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={maxCanBook}
                    value={qtyByKey[key] ?? 0}
                    onChange={(e) => setQty(o, e.target.value)}
                    className="w-20 border rounded px-2 py-1"
                  />

                  <button
                    onClick={() => doBook(o)}
                    disabled={maxCanBook <= 0 || (qtyByKey[key] || 0) <= 0}
                    className="px-3 py-2 bg-red-700 text-white rounded hover:bg-red-600 disabled:opacity-60"
                  >
                    จอง
                  </button>
                </div>
              </div>
              {maxCanBook < 4 && (
                <div className="text-xs text-orange-700 mt-1">
                  * จำกัดจำนวนสูงสุด {maxCanBook} ที่นั่ง
                  (เหลือที่นั่งเท่าที่ว่างจริง)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Booking;
