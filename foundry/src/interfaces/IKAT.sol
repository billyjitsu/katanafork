// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IKAT {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function INFLATION_ADMIN() external view returns (bytes32);
    function INFLATION_BENEFICIARY() external view returns (bytes32);
    function UNLOCKER() external view returns (bytes32);
    function LOCK_EXEMPTION_ADMIN() external view returns (bytes32);
    function MAX_INFLATION() external view returns (uint256);
    function roleHolder(bytes32 role) external view returns (address);
    function pendingRoleHolder(bytes32 role) external view returns (address);
    function distributedSupplyCap() external view returns (uint256);
    function lastMintCapacityIncrease() external view returns (uint256);
    function inflationFactor() external view returns (uint256);
    function mintCapacity(address) external view returns (uint256);
    function unlockTime() external view returns (uint256);
    function locked() external view returns (bool);
    function isUnlocked() external view returns (bool);
    function cap() external view returns (uint256);
    function changeRoleHolder(address newRoleOwner, bytes32 role) external;
    function acceptRole(bytes32 role) external;
    function renounceInflationAdmin() external;
    function renounceInflationBeneficiary() external;
    function unlockAndRenounceUnlocker() external;
    function renounceLockExemptionAdmin() external;
    function setLockExemption(address user, bool value) external;
    function changeInflation(uint256 value) external;
    function distributeInflation() external;
    function distributeMintCapacity(address to, uint256 amount) external;
    function mint(address to, uint256 amount) external;
}
