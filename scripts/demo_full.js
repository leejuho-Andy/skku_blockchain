import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

    // 배포된 컨트랙트 주소 (배포 후 수정 필요)
    const vaultAddress = process.env.VAULT_ADDRESS || "YOUR_VAULT_ADDRESS";
    const ticketAddress = process.env.TICKET_ADDRESS || "YOUR_TICKET_ADDRESS";

    const vaultArtifact = JSON.parse(readFileSync("./artifacts/contracts/MultiSigTreasury.sol/MultiSigTreasury.json", "utf8"));
    const ticketArtifact = JSON.parse(readFileSync("./artifacts/contracts/ChangeTicket.sol/ChangeTicket.json", "utf8"));
    
    const vault = new ethers.Contract(vaultAddress, vaultArtifact.abi, wallet);
    const ticket = new ethers.Contract(ticketAddress, ticketArtifact.abi, wallet);

    console.log("========================================");
    console.log("산업보안 이중 멀티시그 데모");
    console.log("========================================");

    // 1. 금고 상태 확인
    console.log("\n[1] 금고 상태");
    const balance = await vault.getBalance();
    console.log("   잔액:", ethers.formatEther(balance), "ETH");
    
    const limits = await vault.getLimits();
    console.log("   일일 한도:", ethers.formatEther(limits.dailyLimit), "ETH");
    console.log("   거래당 한도:", ethers.formatEther(limits.txLimit), "ETH");
    
    const remaining = await vault.getRemainingDailyLimit();
    console.log("   남은 일일 한도:", ethers.formatEther(remaining), "ETH");

    // 2. 역할 확인
    console.log("\n[2] 역할 정보");
    const owners = await vault.getOwners();
    console.log("   Owners:", owners.length, "명");
    owners.forEach((o, i) => console.log(`     ${i+1}. ${o}`));
    
    const myRole = await vault.roles(wallet.address);
    const roleNames = ["None", "Auditor", "Operator", "Owner"];
    console.log("   내 역할:", roleNames[myRole]);

    // 3. ETH 지출 제안 (L1 수준)
    console.log("\n[3] ETH 지출 제안 (L1 - 0.01 ETH)");
    const testRecipient = "0x0000000000000000000000000000000000000003";
    const tx1 = await vault.proposeETH(
        testRecipient,
        ethers.parseEther("0.01"),
        "테스트 지출: 사무용품 구매"
    );
    await tx1.wait();
    console.log("   제안 완료! TX:", tx1.hash);

    // 트랜잭션 정보 확인
    const txCount = await vault.getTransactionCount();
    const txId = txCount - 1n;
    const txInfo = await vault.getTransaction(txId);
    console.log("\n   거래 #" + txId + " 정보:");
    console.log("     - 받는 주소:", txInfo.to);
    console.log("     - 금액:", ethers.formatEther(txInfo.value), "ETH");
    console.log("     - 등급:", ["L1(일반)", "L2(고액)", "L3(거버넌스)"][txInfo.level]);
    console.log("     - 설명:", txInfo.description);
    console.log("     - 승인 수:", txInfo.approvals.toString());

    // 4. 승인
    console.log("\n[4] 거래 승인");
    const tx2 = await vault.approve(txId);
    await tx2.wait();
    console.log("   승인 완료! TX:", tx2.hash);

    const txInfoAfter = await vault.getTransaction(txId);
    console.log("   현재 승인 수:", txInfoAfter.approvals.toString());

    // 실행 가능 여부 확인
    const [canExec, reason] = await vault.canExecute(txId);
    console.log("   실행 가능:", canExec ? "예" : "아니오", "-", reason);

    // 5. ChangeTicket NFT 발행
    console.log("\n[5] ChangeTicket NFT 발행");
    const tx3 = await ticket.mintTicket(
        wallet.address,
        "서버 방화벽 규칙 변경",
        1  // Severity.MEDIUM
    );
    await tx3.wait();
    console.log("   NFT 발행 완료! TX:", tx3.hash);

    const totalSupply = await ticket.totalSupply();
    console.log("   총 발행량:", totalSupply.toString());

    // 티켓 정보 확인
    if (totalSupply > 0n) {
        const ticketId = totalSupply - 1n;
        const ticketInfo = await ticket.getTicketInfo(ticketId);
        console.log("\n   티켓 #" + ticketId + " 정보:");
        console.log("     - 변경 범위:", ticketInfo.changeScope);
        console.log("     - 중요도:", ["LOW", "MEDIUM", "HIGH", "CRITICAL"][ticketInfo.severity]);
        console.log("     - 상태:", ["대기", "승인됨", "실행가능", "실행완료", "만료", "취소"][ticketInfo.status]);
        console.log("     - 필요 승인:", ticketInfo.requiredApprovals.toString());
        console.log("     - 현재 승인:", ticketInfo.approvals.toString());
    }

    // 6. 비상정지 테스트
    console.log("\n[6] 비상정지 상태");
    const isPaused = await vault.paused();
    console.log("   금고 정지 상태:", isPaused ? "정지됨" : "정상");

    console.log("\n========================================");
    console.log("데모 완료!");
    console.log("========================================");
    console.log("\n주의: 실제 실행(execute)은 2명 이상의 Owner 승인 필요");
}

main().catch(console.error);
