const oracledb = require("oracledb");
oracledb.initOracleClient({ libDir: "C:\\oracle1\\instantclient_23_9" });
console.log("Client version:", oracledb.oracleClientVersionString);
