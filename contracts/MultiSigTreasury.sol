// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MultiSigTreasury
 * @notice 산업보안 변경관리 & 예산 지출 이중 멀티시그 시스템
 * @dev 기획안 100% 반영 + 발표 시연용 설정
 */
contract MultiSigTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // 역할 정의
    // ============================================
    enum Role { None, Auditor, Operator, Owner }
    
    // ============================================
    // 행위 등급 정의
    // ============================================
    enum Level { 
        L1,  // 일반 지출: 2-of-3, 타임락 없음
        L2,  // 고액 지출: 2-of-3, 30초 타임락 (시연용)
        L3   // 거버넌스: 2-of-3, 60초 타임락 (시연용)
    }

    // ============================================
    // 트랜잭션 구조체
    // ============================================
    struct Transaction {
        address to;
        uint256 value;
        address token;
        uint256 tokenAmount;
        Level level;
        string description;
        uint256 approvals;
        uint256 proposedAt;
        uint256 timelockUntil;
        bool executed;
        bool cancelled;
        address proposer;
    }

    // ============================================
    // 한도 설정 구조체
    // ============================================
    struct LimitConfig {
        uint256 dailyLimit;
        uint256 txLimit;
        uint256 l1Threshold;
        uint256 l2Threshold;
    }

    // ============================================
    // 상태 변수
    // ============================================
    mapping(address => Role) public roles;
    address[] public owners;
    address[] public operators;
    address[] public auditors;
    
    mapping(Level => uint256) public requiredApprovals;
    mapping(Level => uint256) public timelockDuration;
    
    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public approved;
    
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;
    
    LimitConfig public limits;
    mapping(uint256 => uint256) public dailySpent;
    
    bool public paused;
    uint256 public constant EXPIRY_DURATION = 7 days;

    // ============================================
    // 이벤트
    // ============================================
    event RoleAssigned(address indexed account, Role role);
    event RoleRevoked(address indexed account, Role previousRole);
    event TransactionProposed(uint256 indexed txId, address indexed proposer, address to, uint256 value, address token, uint256 tokenAmount, Level level, string description);
    event TransactionApproved(uint256 indexed txId, address indexed approver);
    event TransactionRevoked(uint256 indexed txId, address indexed revoker);
    event TransactionExecuted(uint256 indexed txId, address indexed executor);
    event TransactionCancelled(uint256 indexed txId, address indexed canceller);
    event TokenRegistered(address indexed token);
    event TokenRemoved(address indexed token);
    event LimitsUpdated(uint256 dailyLimit, uint256 txLimit, uint256 l1Threshold, uint256 l2Threshold);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event Deposit(address indexed from, uint256 amount);

    // ============================================
    // 제어자
    // ============================================
    modifier onlyOwner() {
        require(roles[msg.sender] == Role.Owner, "Not owner");
        _;
    }
    
    modifier onlyOperatorOrAbove() {
        require(roles[msg.sender] == Role.Operator || roles[msg.sender] == Role.Owner, "Not operator or owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier txExists(uint256 _txId) {
        require(_txId < transactions.length, "Transaction does not exist");
        _;
    }
    
    modifier notExecuted(uint256 _txId) {
        require(!transactions[_txId].executed, "Already executed");
        _;
    }
    
    modifier notCancelled(uint256 _txId) {
        require(!transactions[_txId].cancelled, "Transaction cancelled");
        _;
    }
    
    modifier notExpired(uint256 _txId) {
        require(block.timestamp <= transactions[_txId].proposedAt + EXPIRY_DURATION, "Transaction expired");
        _;
    }

    // ============================================
    // 생성자
    // ============================================
    constructor(
        address[] memory _owners,
        address[] memory _operators,
        address[] memory _auditors
    ) {
        require(_owners.length >= 3, "Need at least 3 owners");
        
        for (uint256 i = 0; i < _owners.length; i++) {
            require(_owners[i] != address(0), "Invalid owner address");
            require(roles[_owners[i]] == Role.None, "Duplicate role");
            roles[_owners[i]] = Role.Owner;
            owners.push(_owners[i]);
            emit RoleAssigned(_owners[i], Role.Owner);
        }
        
        for (uint256 i = 0; i < _operators.length; i++) {
            require(_operators[i] != address(0), "Invalid operator address");
            require(roles[_operators[i]] == Role.None, "Duplicate role");
            roles[_operators[i]] = Role.Operator;
            operators.push(_operators[i]);
            emit RoleAssigned(_operators[i], Role.Operator);
        }
        
        for (uint256 i = 0; i < _auditors.length; i++) {
            require(_auditors[i] != address(0), "Invalid auditor address");
            require(roles[_auditors[i]] == Role.None, "Duplicate role");
            roles[_auditors[i]] = Role.Auditor;
            auditors.push(_auditors[i]);
            emit RoleAssigned(_auditors[i], Role.Auditor);
        }
        
        // 쿼럼: 모두 2-of-3 (시연용)
        requiredApprovals[Level.L1] = 2;
        requiredApprovals[Level.L2] = 2;
        requiredApprovals[Level.L3] = 2;
        
        // 타임락: 시연용 짧은 시간
        timelockDuration[Level.L1] = 0;        // 즉시
        timelockDuration[Level.L2] = 90;       // 30초
        timelockDuration[Level.L3] = 120;       // 60초
        
        // 한도: 시연용 아주 낮은 금액
        limits = LimitConfig({
            dailyLimit: 0.01 ether,      // 일일 0.01 ETH
            txLimit: 0.002 ether,        // 거래당 최대 0.002 ETH
            l1Threshold: 0.0005 ether,   // 0.0005 ETH 이하 = L1
            l2Threshold: 0.001 ether     // 0.0005~0.001 ETH = L2, 초과 = L3
        });
    }

    // ============================================
    // ETH 수신
    // ============================================
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    // ============================================
    // 트랜잭션 제안
    // ============================================
    function propose(
        address _to,
        uint256 _value,
        address _token,
        uint256 _tokenAmount,
        string calldata _description
    ) external onlyOperatorOrAbove whenNotPaused returns (uint256) {
        require(_to != address(0), "Invalid recipient");
        if (_token != address(0)) {
            require(supportedTokens[_token], "Token not supported");
        }
        
        Level level = _determineLevel(_value);
        require(_value <= limits.txLimit, "Exceeds transaction limit");
        
        uint256 txId = transactions.length;
        uint256 timelock = block.timestamp + timelockDuration[level];
        
        transactions.push(Transaction({
            to: _to,
            value: _value,
            token: _token,
            tokenAmount: _tokenAmount,
            level: level,
            description: _description,
            approvals: 0,
            proposedAt: block.timestamp,
            timelockUntil: timelock,
            executed: false,
            cancelled: false,
            proposer: msg.sender
        }));
        
        emit TransactionProposed(txId, msg.sender, _to, _value, _token, _tokenAmount, level, _description);
        return txId;
    }
    
    function proposeETH(
        address _to,
        uint256 _value,
        string calldata _description
    ) external onlyOperatorOrAbove whenNotPaused returns (uint256) {
        require(_to != address(0), "Invalid recipient");
        
        Level level = _determineLevel(_value);
        require(_value <= limits.txLimit, "Exceeds transaction limit");
        
        uint256 txId = transactions.length;
        uint256 timelock = block.timestamp + timelockDuration[level];
        
        transactions.push(Transaction({
            to: _to,
            value: _value,
            token: address(0),
            tokenAmount: 0,
            level: level,
            description: _description,
            approvals: 0,
            proposedAt: block.timestamp,
            timelockUntil: timelock,
            executed: false,
            cancelled: false,
            proposer: msg.sender
        }));
        
        emit TransactionProposed(txId, msg.sender, _to, _value, address(0), 0, level, _description);
        return txId;
    }

    // ============================================
    // 트랜잭션 승인
    // ============================================
    function approve(uint256 _txId) 
        external 
        onlyOwner 
        whenNotPaused
        txExists(_txId)
        notExecuted(_txId)
        notCancelled(_txId)
        notExpired(_txId)
    {
        require(!approved[_txId][msg.sender], "Already approved");
        
        approved[_txId][msg.sender] = true;
        transactions[_txId].approvals += 1;
        
        emit TransactionApproved(_txId, msg.sender);
    }

    // ============================================
    // 승인 철회
    // ============================================
    function revoke(uint256 _txId)
        external
        onlyOwner
        txExists(_txId)
        notExecuted(_txId)
        notCancelled(_txId)
    {
        require(approved[_txId][msg.sender], "Not approved yet");
        
        approved[_txId][msg.sender] = false;
        transactions[_txId].approvals -= 1;
        
        emit TransactionRevoked(_txId, msg.sender);
    }

    // ============================================
    // 트랜잭션 실행
    // ============================================
    function execute(uint256 _txId)
        external
        onlyOwner
        whenNotPaused
        nonReentrant
        txExists(_txId)
        notExecuted(_txId)
        notCancelled(_txId)
        notExpired(_txId)
    {
        Transaction storage txn = transactions[_txId];
        
        require(txn.approvals >= requiredApprovals[txn.level], "Not enough approvals");
        require(block.timestamp >= txn.timelockUntil, "Timelock not expired");
        
        uint256 today = block.timestamp / 1 days;
        require(dailySpent[today] + txn.value <= limits.dailyLimit, "Exceeds daily limit");
        
        txn.executed = true;
        dailySpent[today] += txn.value;
        
        if (txn.token == address(0)) {
            require(address(this).balance >= txn.value, "Insufficient ETH balance");
            (bool success, ) = payable(txn.to).call{value: txn.value}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(txn.token).safeTransfer(txn.to, txn.tokenAmount);
        }
        
        emit TransactionExecuted(_txId, msg.sender);
    }

    // ============================================
    // 트랜잭션 취소
    // ============================================
    function cancel(uint256 _txId)
        external
        txExists(_txId)
        notExecuted(_txId)
        notCancelled(_txId)
    {
        Transaction storage txn = transactions[_txId];
        require(msg.sender == txn.proposer || roles[msg.sender] == Role.Owner, "Not authorized to cancel");
        
        txn.cancelled = true;
        emit TransactionCancelled(_txId, msg.sender);
    }

    // ============================================
    // 비상정지
    // ============================================
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ============================================
    // 토큰 관리
    // ============================================
    function registerToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        require(!supportedTokens[_token], "Token already registered");
        supportedTokens[_token] = true;
        tokenList.push(_token);
        emit TokenRegistered(_token);
    }
    
    function removeToken(address _token) external onlyOwner {
        require(supportedTokens[_token], "Token not registered");
        supportedTokens[_token] = false;
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenList[i] == _token) {
                tokenList[i] = tokenList[tokenList.length - 1];
                tokenList.pop();
                break;
            }
        }
        emit TokenRemoved(_token);
    }

    // ============================================
    // 설정 변경
    // ============================================
    function updateLimits(
        uint256 _dailyLimit,
        uint256 _txLimit,
        uint256 _l1Threshold,
        uint256 _l2Threshold
    ) external onlyOwner {
        require(_l1Threshold < _l2Threshold, "Invalid thresholds");
        limits = LimitConfig({
            dailyLimit: _dailyLimit,
            txLimit: _txLimit,
            l1Threshold: _l1Threshold,
            l2Threshold: _l2Threshold
        });
        emit LimitsUpdated(_dailyLimit, _txLimit, _l1Threshold, _l2Threshold);
    }

    function updateQuorum(Level _level, uint256 _required) external onlyOwner {
        require(_required > 0 && _required <= owners.length, "Invalid quorum");
        requiredApprovals[_level] = _required;
    }
    
    function updateTimelock(Level _level, uint256 _duration) external onlyOwner {
        timelockDuration[_level] = _duration;
    }

    // ============================================
    // 조회 함수
    // ============================================
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    function getTokenBalance(address _token) external view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }
    
    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }
    
    function getTransaction(uint256 _txId) external view returns (Transaction memory) {
        return transactions[_txId];
    }
    
    function getOwners() external view returns (address[] memory) {
        return owners;
    }
    
    function getOperators() external view returns (address[] memory) {
        return operators;
    }
    
    function getAuditors() external view returns (address[] memory) {
        return auditors;
    }
    
    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }
    
    function isApproved(uint256 _txId, address _owner) external view returns (bool) {
        return approved[_txId][_owner];
    }
    
    function getDailySpent() external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        return dailySpent[today];
    }
    
    function getRemainingDailyLimit() external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        if (dailySpent[today] >= limits.dailyLimit) return 0;
        return limits.dailyLimit - dailySpent[today];
    }
    
    function getLimits() external view returns (LimitConfig memory) {
        return limits;
    }
    
    function canExecute(uint256 _txId) external view returns (bool executable, string memory reason) {
        if (_txId >= transactions.length) return (false, "Transaction does not exist");
        
        Transaction storage txn = transactions[_txId];
        
        if (txn.executed) return (false, "Already executed");
        if (txn.cancelled) return (false, "Transaction cancelled");
        if (block.timestamp > txn.proposedAt + EXPIRY_DURATION) return (false, "Transaction expired");
        if (txn.approvals < requiredApprovals[txn.level]) return (false, "Not enough approvals");
        if (block.timestamp < txn.timelockUntil) return (false, "Timelock not expired");
        
        uint256 today = block.timestamp / 1 days;
        if (dailySpent[today] + txn.value > limits.dailyLimit) return (false, "Exceeds daily limit");
        
        return (true, "Ready to execute");
    }

    function _determineLevel(uint256 _value) internal view returns (Level) {
        if (_value <= limits.l1Threshold) {
            return Level.L1;
        } else if (_value <= limits.l2Threshold) {
            return Level.L2;
        } else {
            return Level.L3;
        }
    }
}
