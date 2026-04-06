const fetch = require("node-fetch");
const { connectDB } = require("./mongo");

const RPC = "TU RPC";
const START_BLOCK = 0;
const DELAY = 1950;

// ==========================
// 🟢 CONFIG DEX (AGREGADO)
const PAIR_ADDRESS = "0x0".toLowerCase();
const SWAP_METHOD = "0x38ad1889";

// 🔥 NUEVO (WRTS/WUSDT)
const PAIR_WRTS = "0xabc";

// 🔥 NUEVO — SWAP EVENT (PRO)
const SWAP_TOPIC =
"0xabc";

// 🔥 FIX REAL — ERC20 TRANSFER EVENT CORRECTO
const TRANSFER_TOPIC =
"0xabc";

// ==========================
// 🌐 RPC
async function rpc(method, params = []) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: 1,
    }),
  });

  return await res.json();
}

// ==========================
// ⏱ Delay
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================
// 🔥 HELPERS
function hexToBigInt(hex) {
  return BigInt(hex);
}

function formatUnits(v, decimals) {
  return Number(v) / 10 ** decimals;
}

function decodeSwap(log) {
  const data = log.data.slice(2);

  return {
    amount0In:  hexToBigInt("0x" + data.slice(0, 64)),
    amount1In:  hexToBigInt("0x" + data.slice(64, 128)),
    amount0Out: hexToBigInt("0x" + data.slice(128, 192)),
    amount1Out: hexToBigInt("0x" + data.slice(192, 256))
  };
}

// ==========================
async function getSwapLogs(fromBlock, toBlock, pair) {
  const logs = await rpc("eth_getLogs", [{
    fromBlock,
    toBlock,
    address: pair,
    topics: [SWAP_TOPIC]
  }]);

  return logs.result || [];
}

// ==========================
async function processDexLogs(blockNumber, db) {
  try {
    const hexBlock = "0x" + blockNumber.toString(16);
    const logs = await getSwapLogs(hexBlock, hexBlock, PAIR_WRTS);

    for (const log of logs) {
      const decoded = decodeSwap(log);
      const reserves = await getReserves(PAIR_WRTS);
      if (!reserves) continue;

      const r0 = formatUnits(BigInt(reserves.reserve0), 18);
      const r1 = formatUnits(BigInt(reserves.reserve1), 6);
      const price = r1 / r0;

      await db.collection("dex").insertOne({
        pair: "WRTS/WUSDT",
        type: "swap_log",
        amount0In: decoded.amount0In.toString(),
        amount1In: decoded.amount1In.toString(),
        amount0Out: decoded.amount0Out.toString(),
        amount1Out: decoded.amount1Out.toString(),
        price,
        block: blockNumber,
        timestamp: Date.now()
      });

      console.log("🔥 SWAP LOG DETECTADO | Precio:", price);
    }

  } catch (err) {
    console.log("❌ processDexLogs error:", err.message);
  }
}

// ==========================
async function processDexTx(tx, blockNumber, timestamp, db) {
  try {
    if (!tx.to) return;
    if (tx.to.toLowerCase() !== PAIR_ADDRESS) return;

    const methodId = tx.input.slice(0, 10);
    if (methodId !== SWAP_METHOD) return;

    const data = tx.input.slice(10);
    const tokenIn = "0x" + data.slice(24, 64);
    const amountIn = parseInt(data.slice(64, 128), 16);

    const reservesRaw = await rpc("eth_call", [{
      to: PAIR_ADDRESS,
      data: "0x09a4f1ac"
    }, "latest"]);

    if (!reservesRaw.result) return;

    const resHex = reservesRaw.result.slice(2);
    const reserve0 = parseInt(resHex.slice(0, 64), 16);
    const reserve1 = parseInt(resHex.slice(64, 128), 16);

    if (!reserve0 || !reserve1) return;

    const price = reserve1 / reserve0;

    await db.collection("dex").insertOne({
      pair: "RECC/WUSDT",
      tokenIn,
      amountIn: amountIn / 1e18,
      reserve0,
      reserve1,
      price,
      block: blockNumber,
      timestamp
    });

    console.log("💱 DEX SWAP DETECTADO | Precio:", price);

  } catch (err) {
    console.log("❌ DEX ERROR:", err.message);
  }
}

