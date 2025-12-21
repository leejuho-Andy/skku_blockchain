import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

    // 배포된 금고 주소
    // 배포된 금고 주소
    const vaultAddress = "0x31F225d3A56C1f5C16c92762Aa14B3e07fdEbC44";
    const artifact = JSON.parse(
        readFileSync("./artifacts/contracts/MultiSigTreasury.sol/MultiSigTreasury.json", "utf8")
    );
    const vault = new ethers.Contract(vaultAddress, artifact.abi, wallet);

    console.log("========================================");
    console.log("🏦 멀티시그 금고 데모");
    console.log("========================================");
    
    // 1. 현재 상태 확인
    console.log("\n[1] 현재 금고 상태");
    const balance = await vault.getBalance();
    console.log("   💰 잔액:", ethers.formatEther(balance), "ETH");
    
    const required = await vault.required();
    console.log("   ✅ 필요 승인 수:", required.toString());

    const owner0 = await vault.owners(0);
    console.log("   👤 Owner 1:", owner0);

    // 2. 거래 제안
    console.log("\n[2] 거래 제안하기");
    console.log("   📝 제안: 0.0001 ETH를 테스트 주소로 보내기");
    
    const tx1 = await vault.propose(
        "0x0000000000000000000000000000000000000003", // 받는 주소
        ethers.parseEther("0.0001") // 금액
    );
    await tx1.wait();
    console.log("   ✅ 제안 완료! 트랜잭션:", tx1.hash);

    // 3. 거래 정보 확인
    const txCount = await vault.transactions.length;
    console.log("\n[3] 거래 정보 확인");
    
    const txInfo = await vault.transactions(0);
    console.log("   📋 거래 #0:");
    console.log("      - 받는 주소:", txInfo.to);
    console.log("      - 금액:", ethers.formatEther(txInfo.value), "ETH");
    console.log("      - 실행됨:", txInfo.executed);
    console.log("      - 승인 수:", txInfo.approvals.toString());

    // 4. 승인하기
    console.log("\n[4] 거래 승인하기");
    const tx2 = await vault.approve(0);
    await tx2.wait();
    console.log("   ✅ 승인 완료! 트랜잭션:", tx2.hash);

    // 5. 승인 후 상태
    const txInfoAfter = await vault.transactions(0);
    console.log("\n[5] 승인 후 상태");
    console.log("   📋 거래 #0 승인 수:", txInfoAfter.approvals.toString());

    console.log("\n========================================");
    console.log("⚠️  2-of-3 멀티시그라서 1명 승인으론 실행 불가!");
    console.log("   다른 Owner가 approve(0) 해야 execute 가능");
    console.log("========================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});