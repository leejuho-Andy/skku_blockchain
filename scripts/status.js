import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

    const vaultAddress = process.env.VAULT_ADDRESS;
    const ticketAddress = process.env.TICKET_ADDRESS;

    const vaultArtifact = JSON.parse(readFileSync("./artifacts/contracts/MultiSigTreasury.sol/MultiSigTreasury.json", "utf8"));
    const ticketArtifact = JSON.parse(readFileSync("./artifacts/contracts/ChangeTicket.sol/ChangeTicket.json", "utf8"));
    
    const vault = new ethers.Contract(vaultAddress, vaultArtifact.abi, wallet);
    const ticket = new ethers.Contract(ticketAddress, ticketArtifact.abi, wallet);

    console.log("========================================");
    console.log("📊 시스템 상태 조회");
    console.log("========================================");

    // 금고 상태
    console.log("\n💰 [금고]");
    console.log("   주소:", vaultAddress);
    console.log("   잔액:", ethers.formatEther(await vault.getBalance()), "ETH");
    console.log("   비상정지:", (await vault.paused()) ? "🔴 정지됨" : "🟢 정상");

    // 설정
    const limits = await vault.getLimits();
    console.log("\n⚙️ [설정]");
    console.log("   L1 임계값:", ethers.formatEther(limits.l1Threshold), "ETH 이하");
    console.log("   L2 임계값:", ethers.formatEther(limits.l2Threshold), "ETH 이하");
    console.log("   거래당 한도:", ethers.formatEther(limits.txLimit), "ETH");

    for (let i = 0; i < 3; i++) {
        const timelock = await vault.timelockDuration(i);
        const levelNames = ["L1", "L2", "L3"];
        console.log(`   ${levelNames[i]} 타임락: ${timelock}초`);
    }

    // 역할 정보
    console.log("\n👥 [Owner 목록]");
    const owners = await vault.getOwners();
    owners.forEach((o, i) => console.log(`   ${i+1}. ${o}`));

    // 거래 목록
    const txCount = await vault.getTransactionCount();
    console.log("\n📋 [거래 목록] 총", txCount.toString(), "건");
    
    for (let i = 0; i < txCount; i++) {
        const tx = await vault.getTransaction(i);
        const [canExec, reason] = await vault.canExecute(i);
        const levelNames = ["L1", "L2", "L3"];
        
        let status;
        if (tx.executed) status = "✅ 실행완료";
        else if (tx.cancelled) status = "❌ 취소됨";
        else if (canExec) status = "🟢 실행가능";
        else status = "🟡 대기중";
        
        console.log(`\n   [거래 #${i}] ${status}`);
        console.log(`     금액: ${ethers.formatEther(tx.value)} ETH (${levelNames[tx.level]})`);
        console.log(`     설명: ${tx.description}`);
        console.log(`     승인: ${tx.approvals}/2`);
        
        if (!tx.executed && !tx.cancelled) {
            if (tx.approvals >= 2 && Number(tx.timelockUntil) > Math.floor(Date.now()/1000)) {
                const remaining = Number(tx.timelockUntil) - Math.floor(Date.now()/1000);
                console.log(`     타임락: ${remaining}초 남음`);
            } else if (!canExec) {
                console.log(`     상태: ${reason}`);
            }
        }
    }

    // NFT 현황
    console.log("\n🎫 [NFT 티켓]");
    const totalSupply = await ticket.totalSupply();
    console.log("   현재 발행량:", totalSupply.toString());

    console.log("\n========================================");
}

main().catch(console.error);