// ==========================
async function getReserves(pair) {
  try {
    const res = await rpc("eth_call", [
      { to: pair, data: "0x09a2f1gf" },
      "latest"
    ]);

    if (!res.result) return null;

    const hex = res.result.slice(2);

    return {
      reserve0: parseInt(hex.slice(0, 64), 16),
      reserve1: parseInt(hex.slice(64, 128), 16)
    };

  } catch (err) {
    console.log("❌ getReserves error:", err.message);
    return null;
  }
}

// ==========================
// 🔥 TPS REAL
async function updateTPS(db) {
  try {
    const lastBlocks = await db.collection("blocks")
      .find({})
      .sort({ number: -1 })
      .limit(20)
      .toArray();

    if (lastBlocks.length < 2) return;

    const first = lastBlocks[lastBlocks.length - 1];
    const last  = lastBlocks[0];

    const totalTxs = lastBlocks.reduce((acc, b) => acc + (b.txs || 0), 0);
    const timeDiff = (last.timestamp - first.timestamp) / 1000;

    if (timeDiff <= 0) return;

    const tps = totalTxs / timeDiff;

    await db.collection("stats").updateOne(
      { type: "global" },
      { $set: { tps } },
      { upsert: true }
    );

    console.log("⚡ TPS:", tps.toFixed(2));

  } catch (err) {
    console.log("❌ TPS ERROR:", err.message);
  }
}

// ==========================
async function processERC20Logs(blockNumber, db) {
  try {
    const hexBlock = "0x" + blockNumber.toString(16);

    const logs = await rpc("eth_getLogs", [{
      fromBlock: hexBlock,
      toBlock: hexBlock,
      topics: [TRANSFER_TOPIC]
    }]);

    if (!logs.result) return;

    for (const log of logs.result) {
      const token = log.address.toLowerCase();
      const from = "0x" + log.topics[1].slice(26);
      const to   = "0x" + log.topics[2].slice(26);
      const amount = BigInt(log.data).toString();

      await db.collection("tokens").updateOne(
        { address: token },
        { $setOnInsert: { address: token, detectedAt: blockNumber } },
        { upsert: true }
      );

      await db.collection("transfers").insertOne({
        token,
        from,
        to,
        amount,
        block: blockNumber,
        timestamp: Date.now()
      });
    }

  } catch (err) {
    console.log("❌ ERC20 ERROR:", err.message);
  }
}

// ==========================
// 🚀 MAIN
async function start() {
  const db = await connectDB();

  const blocksCol = db.collection("blocks");
  const txsCol = db.collection("txs");
  const statsCol = db.collection("stats");

  const last = await statsCol.findOne({ type: "global" });
  let currentBlock = last?.lastBlock ?? START_BLOCK;

  console.log("🚀 Indexador desde bloque:", currentBlock);

  while (true) {
    try {
      const latest = await rpc("eth_blockNumber");
      const latestNumber = parseInt(latest.result, 16);

      // 🔥 FIX ADELANTO
      if (currentBlock > latestNumber) {
        console.log("⚠️  Indexer adelantado, corrigiendo...");
        currentBlock = latestNumber;
      }

      while (currentBlock <= latestNumber) {

        const hexBlock = "0x" + currentBlock.toString(16);
        const block = await rpc("eth_getBlockByNumber", [hexBlock, true]);

        if (!block.result) {
          console.log("⏳ Esperando bloque real:", currentBlock);
          await sleep(1950);
          continue;
        }

        const timestamp = parseInt(block.result.timestamp, 16) * 1000;
        const txs = block.result.transactions || [];

        console.log("🧱 RECCNETWORK Procesando Bloques:", currentBlock, "| TXs:", txs.length);

        await blocksCol.insertOne({
          number: currentBlock,
          hash: block.result.hash,
          timestamp,
          txs: txs.length
        });

        for (const tx of txs) {
          await txsCol.insertOne({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: parseInt(tx.value || "0x0", 16) / 1e18,
            gas: parseInt(tx.gas || "0x0", 16),
            block: currentBlock,
            timestamp
          });

          await processDexTx(tx, currentBlock, timestamp, db);
        }

        await processDexLogs(currentBlock, db);
        await processERC20Logs(currentBlock, db);
        await updateWRTSPrice(db);
        await updateTPS(db);

        await statsCol.updateOne(
          { type: "global" },
          {
            $set: { lastBlock: currentBlock },
            $inc: { totalTxs: txs.length }
          },
          { upsert: true }
        );

        currentBlock++;
      }

      console.log("⏳ Sincronizado con el nodo...");
      await sleep(1950);

    } catch (err) {
      console.log("❌ Error:", err.message);
      await sleep(1950);
    }
  }
}

start();
