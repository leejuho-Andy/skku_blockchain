// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ChangeTicket
 * @notice 시스템 변경권 NFT - 산업보안 변경관리용
 */
contract ChangeTicket is ERC721, ERC721Enumerable, ERC721Burnable, AccessControl, ReentrancyGuard {
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    
    enum Severity { LOW, MEDIUM, HIGH, CRITICAL }
    enum TicketStatus { PENDING, APPROVED, EXECUTABLE, EXECUTED, EXPIRED, CANCELLED }
    
    struct TicketInfo {
        string changeScope;
        Severity severity;
        TicketStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 timelockUntil;
        uint256 approvals;
        uint256 requiredApprovals;
        address requester;
        string executionResult;
    }
    
    uint256 private _nextTokenId;
    mapping(uint256 => TicketInfo) public tickets;
    mapping(uint256 => mapping(address => bool)) public hasApproved;
    mapping(Severity => uint256) public requiredApprovalsBySeverity;
    mapping(Severity => uint256) public timelockBySeverity;
    
    uint256 public expiryDuration = 30 days;
    uint256 public maxSupply;
    bool public paused;

    event TicketCreated(uint256 indexed tokenId, address indexed requester, string changeScope, Severity severity, uint256 expiresAt);
    event TicketApproved(uint256 indexed tokenId, address indexed approver, uint256 currentApprovals, uint256 requiredApprovals);
    event TicketApprovalRevoked(uint256 indexed tokenId, address indexed revoker);
    event TicketExecuted(uint256 indexed tokenId, address indexed executor, string result);
    event TicketExpired(uint256 indexed tokenId);
    event TicketCancelled(uint256 indexed tokenId, address indexed canceller, string reason);
    event AdminBurn(uint256 indexed tokenId, address indexed admin, string reason);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier ticketExists(uint256 tokenId) {
        require(_ownerOf(tokenId) != address(0), "Ticket does not exist");
        _;
    }
    
    modifier notExpired(uint256 tokenId) {
        require(block.timestamp <= tickets[tokenId].expiresAt, "Ticket expired");
        _;
    }

    constructor() ERC721("ChangeTicket", "CTIX") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        
        // 시연용: 낮은 승인 수
        requiredApprovalsBySeverity[Severity.LOW] = 2;
        requiredApprovalsBySeverity[Severity.MEDIUM] = 2;
        requiredApprovalsBySeverity[Severity.HIGH] = 2;
        requiredApprovalsBySeverity[Severity.CRITICAL] = 2;
        
        // 시연용: 짧은 타임락
        timelockBySeverity[Severity.LOW] = 0;
        timelockBySeverity[Severity.MEDIUM] = 90;   // 30초
        timelockBySeverity[Severity.HIGH] = 120;     // 60초
        timelockBySeverity[Severity.CRITICAL] = 150; // 90초
    }

    function mintTicket(address to, string calldata changeScope, Severity severity) 
        external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) 
    {
        require(to != address(0), "Invalid recipient");
        require(bytes(changeScope).length > 0, "Change scope required");
        if (maxSupply > 0) require(totalSupply() < maxSupply, "Max supply reached");
        
        uint256 tokenId = _nextTokenId++;
        
        tickets[tokenId] = TicketInfo({
            changeScope: changeScope,
            severity: severity,
            status: TicketStatus.PENDING,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + expiryDuration,
            timelockUntil: 0,
            approvals: 0,
            requiredApprovals: requiredApprovalsBySeverity[severity],
            requester: to,
            executionResult: ""
        });
        
        _safeMint(to, tokenId);
        emit TicketCreated(tokenId, to, changeScope, severity, tickets[tokenId].expiresAt);
        return tokenId;
    }

    function approveTicket(uint256 tokenId) 
        external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused ticketExists(tokenId) notExpired(tokenId)
    {
        TicketInfo storage ticket = tickets[tokenId];
        require(ticket.status == TicketStatus.PENDING || ticket.status == TicketStatus.APPROVED, "Invalid status");
        require(!hasApproved[tokenId][msg.sender], "Already approved");
        
        hasApproved[tokenId][msg.sender] = true;
        ticket.approvals += 1;
        
        emit TicketApproved(tokenId, msg.sender, ticket.approvals, ticket.requiredApprovals);
        
        if (ticket.approvals >= ticket.requiredApprovals) {
            ticket.status = TicketStatus.APPROVED;
            ticket.timelockUntil = block.timestamp + timelockBySeverity[ticket.severity];
        }
    }

    function revokeApproval(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) ticketExists(tokenId) {
        TicketInfo storage ticket = tickets[tokenId];
        require(ticket.status != TicketStatus.EXECUTED, "Already executed");
        require(hasApproved[tokenId][msg.sender], "Not approved");
        
        hasApproved[tokenId][msg.sender] = false;
        ticket.approvals -= 1;
        
        if (ticket.approvals < ticket.requiredApprovals) {
            ticket.status = TicketStatus.PENDING;
            ticket.timelockUntil = 0;
        }
        
        emit TicketApprovalRevoked(tokenId, msg.sender);
    }

    function executeTicket(uint256 tokenId, string calldata result)
        external nonReentrant whenNotPaused ticketExists(tokenId) notExpired(tokenId)
    {
        TicketInfo storage ticket = tickets[tokenId];
        
        require(ownerOf(tokenId) == msg.sender || hasRole(EXECUTOR_ROLE, msg.sender), "Not authorized");
        require(ticket.status == TicketStatus.APPROVED, "Not approved");
        require(ticket.approvals >= ticket.requiredApprovals, "Not enough approvals");
        require(block.timestamp >= ticket.timelockUntil, "Timelock not expired");
        
        ticket.status = TicketStatus.EXECUTED;
        ticket.executionResult = result;
        
        emit TicketExecuted(tokenId, msg.sender, result);
        _burn(tokenId);
    }

    function markExpired(uint256 tokenId) external ticketExists(tokenId) {
        TicketInfo storage ticket = tickets[tokenId];
        require(block.timestamp > ticket.expiresAt, "Not expired yet");
        require(ticket.status != TicketStatus.EXECUTED && ticket.status != TicketStatus.EXPIRED, "Invalid status");
        
        ticket.status = TicketStatus.EXPIRED;
        emit TicketExpired(tokenId);
        _burn(tokenId);
    }

    function cancelTicket(uint256 tokenId, string calldata reason) external ticketExists(tokenId) {
        TicketInfo storage ticket = tickets[tokenId];
        require(ticket.requester == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        require(ticket.status != TicketStatus.EXECUTED && ticket.status != TicketStatus.CANCELLED, "Invalid status");
        
        ticket.status = TicketStatus.CANCELLED;
        emit TicketCancelled(tokenId, msg.sender, reason);
        _burn(tokenId);
    }

    function adminBurn(uint256 tokenId, string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) ticketExists(tokenId) {
        require(bytes(reason).length > 0, "Reason required");
        emit AdminBurn(tokenId, msg.sender, reason);
        _burn(tokenId);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { paused = true; emit Paused(msg.sender); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { paused = false; emit Unpaused(msg.sender); }

    function setExpiryDuration(uint256 _duration) external onlyRole(DEFAULT_ADMIN_ROLE) { expiryDuration = _duration; }
    function setMaxSupply(uint256 _maxSupply) external onlyRole(DEFAULT_ADMIN_ROLE) { maxSupply = _maxSupply; }
    function setRequiredApprovals(Severity severity, uint256 required) external onlyRole(DEFAULT_ADMIN_ROLE) { requiredApprovalsBySeverity[severity] = required; }
    function setTimelock(Severity severity, uint256 duration) external onlyRole(DEFAULT_ADMIN_ROLE) { timelockBySeverity[severity] = duration; }
    function setTreasury(address treasury) external onlyRole(DEFAULT_ADMIN_ROLE) { _grantRole(EXECUTOR_ROLE, treasury); }

    function getTicketInfo(uint256 tokenId) external view returns (TicketInfo memory) { return tickets[tokenId]; }
    function getTicketStatus(uint256 tokenId) external view returns (TicketStatus) { return tickets[tokenId].status; }
    function getApprovalStatus(uint256 tokenId, address approver) external view returns (bool) { return hasApproved[tokenId][approver]; }
    
    function isExecutable(uint256 tokenId) external view returns (bool, string memory) {
        if (_ownerOf(tokenId) == address(0)) return (false, "Ticket does not exist");
        TicketInfo storage ticket = tickets[tokenId];
        if (block.timestamp > ticket.expiresAt) return (false, "Ticket expired");
        if (ticket.status != TicketStatus.APPROVED) return (false, "Not approved");
        if (ticket.approvals < ticket.requiredApprovals) return (false, "Not enough approvals");
        if (block.timestamp < ticket.timelockUntil) return (false, "Timelock not expired");
        return (true, "Ready to execute");
    }

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }
    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) { super._increaseBalance(account, value); }
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable, AccessControl) returns (bool) { return super.supportsInterface(interfaceId); }
}
