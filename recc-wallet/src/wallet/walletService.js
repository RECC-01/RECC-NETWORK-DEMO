import { ethers } from "ethers";

// 🔐 CREAR WALLET
export function crearWallet() {
  const wallet = ethers.Wallet.createRandom();

  const address = wallet.address;
  const alias = `recc1-${address}`;

  return {
    address,        // REAL (0x...)
    alias,          // VISUAL (recc1-0x...)
    privateKey: wallet.privateKey
  };
}
