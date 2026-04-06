import axios from "axios";
import { ethers } from "ethers";

const INDEXER_URL = "TU PUERTO"; // puerto real

// 🔥 BALANCE REAL DESDE INDEXER (NO SE TOCA)
export async function getWalletData(req, res) {
  try {
    const { address } = req.params;

    const clean = address.replace("recc1-", "");

    const response = await axios.get(`${INDEXER_URL}/address/${clean}`);

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo datos reales"
    });
  }
}


// 🔥 IMPORTAR UNA WALLET (NUEVO)
export async function importWallet(req, res) {
  try {
    const { private_key } = req.body;

    const wallet = new ethers.Wallet(private_key);

    res.json({
      success: true,
      address: wallet.address
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Private key inválida"
    });
  }
}


// 🔥 IMPORTAR MÚLTIPLES CUENTAS (GENESIS) 🔥
export async function importMultipleWallets(req, res) {
  try {
    const { private_keys } = req.body;

    if (!Array.isArray(private_keys)) {
      return res.status(400).json({
        success: false,
        error: "Debe enviar un array de private_keys"
      });
    }

    const wallets = private_keys.map(pk => {
      try {
        const wallet = new ethers.Wallet(pk);

        return {
          address: wallet.address,
          recc_address: `recc1-${wallet.address}`
        };

      } catch {
        return null;
      }
    }).filter(Boolean);

    res.json({
      success: true,
      wallets
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Error importando wallets"
    });
  }
}
