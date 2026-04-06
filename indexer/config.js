module.exports = {
  RPC: "TU RPC",

  START_BLOCK: 0,        // desde dónde empieza
  BATCH_SIZE: 1,         // bloques por ciclo (lo dejamos en 1 por ahora)
  DELAY: 2000,            // ms entre consultas (para no saturar)

  DB_PATH: "./db.json"
};
