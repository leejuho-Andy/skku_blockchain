import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

    console.log("========================================");
    console.log("🚀 시연용 멀티시그 시스템 배포");
    console.log("========================================");
    console.log("배포 계정:", wallet.address);
    console.log("잔액:", ethers.formatEther(await provider.getBalance(wallet.address)), "ETH");

    // 3명의 Owner (본인 + 새 계정 + 조원)
    const owners = [
        "0x451A5493Eb07f707e208350d0A1e0cd277Cac0ba",       // Owner 2: 이승은 (새 계정)
        "0x79722aCD6bd0aB02E4Bf59dd72d605357Bb18999",       // Owner 1: 이승은 (메인)
        "0x1f7c0A340EC5f80203fa4Ec980512eA140896fac",       // Owner 3: 조원
    ];
    const operators = [];
    const auditors = [];

    // 1. ChangeTicket 배포
    console.log("\n[1/2] ChangeTicket 배포 중...");
    const ticketArtifact = JSON.parse(readFileSync("./artifacts/contracts/ChangeTicket.sol/ChangeTicket.json", "utf8"));
    const TicketFactory = new ethers.ContractFactory(ticketArtifact.abi, ticketArtifact.bytecode, wallet);
    const ticket = await TicketFactory.deploy();
    await ticket.waitForDeployment();
    const ticketAddress = await ticket.getAddress();
    console.log("✅ ChangeTicket:", ticketAddress);

    // 2. MultiSigTreasury 배포
    console.log("\n[2/2] MultiSigTreasury 배포 중...");
    const vaultArtifact = JSON.parse(readFileSync("./artifacts/contracts/MultiSigTreasury.sol/MultiSigTreasury.json", "utf8"));
    const VaultFactory = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);
    const vault = await VaultFactory.deploy(owners, operators, auditors);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("✅ MultiSigTreasury:", vaultAddress);

    // 3. 연결
    console.log("\n[연결] Treasury ↔ NFT 연결 중...");
    const setTx = await ticket.setTreasury(vaultAddress);
    await setTx.wait();
    console.log("✅ 연결 완료");

    // 결과 출력
    console.log("\n========================================");
    console.log("🎉 배포 완료!");
    console.log("========================================");
    console.log("\n📋 컨트랙트 주소:");
    console.log(`   NFT:  ${ticketAddress}`);
    console.log(`   금고: ${vaultAddress}`);
    console.log("\n🔗 Etherscan:");
    console.log(`   https://sepolia.etherscan.io/address/${ticketAddress}`);
    console.log(`   https://sepolia.etherscan.io/address/${vaultAddress}`);
    console.log("\n📝 .env에 추가:");
    console.log(`   TICKET_ADDRESS=${ticketAddress}`);
    console.log(`   VAULT_ADDRESS=${vaultAddress}`);
    console.log("\n⚙️ 시연용 설정:");
    console.log("   • L1: 0.0005 ETH 이하, 타임락 없음");
    console.log("   • L2: 0.0005 ~ 0.001 ETH, 타임락 30초");
    console.log("   • L3: 0.001 ~ 0.002 ETH, 타임락 60초");
    console.log("   • 쿼럼: 모두 2-of-3");
    console.log("========================================");
}

main().catch(console.error);
