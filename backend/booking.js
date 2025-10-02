const express = require("express");
const oracledb = require("oracledb");
const db = require("./db/dbpool");
const { authRequired } = require("./middleware/auth");
const router = express.Router();
const QRCode = require("qrcode");

const clientLibDir =
  process.platform === "win32"
    ? "C:\\oracle\\instantclient_23_9" // <-- change this path
    : "/opt/oracle/instantclient_11_2"; // <-- change for Linux

oracledb.initOracleClient({ libDir: clientLibDir });
// const conn = await oracledb.getConnection();

// function buildStatusWhere(status) {
//   // mapping ค่าที่มาจาก frontend เช่น upcoming / completed / cancelled
//   switch (status) {
//     case "upcoming":
//       // แสดงการเดินทางที่ยังไม่ถึงเวลา และยังจองอยู่
//       return "AND r.RESERVATIONSTATUSID = 1 AND r.SCHEDULEDATETIME > SYSDATE";
//     case "completed":
//       // แสดงการเดินทางที่เสร็จสิ้น
//       return "AND r.RESERVATIONSTATUSID = 2";
//     case "cancelled":
//       // แสดงการจองที่ถูกยกเลิก
//       return "AND r.RESERVATIONSTATUSID = 3";
//     case "noshow":
//       return "AND r.RESERVATIONSTATUSID = 4";
//     default:
//       // ถ้าไม่ส่ง status จะให้เห็นทั้งหมด
//       return "";
//   }
// }

