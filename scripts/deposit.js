import { ethers } from "ethers";
import 'dotenv/config';

async function main() {
    const args = process.argv.slice(2);
    const amountStr = args[0] || "0.005";
    const amount = ethers.parseEther(amountStr);

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);
    const vaultAddress = process.env.VAULT_ADDRESS;

    console.log("========================================");
    console.log("💰 금고 입금");
    console.log("========================================");
    console.log("입금 금액:", amountStr, "ETH");

    const tx = await wallet.sendTransaction({
        to: vaultAddress,
        value: amount
    });
    console.log("⏳ 전송 중...");
    await tx.wait();

    const newBalance = await provider.getBalance(vaultAddress);
    console.log("\n✅ 입금 완료!");
    console.log("   금고 잔액:", ethers.formatEther(newBalance), "ETH");
    console.log("   TX:", tx.hash);
}

main().catch(console.error);
