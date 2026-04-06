import crypto from "crypto";

function generarIdCorto() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function fechaActual() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

export function generarUserId() {
  return `RECC-${generarIdCorto()}-${fechaActual()}`;
}
