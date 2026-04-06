import pkg from "pg";

const { Pool } = pkg;

export const pool = new Pool({
  user: "recc_user",
  host: "localhost",
  database: "recc_wallet",
  password: "TU PASSWORD",
  port: 5421,
});

