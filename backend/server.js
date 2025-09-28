const express = require("express");
const dotenv = require("dotenv");
const app = express();
const cors = require("cors");
dotenv.config();
const port = process.env.PORT || 3000;

const oracledb = require("oracledb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { authRequired } = require("./middleware/auth");
const bookingRoutes = require("./booking.js");
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
    ? "C:\\oracle1\\instantclient_23_9" // <-- change this path
    : "/opt/oracle/instantclient_11_2"; // <-- change for Linux

// oracledb.initOracleClient({ libDir: "C:\\oracle1\\instantclient_23_9" });
// console.log("Client version:", oracledb.oracleClientVersionString);

const db = require("./db/dbpool");

app.use("/api", bookingRoutes);

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

app.get("/api/stops", async (req, res) => {
  const rs = await db.query(
    "SELECT STOPID, STOPNAME FROM STOP ORDER BY STOPID"
  );
  res.json(rs.rows); // [{STOPID:1, STOPNAME:'MUT'}, ...]
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
    console.log("Before userRow");
    // req.user.positionId มาจาก payload ตอน login
    const sqlUser = `SELECT e.EMPLOYEEID, e.FIRSTNAME, e.LASTNAME, e.USERNAME, e.POSITIONID
         FROM EMPLOYEES e
        WHERE e.ACCOUNT_ID = :id`;
    const userRow = (await db.query(sqlUser, { id: accountId })).rows[0];
    console.log("After userRow", userRow);
    if (!userRow) {
      return res.status(404).json({ message: "User not found" });
    }
    console.log("Before sqlPerms");
    // ดึงสิทธิ์ของ positionId (จากตาราง POSITIONPERMISSION + PERMISSION)
    const sqlPerms = `SELECT p.PERMISSIONNAME
         FROM POSITIONPERMISSIONS pp
         JOIN PERMISSIONS p ON p.PERMISSIONID = pp.PERMISSIONID
        WHERE pp.POSITIONID = :pid
        ORDER BY p.PERMISSIONID`;

    const perms = (await db.query(sqlPerms, { pid: userRow.POSITIONID })).rows;
    console.log("Afer perms");
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
// select db.query  // อย่างอื่น execute      const result = await connection.execute(`SELECT * FROM EMPLOYEES`);
/////////////////////////////////////////////////////////////////////////////////////
app.get("/api/account", async (req, res) => {
  let connection;
  const sql = ` select a.ACCOUNT_ID , a.USERNAME , a.PASSWORD_HASH from account a `;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(sql);
    console.log("dept", result);
    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).send("ไม่สำเร็จ");
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
//-------------------------------------------------------------------------------------------------------------------------------
app.get("/api/position", async (req, res) => {
  let connection;
  const sql = ` select * from positions `;
  try {
    connection = await oracledb.getConnection();
    const result = await db.query(sql);
    console.log("dept", result);
    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).send("ไม่สำเร็จ");
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
//-----------------------------------------------------------------------------------------------------------------------
app.get("/api/department", async (req, res) => {
  let connection;
  const sql = ` select * from departments `;
  try {
    connection = await oracledb.getConnection();
    const result = await db.query(sql);
    console.log("dept", result);
    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).send("ไม่สำเร็จ");
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
//--------------------------------------------------------------------------------------------
app.get("/api/employee", async (req, res) => {
  let connection;
  const sql = `select e.employeeid, 
       e.firstname,
       e.lastname,
       a.username,
       a.password_hash,
       d.deptname,
       p.positionname,
       a.account_id
       from employees e , account a , departments d , positions p
       where (e.account_id = a.account_id) and 
       (e.departmentid=d.DEPARTMENTID) and
       (e.POSITIONID = p.POSITIONID)`;
  try {
    connection = await oracledb.getConnection();
    const result = await db.query(sql);
    console.log("hello", result);
    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).send("ไม่สำเร็จ");
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
// --------------------------------------------------------------------------------------------------------------------//
app.post("/api/employees", async (req, res) => {
  const { username, password, firstname, lastname, department, position } =
    req.body;
  console.log("Received data:", req.body); // ตรวจสอบข้อมูลที่รับจาก frontend

  let connection;
  try {
    // สร้างการเชื่อมต่อกับฐานข้อมูล
    connection = await oracledb.getConnection();

    console.log("Database connected successfully!");

    // ตรวจสอบว่า departmentid และ positionid มีอยู่ในตาราง departments และ positions หรือไม่
    const departmentCheck = await connection.execute(
      `SELECT * FROM departments WHERE departmentid = :departmentid`,
      { departmentid: department }
    );

    const positionCheck = await connection.execute(
      `SELECT * FROM positions WHERE positionid = :positionid`,
      { positionid: position }
    );

    // ตรวจสอบว่ามี departmentid และ positionid ที่ตรงกันในฐานข้อมูล
    if (departmentCheck.rows.length === 0) {
      console.log(`Department ID ${department} not found in database`);
      return res.status(400).send(`Invalid department ID: ${department}`);
    }

    if (positionCheck.rows.length === 0) {
      console.log(`Position ID ${position} not found in database`);
      return res.status(400).send(`Invalid position ID: ${position}`);
    }

    // 1. Insert Account and get Account ID
    const result = await connection.execute(
      `INSERT INTO account (USERNAME, PASSWORD_HASH, ACCOUNT_TYPE)
       VALUES (:USERNAME, :PASSWORD, :ACCOUNT_TYPE) 
       RETURNING account_id INTO :account_id`,
      {
        username,
        password,
        ACCOUNT_TYPE: "EMP",
        account_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    );

    const accountId = result.outBinds.account_id[0];

    // 2. Use sequence for employeeid to generate a unique ID automatically
    const resultid = await connection.execute(
      `SELECT seq_employee.NEXTVAL FROM dual`
    );
    const newid = resultid.rows[0][0]; // Get the next value from the sequence

    // 3. Insert Employee with generated account_id and newid
    const empresult = await connection.execute(
      `INSERT INTO employees (employeeid, firstname, lastname, username, password, departmentid, positionid, account_id)
       VALUES (:employeeid, :firstname, :lastname, :username, :password, :departmentid, :positionid, :account_id)`,
      {
        employeeid: newid,
        firstname: firstname,
        lastname: lastname,
        username: username,
        password: password,
        departmentid: department,
        positionid: position,
        account_id: accountId,
      }
    );

    // Commit the transaction
    await connection.execute("COMMIT");

    res.json({
      message: "Success: Account and Employee added!",
      account: {
        username: username,
        password: password,
        account_id: accountId,
      },
      employee: {
        employeeid: newid,
        firstname: firstname,
        lastname: lastname,
      },
    });
  } catch (err) {
    console.error("Database Error:", err);
    if (connection) {
      await connection.execute("ROLLBACK"); // ถ้ามีข้อผิดพลาดให้ rollback การทำงาน
    }
    res.status(500).send("DB Insert Error");
  } finally {
    if (connection) await connection.close(); // ปิดการเชื่อมต่อฐานข้อมูล
  }
});

/////////////////////////////////////////////////////////////////////////////////////
app.put("/api/employees/:id", async (req, res) => {
  const employeeId = req.params.id; // ใช้ ID จาก URL ในการค้นหาข้อมูลพนักงาน
  const { username, password, firstname, lastname, department, position } =
    req.body; // รับข้อมูลที่อัปเดต

  console.log("Received data for update:", req.body);

  if (!username || !firstname || !lastname || !department || !position) {
    return res
      .status(400)
      .json({ error: "Missing required fields for update" });
  }

  let connection;
  try {
    connection = await oracledb.getConnection();

    console.log("Database connected successfully!");

    // ตรวจสอบว่า department และ position มีอยู่ในฐานข้อมูลหรือไม่
    const departmentCheck = await connection.execute(
      `SELECT * FROM departments WHERE departmentid = :departmentid`,
      { departmentid: department }
    );

    const positionCheck = await connection.execute(
      `SELECT * FROM positions WHERE positionid = :positionid`,
      { positionid: position }
    );

    if (departmentCheck.rows.length === 0) {
      return res.status(400).send(`Invalid department ID: ${department}`);
    }

    if (positionCheck.rows.length === 0) {
      return res.status(400).send(`Invalid position ID: ${position}`);
    }

    // 1. อัปเดตข้อมูลในตาราง employees
    const empResult = await connection.execute(
      `UPDATE employees
       SET username = :username, password = :password, firstname = :firstname, lastname = :lastname, departmentid = :departmentid, positionid = :positionid
       WHERE employeeid = :employeeid`,
      {
        username,
        password,
        firstname,
        lastname,
        departmentid: department,
        positionid: position,
        employeeid: employeeId,
      }
    );

    // 2. อัปเดตข้อมูลในตาราง account
    const accResult = await connection.execute(
      `UPDATE account
       SET username = :username, password_hash = :password
       WHERE account_id = (SELECT account_id FROM employees WHERE employeeid = :employeeid)`,
      {
        username,
        password,
        employeeid: employeeId,
      }
    );

    // Commit the transaction
    await connection.execute("COMMIT");

    res.json({
      message: "Employee data updated successfully!",
      updatedEmployee: {
        employeeid: employeeId,
        username,
        firstname,
        lastname,
        department,
        position,
      },
    });
  } catch (err) {
    console.error("Database Error:", err);
    if (connection) {
      await connection.execute("ROLLBACK"); // Rollback ถ้ามีข้อผิดพลาด
    }
    res.status(500).send("DB Update Error");
  } finally {
    if (connection) await connection.close(); // ปิดการเชื่อมต่อฐานข้อมูล
  }
});

/////////////////////////////////////////////////////////////////////////////////////
app.delete("/api/employees/:id", async (req, res) => {
  const employeeId = req.params.id;
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `DELETE FROM Employees WHERE employeeid = :employeeid`,
      { employeeId },
      { autoCommit: true }
    );
    res.json({ message: "Employee deleted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).send("DB Delete Error");
  } finally {
    if (connection) await connection.close();
  }
});
/////////////////////////////////////////////////////////////////////////////////////

app.post("/api/positions", authRequired, async (req, res) => {
  console.log(req.body);
  const positionName = req.body.POSITIONNAME;
  const conn = await oracledb.getConnection();
  console.log(positionName);
  try {
    await conn.execute(
      "INSERT INTO POSITIONS (POSITIONNAME) VALUES (:positionName)",
      { positionName: positionName },
      { autoCommit: false }
    );

    await conn.commit();
    res.json({ message: "Successful", positionName });
  } catch (error) {
    await conn.rollback();
    console.log(error);
  } finally {
    conn.close();
  }
});

// positions list
app.get("/api/positions", authRequired, async (req, res) => {
  const sql = `SELECT POSITIONID, POSITIONNAME FROM POSITIONS ORDER BY POSITIONID`;
  const position = (await db.query(sql)).rows;
  res.json(position);
});

app.get("/api/permissions", authRequired, async (req, res) => {
  const sql = `SELECT PERMISSIONID, PERMISSIONNAME FROM PERMISSIONS ORDER BY PERMISSIONID`;
  const permission = (await db.query(sql)).rows;
  res.json(permission);
});

app.post("/api/employee", async (req, res) => {
  console.log("Request Body: ", req.body);

  // แนะนำให้ส่งเป็น *_ID ไม่ใช่ NAME ถ้าคอลัมน์เป็น FK ID
  const { FIRSTNAME, LASTNAME, DEPARTMENTID, POSITIONID } = req.body;

  // ✅ validate
  if (!FIRSTNAME || !LASTNAME || !DEPARTMENTID || !POSITIONID) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  let connection;
  try {
    connection = await oracledb.getConnection();

    // ใช้ sequence + returning
    const sql = `
      INSERT INTO EMPLOYEES (EMPLOYEEID, FIRSTNAME, LASTNAME, DEPARTMENTID, POSITIONID)
      VALUES (SEQ_EMPLOYEES.NEXTVAL, :FIRSTNAME, :LASTNAME, :DEPARTMENTID, :POSITIONID)
      RETURNING EMPLOYEEID INTO :NEWID
    `;

    const binds = {
      FIRSTNAME,
      LASTNAME,
      DEPARTMENTID, // ควรเป็นตัวเลข หรือแปลง Number(DEPARTMENTID)
      POSITIONID, // ควรเป็นตัวเลข หรือแปลง Number(POSITIONID)
      NEWID: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };

    const result = await connection.execute(sql, binds, { autoCommit: true });

    const newId = result.outBinds.NEWID?.[0];
    return res.json({ message: "inserted success", EMPLOYEEID: newId });
  } catch (err) {
    console.error(err);
    return res.status(500).send("DB Insert Error");
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch {}
    }
  }
});

app.get("/api/positione-employee", authRequired, async (req, res) => {
  try {
    const sql = `SELECT p.POSITIONID AS POSITIONID ,p.POSITIONNAME AS POSITIONNAME ,
    count(e.EMPLOYEEID) AS NOOFEMP FROM EMPLOYEES e
RIGHT JOIN POSITIONS p   ON e.POSITIONID  =p.POSITIONID
GROUP BY p.POSITIONID ,p.POSITIONNAME ORDER BY POSITIONNAME  `;
    const result = (await db.query(sql)).rows;

    res.json(result);
  } catch (error) {
    console.log(error);
  }
});

app.put("/api/position/:positionid", authRequired, async (req, res) => {
  const positionid = req.params.positionid;
  try {
    const conn = await oracledb.getConnection();
    await conn.execute(
      `UPDATE POSITIONS
                      SET POSITIONNAME='MONKEY'
                      WHERE POSITIONID=:positionid`,
      { positionid: positionid },
      { autoCommit: false }
    );
    await conn.commit();
  } catch (error) {
    conn.rollback();
    console.log(error);
    res.json(error);
  }
});

app.get("/api/positions/:id/permissions", async (req, res) => {
  console.log("Fetching permissions for position ID:", req.params.id);
  const sql = `SELECT p.PERMISSIONID, TRIM(p.PERMISSIONNAME) AS PERMISSIONNAME
               FROM POSITIONPERMISSIONS pp 
               JOIN PERMISSIONS p ON p.PERMISSIONID = pp.PERMISSIONID
               WHERE pp.POSITIONID = :id
               ORDER BY p.PERMISSIONID`;
  const rs = await db.query(sql, { id: Number(req.params.id) });
  res.json(rs.rows);
});

app.put("/api/positions/:id/permissions", authRequired, async (req, res) => {
  const positionId = Number(req.params.id);
  const permissionIds = req.body.permissionIds; // [1, 2, 3]
  console.log(positionId, permissionIds);
  const conn = await oracledb.getConnection();
  try {
    await conn.execute(
      "DELETE FROM POSITIONPERMISSIONS WHERE POSITIONID = :id",
      { id: positionId },
      { autoCommit: false }
    );

    // กันค่าซ้ำใน array ก่อน
    const uniqueIds = [...new Set(permissionIds)];

    // bulk insert จะเร็วและชัดกว่า loop
    const binds = uniqueIds.map((pid) => ({
      POSITIONID: positionId,
      PERMISSIONID: pid,
    }));
    console.log("Binds for insert:", binds);
    if (binds.length) {
      await conn.executeMany(
        `INSERT INTO POSITIONPERMISSIONS (POSITIONID, PERMISSIONID)
       VALUES (:POSITIONID, :PERMISSIONID)`,
        binds,
        { autoCommit: false }
      );
    }

    await conn.commit();
    res.json({ message: "Update successful", positionId, permissionIds });
  } catch (err) {
    console.log(err);
    await conn.rollback();
    return res.status(500).json({ message: "Update failed" });
  } finally {
    await conn.close();
  }
});

app.delete("/api/positions/:id", authRequired, async (req, res) => {
  const id = req.params.id;
  const conn = await oracledb.getConnection();
  try {
    conn.execute(
      `DELETE FROM POSITIONS
                  WHERE POSITIONID=:id`,
      { id: id },
      { autoCommit: false }
    );
    conn.commit();
    res.json({ message: "Delete Successfully" });
  } catch (error) {
    conn.rollback();
    res.json(error);
  } finally {
    conn.close();
  }
});

app.post("/api/logout", (req, res) => {
  console.log("Logging out");
  res.clearCookie(process.env.COOKIE_NAME);
  res.json({ message: "Logged out successfully" });
});

app.get("/api/employees", async (req, res) => {
  try {
    const sql = `
SELECT e.EMPLOYEEID,
e.FIRSTNAME,
e.LASTNAME,
e.DEPARTMENTID,
d.DEPTNAME,
e.POSITIONID,
p.POSITIONNAME,
e.ACCOUNT_ID,
a.USERNAME as ACCOUNT_USERNAME,
a.ACCOUNT_TYPE
FROM EMPLOYEES e
LEFT JOIN DEPARTMENTS d ON d.DEPARTMENTID = e.DEPARTMENTID
LEFT JOIN POSITIONS p ON p.POSITIONID = e.POSITIONID
LEFT JOIN ACCOUNT a ON a.ACCOUNT_ID = e.ACCOUNT_ID
ORDER BY e.EMPLOYEEID`;
    const rows = (await db.query(sql)).rows;
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch employees" });
  }
});

app.get("/api/employees/:id", async (req, res) => {
  try {
    const rows = (
      await db.query(
        `SELECT EMPLOYEEID, FIRSTNAME, LASTNAME, DEPARTMENTID, POSITIONID, ACCOUNT_ID
FROM EMPLOYEES WHERE EMPLOYEEID = :id`,
        { id: req.params.id }
      )
    ).rows;
    if (!rows.length) return res.status(404).json({ message: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch employee" });
  }
});

//////////////////////////////////////////////////// Booking//////////////////////////////////////////

app.post("/routes/search", async (req, res) => {
  try {
    const { startStop, endStop } = req.body || {};
    if (!startStop || !endStop) {
      return res
        .status(400)
        .json({ message: "startStop และ endStop จำเป็นต้องระบุ" });
    }

    const sql = `
      SELECT
        r.ROUTEID,
        r.ROUTENAME,
        s1.STOPNAME     AS STARTSTOP,
        rs1.STOPORDER   AS STARTORDER,
        s2.STOPNAME     AS ENDSTOP,
        rs2.STOPORDER   AS ENDORDER,
        (
          SELECT SUM(NVL(rsx.TIMETONEXT, 0))
          FROM ROUTE_STOP rsx
          WHERE rsx.ROUTEID = r.ROUTEID
            AND rsx.STOPORDER >= rs1.STOPORDER
            AND rsx.STOPORDER <  rs2.STOPORDER
        ) AS TOTAL_MINUTES
      FROM ROUTE r
      JOIN ROUTE_STOP rs1 ON r.ROUTEID = rs1.ROUTEID
      JOIN STOP s1        ON s1.STOPID  = rs1.STOPID
      JOIN ROUTE_STOP rs2 ON r.ROUTEID = rs2.ROUTEID
      JOIN STOP s2        ON s2.STOPID  = rs2.STOPID
      WHERE
        UPPER(TRIM(s1.STOPNAME)) = UPPER(TRIM(:startStop))
        AND UPPER(TRIM(s2.STOPNAME)) = UPPER(TRIM(:endStop))
        AND rs1.STOPORDER < rs2.STOPORDER
      ORDER BY r.ROUTEID
    `;

    const rows = (await db.query(sql, { startStop, endStop })).rows;
    return res.json(rows);
  } catch (err) {
    console.error("search routes error:", err);
    return res.status(500).json({ message: "Server error" });
  }
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
