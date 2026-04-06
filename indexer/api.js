console.log("🔥 ESTE ES EL API CORRECTO 🔥");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { MongoClient } = require("mongodb");

const app = express();

// 🔐 CONFIG
const PORT = process.env.PORT || 5050;
const MONGO_URI = process.env.MONGO_URI || "mongodb://TU MONGO";
const DB_NAME = "recc_indexer";

// 🛡️ MIDDLEWARES
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
});
app.use(limiter);

// 📦 Mongo
const client = new MongoClient(MONGO_URI);
let db;

// ----------------------
// ❤️ HEALTH
// ----------------------
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "RECC API",
  });
});

// ----------------------
// 🔹 BLOQUES
// ----------------------
app.get("/blocks", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const blocks = await db.collection("blocks")
      .find()
      .sort({ number: -1 })
      .limit(limit)
      .toArray();

    res.json(blocks);
  } catch (err) {
    console.error("❌ /blocks error:", err);
    res.status(500).json({ error: "Error obteniendo bloques" });
  }
});

app.get("/block/:num", async (req, res) => {
  try {
    const num = parseInt(req.params.num);

    const block = await db.collection("blocks").findOne({ number: num });

    if (!block) {
      return res.status(404).json({ error: "Bloque no encontrado" });
    }

    res.json(block);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo bloque" });
  }
});

// ----------------------
// 🔹 TXS
// ----------------------
app.get("/txs", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const txs = await db.collection("txs")
      .find()
      .sort({ blockNumber: -1 })
      .limit(limit)
      .toArray();

    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo transacciones" });
  }
});

// ----------------------
// 🔥 TX COMPLETA (CON TOKENS)
// ----------------------
app.get("/tx/:hash", async (req, res) => {
  try {
    const hash = req.params.hash;

    const tx = await db.collection("txs").findOne({ hash });

    if (!tx) {
      return res.status(404).json({ error: "TX no encontrada" });
    }

    const transfers = await db.collection("transfers").find({
      txHash: hash
    }).toArray();

    res.json({
      ...tx,
      transfers // 🔥 ahora incluye tokens reales
    });

  } catch (err) {
    console.error("❌ /tx error:", err);
    res.status(500).json({ error: "Error obteniendo TX" });
  }
});

// ----------------------
// 🔥 ADDRESS COMPLETO
// ----------------------
app.get("/address/:addr", async (req, res) => {
  try {
    const addr = req.params.addr.toLowerCase();

    const txs = await db.collection("txs")
      .find({
        $or: [{ from: addr }, { to: addr }],
      })
      .sort({ blockNumber: -1 })
      .limit(50)
      .toArray();

    const transfers = await db.collection("transfers")
      .find({
        $or: [{ from: addr }, { to: addr }],
      })
      .sort({ blockNumber: -1 })
      .limit(50)
      .toArray();

    res.json({
      address: addr,
      txs,
      transfers
    });

  } catch (err) {
    console.error("❌ /address error:", err);
    res.status(500).json({ error: "Error obteniendo address" });
  }
});

// ----------------------
// 🔥 BALANCE
// ----------------------
app.get("/balance/:addr", async (req, res) => {
  try {
    const addr = req.params.addr.toLowerCase();

    const txs = await db.collection("txs").find({
      $or: [{ from: addr }, { to: addr }]
    }).toArray();

    let balance = 0;

    txs.forEach(tx => {
      if (tx.to === addr) balance += Number(tx.value || 0);
      if (tx.from === addr) balance -= Number(tx.value || 0);
    });

    res.json({ address: addr, balance });

  } catch (err) {
    res.status(500).json({ error: "Error obteniendo balance" });
  }
});

// ----------------------
// 🔥 TOKENS (ARREGLADO REAL)
// ----------------------
app.get("/tokens/:addr", async (req, res) => {
  try {
    const addr = req.params.addr.toLowerCase();

    const transfers = await db.collection("transfers").find({
      $or: [{ from: addr }, { to: addr }]
    }).toArray();

    const balances = {};

    for (const tx of transfers) {

      if (!tx.token || !tx.amount) continue;

      const token = tx.token.toLowerCase();

      if (!balances[token]) balances[token] = 0n;

      if (tx.to === addr) balances[token] += BigInt(tx.amount);
      if (tx.from === addr) balances[token] -= BigInt(tx.amount);
    }

    const tokens = Object.keys(balances)
      .filter(t => balances[t] > 0n)
      .map(t => ({
        token: t,
        balance: balances[t].toString()
      }));

    res.json({ address: addr, tokens });

  } catch (err) {
    console.error("❌ /tokens error:", err);
    res.status(500).json({ error: "Error obteniendo tokens" });
  }
});

// ----------------------
// 🔥 STATS
// ----------------------
app.get("/stats", async (req, res) => {
  try {
    const totalBlocks = await db.collection("blocks").countDocuments();
    const totalTxs = await db.collection("txs").countDocuments();

    res.json({
      totalBlocks,
      totalTxs,
      tps: 0
    });

  } catch (err) {
    res.status(500).json({ error: "Error obteniendo stats" });
  }
});

// ----------------------
// 🔥 PRICE
// ----------------------
app.get("/price/:pair", async (req, res) => {
  try {
    const pair = req.params.pair;

    const data = await db.collection("dex").findOne({ pair });

    res.json({
      pair,
      price: data?.price || 0
    });

  } catch (err) {
    res.status(500).json({ error: "Error obteniendo precio" });
  }
});

// ----------------------
// ❌ 404
// ----------------------
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// ----------------------
// 💥 ERROR GLOBAL
// ----------------------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Error interno" });
});

// ----------------------
// 🚀 START
// ----------------------
async function start() {
  try {
    await client.connect();
    db = client.db(DB_NAME);

    console.log("✅ RECCNETWORK Mongo conectado");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 RECCNETWORK API corriendo en puerto ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Error Mongo:", err);
    process.exit(1);
  }
}

start();
