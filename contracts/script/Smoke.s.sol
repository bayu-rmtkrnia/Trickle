// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ITricklePayroll} from "../src/ITricklePayroll.sol";
import {MockAUSD} from "../src/mocks/MockAUSD.sol";

/// @notice End-to-end check of the deployed payroll on a real chain, in two steps because a live
/// chain cannot warp time. The signer is employer and worker at once; the two recipients are
/// fixed throwaway addresses nobody controls, so their mAUSD (mock, no value) is effectively burned.
///
///   1. forge script script/Smoke.s.sol --rpc-url monad_testnet --account trickle-deployer --broadcast
///   2. wait for the stream to end (DURATION), then:
///      forge script script/Smoke.s.sol --sig "finish(uint256)" <streamId> \
///        --rpc-url monad_testnet --account trickle-deployer --broadcast
///
/// Reads PAYROLL_ADDRESS and TOKEN_ADDRESS from the environment.
contract Smoke is Script {
    uint128 internal constant AMOUNT = 100e6; // 100 mAUSD
    uint40 internal constant DURATION = 120;
    uint16 internal constant BPS_1 = 2_000; // 20%
    uint16 internal constant BPS_2 = 1_000; // 10%

    address internal constant FAMILY_1 =
        address(uint160(uint256(keccak256("trickle.smoke.family1"))));
    address internal constant FAMILY_2 =
        address(uint160(uint256(keccak256("trickle.smoke.family2"))));

    function run() external returns (uint256 streamId) {
        ITricklePayroll payroll = ITricklePayroll(vm.envAddress("PAYROLL_ADDRESS"));
        MockAUSD token = MockAUSD(vm.envAddress("TOKEN_ADDRESS"));

        ITricklePayroll.Split[] memory splits = new ITricklePayroll.Split[](2);
        splits[0] = ITricklePayroll.Split({recipient: FAMILY_1, bps: BPS_1});
        splits[1] = ITricklePayroll.Split({recipient: FAMILY_2, bps: BPS_2});

        vm.startBroadcast();
        address me = msg.sender;
        token.mint(me, AMOUNT);
        token.approve(address(payroll), AMOUNT);
        streamId = payroll.createStream(me, AMOUNT, 0, uint40(block.timestamp) + DURATION);
        payroll.setSplits(splits);
        vm.stopBroadcast();

        require(payroll.splitBpsOf(me, FAMILY_1) == BPS_1, "split 1 not stored");
        require(payroll.splitBpsOf(me, FAMILY_2) == BPS_2, "split 2 not stored");
        console.log("Stream id:", streamId);
        console.log("Run finish(uint256) after the stream ends (seconds):", DURATION);
    }

    function finish(uint256 streamId) external {
        ITricklePayroll payroll = ITricklePayroll(vm.envAddress("PAYROLL_ADDRESS"));
        MockAUSD token = MockAUSD(vm.envAddress("TOKEN_ADDRESS"));
        require(block.timestamp >= payroll.getStream(streamId).end, "stream has not ended yet");

        uint256 f1Before = token.balanceOf(FAMILY_1);
        uint256 f2Before = token.balanceOf(FAMILY_2);

        vm.startBroadcast();
        address me = msg.sender;
        uint256 meBefore = token.balanceOf(me);
        payroll.withdraw(streamId);
        payroll.setSplits(new ITricklePayroll.Split[](0)); // leave the signer without a split
        vm.stopBroadcast();

        uint256 toF1 = token.balanceOf(FAMILY_1) - f1Before;
        uint256 toF2 = token.balanceOf(FAMILY_2) - f2Before;
        uint256 toMe = token.balanceOf(me) - meBefore;
        require(toF1 == uint256(AMOUNT) * BPS_1 / 10_000, "family 1 share");
        require(toF2 == uint256(AMOUNT) * BPS_2 / 10_000, "family 2 share");
        require(toMe + toF1 + toF2 == AMOUNT, "total");
        require(payroll.splitsOf(me).length == 0, "split not cleared");

        console.log("Worker received:", toMe);
        console.log("Family 1 received:", toF1);
        console.log("Family 2 received:", toF2);
    }
}
