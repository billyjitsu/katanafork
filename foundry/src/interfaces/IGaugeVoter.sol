// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGaugeVoter {
    struct GaugeVote {
        address gauge;
        uint256 weight;
    }

    function vote(uint256 tokenId, GaugeVote[] calldata votes) external;
    function reset(uint256 tokenId) external;
    function isVoting(uint256 tokenId) external view returns (bool);
    function votes(uint256 tokenId, address gauge) external view returns (uint256);
    function usedVotingPower(uint256 tokenId) external view returns (uint256);
    function gaugeVotes(address gauge) external view returns (uint256);
    function totalVotingPowerCast() external view returns (uint256);
    function isGauge(address gauge) external view returns (bool);
    function isAlive(address gauge) external view returns (bool);
    function getAllGauges() external view returns (address[] memory);
    function getActiveGauges() external view returns (address[] memory);
    function escrow() external view returns (address);
}