///  ดีงรายการจองของ User
router.get("/my-reservations", authRequired, async (req, res) => {
  try {
    if (req.user.accountType !== "USER") {
      return res.status(401).json({ message: "Unauthenticated" });
    }

    const userRow = (
      await db.query(
        `SELECT u.USERID FROM USER_ACCOUNT u WHERE u.ACCOUNT_ID = :aid`,
        { aid: req.user.accountId }
      )
    ).rows[0];
    if (!userRow) return res.status(400).json({ message: "User not found" });

    const status = String((req.query.status || "all").toLowerCase());

    console.log("status = ", status);
    // ต่อ fragment เฉพาะค่าที่อนุญาต (whitelist)
    let statusWhere = "";
    switch (status) {
      case "upcoming":
        statusWhere = `AND r.RESERVATIONSTATUSID = 1 AND r.SCHEDULEDATETIME > SYSDATE`;
        break;
      case "completed":
        statusWhere = `AND r.RESERVATIONSTATUSID = 2`;
        break;
      case "cancelled":
        statusWhere = `AND r.RESERVATIONSTATUSID = 3`;
        break;
      case "noshow":
        statusWhere = `AND r.RESERVATIONSTATUSID = 4`;
        break;
      case "all":
      default:
        statusWhere = ``; // ไม่กรองเพิ่ม
    }
    console.log("User id", userRow.USERID);
    const sql = `
      SELECT
        r.RESERVATIONID,
        r.ROUTEID,
        rt.ROUTENAME,
        r.ROUND,
        r.SCHEDULEDATETIME,
        r.PICKUPSTOPORDER,
        r.DROPOFFSTOPORDER,
        r.RESERVATIONTIME,
        r.RESERVATIONSTATUSID,
        r.PASSENGERCOUNT,
        r.QRCODE,
        s1.STOPNAME AS PICKUPNAME,
        s2.STOPNAME AS DROPOFFNAME
      FROM RESERVATION r
      JOIN ROUTE rt ON rt.ROUTEID = r.ROUTEID
      JOIN ROUTE_STOP rs1 ON rs1.ROUTEID = r.ROUTEID AND rs1.STOPORDER = r.PICKUPSTOPORDER
      JOIN STOP      s1  ON s1.STOPID   = rs1.STOPID
      JOIN ROUTE_STOP rs2 ON rs2.ROUTEID = r.ROUTEID AND rs2.STOPORDER = r.DROPOFFSTOPORDER
      JOIN STOP      s2  ON s2.STOPID   = rs2.STOPID
      WHERE r.USERID = :userid
      ${statusWhere}
      ORDER BY r.SCHEDULEDATETIME DESC
    `;
    const userid = userRow.USERID;
    const rows = (await db.query(sql, { userid })).rows;

    res.json(
      rows.map((x) => ({
        reservationId: x.RESERVATIONID,
        routeId: x.ROUTEID,
        routeName: x.ROUTENAME,
        round: x.ROUND,
        scheduleDateTime: x.SCHEDULEDATETIME,
        pickup: { order: x.PICKUPSTOPORDER, name: x.PICKUPNAME },
        dropoff: { order: x.DROPOFFSTOPORDER, name: x.DROPOFFNAME },
        passengerCount: x.PASSENGERCOUNT,
        statusId: x.RESERVATIONSTATUSID,
        qr: x.QRCODE,
        canCancel:
          x.RESERVATIONSTATUSID === 1 &&
          new Date(x.SCHEDULEDATETIME).getTime() > Date.now() + 20 * 60 * 1000,
      }))
    );
  } catch (err) {
    console.error("Database query error", err);
    res.status(500).json({ message: "Server error" });
  }
});
///////////////// ยกเลิกการจองของผู้ใช้
router.post("/booking/cancel/:id", authRequired, async (req, res) => {
  try {
    if (req.user.accountType !== "USER")
      return res.status(401).json({ message: "Unauthenticated" });

    const rid = Number(req.params.id);

    const u = (
      await db.query(
        `SELECT USERID FROM USER_ACCOUNT WHERE ACCOUNT_ID = :aid`,
        { aid: req.user.accountId }
      )
    ).rows[0];
    if (!u) return res.status(400).json({ message: "User not found" });

    // อนุญาตยกเลิกได้เฉพาะสถานะ Reserved และเวลา > 20 นาที
    const sql = `
      UPDATE RESERVATION
      SET RESERVATIONSTATUSID = 3  -- Cancelled
      WHERE RESERVATIONID = :rid
        AND USERID = :userid
        AND RESERVATIONSTATUSID = 1
        AND SCHEDULEDATETIME > SYSDATE + (20/1440)
    `;
    const rs = await db.query(
      sql,
      { rid, userid: u.USERID },
      { autoCommit: true }
    );
    if (rs.rowsAffected === 0)
      return res.status(400).json({
        message: "ยกเลิกไม่ได้ (เลยเวลา/สถานะไม่ถูกต้อง/ไม่ใช่ของคุณ)",
      });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

///  Generate QR CODE
router.get("/booking/qrcode/:id", authRequired, async (req, res) => {
  try {
    if (req.user.accountType !== "USER")
      return res.status(401).json({ message: "Unauthenticated" });

    const rid = Number(req.params.id);

    // ดึง qr ใน database + ตรวจว่าเป็นของ user
    const row = (
      await db.query(
        `
        SELECT r.QRCODE
        FROM RESERVATION r
        JOIN USER_ACCOUNT u ON u.USERID = r.USERID
        WHERE r.RESERVATIONID = :rid
          AND u.ACCOUNT_ID = :aid
      `,
        { rid, aid: req.user.accountId }
      )
    ).rows[0];
    if (!row) return res.status(404).json({ message: "Not found" });
    //แปลง text เป็นรูป QR แล้วคืนค่าเป็น Data URL (เช่น data:image/png;base64,....)
    const dataUrl = await QRCode.toDataURL(String(row.QRCODE), {
      errorCorrectionLevel: "M", // ระดับการแก้ไขความผิดพลาดของ QR "L" ~7% , "M" ~15% , "Q" ~25% , "H" ~30% (ยิ่งสูง QR จะหนาแน่นขึ้น)
      width: 320, //ความกว้างภาพ (พิกเซล) ของ PNG ที่สร้าง
      margin: 1, //ขอบขาวรอบ QR (modules) ยิ่งมากยิ่งอ่านง่ายขึ้นบนพื้นหลังรก ๆ
    });
    console.log(row);
    res.json({ dataUrl, qrCode: row.QRCODE }); // ส่ง qr code  กลับไป
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

async function findRoutesWithSegment(startStopId, endStopId) {
  console.log("findRoutesWithSegment", startStopId, endStopId);
  const sql = `
    SELECT r.ROUTEID AS routeId,
      r.ROUTENAME AS routeName,
      rs1.STOPORDER AS startOrder,
      rs2.STOPORDER AS endOrder
    FROM ROUTE r
    JOIN ROUTE_STOP rs1 ON r.ROUTEID = rs1.ROUTEID
    JOIN STOP s1 ON s1.STOPID = rs1.STOPID
    JOIN ROUTE_STOP rs2 ON r.ROUTEID = rs2.ROUTEID
    JOIN STOP s2 ON s2.STOPID = rs2.STOPID
    WHERE s1.STOPID = :startStopId
      AND s2.STOPID = :endStopId
      AND rs1.STOPORDER < rs2.STOPORDER
    ORDER BY r.ROUTEID
  `;
  return (await db.query(sql, { startStopId, endStopId })).rows;
}

async function fetchSegmentStops(routeId, startOrder, endOrder) {
  const sql = `
   SELECT 
  s.STOPORDER,
  st.STOPNAME
FROM ROUTE_STOP s
JOIN STOP st ON s.STOPID = st.STOPID
WHERE s.ROUTEID = :routeId
  AND s.STOPORDER BETWEEN :startOrder AND :endOrder
ORDER BY s.STOPORDER
  `;
  return (await db.query(sql, { routeId, startOrder, endOrder })).rows;
}

const minutesToHHMM = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
};

router.post("/booking/options", async (req, res) => {
  try {
    const { startStopId, endStopId } = req.body || {};
    if (!startStopId || !endStopId) {
      return res
        .status(400)
        .json({ message: "กรุณาระบุ startStopId และ endStopId" });
    }

    // 1) หาเส้นทางที่ผ่าน start->end
    const routes = await findRoutesWithSegment(startStopId, endStopId);
    if (routes.length === 0) return res.json([]);

    const minTime = new Date(Date.now() + 20 * 60 * 1000);
    const result = [];

    for (const r of routes) {
      // ใช้คีย์พิมพ์ใหญ่ตามที่ DB คืนมา
      const routeId = r.ROUTEID;
      const routeName = r.ROUTENAME;
      const startOrder = r.STARTORDER;
      const endOrder = r.ENDORDER;

      // 1.1 ป้ายที่ผ่าน
      const stops = await fetchSegmentStops(routeId, startOrder, endOrder);

      // 1.2 คำนวณเวลารวมเดินทาง (sum TIMETONEXT ตั้งแต่ startOrder ถึง endOrder-1)
      const durSql = `
        SELECT COALESCE(SUM(TIMETONEXT), 0) AS DURATION_MIN
        FROM ROUTE_STOP
        WHERE ROUTEID = :rid
          AND STOPORDER >= :startOrder
          AND STOPORDER <  :endOrder
          AND NVL(ISACTIVE, 'Y') = 'Y'
      `;
      const durRs = await db.query(durSql, {
        rid: routeId,
        startOrder,
        endOrder,
      });
      const durationMinutes = Number(durRs.rows?.[0]?.DURATION_MIN || 0);
      const durationText = minutesToHHMM(durationMinutes);

      // 1.3 ดึงรอบในอนาคต + คำนวณที่นั่งคงเหลือ
      const schedSql = `
        SELECT
          s.ROUTEID, s.ROUND, s.SCHEDULEDATETIME,
          b.PLATENUMBER,
          bt.CAPACITY,
          (
            SELECT NVL(SUM(r.PASSENGERCOUNT), 0)
            FROM RESERVATION r
            WHERE r.ROUTEID = s.ROUTEID
              AND r.ROUND = s.ROUND
              AND r.SCHEDULEDATETIME = s.SCHEDULEDATETIME
              AND r.RESERVATIONSTATUSID IN (1)
              AND r.PICKUPSTOPORDER < :endOrder
              AND r.DROPOFFSTOPORDER > :startOrder
          ) AS USED_SEATS
        FROM SCHEDULE s
        JOIN BUS b      ON b.BUSID       = s.BUSID
        JOIN BUSTYPE bt ON bt.BUSTYPEID  = b.BUSTYPEID
        WHERE s.ROUTEID = :routeId
          AND s.SCHEDULEDATETIME >= :minTime
          AND s.STATUS = 'Pending'
        ORDER BY s.SCHEDULEDATETIME
      `;

      const schedRows = (
        await db.query(schedSql, {
          routeId,
          startOrder,
          endOrder,
          minTime,
        })
      ).rows;

      for (const row of schedRows) {
        const used = Number(row.USED_SEATS) || 0;
        const cap = Number(row.CAPACITY) || 0;
        const left = Math.max(cap - used, 0);

        result.push({
          routeId,
          routeName,
          round: row.ROUND,
          scheduleDateTime: row.SCHEDULEDATETIME,
          plateNumber: row.PLATENUMBER,
          capacity: cap,
          seatsLeft: left,
          startOrder,
          endOrder,
          stops,
          // เวลารวมเดินทางแนบมาด้วย
          durationMinutes,
          durationText,
        });
      }
    }

    // เรียงตามเวลา
    result.sort(
      (a, b) => new Date(a.scheduleDateTime) - new Date(b.scheduleDateTime)
    );
    res.json(result);
  } catch (error) {}
});
router.post("/booking/create", authRequired, async (req, res) => {
  try {
    const {
      routeId,
      round,
      scheduleDateTime,
      startOrder,
      endOrder,
      passengerCount,
    } = req.body || {};

    const { accountType, accountId } = req.user || null;

    const userSql = `SELECT u.USERID  FROM USER_ACCOUNT u JOIN ACCOUNT a ON u.ACCOUNT_ID = a.ACCOUNT_ID
WHERE u.ACCOUNT_ID = :accountId `;

    const userId = (
      await db.query(userSql, {
        accountId,
      })
    ).rows[0];
    if (!userId) return res.status(400).json({ message: "Not found User" });
    // console.log("ก่อน check การจอง");
    const checkReservSql = `
      SELECT COUNT(*) AS CNT
      FROM RESERVATION
      WHERE USERID = :userId
        AND ROUTEID = :routeId
        AND ROUND = :round
        AND TRUNC(SCHEDULEDATETIME) = TRUNC(:scheduleDateTime)
        AND RESERVATIONSTATUSID IN (1)  -- Reserved หรือ Completed เท่านั้น
    `;
    // console.log("data", userId, routeId, round);
    const check = await db.query(checkReservSql, {
      userId: userId?.USERID,
      routeId,
      round,
      scheduleDateTime: new Date(scheduleDateTime),
    });

    if (check.rows[0].CNT > 0) {
      return res.status(400).json({
        ok: false,
        message: "คุณได้จองรอบนี้ไปแล้ว ไม่สามารถจองซ้ำได้",
      });
    }
    console.log("หลังจาก check การจอง");
    if (accountType !== "USER")
      return res.status(401).json({ message: "Unauthenticated" });

    if (!routeId || !round || !scheduleDateTime || !startOrder || !endOrder) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }
    if (Number(passengerCount) <= 0) {
      return res.status(400).json({ message: "จำนวนที่นั่งต้องมากกว่า 0" });
    }
    if (Number(passengerCount) > 4) {
      return res
        .status(400)
        .json({ message: "จองได้สูงสุด 4 ที่นั่งต่อครั้ง" });
    }
    console.log(accountId);

    //ตรวจสอบเวลาก่อน 20 นาทีอีกครั้ง
    const schedTime = new Date(scheduleDateTime);
    const minTime = new Date(Date.now() + 20 * 60 * 1000);
    if (schedTime < minTime) {
      return res
        .status(400)
        .json({ message: "ต้องจองล่วงหน้าอย่างน้อย 20 นาที" });
    }

    //ดึงข้อมูลจำนวนที่นั่ง
    const checkSql = `
      SELECT
        bt.CAPACITY,
        (
          SELECT NVL(SUM(r.PASSENGERCOUNT), 0)
          FROM RESERVATION r
          WHERE r.ROUTEID = :routeId
            AND r.ROUND = :round
            AND r.SCHEDULEDATETIME = :scheduleDateTime
            AND r.RESERVATIONSTATUSID IN (1)
            AND r.PICKUPSTOPORDER < :endOrder
            AND r.DROPOFFSTOPORDER > :startOrder
        ) AS USED_SEATS
      FROM SCHEDULE s
      JOIN BUS b      ON b.BUSID = s.BUSID
      JOIN BUSTYPE bt ON bt.BUSTYPEID = b.BUSTYPEID
      WHERE s.ROUTEID = :routeId
        AND s.ROUND = :round
        AND s.SCHEDULEDATETIME = :scheduleDateTime
    `;
    console.log(routeId, round, schedTime, startOrder, endOrder);
    const row = (
      await db.query(checkSql, {
        routeId,
        round,
        scheduleDateTime: schedTime,
        startOrder,
        endOrder,
      })
    ).rows[0];
    if (!row) return res.status(400).json({ message: "Not found Route" });

    const cap = Number(row.CAPACITY) || 0;
    const used = Number(row.USED_SEATS) || 0;
    const left = Math.max(cap - used, 0);

    console.log("Seat Left", left);
    if (left < passengerCount) {
      return res
        .status(400)
        .json({ message: `ที่นั่งว่างไม่พอ (เหลือ ${left})` });
    }

    const qr = Math.random().toString(36).slice(2).toUpperCase();

    const insertSql = `
      INSERT INTO RESERVATION
      (RESERVATIONID, USERID, ROUTEID, ROUND, SCHEDULEDATETIME,
       PICKUPSTOPORDER, DROPOFFSTOPORDER, RESERVATIONTIME,
       RESERVATIONSTATUSID, PASSENGERCOUNT, QRCODE)
      VALUES
      (RESERVATION_SEQ.NEXTVAL, :userId, :routeId, :round, :scheduleDateTime,
       :startOrder, :endOrder, SYSDATE,
       1, :passengerCount, :qr)
      RETURNING RESERVATIONID INTO :outId
    `;
    // console.log(
    //   userId.USERID,
    //   routeId,
    //   round,
    //   schedTime,
    //   startOrder,
    //   endOrder,
    //   passengerCount,
    //   qr
    // );
    const binds = {
      userId: Number(userId?.USERID ?? userId),
      routeId: Number(routeId?.ROUTEID ?? routeId),
      round: Number(round),
      scheduleDateTime:
        schedTime instanceof Date ? schedTime : new Date(schedTime),
      startOrder: Number(startOrder),
      endOrder: Number(endOrder),
      passengerCount: Number(passengerCount),
      qr: String(qr), // ถ้าเป็น Buffer ให้ใช้ { val: qr, type: db.BLOB }
      outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };
    const rs = await db.query(insertSql, binds, { autoCommit: true });
    const reservationId = rs.outBinds?.outId?.[0] || null;

    res.json({
      ok: true,
      reservationId,
      qr,
      seatsLeftAfter: left - passengerCount,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error });
  }
});

module.exports = router;
