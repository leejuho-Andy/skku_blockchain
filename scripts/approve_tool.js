import hre from "hardhat"; // 1. 이렇게 가져와야 합니다.
const { ethers } = hre;    // 2. 여기서 ethers를 꺼냅니다.
import "dotenv/config";

async function main() {
    // ▼▼▼ [중요] 개인키 뒤에 공백이 있어서 에러가 날 뻔했습니다. .trim()으로 공백 제거했습니다.
    const SECOND_PRIVATE_KEY = "0x6a6116961ff9ede8273a09d7c62ae35aaecbab08ff53e09e372c40605ddcfc81".trim(); 
    
    // ▼▼▼ 금고 주소 (최신 주소 확인)
    const VAULT_ADDRESS = "0x8c00F25Aa9c8aA45743515a9AC136d8a98dFb960"; 
    const TX_ID = 0; // 승인할 거래 번호

    console.log("-----------------------------------------");
    
    // 1. 지갑 연결 (Hardhat에 설정된 네트워크 Provider 사용)
    // *굳이 JsonRpcProvider를 따로 만들지 않아도, --network sepolia 옵션을 주면 자동 연결됩니다.
    const provider = ethers.provider; 
    const wallet = new ethers.Wallet(SECOND_PRIVATE_KEY, provider);

    console.log(`👤 승인자(Account 2) 지갑 연결됨: ${wallet.address}`);
    
    // 2. 금고 컨트랙트 연결
    const vault = await ethers.getContractAt("MultiSigVault", VAULT_ADDRESS, wallet);

    // 3. 승인 실행
    console.log(`⏳ 거래 #${TX_ID}번 승인 요청 중...`);
    try {
        const tx = await vault.approve(TX_ID);
        console.log(`➡️  트랜잭션 전송됨 (Hash: ${tx.hash})`);
        console.log("⏳ 블록 생성 대기 중...");
        
        await tx.wait();
        console.log(`✅ 거래 #${TX_ID} 승인 완료!`);
        console.log("👉 이제 웹 대시보드에서 [실행] 버튼이 활성화되었을 겁니다.");
    } catch (e) {
        console.error("❌ 승인 실패:", e.reason || e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});