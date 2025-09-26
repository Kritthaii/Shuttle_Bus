const oracledb = require("oracledb");
const dotenv = require("dotenv");
dotenv.config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECTION_STRING,
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 1,
};

async function initialize() {
  try {
    await oracledb.createPool(dbConfig);
    console.log("Database connection pool started");
  } catch (err) {
    console.error("Error initializing database connection pool:", err);
  }
}

async function close() {
  try {
    await oracledb.getPool().close(10);
    console.log("Database connection pool closed");
  } catch (err) {
    console.error("Error closing database connection pool:", err);
  }
}

/*@param {string} sql
@param {object} binds
@param {object} options
*/
async function query(sql, binds = {}, opts = {}) {
  let conn;
  const options = { outFormat: oracledb.OUT_FORMAT_OBJECT, ...opts };
  try {
    conn = await oracledb.getConnection();
    const result = await conn.execute(sql, binds, options);
    return result;
  } catch (err) {
    console.error("Database query error", err);
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}
async function commit() {
  if (conn) {
    try {
      await conn.commit();
    } catch (err) {
      console.error("Commit error", err);
      throw err;
    }
  }
}
module.exports = { initialize, close, query };
