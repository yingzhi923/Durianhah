// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Durian721
 * @notice 标准 ERC721 + AccessControl + ERC721URIStorage 版本
 */
contract Durian721 is ERC721URIStorage, AccessControl {
    // 角色常量
    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");
    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");

    constructor() ERC721("Durian", "DURI") {
        // 部署者为管理员
        _grantRole(ADMIN_ROLE, msg.sender);

        // ADMIN 可以管理 FARMER_ROLE
        _setRoleAdmin(FARMER_ROLE, ADMIN_ROLE);
    }

    /**
     * @notice 农户（或演示时你的单账号）铸造一个新的榴莲 NFT
     * @param to 接收地址
     * @param tokenId 自定义 tokenId
     * @param tokenUri 可为空字符串；不为空则写入 tokenURI（通常是聚合元数据 JSON）
     */
    function mintDurian(
        address to,
        uint256 tokenId,
        string calldata tokenUri
    ) external onlyRole(FARMER_ROLE) {
        _safeMint(to, tokenId);
        if (bytes(tokenUri).length != 0) {
            _setTokenURI(tokenId, tokenUri);
        }
    }

    /**
     * @notice （可选）管理员修改/补充 tokenURI
     */
    function setTokenURI(uint256 tokenId, string calldata tokenUri)
        external
        onlyRole(ADMIN_ROLE)
    {
        _setTokenURI(tokenId, tokenUri);
    }

    // ---------------- 必要的多重继承 overrides ----------------

    // AccessControl 与 ERC721 都实现了 supportsInterface，需要显式 override
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControl, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}