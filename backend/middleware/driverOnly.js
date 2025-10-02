const db = require("../db/dbpool");

async function driverOnly(req, res, next) {
  // สมมติคุณใส่ req.user.positionName มาแล้วจาก login
  const sql = `
         SELECT p.POSITIONNAME  FROM positions p JOIN
 EMPLOYEES e ON e.POSITIONID  =p.POSITIONID
 JOIN ACCOUNT  a ON a.ACCOUNT_ID  =e.ACCOUNT_ID
 WHERE e.ACCOUNT_ID  = :accountId
        `;
  const rows = (await db.query(sql, { accountId: req.user.accountId })).rows[0];
  console.log(rows);

  if (rows.POSITIONNAME !== "Driver") {
    return res.status(403).json({ message: "Driver only" });
  }
  next();
}
module.exports = driverOnly;
