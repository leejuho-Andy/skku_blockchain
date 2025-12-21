import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);
    const ticketAddress = process.env.TICKET_ADDRESS;

    // 권한 받을 주소 (0x451A - 웹에서 사용할 메인 계정)
    const mainOwner = "0x451A5493Eb07f707e208350d0A1e0cd277Cac0ba";

    const ticketArtifact = JSON.parse(readFileSync("./artifacts/contracts/ChangeTicket.sol/ChangeTicket.json", "utf8"));
    const ticket = new ethers.Contract(ticketAddress, ticketArtifact.abi, wallet);

    console.log("========================================");
    console.log("👑 NFT 권한 부여 (MINTER + ADMIN)");
    console.log("========================================");
    console.log("NFT 주소:", ticketAddress);
    console.log("현재 계정 (권한 주는 사람):", wallet.address);
    console.log("받는 사람 (0x451A):", mainOwner);

    // 1. MINTER_ROLE 부여
    console.log("\n[1/2] MINTER 권한 확인...");
    const MINTER_ROLE = await ticket.MINTER_ROLE();
    const hasMinter = await ticket.hasRole(MINTER_ROLE, mainOwner);
    
    if (!hasMinter) {
        console.log("⏳ MINTER 권한 부여 중...");
        const tx1 = await ticket.grantRole(MINTER_ROLE, mainOwner);
        await tx1.wait();
        console.log("✅ MINTER 권한 부여 완료!");
    } else {
        console.log("⚠️ 이미 MINTER 권한이 있습니다.");
    }

    // 2. DEFAULT_ADMIN_ROLE 부여
    console.log("\n[2/2] ADMIN 권한 확인...");
    const ADMIN_ROLE = await ticket.DEFAULT_ADMIN_ROLE();
    const hasAdmin = await ticket.hasRole(ADMIN_ROLE, mainOwner);
    
    if (!hasAdmin) {
        console.log("⏳ ADMIN 권한 부여 중...");
        const tx2 = await ticket.grantRole(ADMIN_ROLE, mainOwner);
        await tx2.wait();
        console.log("✅ ADMIN 권한 부여 완료!");
    } else {
        console.log("⚠️ 이미 ADMIN 권한이 있습니다.");
    }

    // 3. 확인
    console.log("\n========================================");
    console.log("🎉 완료! 권한 상태:");
    console.log("   MINTER:", await ticket.hasRole(MINTER_ROLE, mainOwner) ? "✅" : "❌");
    console.log("   ADMIN:", await ticket.hasRole(ADMIN_ROLE, mainOwner) ? "✅" : "❌");
    console.log("========================================");
    console.log("\n✨ 이제 0x451A 계정이 웹에서 NFT 발행 가능!");
}

main().catch(console.error);
