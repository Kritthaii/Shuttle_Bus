const express = require("express");
const router = express.Router();
const db = require("./db/dbpool");
const { authRequired } = require("./middleware/auth");
const driverOnly = require("./middleware/driverOnly");
// const { autoCommit } = require("oracledb");

// หา employeeId ของคนขับจาก account_id
async function getMyEmployeeId(accountId) {
  const sql = `SELECT e.EMPLOYEEID
               FROM EMPLOYEES e
               JOIN ACCOUNT a ON a.ACCOUNT_ID = e.ACCOUNT_ID
               WHERE a.ACCOUNT_ID = :aid`;
  const row = (await db.query(sql, { aid: accountId })).rows[0];
  return row?.EMPLOYEEID || null;
}

// GET /api/driver/my-jobs?from=2025-10-02&to=2025-10-03
router.get("/driver/my-jobs", authRequired, driverOnly, async (req, res) => {
  try {
    const empId = await getMyEmployeeId(req.user.accountId);
    if (!empId) return res.status(400).json({ message: "Employee not found" });

    const from1 = req.query.from ? new Date(req.query.from) : new Date();
    const to1 = req.query.to
      ? new Date(req.query.to)
      : new Date(Date.now() + 86400000);
    console.log("from", from1, "to", to1);

    //ดึงข้อมูลตารางงาน
    const sql = `
      SELECT s.ROUTEID, r.ROUTENAME, s.ROUND, s.SCHEDULEDATETIME,
             s.STATUS, s.STARTTIME, s.ENDTIME, b.PLATENUMBER
      FROM SCHEDULE s
      JOIN ROUTE r ON r.ROUTEID = s.ROUTEID
      JOIN BUS b   ON b.BUSID   = s.BUSID
      WHERE s.DRIVERID = :empId AND (s.STATUS = 'Pending' OR s.STATUS = 'Running')
        AND s.SCHEDULEDATETIME BETWEEN :from1 AND :to1
      ORDER BY s.SCHEDULEDATETIME
    `;
    const rows = (await db.query(sql, { empId, from1, to1 })).rows;

    // ดึงเส้นทางย่อยของแต่ละ Route (Route Stop)
    const routeStopsSql = `
      SELECT rs.ROUTEID, rs.STOPORDER, sp.STOPNAME
      FROM ROUTE_STOP rs
      JOIN STOP sp ON sp.STOPID = rs.STOPID
      ORDER BY rs.ROUTEID, rs.STOPORDER
    `;
    const stops = (await db.query(routeStopsSql, {})).rows;

    // จัดกลุ่มเส้นทาง
    const stopsByRoute = {};
    stops.forEach((x) => {
      if (!stopsByRoute[x.ROUTEID]) stopsByRoute[x.ROUTEID] = [];
      stopsByRoute[x.ROUTEID].push({
        order: x.STOPORDER,
        name: x.STOPNAME,
      });
    });

    // รวมข้อมูล
    const jobs = rows.map((x) => ({
      routeId: x.ROUTEID,
      routeName: x.ROUTENAME,
      round: x.ROUND,
      scheduleDateTime: x.SCHEDULEDATETIME,
      status: x.STATUS,
      plateNumber: x.PLATENUMBER,
      startTime: x.STARTTIME,
      endTime: x.ENDTIME,
      routeStops: stopsByRoute[x.ROUTEID] || [],
    }));
    res.json(jobs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/driver/start
// body: { routeId, round, scheduleDateTime }
router.post("/driver/start", authRequired, driverOnly, async (req, res) => {
  try {
    const empId = await getMyEmployeeId(req.user.accountId);
    if (!empId) return res.status(400).json({ message: "Employee not found" });

    const { routeId, round, scheduleDateTime } = req.body || {};
    const schedTime = new Date(scheduleDateTime);

    // มั่นใจว่าเป็นรอบของคนขับคนนี้ และยังไม่เริ่ม/ไม่จบ
    const checkSql = `
      SELECT STATUS FROM SCHEDULE
      WHERE ROUTEID=:rid AND ROUND=:rnd AND SCHEDULEDATETIME=:dt AND DRIVERID=:did
    `;
    const chk = (
      await db.query(checkSql, {
        rid: routeId,
        rnd: round,
        dt: schedTime,
        did: empId,
      })
    ).rows[0];
    if (!chk) return res.status(404).json({ message: "Schedule not found" });
    if (chk.STATUS === "Running")
      return res.status(400).json({ message: "Already running" });
    if (chk.STATUS === "Finished")
      return res.status(400).json({ message: "Already finished" });

    const upd = `
      UPDATE SCHEDULE
      SET STATUS='Running', STARTTIME=SYSDATE
      WHERE ROUTEID=:rid AND ROUND=:rnd AND SCHEDULEDATETIME=:dt AND DRIVERID=:did
    `;
    await db.query(
      upd,
      { rid: routeId, rnd: round, dt: schedTime, did: empId },
      { autoCommit: true }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/driver/manifest?routeId=&round=&scheduleDateTime=
router.get("/driver/manifest", authRequired, driverOnly, async (req, res) => {
  console.log("HEllo");
  try {
    const empId = await getMyEmployeeId(req.user.accountId);
    if (!empId) return res.status(400).json({ message: "Employee not found" });
    console.log("empId", empId);
    const { routeId, round, scheduleDateTime } = req.query || {};
    if (!routeId || !round || !scheduleDateTime) {
      return res.status(400).json({ message: "Missing query params" });
    }
    const dt1 = new Date(scheduleDateTime);
    console.log("date", dt1);
    // ยืนยันว่าเป็นรอบของคนขับ
    const okSql = `SELECT 1 FROM SCHEDULE WHERE ROUTEID = :rid1
    AND ROUND=:rnd1 AND TRUNC(SCHEDULEDATETIME, 'MI') = TRUNC(TO_DATE(:dt1, 'YYYY-MM-DD HH24:MI:SS'), 'MI')
    AND DRIVERID= :did1
    `;
    // แปลงวันเวลาให้ตรงกับ Oracle
    // dt1.setHours(dt1.getHours() - 7); //ใช้ กับ postman
    const formatted =
      dt1.getFullYear() +
      "-" +
      String(dt1.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(dt1.getDate()).padStart(2, "0") +
      " " +
      String(dt1.getHours()).padStart(2, "0") +
      ":" +
      String(dt1.getMinutes()).padStart(2, "0") +
      ":" +
      String(dt1.getSeconds()).padStart(2, "0");
    console.log(routeId, round, formatted, empId);
    const ok = (
      await db.query(okSql, {
        rid1: routeId,
        rnd1: round,
        dt1: formatted,
        did1: empId,
      })
    ).rows[0];
    console.log(ok);
    if (!ok) return res.status(403).json({ message: "Not your schedule" });

    // 1) ดึงผู้โดยสารในรอบนี้
    const paxSql = `
      SELECT r.RESERVATIONID, r.PASSENGERCOUNT,
             r.PICKUPSTOPORDER, r.DROPOFFSTOPORDER,
             s1.STOPNAME AS PICKUPNAME, s2.STOPNAME AS DROPOFFNAME,
             u.FIRSTNAME, u.LASTNAME, r.CHECKINTIME,r.RESERVATIONSTATUSID
      FROM RESERVATION r
      JOIN ROUTE_STOP rs1 ON rs1.ROUTEID=r.ROUTEID AND rs1.STOPORDER=r.PICKUPSTOPORDER
      JOIN STOP s1        ON s1.STOPID=rs1.STOPID
      JOIN ROUTE_STOP rs2 ON rs2.ROUTEID=r.ROUTEID AND rs2.STOPORDER=r.DROPOFFSTOPORDER
      JOIN STOP s2        ON s2.STOPID=rs2.STOPID
      JOIN USER_ACCOUNT u ON u.USERID = r.USERID
      WHERE r.ROUTEID=:rid AND r.ROUND=:rnd
        AND r.SCHEDULEDATETIME = TO_DATE(:dt1,'YYYY-MM-DD HH24:MI:SS')
        AND r.RESERVATIONSTATUSID IN (1,2,5)  -- Reserved/Completed/Running(ถ้ามี)
      ORDER BY r.PICKUPSTOPORDER
    `;
    const paxRows = (
      await db.query(paxSql, { rid: routeId, rnd: round, dt1: formatted })
    ).rows;

    // 2) ดึง "รายชื่อป้าย" ของเส้นทาง (ทั้งหมดตั้งแต่ต้นถึงท้าย)
    const stopsSql = `
      SELECT rs.STOPORDER, s.STOPNAME
      FROM ROUTE_STOP rs
      JOIN STOP s ON s.STOPID = rs.STOPID
      WHERE rs.ROUTEID = :rid
      ORDER BY rs.STOPORDER
    `;
    const stopRows = (await db.query(stopsSql, { rid: routeId })).rows || [];
    // map order -> name
    const stopNameByOrder = {};
    const routeStops = stopRows.map((r) => {
      stopNameByOrder[r.STOPORDER] = r.STOPNAME;
      return { order: r.STOPORDER, name: r.STOPNAME };
    });

    // 3) รวมยอดต่อป้ายแบบ “มีชื่อป้าย”
    const boardTally = {}; // key "1.MUT" -> total
    const alightTally = {}; // key "2.Lotus" -> total
    const boardList = {}; // "1.MUT" -> [{ fullName, count, reservationId }]
    const alightList = {}; // "2.Lotus" -> [{ fullName, count, reservationId }]

    paxRows.forEach((r) => {
      const fullName = `${r.FIRSTNAME} ${r.LASTNAME}`;
      const bKey = `${r.PICKUPSTOPORDER}.${
        stopNameByOrder[r.PICKUPSTOPORDER] || r.PICKUPNAME
      }`;
      const aKey = `${r.DROPOFFSTOPORDER}.${
        stopNameByOrder[r.DROPOFFSTOPORDER] || r.DROPOFFNAME
      }`;
      const statusId = r.RESERVATIONSTATUSID;
      // tally ขึ้น
      boardTally[bKey] = (boardTally[bKey] || 0) + Number(r.PASSENGERCOUNT);
      if (!boardList[bKey]) boardList[bKey] = [];
      boardList[bKey].push({
        fullName,
        statusId,
        count: Number(r.PASSENGERCOUNT),
        reservationId: r.RESERVATIONID,
      });

      // tally ลง
      alightTally[aKey] = (alightTally[aKey] || 0) + Number(r.PASSENGERCOUNT);
      if (!alightList[aKey]) alightList[aKey] = [];
      alightList[aKey].push({
        fullName,
        count: Number(r.PASSENGERCOUNT),
        reservationId: r.RESERVATIONID,
      });
    });

    // ส่งกลับ: ผู้โดยสาร, รายชื่อป้ายทั้งหมด, สรุปต่อป้าย (มีชื่อป้าย) และ list รายคนต่อป้าย
    res.json({
      passengers: paxRows,
      routeStops, // ↩️ ใช้โชว์เส้นทางตั้งแต่ต้นถึงปลาย
      boardTally, // { '1.MUT': 5, '3.Park': 2, ... }
      alightTally, // { '2.Lotus': 3, ... }
      boardList, // { '1.MUT': [{fullName:'A',count:2}, ...] }
      alightList,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

//  const sql = `
//       SELECT r.RESERVATIONID, r.PASSENGERCOUNT,
//              r.PICKUPSTOPORDER, r.DROPOFFSTOPORDER,
//              s1.STOPNAME AS PICKUPNAME, s2.STOPNAME AS DROPOFFNAME,
//              u.FIRSTNAME, u.LASTNAME, r.CHECKINTIME
//       FROM RESERVATION r
//       JOIN ROUTE_STOP rs1 ON rs1.ROUTEID=r.ROUTEID AND rs1.STOPORDER=r.PICKUPSTOPORDER
//       JOIN STOP s1        ON s1.STOPID=rs1.STOPID
//       JOIN ROUTE_STOP rs2 ON rs2.ROUTEID=r.ROUTEID AND rs2.STOPORDER=r.DROPOFFSTOPORDER
//       JOIN STOP s2        ON s2.STOPID=rs2.STOPID
//       JOIN USER_ACCOUNT u ON u.USERID = r.USERID
//       WHERE r.ROUTEID=:rid AND r.ROUND=:rnd AND r.SCHEDULEDATETIME=:dt1
//         AND r.RESERVATIONSTATUSID IN (1,2,5)  -- Reserved/Completed
//       ORDER BY r.PICKUPSTOPORDER
//     `;
//     const rows = (await db.query(sql, { rid: routeId, rnd: round, dt1 })).rows;

//     // รวมยอดต่อป้าย
//     const boardTally = {}; // stopOrder -> total board
//     const alightTally = {}; // stopOrder -> total drop
//     rows.forEach((r) => {
//       boardTally[r.PICKUPSTOPORDER] =
//         (boardTally[r.PICKUPSTOPORDER] || 0) + Number(r.PASSENGERCOUNT);
//       alightTally[r.DROPOFFSTOPORDER] =
//         (alightTally[r.DROPOFFSTOPORDER] || 0) + Number(r.PASSENGERCOUNT);
//     });
//     console.log("HELLO");

// POST /api/driver/checkin
// body: { reservationId }
router.post("/driver/checkin", authRequired, driverOnly, async (req, res) => {
  console.log(req.body);
  try {
    const empId = await getMyEmployeeId(req.user.accountId);
    // const { reservationId } = req.body || {};
    const { qrText } = req.body || {};
    console.log("qrText", qrText);
    console.log("empId", empId);
    if (!empId || !qrText) {
      console.log("Bad request Missing empId or qrText");
      return res
        .status(400)
        .json({ message: "Bad request Missing empId or qrText" });
    }

    // เอา reservation -> หา schedule
    const rsql = `
      SELECT r.RESERVATIONID, r.ROUTEID, r.ROUND, r.SCHEDULEDATETIME,
             s.STATUS, s.DRIVERID
      FROM RESERVATION r
      JOIN SCHEDULE s
        ON s.ROUTEID=r.ROUTEID AND s.ROUND=r.ROUND AND s.SCHEDULEDATETIME=r.SCHEDULEDATETIME
      WHERE r.QRCODE = :qrText
    `;
    const r = (await db.query(rsql, { qrText: qrText })).rows[0];
    if (!r) return res.status(404).json({ message: "Reservation not found" });

    if (r.DRIVERID !== empId)
      return res
        .status(403)
        .json({ message: "คนขับไม่ตรงกับตารางเวลา หรือ ลูกค้าอาจขึ้นผิดคัน" });
    if (r.STATUS !== "Running")
      return res.status(400).json({
        message:
          "QR Code ที่สแกนนี้เป็นของรอบที่ยังไม่ถึงเวลาเริ่มงานหรือเสร็จสิ้นไปแล้ว ",
      });
    //หา RESERVATIONID เพื่อ ใช้ ใน query อืนๆอีกที
    console.log("qrText", qrText);
    const reservationIdOnCheckin = (
      await db.query(
        `SELECT r.RESERVATIONID FROM RESERVATION  r
   WHERE r.QRCODE =:qrText`,
        { qrText: qrText }
      )
    ).rows[0];
    // กันเช็คอินซ้ำ

    const dup = `SELECT 1 FROM CHECKIN_LOG cl JOIN RESERVATION r 
    ON cl.RESERVATIONID = r.RESERVATIONID
    WHERE r.RESERVATIONID= :reservId`;
    const reservId = reservationIdOnCheckin.RESERVATIONID;
    console.log("reservationIdOnCheckin", reservationIdOnCheckin);
    console.log("reservId", reservId);
    if ((await db.query(dup, { reservId })).rows[0]) {
      console.log("Already checked-in");
      return res.status(400).json({ message: "เช็คอินไปแล้ว" });
    }

    // บันทึก check-in
    await db.query(
      `INSERT INTO CHECKIN_LOG (CHECKIN_ID, RESERVATIONID, EMPLOYEEID, CHECKIN_TIME)
       VALUES (CHECKIN_SEQ.NEXTVAL, :rid, :did, SYSDATE)`,
      { rid: reservId, did: empId },
      { autoCommit: true }
    );
    // บันทึก check-in
    await db.query(
      `UPDATE RESERVATION
      SET RESERVATIONSTATUSID=5
       WHERE RESERVATIONID=:rid`,
      { rid: reservId },
      { autoCommit: true }
    );
    // อัพเดตเวลาที่ตั๋ว
    await db.query(
      `UPDATE RESERVATION SET CHECKINTIME=SYSDATE WHERE RESERVATIONID=:rid`,
      { rid: reservId },
      { autoCommit: true }
    );

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/driver/finish
// body: { routeId, round, scheduleDateTime }
router.post("/driver/finish", authRequired, driverOnly, async (req, res) => {
  try {
    const empId = await getMyEmployeeId(req.user.accountId);
    const { routeId, round, scheduleDateTime } = req.body || {};
    const dt1 = new Date(scheduleDateTime);
    // dt1.setHours(dt1.getHours() - 7); //ใช้ กับ postman
    const formatted =
      dt1.getFullYear() +
      "-" +
      String(dt1.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(dt1.getDate()).padStart(2, "0") +
      " " +
      String(dt1.getHours()).padStart(2, "0") +
      ":" +
      String(dt1.getMinutes()).padStart(2, "0") +
      ":" +
      String(dt1.getSeconds()).padStart(2, "0");
    console.log(routeId, round, formatted, empId);

    // ยืนยันสิทธิ์
    const ok = (
      await db.query(
        `SELECT STATUS FROM SCHEDULE
       WHERE ROUTEID=:rid AND ROUND=:rnd 
       AND TRUNC(SCHEDULEDATETIME, 'MI') = TRUNC(TO_DATE(:dt1, 'YYYY-MM-DD HH24:MI:SS'),'MI')
         AND DRIVERID=:did`,
        { rid: routeId, rnd: round, dt1: formatted, did: empId }
      )
    ).rows[0];
    if (!ok) return res.status(403).json({ message: "Not your schedule" });
    if (ok.STATUS !== "Running")
      return res.status(400).json({ message: "Schedule not running" });

    // close schedule
    await db.query(
      `UPDATE SCHEDULE SET STATUS='Finished', ENDTIME=SYSDATE
       WHERE ROUTEID=:rid AND ROUND=:rnd AND TRUNC(SCHEDULEDATETIME, 'MI') = TRUNC(TO_DATE(:dt1, 'YYYY-MM-DD HH24:MI:SS'),'MI') AND DRIVERID=:did`,
      { rid: routeId, rnd: round, dt1: formatted, did: empId },
      { autoCommit: true }
    );

    // ปิด reservation: ถ้ายัง Reserved และไม่มี CHECKINTIME -> NoShow(4), ถ้ามี CHECKINTIME -> Completed(2)
    const closeSql = `
      UPDATE RESERVATION r
      SET r.RESERVATIONSTATUSID = CASE
        WHEN r.CHECKINTIME IS NULL THEN 4 -- NoShow
        ELSE 2 -- Completed
      END,
      r.DROPOFFTIME = SYSDATE
      WHERE r.ROUTEID=:rid AND r.ROUND=:rnd AND r.SCHEDULEDATETIME=:dt1
        AND r.RESERVATIONSTATUSID = 1
    `;
    await db.query(
      closeSql,
      { rid: routeId, rnd: round, dt1 },
      { autoCommit: true }
    );

    // สรุปผล
    const sumSql = `
  SELECT
    SUM(CASE WHEN CHECKINTIME IS NOT NULL THEN PASSENGERCOUNT ELSE 0 END) AS ONBOARD,
    SUM(CASE WHEN CHECKINTIME IS NULL THEN PASSENGERCOUNT ELSE 0 END)     AS NOSHOW
  FROM RESERVATION
  WHERE ROUTEID=:rid AND ROUND=:rnd AND SCHEDULEDATETIME=:dt1
`;
    const sum = (await db.query(sumSql, { rid: routeId, rnd: round, dt1 }))
      .rows[0];
    // ดึงรายชื่อทั้งหมดพร้อมจุดขึ้น/ลง
    const listSql = `
  SELECT u.FIRSTNAME, u.LASTNAME,
         s1.STOPNAME AS PICKUPNAME, s2.STOPNAME AS DROPOFFNAME,
         r.PASSENGERCOUNT, 
         CASE WHEN r.CHECKINTIME IS NULL THEN 'NoShow' ELSE 'Onboard' END AS STATUS
  FROM RESERVATION r
  JOIN USER_ACCOUNT u ON u.USERID = r.USERID
  JOIN ROUTE_STOP rs1 ON rs1.ROUTEID=r.ROUTEID AND rs1.STOPORDER=r.PICKUPSTOPORDER
  JOIN STOP s1 ON s1.STOPID = rs1.STOPID
  JOIN ROUTE_STOP rs2 ON rs2.ROUTEID=r.ROUTEID AND rs2.STOPORDER=r.DROPOFFSTOPORDER
  JOIN STOP s2 ON s2.STOPID = rs2.STOPID
  WHERE r.ROUTEID=:rid AND r.ROUND=:rnd AND r.SCHEDULEDATETIME=:dt1
  ORDER BY r.PICKUPSTOPORDER
`;
    const passengerList = (
      await db.query(listSql, { rid: routeId, rnd: round, dt1 })
    ).rows;

    res.json({
      ok: true,
      onboard: Number(sum.ONBOARD || 0),
      noshow: Number(sum.NOSHOW || 0),
      passengerList,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
