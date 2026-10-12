// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {TricklePayroll} from "../src/TricklePayroll.sol";
import {ITricklePayroll} from "../src/ITricklePayroll.sol";
import {MockAUSD} from "../src/mocks/MockAUSD.sol";

contract TricklePayrollTest is Test {
    TricklePayroll internal payroll;
    MockAUSD internal token;

    address internal employer = makeAddr("employer");
    address internal worker = makeAddr("worker");
    address internal family = makeAddr("family");
    address internal stranger = makeAddr("stranger");

    uint128 internal constant AMOUNT = 3_000e6; // $3,000
    uint40 internal constant DURATION = 30 days;
    uint40 internal t0;

    function setUp() public {
        vm.warp(1_760_000_000);
        t0 = uint40(block.timestamp);

        token = new MockAUSD();
        payroll = new TricklePayroll(IERC20(address(token)));

        token.mint(employer, 1_000_000e6);
        vm.prank(employer);
        token.approve(address(payroll), type(uint256).max);
    }

    function _create() internal returns (uint256) {
        vm.prank(employer);
        return payroll.createStream(worker, AMOUNT, 0, t0 + DURATION);
    }

    // ------------------------------------------------------------------------------------------
    // constructor / token
    // ------------------------------------------------------------------------------------------

    function test_constructor_revertsOnZeroToken() public {
        vm.expectRevert(ITricklePayroll.ZeroAddress.selector);
        new TricklePayroll(IERC20(address(0)));
    }

    function test_mockToken_metadata() public view {
        assertEq(token.name(), "Mock AUSD");
        assertEq(token.symbol(), "mAUSD");
        assertEq(token.decimals(), 6);
        assertEq(address(payroll.token()), address(token));
    }

    // ------------------------------------------------------------------------------------------
    // createStream
    // ------------------------------------------------------------------------------------------

    function test_createStream_pullsFundsAndStores() public {
        vm.expectEmit(address(payroll));
        emit ITricklePayroll.StreamCreated(1, employer, worker, AMOUNT, t0, t0 + DURATION);
        uint256 id = _create();

        assertEq(id, 1);
        assertEq(payroll.nextStreamId(), 2);
        assertEq(token.balanceOf(address(payroll)), AMOUNT);

        ITricklePayroll.Stream memory s = payroll.getStream(id);
        assertEq(s.employer, employer);
        assertEq(s.worker, worker);
        assertEq(s.amount, AMOUNT);
        assertEq(s.start, t0, "start=0 resolves to now");
        assertEq(s.end, t0 + DURATION);
        assertEq(s.withdrawn, 0);
        assertEq(s.refunded, 0);
        assertFalse(s.canceled);
    }

    function test_createStream_futureStart() public {
        vm.prank(employer);
        uint256 id = payroll.createStream(worker, AMOUNT, t0 + 1 days, t0 + 2 days);
        assertEq(payroll.getStream(id).start, t0 + 1 days);
        assertEq(payroll.withdrawable(id), 0);
    }

    function test_createStream_incrementsIds() public {
        assertEq(_create(), 1);
        assertEq(_create(), 2);
    }

    function test_createStream_revertsOnZeroWorker() public {
        vm.prank(employer);
        vm.expectRevert(ITricklePayroll.ZeroAddress.selector);
        payroll.createStream(address(0), AMOUNT, 0, t0 + DURATION);
    }

    function test_createStream_revertsOnZeroAmount() public {
        vm.prank(employer);
        vm.expectRevert(ITricklePayroll.ZeroAmount.selector);
        payroll.createStream(worker, 0, 0, t0 + DURATION);
    }

    function test_createStream_revertsOnPastStart() public {
        vm.prank(employer);
        vm.expectRevert(ITricklePayroll.InvalidTimeRange.selector);
        payroll.createStream(worker, AMOUNT, t0 - 1, t0 + DURATION);
    }

    function test_createStream_revertsWhenEndNotAfterStart() public {
        vm.startPrank(employer);
        vm.expectRevert(ITricklePayroll.InvalidTimeRange.selector);
        payroll.createStream(worker, AMOUNT, 0, t0);
        vm.expectRevert(ITricklePayroll.InvalidTimeRange.selector);
        payroll.createStream(worker, AMOUNT, t0 + 10, t0 + 10);
        vm.stopPrank();
    }

    function test_createStream_revertsWithoutAllowance() public {
        token.mint(stranger, AMOUNT);
        vm.prank(stranger);
        vm.expectRevert();
        payroll.createStream(worker, AMOUNT, 0, t0 + DURATION);
    }

    // ------------------------------------------------------------------------------------------
    // streamedAmount
    // ------------------------------------------------------------------------------------------

    function test_streamedAmount_linear() public {
        uint256 id = _create();
        assertEq(payroll.streamedAmount(id), 0);

        vm.warp(t0 + DURATION / 2);
        assertEq(payroll.streamedAmount(id), AMOUNT / 2);

        vm.warp(t0 + DURATION);
        assertEq(payroll.streamedAmount(id), AMOUNT);

        vm.warp(t0 + DURATION * 10);
        assertEq(payroll.streamedAmount(id), AMOUNT, "capped at amount");
    }

    function test_views_revertOnUnknownStream() public {
        vm.expectRevert(abi.encodeWithSelector(ITricklePayroll.StreamNotFound.selector, 42));
        payroll.getStream(42);
        vm.expectRevert(abi.encodeWithSelector(ITricklePayroll.StreamNotFound.selector, 42));
        payroll.withdrawable(42);
    }

    function testFuzz_streamedAmount_boundedAndMonotonic(
        uint128 amount,
        uint40 duration,
        uint40 a,
        uint40 b
    ) public {
        amount = uint128(bound(amount, 1, type(uint128).max));
        duration = uint40(bound(duration, 1, 10 * 365 days));
        a = uint40(bound(a, 0, uint256(duration) * 2));
        b = uint40(bound(b, a, uint256(duration) * 2));

        token.mint(employer, amount);
        vm.prank(employer);
        uint256 id = payroll.createStream(worker, amount, 0, t0 + duration);

        vm.warp(t0 + a);
        uint128 atA = payroll.streamedAmount(id);
        vm.warp(t0 + b);
        uint128 atB = payroll.streamedAmount(id);

        assertLe(atA, atB, "monotonic");
        assertLe(atB, amount, "bounded");
        if (b >= duration) assertEq(atB, amount, "full amount at end");
    }

    // ------------------------------------------------------------------------------------------
    // withdraw
    // ------------------------------------------------------------------------------------------

    function test_withdraw_paysStreamedAmount() public {
        uint256 id = _create();
        vm.warp(t0 + DURATION / 3);

        vm.expectEmit(address(payroll));
        emit ITricklePayroll.Withdrawn(id, worker, AMOUNT / 3, address(0), 0);
        vm.prank(worker);
        payroll.withdraw(id);

        assertEq(token.balanceOf(worker), AMOUNT / 3);
        assertEq(payroll.getStream(id).withdrawn, AMOUNT / 3);
        assertEq(payroll.withdrawable(id), 0);
    }

    function test_withdraw_onlyWorker() public {
        uint256 id = _create();
        vm.warp(t0 + 1 days);

        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(ITricklePayroll.NotWorker.selector, id));
        payroll.withdraw(id);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ITricklePayroll.NotWorker.selector, id));
        payroll.withdraw(id);
    }

    function test_withdraw_revertsBeforeStart() public {
        vm.prank(employer);
        uint256 id = payroll.createStream(worker, AMOUNT, t0 + 1 days, t0 + 2 days);

        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(ITricklePayroll.NothingToWithdraw.selector, id));
        payroll.withdraw(id);
    }

    function test_withdraw_twiceInSameBlockReverts() public {
        uint256 id = _create();
        vm.warp(t0 + 1 days);

        vm.startPrank(worker);
        payroll.withdraw(id);
        vm.expectRevert(abi.encodeWithSelector(ITricklePayroll.NothingToWithdraw.selector, id));
        payroll.withdraw(id);
        vm.stopPrank();
    }

    function test_withdraw_unknownStream() public {
        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(ITricklePayroll.StreamNotFound.selector, 7));
        payroll.withdraw(7);
    }

    function test_withdraw_afterEndPaysExactlyAmount() public {
        uint256 id = _create();
        vm.warp(t0 + 7 days);
        vm.prank(worker);
        payroll.withdraw(id);

        vm.warp(t0 + DURATION + 1);
        vm.prank(worker);
        payroll.withdraw(id);

        assertEq(token.balanceOf(worker), AMOUNT);
        assertEq(token.balanceOf(address(payroll)), 0);
    }

    function test_withdraw_appliesSplit() public {
        uint256 id = _create();
        vm.prank(worker);
        payroll.setSplit(family, 3_000); // 30%

        vm.warp(t0 + DURATION);
        vm.expectEmit(address(payroll));
        emit ITricklePayroll.Withdrawn(id, worker, 2_100e6, family, 900e6);
        vm.prank(worker);
        payroll.withdraw(id);

        assertEq(token.balanceOf(worker), 2_100e6);
        assertEq(token.balanceOf(family), 900e6);
    }

    function test_withdraw_fullSplitSendsEverythingToRecipient() public {
        uint256 id = _create();
        vm.prank(worker);
        payroll.setSplit(family, 10_000);

        vm.warp(t0 + DURATION);
        vm.prank(worker);
        payroll.withdraw(id);

        assertEq(token.balanceOf(worker), 0);
        assertEq(token.balanceOf(family), AMOUNT);
    }

    function test_withdraw_splitRoundsInWorkersFavor() public {
        vm.prank(employer);
        uint256 id = payroll.createStream(worker, 3, 0, t0 + 1);
        vm.prank(worker);
        payroll.setSplit(family, 5_000); // 50% of 3 = 1.5 -> 1

        vm.warp(t0 + 1);
        vm.prank(worker);
        payroll.withdraw(id);

        assertEq(token.balanceOf(family), 1);
        assertEq(token.balanceOf(worker), 2);
    }

    function testFuzz_withdraw_splitConservesFunds(uint16 bps, uint40 elapsed) public {
        bps = uint16(bound(bps, 0, 10_000));
        elapsed = uint40(bound(elapsed, 1, DURATION));
        uint256 id = _create();
        vm.prank(worker);
        payroll.setSplit(family, bps);

        vm.warp(t0 + elapsed);
        uint128 available = payroll.withdrawable(id);
        vm.assume(available > 0);
        vm.prank(worker);
        payroll.withdraw(id);

        assertEq(token.balanceOf(worker) + token.balanceOf(family), available);
        assertEq(token.balanceOf(family), uint256(available) * bps / 10_000);
    }

    function testFuzz_withdraw_manyTimesTotalsAmount(uint8 steps, uint256 seed) public {
        steps = uint8(bound(steps, 1, 20));
        uint256 id = _create();

        for (uint256 i; i < steps; i++) {
            seed = uint256(keccak256(abi.encode(seed)));
            vm.warp(block.timestamp + (seed % (DURATION / 4)));
            if (payroll.withdrawable(id) > 0) {
                vm.prank(worker);
                payroll.withdraw(id);
            }
        }
        vm.warp(t0 + DURATION);
        if (payroll.withdrawable(id) > 0) {
            vm.prank(worker);
            payroll.withdraw(id);
        }

        assertEq(token.balanceOf(worker), AMOUNT, "no dust lost");
        assertEq(token.balanceOf(address(payroll)), 0);
    }

    // ------------------------------------------------------------------------------------------
    // setSplit
    // ------------------------------------------------------------------------------------------

    function test_setSplit_storesAndEmits() public {
        vm.expectEmit(address(payroll));
        emit ITricklePayroll.SplitUpdated(worker, family, 2_500);
        vm.prank(worker);
        payroll.setSplit(family, 2_500);

        (address recipient, uint16 bps) = payroll.splitOf(worker);
        assertEq(recipient, family);
        assertEq(bps, 2_500);
    }

    function test_setSplit_disable() public {
        vm.startPrank(worker);
        payroll.setSplit(family, 2_500);
        payroll.setSplit(address(0), 0);
        vm.stopPrank();

        (address recipient, uint16 bps) = payroll.splitOf(worker);
        assertEq(recipient, address(0));
        assertEq(bps, 0);
    }

    function test_setSplit_revertsAboveMaxBps() public {
        vm.prank(worker);
        vm.expectRevert(ITricklePayroll.InvalidSplit.selector);
        payroll.setSplit(family, 10_001);
    }

    function test_setSplit_revertsOnZeroRecipientWithBps() public {
        vm.prank(worker);
        vm.expectRevert(ITricklePayroll.InvalidSplit.selector);
        payroll.setSplit(address(0), 100);
    }

    function test_setSplit_isPerWorker() public {
        vm.prank(worker);
        payroll.setSplit(family, 5_000);
        (address recipient,) = payroll.splitOf(stranger);
        assertEq(recipient, address(0));
    }

    // ------------------------------------------------------------------------------------------
    // cancel
    // ------------------------------------------------------------------------------------------

    function test_cancel_refundsUnstreamedAndFreezes() public {
        uint256 id = _create();
        uint256 employerBefore = token.balanceOf(employer);
        vm.warp(t0 + DURATION / 4);

        uint128 streamed = AMOUNT / 4;
        vm.expectEmit(address(payroll));
        emit ITricklePayroll.StreamCanceled(id, streamed, AMOUNT - streamed);
        vm.prank(employer);
        payroll.cancel(id);

        assertEq(token.balanceOf(employer) - employerBefore, AMOUNT - streamed);
        assertTrue(payroll.getStream(id).canceled);

        // Time passing after cancel does not unlock more.
        vm.warp(t0 + DURATION);
        assertEq(payroll.streamedAmount(id), streamed);

        vm.prank(worker);
        payroll.withdraw(id);
        assertEq(token.balanceOf(worker), streamed);
        assertEq(token.balanceOf(address(payroll)), 0);
    }

    function test_cancel_afterPartialWithdraw() public {
        uint256 id = _create();
        vm.warp(t0 + DURATION / 4);
        vm.prank(worker);
        payroll.withdraw(id);

        vm.warp(t0 + DURATION / 2);
        vm.prank(employer);
        payroll.cancel(id);

        vm.prank(worker);
        payroll.withdraw(id);
        assertEq(token.balanceOf(worker), AMOUNT / 2);

        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(ITricklePayroll.NothingToWithdraw.selector, id));
        payroll.withdraw(id);
    }

    function test_cancel_beforeStartRefundsEverything() public {
        vm.prank(employer);
        uint256 id = payroll.createStream(worker, AMOUNT, t0 + 1 days, t0 + 2 days);
        uint256 employerBefore = token.balanceOf(employer);

        vm.prank(employer);
        payroll.cancel(id);

        assertEq(token.balanceOf(employer) - employerBefore, AMOUNT);
        assertEq(payroll.withdrawable(id), 0);
    }

    function test_cancel_onlyEmployer() public {
        uint256 id = _create();
        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(ITricklePayroll.NotEmployer.selector, id));
        payroll.cancel(id);
    }

    function test_cancel_twiceReverts() public {
        uint256 id = _create();
        vm.startPrank(employer);
        payroll.cancel(id);
        vm.expectRevert(abi.encodeWithSelector(ITricklePayroll.StreamAlreadyCanceled.selector, id));
        payroll.cancel(id);
        vm.stopPrank();
    }

    function test_cancel_afterEndReverts() public {
        uint256 id = _create();
        vm.warp(t0 + DURATION);
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(ITricklePayroll.StreamAlreadyEnded.selector, id));
        payroll.cancel(id);
    }

    function testFuzz_cancel_conservesFunds(uint40 cancelAt, uint40 withdrawAt) public {
        cancelAt = uint40(bound(cancelAt, 0, DURATION - 1));
        withdrawAt = uint40(bound(withdrawAt, 0, cancelAt));
        uint256 id = _create();
        uint256 employerBefore = token.balanceOf(employer);

        vm.warp(t0 + withdrawAt);
        if (payroll.withdrawable(id) > 0) {
            vm.prank(worker);
            payroll.withdraw(id);
        }
        vm.warp(t0 + cancelAt);
        vm.prank(employer);
        payroll.cancel(id);
        vm.warp(t0 + DURATION * 2);
        if (payroll.withdrawable(id) > 0) {
            vm.prank(worker);
            payroll.withdraw(id);
        }

        ITricklePayroll.Stream memory s = payroll.getStream(id);
        assertLe(uint256(s.withdrawn) + s.refunded, s.amount);
        assertEq(token.balanceOf(worker) + (token.balanceOf(employer) - employerBefore), AMOUNT);
        assertEq(token.balanceOf(address(payroll)), 0);
    }

    // ------------------------------------------------------------------------------------------
    // reentrancy
    // ------------------------------------------------------------------------------------------

    function test_withdraw_blocksReentrancy() public {
        ReentrantToken evil = new ReentrantToken();
        TricklePayroll p = new TricklePayroll(IERC20(address(evil)));
        Reenterer attacker = new Reenterer(p);

        evil.mint(employer, AMOUNT);
        vm.startPrank(employer);
        evil.approve(address(p), AMOUNT);
        uint256 id = p.createStream(address(attacker), AMOUNT, 0, t0 + DURATION);
        vm.stopPrank();

        evil.setHook(address(attacker));
        attacker.arm(id);
        vm.warp(t0 + DURATION);

        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        attacker.attack(id);
    }
}

/// @dev Calls back into the recipient on every transfer, like an ERC-777 hook.
contract ReentrantToken is ERC20 {
    address internal hook;

    constructor() ERC20("Evil", "EVL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setHook(address hook_) external {
        hook = hook_;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (to == hook && hook != address(0)) Reenterer(hook).onReceive();
    }
}

contract Reenterer {
    TricklePayroll internal immutable payroll;
    uint256 internal target;

    constructor(TricklePayroll payroll_) {
        payroll = payroll_;
    }

    function arm(uint256 id) external {
        target = id;
    }

    function attack(uint256 id) external {
        payroll.withdraw(id);
    }

    function onReceive() external {
        payroll.withdraw(target);
    }
}
