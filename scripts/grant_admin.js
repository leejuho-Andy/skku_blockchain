import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);
    const ticketAddress = process.env.TICKET_ADDRESS;

    // 조원(Owner 2) 주소 - 에러 났던 그 주소
    const partnerAddress = "0x451A5493Eb07f707e208350d0A1e0cd277Cac0ba";

    const ticketArtifact = JSON.parse(readFileSync("./artifacts/contracts/ChangeTicket.sol/ChangeTicket.json", "utf8"));
    const ticket = new ethers.Contract(ticketAddress, ticketArtifact.abi, wallet);

    console.log("========================================");
    console.log("👑 NFT 관리자 권한 부여");
    console.log("========================================");
    console.log("주는 사람 (Owner 1):", wallet.address);
    console.log("받는 사람 (Owner 2):", partnerAddress);

    // DEFAULT_ADMIN_ROLE 구하기 (0x00...00)
    const ADMIN_ROLE = await ticket.DEFAULT_ADMIN_ROLE();

    // 이미 권한이 있는지 확인
    const hasRole = await ticket.hasRole(ADMIN_ROLE, partnerAddress);
    if (hasRole) {
        console.log("\n⚠️ 이미 관리자 권한이 있습니다.");
        return;
    }

    console.log("\n⏳ 권한 부여 중...");
    const tx = await ticket.grantRole(ADMIN_ROLE, partnerAddress);
    await tx.wait();

    console.log("✅ 부여 완료! 이제 Owner 2도 승인할 수 있습니다.");
}

main().catch(console.error);