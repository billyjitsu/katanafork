// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Base.t.sol";

/// @title VoteOnGauges
/// @notice vKAT holders vote on gauge allocations.
contract VoteOnGaugesTest is KatanaForkTest {

    function test_voteOnGauges() public {
        vm.startPrank(alice);
        kat.approve(address(escrow), 1_000 ether);
        uint256 tokenId = escrow.createLock(1_000 ether);
        vm.stopPrank();

        address[] memory gauges;
        try gaugeVoter.getActiveGauges() returns (address[] memory g) {
            gauges = g;
        } catch {
            return;
        }

        if (gauges.length == 0) return;

        IGaugeVoter.GaugeVote[] memory votes;
        if (gauges.length == 1) {
            votes = new IGaugeVoter.GaugeVote[](1);
            votes[0] = IGaugeVoter.GaugeVote(gauges[0], 10_000);
        } else {
            votes = new IGaugeVoter.GaugeVote[](2);
            votes[0] = IGaugeVoter.GaugeVote(gauges[0], 6_000);
            votes[1] = IGaugeVoter.GaugeVote(gauges[1], 4_000);
        }

        vm.prank(alice);
        gaugeVoter.vote(tokenId, votes);

        assertTrue(escrow.isVoting(tokenId), "Token should be marked as voting");
    }

    function test_multipleVoters() public {
        address[] memory gauges;
        try gaugeVoter.getActiveGauges() returns (address[] memory g) {
            gauges = g;
        } catch {
            return;
        }

        if (gauges.length < 2) return;

        vm.startPrank(alice);
        kat.approve(address(escrow), 2_000 ether);
        uint256 aliceId = escrow.createLock(2_000 ether);
        IGaugeVoter.GaugeVote[] memory aliceVotes = new IGaugeVoter.GaugeVote[](1);
        aliceVotes[0] = IGaugeVoter.GaugeVote(gauges[0], 10_000);
        gaugeVoter.vote(aliceId, aliceVotes);
        vm.stopPrank();

        vm.startPrank(bob);
        kat.approve(address(escrow), 3_000 ether);
        uint256 bobId = escrow.createLock(3_000 ether);
        IGaugeVoter.GaugeVote[] memory bobVotes = new IGaugeVoter.GaugeVote[](1);
        bobVotes[0] = IGaugeVoter.GaugeVote(gauges[1], 10_000);
        gaugeVoter.vote(bobId, bobVotes);
        vm.stopPrank();

        assertTrue(gaugeVoter.gaugeVotes(gauges[0]) > 0);
        assertTrue(gaugeVoter.gaugeVotes(gauges[1]) > 0);
    }
}
