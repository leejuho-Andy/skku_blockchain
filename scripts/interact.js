import { ethers } from "ethers";
import { readFileSync } from "fs";
import 'dotenv/config';

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

    // 방금 님이 배포 성공한 주소들입니다.
    const nftAddress = "0x1E60B7AB9F22EaEDebDA29ED1a7a2dd003582030"; 
    const vaultAddress = "0xf412c36ab657B01A8fcf1a0C3750Ee5584f50D8C";

    console.log("Interact with account:", wallet.address);

    // 1. NFT 발행 (ChangeTicket 받기)
    console.log("\n[1] Minting NFT...");
    // NFT 설정 불러오기
    const nftArtifact = JSON.parse(readFileSync("./artifacts/contracts/ChangeTicket.sol/ChangeTicket.json", "utf8"));
    const nftContract = new ethers.Contract(nftAddress, nftArtifact.abi, wallet);
    
    // safeMint 실행 (내 지갑으로 NFT 1개 발행)
    const mintTx = await nftContract.safeMint(wallet.address);
    console.log("Waiting for confirmation...");
    await mintTx.wait();
    console.log(`✅ NFT Minted!`);

    // 2. 금고에 ETH 입금 (Funding)
    console.log("\n[2] Sending ETH to Vault...");
    // 금고로 0.001 ETH 송금
    const tx = await wallet.sendTransaction({
        to: vaultAddress,
        value: ethers.parseEther("0.001") 
    });
    await tx.wait();
    console.log(`✅ Funding Complete!`);
    
    console.log("\n------------------------------------------------");
    console.log("이제 이더스캔을 새로고침 해보세요!");
    console.log(`👉 NFT 확인: https://sepolia.etherscan.io/address/${nftAddress}`);
    console.log(`👉 금고 확인: https://sepolia.etherscan.io/address/${vaultAddress}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});