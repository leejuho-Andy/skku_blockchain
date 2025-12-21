import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log("========================================");
        console.log("사용법: node scripts/mint_ticket.js <변경내용> <중요도>");
        console.log("========================================");
        console.log("\n중요도:");
        console.log("  0 = LOW (타임락 없음)");
        console.log("  1 = MEDIUM (타임락 30초)");
        console.log("  2 = HIGH (타임락 60초)");
        console.log("  3 = CRITICAL (타임락 90초)");
        console.log("\n예시:");
        console.log('  node scripts/mint_ticket.js "방화벽 규칙 변경" 1');
        process.exit(1);
    }

    const [changeScope, severityStr] = args;
    const severity = parseInt(severityStr);
    const severityNames = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);
    const ticketAddress = process.env.TICKET_ADDRESS;

    const ticketArtifact = JSON.parse(readFileSync("./artifacts/contracts/ChangeTicket.sol/ChangeTicket.json", "utf8"));
    const ticket = new ethers.Contract(ticketAddress, ticketArtifact.abi, wallet);

    console.log("========================================");
    console.log("🎫 NFT 티켓 발행");
    console.log("========================================");
    console.log("변경 내용:", changeScope);
    console.log("중요도:", severityNames[severity]);

    const tx = await ticket.mintTicket(wallet.address, changeScope, severity);
    console.log("\n⏳ 발행 중...");
    await tx.wait();

    const totalSupply = await ticket.totalSupply();
    const tokenId = totalSupply - 1n;

    console.log("\n✅ 발행 완료!");
    console.log("   티켓 ID:", tokenId.toString());
    console.log("   TX:", tx.hash);
}

main().catch(console.error);
