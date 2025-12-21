import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log("========================================");
        console.log("사용법: node scripts/propose.js <받는주소> <금액ETH> <설명>");
        console.log("========================================");
        console.log("\n예시:");
        console.log('  node scripts/propose.js 0x0000...0001 0.0003 "사무용품"  → L1 (즉시)');
        console.log('  node scripts/propose.js 0x0000...0001 0.0008 "장비구매"   → L2 (30초)');
        console.log('  node scripts/propose.js 0x0000...0001 0.0015 "서버구매"   → L3 (60초)');
        console.log("\n등급 기준:");
        console.log("  L1: 0.0005 ETH 이하 → 타임락 없음");
        console.log("  L2: 0.0005~0.001 ETH → 타임락 30초");
        console.log("  L3: 0.001~0.002 ETH → 타임락 60초");
        process.exit(1);
    }

    const [to, amountStr, description] = args;
    const amount = ethers.parseEther(amountStr);

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);
    const vaultAddress = process.env.VAULT_ADDRESS;

    const vaultArtifact = JSON.parse(readFileSync("./artifacts/contracts/MultiSigTreasury.sol/MultiSigTreasury.json", "utf8"));
    const vault = new ethers.Contract(vaultAddress, vaultArtifact.abi, wallet);

    // 🚨 비상정지 상태 체크
    const isPaused = await vault.paused();
    if (isPaused) {
        console.log("========================================");
        console.log("🚨 비상정지 상태!");
        console.log("========================================");
        console.log("\n❌ 현재 컨트랙트가 정지되어 있어 제안할 수 없습니다.");
        console.log("\n💡 해제하려면: node scripts/pause.js off");
        return;
    }

    // 등급 판단
    const limits = await vault.getLimits();
    let level;
    if (amount <= limits.l1Threshold) level = "L1 (타임락 없음)";
    else if (amount <= limits.l2Threshold) level = "L2 (타임락 30초)";
    else level = "L3 (타임락 60초)";

    console.log("========================================");
    console.log("📝 ETH 지출 제안");
    console.log("========================================");
    console.log("받는 주소:", to);
    console.log("금액:", amountStr, "ETH");
    console.log("등급:", level);
    console.log("설명:", description);

    const tx = await vault.proposeETH(to, amount, description);
    console.log("\n⏳ 제안 중...");
    await tx.wait();

    const txCount = await vault.getTransactionCount();
    const txId = txCount - 1n;

    console.log("\n✅ 제안 완료!");
    console.log("   거래 ID:", txId.toString());
    console.log("   TX:", tx.hash);
    console.log("\n👉 다음 단계: node scripts/approve.js", txId.toString());
}

main().catch(console.error);
