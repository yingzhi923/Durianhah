// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IRewardToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IDurian721 {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title SupplyChainManager
 * @notice 五阶段提交流程 + 延迟奖励编排：
 *         - phase ∈ {1..5}，后一环核验前一环；phase=5 走 7 天时间锁后可领。
 *         - 事件带 CID（不进存储），链上仅存 dataHash 与少量元数据。
 *         - 位图 flags 管理 submitted/verified/claimed 状态（各占 5 bit）。
 */
contract SupplyChainManager is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --------- 角色 ---------
    bytes32 public constant ADMIN_ROLE     = keccak256("ADMIN_ROLE");
    bytes32 public constant FARMER_ROLE    = keccak256("FARMER_ROLE");
    bytes32 public constant PACKER_ROLE    = keccak256("PACKER_ROLE");
    bytes32 public constant LOGISTICS_ROLE = keccak256("LOGISTICS_ROLE");
    bytes32 public constant RETAIL_ROLE    = keccak256("RETAIL_ROLE");

    // --------- 常量/配置 ---------
    uint8 public constant MIN_PHASE = 1;
    uint8 public constant MAX_PHASE = 5;

    IERC20 public immutable rewardToken;
    IDurian721 public immutable nft;
    uint256 public retailLockPeriod = 7 days;

    // phase 奖励金额
    mapping(uint8 => uint256) public rewardForPhase; // 1..5

    // tokenId => flags 位图（低 5 位：submitted；第 8~12 位：verified；第 16~20 位：claimed）
    mapping(uint256 => uint32) private _flags;

    // phase 提交者与时间（占 1 槽）
    struct SubmitMeta {
        address submitter;   // 20B
        uint64 submittedAt;  // 8B
        uint32 reserved;     // 4B 填充
    }
    mapping(uint256 => mapping(uint8 => SubmitMeta)) public submitMeta; // tokenId => phase => meta

    // phase 数据：仅 dataHash + packedData（自定义打包多个数值）
    struct PhaseData {
        bytes32 dataHash;
        uint256 packedData; // 可选：将若干 int/uint 压进一个 uint256，前端解码
    }
    mapping(uint256 => mapping(uint8 => PhaseData)) public phaseData; // tokenId => phase => data

    // Retail 时间锁：phase=5 提交时设定
    mapping(uint256 => uint64) public retailReadyAt; // unlock timestamp

    // --------- 事件（CID 只放这里，不入存储） ---------
    event PhaseSubmitted(
        uint256 indexed tokenId,
        uint8 indexed phase,
        bytes32 dataHash,
        uint256 packedData,
        string cid,            // 仅事件携带
        address indexed submitter,
        uint64 submittedAt
    );

    event PhaseVerified(uint256 indexed tokenId, uint8 indexed phase, address indexed verifier, uint64 verifiedAt);
    event RewardClaimed(uint256 indexed tokenId, uint8 indexed phase, address indexed to, uint256 amount);
    event RetailReadySet(uint256 indexed tokenId, uint64 unlockTime);
    event RewardFunded(address indexed from, uint256 amount);
    event RewardWithdrawn(address indexed to, uint256 amount);
    event RewardForPhaseSet(uint8 indexed phase, uint256 amount);
    event RetailLockPeriodSet(uint256 seconds_);

    // --------- 构造 ---------
    constructor(address rewardToken_, address nft_) {
        require(rewardToken_ != address(0) && nft_ != address(0), "bad addr");
        rewardToken = IERC20(rewardToken_);
        nft = IDurian721(nft_);

        _grantRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(FARMER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(PACKER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(LOGISTICS_ROLE, ADMIN_ROLE);
        _setRoleAdmin(RETAIL_ROLE, ADMIN_ROLE);

        // 设置每个阶段的奖励金额为 10 TOKEN (10 * 10^18 wei)
        rewardForPhase[1] = 10 * 10**18;  // Phase 1: Farming - 10 TOKEN
        rewardForPhase[2] = 10 * 10**18;  // Phase 2: Harvest - 10 TOKEN
        rewardForPhase[3] = 10 * 10**18;  // Phase 3: Packing - 10 TOKEN
        rewardForPhase[4] = 10 * 10**18;  // Phase 4: Logistics - 10 TOKEN
        rewardForPhase[5] = 10 * 10**18;  // Phase 5: Retail - 10 TOKEN
    }

    // --------- 管理员函数 ---------
    function setRewardForPhase(uint8 phase, uint256 amount) external onlyRole(ADMIN_ROLE) {
        _checkPhase(phase);
        rewardForPhase[phase] = amount;
        emit RewardForPhaseSet(phase, amount);
    }

    function setRetailLockPeriod(uint256 seconds_) external onlyRole(ADMIN_ROLE) {
        require(seconds_ > 0, "zero");
        retailLockPeriod = seconds_;
        emit RetailLockPeriodSet(seconds_);
    }

    /// @notice 为合约“充奖励币”（需要先在前端对 rewardToken 执行 approve 给本合约）
    function fundRewards(uint256 amount) external onlyRole(ADMIN_ROLE) {
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardFunded(msg.sender, amount);
    }

    function withdrawRewards(address to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        rewardToken.safeTransfer(to, amount);
        emit RewardWithdrawn(to, amount);
    }

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    // --------- 提交 / 核验 / 领取 ---------

    /**
     * @notice 提交某阶段数据（CID 仅写入事件）。
     * @param tokenId  NFT id
     * @param phase    1..5
     * @param dataHash 规范化 JSON 的 keccak256
     * @param packedData 自定义打包的指标（前端/离线工具负责编码/解码）
     * @param cid      IPFS CID（不落存储）
     *
     * 访问控制：调用者必须具备该 phase 的角色。
     */
    function submitPhase(
        uint256 tokenId,
        uint8 phase,
        bytes32 dataHash,
        uint256 packedData,
        string calldata cid
    ) external whenNotPaused nonReentrant {
        _checkPhase(phase);
        _checkRole(_roleForPhase(phase), msg.sender);

        // 可选的所有权/存在性校验：只要求 token 存在且有人拥有
        // 若你希望更严格，可在 Durian721 增加 exists()；此处用 ownerOf 失败即 revert
        nft.ownerOf(tokenId);

        // 不可重复提交同一 phase（如需要“允许覆盖”，可改为允许覆盖并做事件记录）
        require(!_isSubmitted(tokenId, phase), "already submitted");

        // 记录 minimal 数据
        phaseData[tokenId][phase] = PhaseData({
            dataHash: dataHash,
            packedData: packedData
        });

        submitMeta[tokenId][phase] = SubmitMeta({
            submitter: msg.sender,
            submittedAt: uint64(block.timestamp),
            reserved: 0
        });

        _setSubmitted(tokenId, phase);

        // 若为 Retail（phase=5），设置时间锁
        if (phase == 5) {
            uint64 unlock = uint64(block.timestamp + retailLockPeriod);
            retailReadyAt[tokenId] = unlock;
            emit RetailReadySet(tokenId, unlock);
        }

        emit PhaseSubmitted(
            tokenId,
            phase,
            dataHash,
            packedData,
            cid,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice 核验上一阶段（phase ∈ {1..4}），调用者必须是“下一阶段”的角色。
     *         例如核验 phase=2（Harvest），需要 Packer 角色（phase=3）。
     */
    function verifyPhase(uint256 tokenId, uint8 phase)
        external
        whenNotPaused
        nonReentrant
    {
        require(phase >= MIN_PHASE && phase < MAX_PHASE, "phase out of range");
        // 例如核验 2 -> 要有 3 的角色
        bytes32 nextRole = _roleForPhase(phase + 1);
        _checkRole(nextRole, msg.sender);

        require(_isSubmitted(tokenId, phase), "not submitted");
        require(!_isVerified(tokenId, phase), "already verified");

        _setVerified(tokenId, phase);

        emit PhaseVerified(tokenId, phase, msg.sender, uint64(block.timestamp));
    }

    /**
     * @notice 领取某阶段奖励：
     *         - phase ∈ {1..4}：必须已通过 verify；
     *         - phase = 5：必须到达零售时间锁 unlock；
     *         - 仅限该阶段提交者领取；每阶段仅可领取一次。
     */
    function claimReward(uint256 tokenId, uint8 phase)
        external
        whenNotPaused
        nonReentrant
    {
        _checkPhase(phase);

        SubmitMeta memory sm = submitMeta[tokenId][phase];
        require(sm.submitter == msg.sender, "not submitter");
        require(!_isClaimed(tokenId, phase), "already claimed");

        if (phase == 5) {
            uint64 unlock = retailReadyAt[tokenId];
            require(unlock != 0 && block.timestamp >= unlock, "retail locked");
        } else {
            require(_isVerified(tokenId, phase), "not verified");
        }

        _setClaimed(tokenId, phase);

        uint256 amt = rewardForPhase[phase];
        if (amt > 0) {
            rewardToken.safeTransfer(msg.sender, amt);
        }

        emit RewardClaimed(tokenId, phase, msg.sender, amt);
    }

    // --------- 只读辅助 ---------
    function getFlags(uint256 tokenId) external view returns (uint32) {
        return _flags[tokenId];
    }

    function phaseStatus(uint256 tokenId, uint8 phase)
        external
        view
        returns (bool submitted, bool verified, bool claimed, address submitter, uint64 submittedAt)
    {
        submitted   = _isSubmitted(tokenId, phase);
        verified    = _isVerified(tokenId, phase);
        claimed     = _isClaimed(tokenId, phase);
        submitter   = submitMeta[tokenId][phase].submitter;
        submittedAt = submitMeta[tokenId][phase].submittedAt;
    }

    // --------- 内部：位图 & 角色 & 校验 ---------

    function _checkPhase(uint8 phase) internal pure {
        require(phase >= MIN_PHASE && phase <= MAX_PHASE, "bad phase");
    }

    function _roleForPhase(uint8 phase) internal pure returns (bytes32 r) {
        if (phase == 1) return FARMER_ROLE;
        if (phase == 2) return FARMER_ROLE;
        if (phase == 3) return PACKER_ROLE;
        if (phase == 4) return LOGISTICS_ROLE;
        if (phase == 5) return RETAIL_ROLE;
        revert("bad phase");
    }

    // bit layout:
    // submitted: bits [0..4]
    // verified : bits [8..12]
    // claimed  : bits [16..20]
    function _mask(uint8 phase) internal pure returns (uint32) {
        // phase 1..5 -> bit index 0..4
        return uint32(1) << (phase - 1);
    }

    function _isSubmitted(uint256 tokenId, uint8 phase) internal view returns (bool) {
        return (_flags[tokenId] & (_mask(phase))) != 0;
    }

    function _isVerified(uint256 tokenId, uint8 phase) internal view returns (bool) {
        return (_flags[tokenId] & (_mask(phase) << 8)) != 0;
    }

    function _isClaimed(uint256 tokenId, uint8 phase) internal view returns (bool) {
        return (_flags[tokenId] & (_mask(phase) << 16)) != 0;
    }

    function _setSubmitted(uint256 tokenId, uint8 phase) internal {
        _flags[tokenId] |= _mask(phase);
    }

    function _setVerified(uint256 tokenId, uint8 phase) internal {
        _flags[tokenId] |= (_mask(phase) << 8);
    }

    function _setClaimed(uint256 tokenId, uint8 phase) internal {
        _flags[tokenId] |= (_mask(phase) << 16);
    }
}
