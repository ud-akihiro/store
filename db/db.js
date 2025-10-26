// db.js
import mysql from "mysql2";
import dotenv from "dotenv";
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "mysql",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "mysqlpass",
  database: process.env.MYSQL_DATABASE || "store",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // 金額をDECIMALで数値として受けたい場合：decimalNumbers: true,
});
