# 🔐 산업보안 이중 멀티시그 컨트랙트

> 블록체인 기반 예산 지출 & NFT 변경권 관리 시스템

2025-2 블록체인 기술과 응용 기말 프로젝트 | 3조

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [설치 및 환경설정](#설치-및-환경설정)
4. [배포된 컨트랙트](#배포된-컨트랙트)
5. [시연 순서 및 명령어](#시연-순서-및-명령어)
6. [파일 구조](#파일-구조)

---

## 프로젝트 개요

### 해결하고자 하는 문제
- 단일 관리자의 권한 남용 방지 → **2-of-3 멀티시그**
- 무단 시스템 변경 방지 → **NFT 기반 변경권 + 타임락**
- 비상 상황 대응 → **비상정지 기능**
- 모든 거래의 투명성 확보 → **블록체인 기록**

### 핵심 기능
| 기능 | 설명 |
|------|------|
| 멀티시그 (2-of-3) | 3명 중 2명 승인 시 거래 실행 |
| 타임락 | 등급별 대기 시간 (L1: 0초, L2: 90초, L3: 120초) |
| NFT 변경권 | 시스템 변경 요청을 NFT로 발행, 실행 후 자동 소각 |
| 비상정지 | 해킹/위협 감지 시 모든 거래 즉시 차단 |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    유저 레이어                           │
│   Owner 1 (웹)    Owner 2 (터미널)    Owner 3 (예비)    │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│                 인터페이스 레이어                        │
│   웹 대시보드              터미널 CLI                    │
│   (HTML + ethers.js)      (Node.js + ethers.js)        │
│   MetaMask 서명            Private Key 서명             │
└─────────────────────────────────────────────────────────┘
                          │
                    Alchemy RPC
                          │
┌─────────────────────────────────────────────────────────┐
│               블록체인 레이어 (Sepolia)                  │
│   MultiSigTreasury.sol        ChangeTicket.sol         │
│   (예산 금고)                  (NFT 변경권)              │
└─────────────────────────────────────────────────────────┘
```

---

## 설치 및 환경설정

### 1. 의존성 설치
```bash
npm install ethers dotenv
```

### 2. 환경변수 설정 (.env)
```env
# Alchemy RPC URL (Sepolia)
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Owner Private Keys (테스트용)
PRIVATE_KEY_1=0x...  # Owner 1 (웹 대시보드용)
PRIVATE_KEY_2=0x...  # Owner 2 (터미널 CLI용)
PRIVATE_KEY_3=0x...  # Owner 3 (예비)

# 배포된 컨트랙트 주소
VAULT_ADDRESS=0x1C44a6A6282e25dBc0F0dDF56Ec05B6f40D00eAc
TICKET_ADDRESS=0x65108E60Abf82fd33Bd0293b31811b4D8E868e32
```

### 3. 웹 대시보드 실행
```bash
# dashboard.html을 브라우저에서 열기
# MetaMask 연결 필요 (Sepolia 네트워크)
```

---

## 배포된 컨트랙트

| 컨트랙트 | 주소 | Etherscan |
|----------|------|-----------|
| MultiSigTreasury | `0x1C44a6A6282e25dBc0F0dDF56Ec05B6f40D00eAc` | [보기](https://sepolia.etherscan.io/address/0x1C44a6A6282e25dBc0F0dDF56Ec05B6f40D00eAc) |
| ChangeTicket | `0x65108E60Abf82fd33Bd0293b31811b4D8E868e32` | [보기](https://sepolia.etherscan.io/address/0x65108E60Abf82fd33Bd0293b31811b4D8E868e32) |

---

## 시연 순서 및 명령어

### 1️⃣ 금고 입금
```bash
# 웹: 입금 금액 입력 → MetaMask 승인
# 또는 터미널:
node scripts/deposit.js 0.005
```

### 2️⃣ 지출 제안 생성
```bash
# 웹: 주소, 금액 입력 → 제안 버튼 클릭
# 또는 터미널:
node scripts/propose.js 0x수신주소 0.0004 "테스트 지출"
```
- 금액에 따라 등급 자동 결정 (L1/L2/L3)

### 3️⃣ 멀티시그 승인 (2-of-3)
```bash
# 1차 승인: 웹에서 승인 버튼 클릭

# 2차 승인: 터미널에서 실행
node scripts/approve.js 0   # 0 = 거래 ID
```

### 4️⃣ 거래 실행
```bash
# 웹: 실행 버튼 클릭 (2명 승인 완료 후 활성화)
# 또는 터미널:
node scripts/execute.js 0
```

### 5️⃣ NFT 변경권 발행
```bash
# 웹: 변경 내용, 중요도 입력 → 발행 버튼
# 또는 터미널:
node scripts/mint_ticket.js "방화벽 규칙 변경" 2   # 2 = HIGH
```
- 중요도: 0=LOW, 1=MEDIUM, 2=HIGH

### 6️⃣ NFT 권한 부여 (AccessControl)
```bash
# 웹: 권한 관리 섹션에서 주소 입력 → 권한 부여
# 부여되는 권한: MINTER_ROLE, DEFAULT_ADMIN_ROLE
```

### 7️⃣ NFT 승인 (2-of-3)
```bash
# 1차 승인: 웹에서 승인 버튼

# 2차 승인: 터미널에서 실행
node scripts/approve_ticket.js 0   # 0 = NFT ID
```
- 2명 승인 완료 시 타임락 시작 (HIGH: 120초)

### 8️⃣ NFT 실행 & 자동 소각
```bash
# 타임락 해제 후 웹에서 실행 버튼
# 또는 터미널:
node scripts/execute_ticket.js 0 "변경 완료"
```
- 실행 시 NFT 자동 소각 (권한 소비형)

### 9️⃣ 비상정지 활성화/해제
```bash
# 활성화
node scripts/pause.js on

# 해제
node scripts/pause.js off
```
- 비상정지 중에는 모든 제안/승인/실행 차단

### 🔟 상태 조회
```bash
node scripts/status.js
```
- 금고 잔액, Owner 목록, 거래 내역 등 조회

---

## 파일 구조

```
📦 프로젝트 루트
├── 📜 contracts/
│   ├── MultiSigTreasury.sol    # 예산 금고 컨트랙트
│   └── ChangeTicket.sol        # NFT 변경권 컨트랙트
├── 📜 scripts/
│   ├── deploy.js               # 컨트랙트 배포
│   ├── deposit.js              # 금고 입금
│   ├── propose.js              # 지출 제안
│   ├── approve.js              # 거래 승인
│   ├── execute.js              # 거래 실행
│   ├── mint_ticket.js          # NFT 발행
│   ├── approve_ticket.js       # NFT 승인
│   ├── execute_ticket.js       # NFT 실행
│   ├── pause.js                # 비상정지
│   └── status.js               # 상태 조회
├── 📜 dashboard.html           # 웹 대시보드
├── 📜 .env                     # 환경변수 (gitignore)
├── 📜 package.json
└── 📜 README.md
```
