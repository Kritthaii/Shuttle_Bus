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
     // select db.query  // อย่างอื่น execute      const result = await connection.execute(`SELECT * FROM EMPLOYEES`); 
/////////////////////////////////////////////////////////////////////////////////////
app.get("/api/account",async (req,res) => { 
  let connection; 
   const sql = ` select a.ACCOUNT_ID , a.USERNAME , a.PASSWORD_HASH from account a `
  try{ 
    connection = await oracledb.getConnection();
     const result = await connection.execute(sql);
    console.log("dept",result)
     res.json(result.rows); }catch(err)
     { console.log(err); res.status(500).send("ไม่สำเร็จ"); } finally
     { if(connection)
      { await connection.close(); } 
    } 
  });
//-------------------------------------------------------------------------------------------------------------------------------
app.get("/api/position",async (req,res) => { 
  let connection; 
   const sql = ` select * from positions `
  try{ 
    connection = await oracledb.getConnection();
     const result = await db.query(sql)
    console.log("dept",result)
     res.json(result.rows); }catch(err)
     { console.log(err); res.status(500).send("ไม่สำเร็จ"); } finally
     { if(connection)
      { await connection.close(); } 
    } 
  });
//-----------------------------------------------------------------------------------------------------------------------
app.get("/api/department",async (req,res) => { 
  let connection; 
   const sql = ` select * from departments `
  try{ 
    connection = await oracledb.getConnection();
     const result = await db.query(sql)
    console.log("dept",result)
     res.json(result.rows); }catch(err)
     { console.log(err); res.status(500).send("ไม่สำเร็จ"); } finally
     { if(connection)
      { await connection.close(); } 
    } 
  });
//--------------------------------------------------------------------------------------------
 app.get("/api/employee",async (req,res) => { 
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
       (e.POSITIONID = p.POSITIONID)`
  try{ 
    connection = await oracledb.getConnection();
     const result = await db.query(sql)
    console.log("hello",result)
     res.json(result.rows); }catch(err)
     { console.log(err); res.status(500).send("ไม่สำเร็จ"); } finally
     { if(connection)
      { await connection.close(); } 
    } 
  });
     // --------------------------------------------------------------------------------------------------------------------//
    app.post("/api/employees", async (req, res) => {
  const { username, password, firstname, lastname, department, position } = req.body;
  console.log("Received data:", req.body);  // ตรวจสอบข้อมูลที่รับจาก frontend
        

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
        account_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
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
        account_id: accountId
      }
    );

    // Commit the transaction
    await connection.execute("COMMIT");

    res.json({
      message: "Success: Account and Employee added!",
      account: {
        username: username,
        password: password,
        account_id: accountId
      },
      employee: {
        employeeid: newid,
        firstname: firstname,
        lastname: lastname
      }
    });

  } catch (err) {
    console.error("Database Error:", err);
    if (connection) {
      await connection.execute("ROLLBACK");  // ถ้ามีข้อผิดพลาดให้ rollback การทำงาน
    }
    res.status(500).send("DB Insert Error");
  } finally {
    if (connection) await connection.close();  // ปิดการเชื่อมต่อฐานข้อมูล
  }
});

/////////////////////////////////////////////////////////////////////////////////////
app.put("/api/employees/:id", async (req, res) => {
  const employeeId = req.params.id;  // ใช้ ID จาก URL ในการค้นหาข้อมูลพนักงาน
  const { username, password, firstname, lastname, department, position } = req.body;  // รับข้อมูลที่อัปเดต

  console.log("Received data for update:", req.body);

  if (!username || !firstname || !lastname || !department || !position) {
    return res.status(400).json({ error: 'Missing required fields for update' });
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
        employeeid: employeeId
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
        employeeid: employeeId
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
        position
      }
    });

  } catch (err) {
    console.error("Database Error:", err);
    if (connection) {
      await connection.execute("ROLLBACK");  // Rollback ถ้ามีข้อผิดพลาด
    }
    res.status(500).send("DB Update Error");
  } finally {
    if (connection) await connection.close();  // ปิดการเชื่อมต่อฐานข้อมูล
  }
});

/////////////////////////////////////////////////////////////////////////////////////
app.delete("/api/employees/:id",async (req,res)=>{
  const employeeId = req.params.id;
  let connection
  try{
       connection = await oracledb.getConnection()
       await connection.execute(`DELETE FROM Employees WHERE employeeid = :employeeid`,
        {employeeId},
        {autoCommit: true}
       )
      res.json({ message: "Employee deleted successfully!" });    
  }catch(err){
     console.error(err);
    res.status(500).send("DB Delete Error");
  }finally{
     if(connection)  await connection.close();
  }
});
/////////////////////////////////////////////////////////////////////////////////////

   



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
