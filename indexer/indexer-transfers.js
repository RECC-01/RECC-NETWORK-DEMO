const { ethers } = require("ethers");
const { MongoClient } = require("mongodb");

const RPC = "TU RPC";
const provider = new ethers.JsonRpcProvider(RPC);

const client = new MongoClient("mongodb://TU MONGO");

async function start() {

  await client.connect();
  const db = client.db("recc_indexer");

  console.log("🔥 Indexer TRANSFERS + TOKENS iniciado");

  const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

  // 🔥 IMPORTANTE: empezar desde el inicio REAL
  let lastBlock = 1;

  const STEP = 500; // 🔥 tamaño seguro para evitar error RPC

  while (true) {
    try {

      const currentBlock = await provider.getBlockNumber();

      // 🔥 Si ya estamos al día, esperamos
      if (lastBlock > currentBlock) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      const toBlock = Math.min(lastBlock + STEP, currentBlock);

      let logs = [];

      try {
        logs = await provider.getLogs({
          fromBlock: lastBlock,
          toBlock: toBlock,
          topics: [TRANSFER_TOPIC]
        });
      } catch (err) {
        console.log("❌ Sub-range error:", err.message);

        // 🔥 Si falla el rango, reducimos el STEP dinámicamente
        lastBlock = lastBlock + Math.floor(STEP / 2);
        continue;
      }

      for (const log of logs) {

        try {

          const from = "0x" + log.topics[1].slice(26);
          const to = "0x" + log.topics[2].slice(26);
          const amount = BigInt(log.data).toString();
          const tokenAddress = log.address.toLowerCase();

          // 🔥 Guardar transfer
          await db.collection("transfers").updateOne(
            {
              txHash: log.transactionHash,
              logIndex: log.index
            },
            {
              $set: {
                txHash: log.transactionHash,
                token: tokenAddress,
                from: from.toLowerCase(),
                to: to.toLowerCase(),
                amount,
                blockNumber: log.blockNumber
              }
            },
            { upsert: true }
          );

          // 🔥 AUTO DETECT TOKEN (una sola vez)
          const exists = await db.collection("tokens").findOne({ address: tokenAddress });

          if (!exists) {
            try {

              const token = new ethers.Contract(tokenAddress, [
                "function symbol() view returns (string)",
                "function decimals() view returns (uint8)",
                "function name() view returns (string)"
              ], provider);

              const symbol = await token.symbol();
              const decimals = await token.decimals();
              const name = await token.name();

              await db.collection("tokens").insertOne({
                address: tokenAddress,
                symbol,
                decimals,
                name
              });

              console.log("🟢 Token detectado:", symbol);

            } catch (e) {
              // algunos contratos no son ERC20 válidos
            }
          }

        } catch (err) {
          console.log("❌ Error procesando log:", err.message);
        }
      }

      console.log(`✅ RECCNETWORK Bloques procesados: ${lastBlock} → ${toBlock}`);

      lastBlock = toBlock + 1;

    } catch (err) {
      console.log("❌ Error general:", err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

start();
