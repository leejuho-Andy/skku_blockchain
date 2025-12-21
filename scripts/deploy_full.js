import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

    console.log("====================================================");
    console.log("산업보안 이중 멀티시그 시스템 배포");
    console.log("====================================================");
    console.log("배포 계정:", wallet.address);

    const owners = [
        wallet.address,
        "0x6CD24e99af374872aa1E8336af37090d2a403fdd",
        "0x1f7c0A340EC5f80203fa4Ec980512eA140896fac",
    ];
    const operators = [];
    const auditors = [];

    console.log("\n[1/2] ChangeTicket 배포 중...");
    const ticketArtifact = JSON.parse(readFileSync("./artifacts/contracts/ChangeTicket.sol/ChangeTicket.json", "utf8"));
    const TicketFactory = new ethers.ContractFactory(ticketArtifact.abi, ticketArtifact.bytecode, wallet);
    const ticket = await TicketFactory.deploy();
    await ticket.waitForDeployment();
    const ticketAddress = await ticket.getAddress();
    console.log("ChangeTicket:", ticketAddress);

    console.log("\n[2/2] MultiSigTreasury 배포 중...");
    const vaultArtifact = JSON.parse(readFileSync("./artifacts/contracts/MultiSigTreasury.sol/MultiSigTreasury.json", "utf8"));
    const VaultFactory = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);
    const vault = await VaultFactory.deploy(owners, operators, auditors);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("MultiSigTreasury:", vaultAddress);

    console.log("\n[연결] Treasury 연결 중...");
    const setTx = await ticket.setTreasury(vaultAddress);
    await setTx.wait();

    console.log("\n====================================================");
    console.log("배포 완료!");
    console.log("NFT:", ticketAddress);
    console.log("금고:", vaultAddress);
    console.log("====================================================");
}

main().catch(console.error);
