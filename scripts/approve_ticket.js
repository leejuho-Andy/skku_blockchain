import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
    const args = process.argv.slice(2);
    
    // 사용법 안내
    if (args.length < 1) {
        console.log("사용법: node scripts/approve_ticket.js <티켓ID>");
        console.log("예시: node scripts/approve_ticket.js 0");
        process.exit(1);
    }

    const tokenId = args[0]; // 입력받은 티켓 ID

    // 환경변수 로드
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);
    const ticketAddress = process.env.TICKET_ADDRESS;

    // 컨트랙트 연결
    const ticketArtifact = JSON.parse(readFileSync("./artifacts/contracts/ChangeTicket.sol/ChangeTicket.json", "utf8"));
    const ticket = new ethers.Contract(ticketAddress, ticketArtifact.abi, wallet);

    console.log("========================================");
    console.log("🎫 NFT 티켓 승인");
    console.log("========================================");
    console.log("티켓 ID:", tokenId);
    console.log("승인자:", wallet.address);

    try {
        // 1. 현재 상태 확인
        const info = await ticket.getTicketInfo(tokenId);
        const currentApprovals = info.approvals.toString();
        const requiredApprovals = info.requiredApprovals.toString();
        
        console.log(`현재 승인 상태: ${currentApprovals} / ${requiredApprovals}`);

        // 2. 이미 승인했는지 확인 (컨트랙트 에러 방지용)
        const hasApproved = await ticket.getApprovalStatus(tokenId, wallet.address);
        if (hasApproved) {
            console.log("\n⚠️ 이미 승인한 티켓입니다!");
            return;
        }

        // 3. 승인 트랜잭션 전송
        console.log("\n⏳ 승인 트랜잭션 전송 중...");
        const tx = await ticket.approveTicket(tokenId);
        await tx.wait();

        // 4. 결과 확인
        const newInfo = await ticket.getTicketInfo(tokenId);
        console.log("✅ 승인 완료!");
        console.log(`   최종 승인 상태: ${newInfo.approvals} / ${newInfo.requiredApprovals}`);
        
        // 타임락 안내
        if (newInfo.status == 1) { // 1 = APPROVED
             const timelock = Number(newInfo.timelockUntil);
             if (timelock > 0) {
                 const now = Math.floor(Date.now() / 1000);
                 const remaining = timelock - now;
                 if (remaining > 0) {
                     console.log(`\n⏱️ 타임락 시작! 약 ${remaining}초 후 실행 가능`);
                 }
             } else {
                 console.log("\n🟢 타임락 없음. 즉시 실행 가능!");
             }
        } else if (newInfo.approvals < newInfo.requiredApprovals) {
            console.log("\n🟡 추가 승인이 필요합니다.");
        }

    } catch (error) {
        console.error("\n❌ 오류 발생:", error.reason || error.message);
    }
}

main().catch(console.error);