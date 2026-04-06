const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider("TU RPC");

// 🔥 Dirección WUSDT (CAMBIA SI ES OTRA)
const WUSDT = "0xabc";

// ABI mínima
const ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

async function run(){
  try{

    const address = "0xabc";

    const token = new ethers.Contract(WUSDT, ABI, provider);

    const bal = await token.balanceOf(address);
    const dec = await token.decimals();
    const sym = await token.symbol();

    console.log("TOKEN:", sym);
    console.log("BALANCE:", ethers.formatUnits(bal, dec));

  }catch(e){
    console.log("ERROR:", e.message);
  }
}

run();
