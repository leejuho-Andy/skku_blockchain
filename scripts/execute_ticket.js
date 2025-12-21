import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
    const args = process.argv.slice(2);
    
    // 사용법 안내
    if (args.length < 1) {
        console.log("사용법: node scripts/execute_ticket.js <티켓ID> [결과메시지]");
        console.log("예시: node scripts/execute_ticket.js 0 \"방화벽 포트 8080 오픈 완료\"");
        process.exit(1);
    }

    const tokenId = args[0];
    const resultMsg = args[1] || "작업 완료"; // 결과 메시지 없으면 기본값

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);
    const ticketAddress = process.env.TICKET_ADDRESS;

    // ABI 로드
    const ticketArtifact = JSON.parse(readFileSync("./artifacts/contracts/ChangeTicket.sol/ChangeTicket.json", "utf8"));
    const ticket = new ethers.Contract(ticketAddress, ticketArtifact.abi, wallet);

    console.log("========================================");
    console.log("🔥 NFT 티켓 실행 및 소각");
    console.log("========================================");
    console.log("티켓 ID:", tokenId);

    // 1. 상태 및 실행 가능 여부 확인
    try {
        const [executable, reason] = await ticket.isExecutable(tokenId);
        
        if (!executable) {
            console.log(`❌ 실행 불가: ${reason}`);
            
            // 타임락 때문이라면 남은 시간 보여주기
            if (reason === "Timelock not expired") {
                const info = await ticket.getTicketInfo(tokenId);
                const remaining = Number(info.timelockUntil) - Math.floor(Date.now() / 1000);
                console.log(`   ⏳ 타임락 대기 중: 약 ${remaining}초 남음`);
            }
            return;
        }
    } catch (e) {
        // 이미 소각되어 없는 티켓일 경우 등 에러 처리
        console.log("❌ 티켓 조회 실패 (이미 소각되었거나 존재하지 않음)");
        return;
    }

    // 2. 실행 (이 함수가 호출되면 _burn()이 실행되어 소각됨)
    console.log(`실행 결과 기록: "${resultMsg}"`);
    console.log("\n⏳ 트랜잭션 전송 중... (실행 + 소각)");
    
    const tx = await ticket.executeTicket(tokenId, resultMsg);
    await tx.wait();

    console.log("\n✅ 실행 완료! NFT가 소각되었습니다.");
    
    // 3. 소각 확인 (조회 시도)
    try {
        await ticket.ownerOf(tokenId);
        console.log("⚠️ 경고: 소각되지 않은 것 같습니다.");
    } catch (e) {
        console.log("🎉 확인 완료: 해당 토큰ID 조회 불가 (정상적으로 소각됨)");
    }
}

main().catch(console.error);