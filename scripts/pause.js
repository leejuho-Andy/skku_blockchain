import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 1 || !["on", "off"].includes(args[0])) {
        console.log("사용법: node scripts/pause.js <on|off>");
        process.exit(1);
    }

    const action = args[0];

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);
    const vaultAddress = process.env.VAULT_ADDRESS;

    const vaultArtifact = JSON.parse(readFileSync("./artifacts/contracts/MultiSigTreasury.sol/MultiSigTreasury.json", "utf8"));
    const vault = new ethers.Contract(vaultAddress, vaultArtifact.abi, wallet);

    const currentPaused = await vault.paused();
    
    console.log("========================================");
    console.log("🚨 비상정지");
    console.log("========================================");
    console.log("현재 상태:", currentPaused ? "🔴 정지됨" : "🟢 정상");
    console.log("요청:", action === "on" ? "정지 활성화" : "정지 해제");

    if (action === "on" && currentPaused) {
        console.log("\n⚠️ 이미 정지 상태!");
        return;
    }
    if (action === "off" && !currentPaused) {
        console.log("\n⚠️ 이미 정상 상태!");
        return;
    }

    const tx = action === "on" ? await vault.pause() : await vault.unpause();
    console.log("\n⏳ 처리 중...");
    await tx.wait();

    const newPaused = await vault.paused();
    console.log("\n✅ 완료!");
    console.log("   새 상태:", newPaused ? "🔴 정지됨" : "🟢 정상");
}

main().catch(console.error);
