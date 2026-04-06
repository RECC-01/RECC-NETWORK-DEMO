import express from "express";
import cors from "cors";
import { pool } from "./database/db.js";
import userRoutes from "./users/userRoutes.js";

// 🔥 IMPORT WALLET CONTROLLER
import { getWalletData, importWallet, importMultipleWallets } from "./wallet/walletController.js";

const app = express();

app.use(cors());
app.use(express.json());

// 🔹 USERS
app.use("/api/users", userRoutes);

// 🔥 WALLET ROUTES (AGREGADO)
app.get("/api/wallet/:address", getWalletData);

// 🔹 IMPORTAR 1 CUENTA
app.post("/api/wallet/import", importWallet);

// 🔹 IMPORTAR MÚLTIPLES CUENTAS (GENESIS)
app.post("/api/wallet/import-multiple", importMultipleWallets);


// 🔹 ROOT
app.get("/", (req, res) => {
  res.send("RECC Wallet API funcionando 🚀");
});


// 🔹 DB
pool.connect()
  .then(() => console.log("✅ Conectado a PostgreSQL"))
  .catch(err => console.error("❌ Error DB:", err));


// 🔹 SERVER
app.listen(8000,"0.0.0.0", () => {
  console.log("Servidor corriendo en http://TU SERVIDOR");
});
