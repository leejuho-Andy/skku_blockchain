import { ethers } from "ethers";
import "dotenv/config";

async function main() {
    // 1. 설정
    const LEADER_KEY = process.env.SEPOLIA_PRIVATE_KEY; 
    
    // 권한을 받을 사람 (아까 에러 났던 0x7972...)
    const NEW_AUDITOR_ADDR = "0x79722aCD6bd0aB02E4Bf59dd72d605357Bb18999"; 
    
    // 최신 티켓 주소 (dashboard.html에 있는 것과 같아야 함)
    const TICKET_ADDRESS = "0x523e159B0bA668a2aaac6e26c4D2147fD86f99BB";

    // ▼▼▼ [핵심 수정] 버전 호환성 처리 (v5, v6 모두 작동) ▼▼▼
    const JsonRpcProvider = ethers.JsonRpcProvider || ethers.providers.JsonRpcProvider;
    const keccak256 = ethers.id || ethers.utils.id; // v6는 id, v5는 utils.id
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    // 2. 연결
    const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(LEADER_KEY, provider);
    console.log(`👑 대장 계정 연결됨: ${wallet.address}`);

    const ticket = new ethers.Contract(TICKET_ADDRESS, [
        "function grantRole(bytes32, address) external",
        "function hasRole(bytes32, address) view returns (bool)"
    ], wallet);

    // 3. 임명 실행
    const AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    console.log(`⏳ ${NEW_AUDITOR_ADDR} 에게 승인자(Auditor) 권한 부여 중...`);
    
    try {
        const tx = await ticket.grantRole(AUDITOR_ROLE, NEW_AUDITOR_ADDR, { gasLimit: 500000 });
        await tx.wait();
        console.log(`✅ 임명 완료! 이제 0x7972 계정도 승인을 누를 수 있습니다.`);
    } catch (e) {
        console.log("⚠️ 이미 권한이 있거나, 대장 계정이 아닙니다.");
        console.error(e.reason || e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});