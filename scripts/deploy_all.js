import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

  console.log("----------------------------------------------------");
  console.log("Deploying contracts with account:", wallet.address);
  
  // ====================================================
  // 1. ChangeTicket (NFT) 배포
  // ====================================================
  console.log("\n[1] Deploying ChangeTicket (NFT)...");
  
  // 수정된 부분: getContractFactory 대신 JSON 파일을 직접 읽어옵니다.
  const ticketArtifact = JSON.parse(
    readFileSync("./artifacts/contracts/ChangeTicket.sol/ChangeTicket.json", "utf8")
  );

  const TicketFactory = new ethers.ContractFactory(ticketArtifact.abi, ticketArtifact.bytecode, wallet);
  const ticket = await TicketFactory.deploy(); // 옵션 없이 배포 (자동 가스 계산)
  await ticket.waitForDeployment();
  
  const ticketAddress = await ticket.getAddress();
  console.log("✅ ChangeTicket deployed to:", ticketAddress);


  // ====================================================
  // 2. MultiSigTreasury (금고) 배포
  // ====================================================
  console.log("\n[2] Deploying MultiSigTreasury (Vault)...");
  
  const vaultArtifact = JSON.parse(
    readFileSync("./artifacts/contracts/MultiSigTreasury.sol/MultiSigTreasury.json", "utf8")
  );

  // 시연을 위해 Owners에 본인 지갑만 넣고 싶다면 아래 주석을 풀고 owners 변수를 교체하세요.
  // (현재는 기획안대로 3명 유지)
  const owners = [
    wallet.address,
    "0x0000000000000000000000000000000000000001", 
    "0x0000000000000000000000000000000000000002"
  ];
  const required = 2; 

  const VaultFactory = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);
  const vault = await VaultFactory.deploy(owners, required);
  await vault.waitForDeployment();
  
  const vaultAddress = await vault.getAddress();
  console.log("✅ MultiSigTreasury deployed to:", vaultAddress);

  console.log("----------------------------------------------------");
  console.log("✨ All contracts deployed successfully!");
  console.log(`👉 NFT Contract: https://sepolia.etherscan.io/address/${ticketAddress}`);
  console.log(`👉 Vault Contract: https://sepolia.etherscan.io/address/${vaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});