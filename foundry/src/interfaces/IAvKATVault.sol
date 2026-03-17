// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAvKATVault {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function maxDeposit(address) external view returns (uint256);
    function maxMint(address) external view returns (uint256);
    function maxWithdraw(address owner) external view returns (uint256);
    function maxRedeem(address owner) external view returns (uint256);
    function previewDeposit(uint256 assets) external view returns (uint256);
    function previewMint(uint256 shares) external view returns (uint256);
    function previewWithdraw(uint256 assets) external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);
    function deposit(uint256 assets, address receiver) external returns (uint256);
    function mint(uint256 shares, address receiver) external returns (uint256);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256);
    function escrow() external view returns (address);
    function lockNft() external view returns (address);
    function masterTokenId() external view returns (uint256);
    function strategy() external view returns (address);
    function defaultStrategy() external view returns (address);
    function paused() external view returns (bool);
    function depositTokenId(uint256 tokenId, address receiver) external returns (uint256);
    function withdrawTokenId(uint256 assets, address receiver, address owner) external returns (uint256);
    function donate(uint256 assets) external;
    function pause() external;
    function unpause() external;
    function initializeMasterTokenAndStrategy(uint256 tokenId, address strategy) external;
}
