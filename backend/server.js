const express = require("express");
const dotenv = require("dotenv");
const app = express();
const cors = require("cors");
dotenv.config();
const port = process.env.PORT || 3000;
const db = require("./db/dbpool");
const oracledb = require("oracledb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { authRequired } = require("./middleware/auth");

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true, // Allow cookies to be sent
  })
);
app.use(cookieParser());
app.use(express.json()); // Middleware to parse JSON request bodies
const clientLibDir =
  process.platform === "win32"
    ? "C:\\oracle\\instantclient_23_9" // <-- change this path
    : "/opt/oracle/instantclient_11_2"; // <-- change for Linux

oracledb.initOracleClient({ libDir: clientLibDir });

app.get("/api/users", async (req, res) => {
  const page = Math.max(parseInt(req.query.page || "1"), 1);
  const limit = Math.max(parseInt(req.query.lmit || "10"), 1);
  const offset = (page - 1) * limit;

  try {
    const sql = `
     SELECT USERID, FIRSTNAME, LASTNAME
  FROM (
    SELECT USERID, FIRSTNAME, LASTNAME,
           ROW_NUMBER() OVER (ORDER BY USERID) AS RN
    FROM USER_ACCOUNT
  )
  WHERE RN BETWEEN :offset + 1 AND :offset + :limit
    `;
    const countSql = `SELECT COUNT(*) AS TOTAL FROM USER_ACCOUNT`;

    const [rowsResult, countResult] = await Promise.all(
      //ยิงทั้งสอง query ไปพร้อมกัน แล้วรอจนกว่าทั้งคู่เสร็จ
      [db.query(sql, { offset, limit }), db.query(countSql)]
    );

    const total = countResult.rows[0].TOTAL;
    res.json({
      page,
      limit,
      total,
      data: rowsResult.rows,
    });
  } catch (err) {
    console.log(err);
  }
});
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  console.log(username, password);
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }
  try {
    const sql = `SELECT ACCOUNT_ID, USERNAME, ACCOUNT_TYPE
             FROM ACCOUNT
             WHERE USERNAME = :username AND PASSWORD_HASH = :password`;
    const result = await db.query(sql, { username, password });
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const user = result.rows[0];
    const payload = {
      username: user.USERNAME,
      accountId: user.ACCOUNT_ID,
      accountType: user.ACCOUNT_TYPE,
    };
    // Generate JWT
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.cookie(process.env.COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // ใช้ http บน localhost
      path: "/", // ใช้ได้ทั้งแอป
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.json({ message: "Login successful", user: payload });
  } catch (err) {
    console.log(err);
  }
});
app.get("/api/me", authRequired, async (req, res) => {
  const { accountId, accountType } = req.user;
  console.log(accountId, accountType);
  if (accountType === "EMP") {
    // req.user.positionId มาจาก payload ตอน login
    const sqlUser = `SELECT e.EMPLOYEEID, e.FIRSTNAME, e.LASTNAME, e.USERNAME, e.POSITIONID
         FROM EMPLOYEES e
        WHERE e.ACCOUNT_ID = :id`;
    const userRow = (await db.query(sqlUser, { id: accountId })).rows[0];
    if (!userRow) {
      return res.status(404).json({ message: "User not found" });
    }
    // ดึงสิทธิ์ของ positionId (จากตาราง POSITIONPERMISSION + PERMISSION)
    const sqlPerms = `SELECT p.PERMISSIONNAME
         FROM POSITIONPERMISSIONS pp
         JOIN PERMISSIONS p ON p.PERMISSIONID = pp.PERMISSIONID
        WHERE pp.POSITIONID = :pid
        ORDER BY p.PERMISSIONID`;
    const perms = (await db.query(sqlPerms, { pid: userRow.POSITIONID })).rows;

    res.json({
      username: userRow.USERNAME,
      firstname: userRow.FIRSTNAME,
      lastname: userRow.LASTNAME,
      positionId: userRow.POSITIONID,
      permissions: perms.map((p) => p.PERMISSIONNAME), // ['CanManageUsers', ...]
    });
  }
  if (accountType === "USER") {
    // req.user.positionId มาจาก payload ตอน login
    const sqlUser = `SELECT USERID, FIRSTNAME, LASTNAME, USERNAME, STATUSID
         FROM USER_ACCOUNT
        WHERE ACCOUNT_ID = :id`;
    const userRow = (await db.query(sqlUser, { id: accountId })).rows[0];
    if (!userRow) {
      return res.status(404).json({ message: "User not found" });
    }
    const permissions = ["CanReservation"];

    res.json({
      username: userRow.USERNAME,
      firstname: userRow.FIRSTNAME,
      lastname: userRow.LASTNAME,
      positionId: userRow.POSITIONID,
      permissions,
    });
  }
});

app.post("/api/logout", (req, res) => {
  console.log("Logging out");
  res.clearCookie(process.env.COOKIE_NAME);
  res.json({ message: "Logged out successfully" });
});
// Initialize the database connection pool
db.initialize()
  .then(() => {
    console.log("Database initialized");
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
  })
  .then(() => {
    // Start the server only after the database is initialized
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  });
