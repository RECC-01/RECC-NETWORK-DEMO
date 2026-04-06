const { MongoClient } = require("mongodb");

const url = "mongodb://TU MONGO";
const client = new MongoClient(url);

let db;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("recc_indexer");
    console.log("RECCNETWORK 📡 🌎 Mongo conectado");
  }
  return db;
}

module.exports = { connectDB };
