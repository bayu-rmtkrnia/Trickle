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

    address internal family2 = makeAddr("family2");
    address internal family3 = makeAddr("family3");

    function _create() internal returns (uint256) {
        vm.prank(employer);
        return payroll.createStream(worker, AMOUNT, 0, t0 + DURATION);
    }

    function _split(address recipient, uint16 bps)
        internal
        pure
        returns (ITricklePayroll.Split memory)
    {
        return ITricklePayroll.Split({recipient: recipient, bps: bps});
    }

    function _splits1(address r, uint16 bps)
        internal
        pure
        returns (ITricklePayroll.Split[] memory s)
    {
        s = new ITricklePayroll.Split[](1);
        s[0] = _split(r, bps);
    }

    function _splits3(uint16 a, uint16 b, uint16 c)
        internal
        view
        returns (ITricklePayroll.Split[] memory s)
    {
        s = new ITricklePayroll.Split[](3);
        s[0] = _split(family, a);
        s[1] = _split(family2, b);
        s[2] = _split(family3, c);
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
        emit ITricklePayroll.Withdrawn(id, worker, AMOUNT / 3, 0);
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
        payroll.setSplits(_splits1(family, 3_000)); // 30%

        vm.warp(t0 + DURATION);
        vm.expectEmit(address(payroll));
        emit ITricklePayroll.Withdrawn(id, worker, 2_100e6, 900e6);
        vm.expectEmit(address(payroll));
        emit ITricklePayroll.SplitPaid(id, worker, family, 900e6);
        vm.prank(worker);
        payroll.withdraw(id);

        assertEq(token.balanceOf(worker), 2_100e6);
        assertEq(token.balanceOf(family), 900e6);
    }

    function test_withdraw_appliesThreeSplits() public {
        uint256 id = _create();
        vm.prank(worker);
        payroll.setSplits(_splits3(2_000, 1_000, 500)); // 20% + 10% + 5%

        vm.warp(t0 + DURATION);
        vm.expectEmit(address(payroll));
        emit ITricklePayroll.Withdrawn(id, worker, 1_950e6, 1_050e6);
        vm.expectEmit(address(payroll));
        emit ITricklePayroll.SplitPaid(id, worker, family, 600e6);
        vm.expectEmit(address(payroll));
        emit ITricklePayroll.SplitPaid(id, worker, family2, 300e6);
        vm.expectEmit(address(payroll));
        emit ITricklePayroll.SplitPaid(id, worker, family3, 150e6);
        vm.prank(worker);
        payroll.withdraw(id);

        assertEq(token.balanceOf(worker), 1_950e6);
        assertEq(token.balanceOf(family), 600e6);
        assertEq(token.balanceOf(family2), 300e6);
        assertEq(token.balanceOf(family3), 150e6);
    }

    function test_withdraw_skipsZeroShares() public {
        vm.prank(employer);
        uint256 id = payroll.createStream(worker, 10, 0, t0 + 1);
        vm.prank(worker);
        payroll.setSplits(_splits3(5_000, 500, 500)); // 10 units: 5, 0.5 -> 0, 0.5 -> 0

        vm.warp(t0 + 1);
        vm.recordLogs();
        vm.prank(worker);
        payroll.withdraw(id);

        // Withdrawn + one SplitPaid (family2 and family3 get 0, so no event) + 2 Transfers.
        assertEq(vm.getRecordedLogs().length, 4);
        assertEq(token.balanceOf(family), 5);
        assertEq(token.balanceOf(family2), 0);
        assertEq(token.balanceOf(family3), 0);
        assertEq(token.balanceOf(worker), 5);
    }

    function test_withdraw_fullSplitSendsEverythingToRecipient() public {
        uint256 id = _create();
        vm.prank(worker);
        payroll.setSplits(_splits1(family, 10_000));

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
        payroll.setSplits(_splits1(family, 5_000)); // 50% of 3 = 1.5 -> 1

        vm.warp(t0 + 1);
        vm.prank(worker);
        payroll.withdraw(id);

        assertEq(token.balanceOf(family), 1);
        assertEq(token.balanceOf(worker), 2);
    }

    function testFuzz_withdraw_splitConservesFunds(uint16 a, uint16 b, uint16 c, uint40 elapsed)
        public
    {
        a = uint16(bound(a, 1, 10_000 - 2));
        b = uint16(bound(b, 1, 10_000 - 1 - a));
        c = uint16(bound(c, 1, 10_000 - a - b));
        elapsed = uint40(bound(elapsed, 1, DURATION));
        uint256 id = _create();
        vm.prank(worker);
        payroll.setSplits(_splits3(a, b, c));

        vm.warp(t0 + elapsed);
        uint128 available = payroll.withdrawable(id);
        vm.assume(available > 0);
        vm.prank(worker);
        payroll.withdraw(id);

        assertEq(
            token.balanceOf(worker) + token.balanceOf(family) + token.balanceOf(family2)
                + token.balanceOf(family3),
            available
        );
        assertEq(token.balanceOf(family), uint256(available) * a / 10_000);
        assertEq(token.balanceOf(family2), uint256(available) * b / 10_000);
        assertEq(token.balanceOf(family3), uint256(available) * c / 10_000);
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
    // setSplits
    // ------------------------------------------------------------------------------------------

    function test_setSplits_storesAndEmits() public {
        ITricklePayroll.Split[] memory splits = _splits3(2_500, 1_000, 500);
        vm.expectEmit(address(payroll));
        emit ITricklePayroll.SplitUpdated(worker, splits);
        vm.prank(worker);
        payroll.setSplits(splits);

        ITricklePayroll.Split[] memory stored = payroll.splitsOf(worker);
        assertEq(stored.length, 3);
        assertEq(stored[0].recipient, family);
        assertEq(stored[0].bps, 2_500);
        assertEq(stored[2].recipient, family3);
        assertEq(stored[2].bps, 500);

        assertEq(payroll.splitBpsOf(worker, family), 2_500);
        assertEq(payroll.splitBpsOf(worker, family2), 1_000);
        assertEq(payroll.splitBpsOf(worker, stranger), 0);
    }

    function test_setSplits_replacesPreviousList() public {
        vm.startPrank(worker);
        payroll.setSplits(_splits3(2_500, 1_000, 500));
        payroll.setSplits(_splits1(family2, 4_000));
        vm.stopPrank();

        ITricklePayroll.Split[] memory stored = payroll.splitsOf(worker);
        assertEq(stored.length, 1);
        assertEq(stored[0].recipient, family2);
        assertEq(payroll.splitBpsOf(worker, family), 0, "old recipient removed");
        assertEq(payroll.splitBpsOf(worker, family2), 4_000);
    }

    function test_setSplits_emptyDisables() public {
        vm.startPrank(worker);
        payroll.setSplits(_splits1(family, 2_500));
        payroll.setSplits(new ITricklePayroll.Split[](0));
        vm.stopPrank();

        assertEq(payroll.splitsOf(worker).length, 0);
        assertEq(payroll.splitBpsOf(worker, family), 0);
    }

    function test_setSplits_revertsAboveMaxBps() public {
        vm.startPrank(worker);
        vm.expectRevert(ITricklePayroll.InvalidSplit.selector);
        payroll.setSplits(_splits1(family, 10_001));
        vm.expectRevert(ITricklePayroll.InvalidSplit.selector);
        payroll.setSplits(_splits3(5_000, 4_000, 1_001)); // total 10_001
        vm.stopPrank();
    }

    function test_setSplits_allowsExactlyFullTotal() public {
        vm.prank(worker);
        payroll.setSplits(_splits3(5_000, 4_000, 1_000));
        assertEq(payroll.splitsOf(worker).length, 3);
    }

    function test_setSplits_revertsOnZeroRecipient() public {
        vm.prank(worker);
        vm.expectRevert(ITricklePayroll.InvalidSplit.selector);
        payroll.setSplits(_splits1(address(0), 100));
    }

    function test_setSplits_revertsOnZeroBps() public {
        vm.prank(worker);
        vm.expectRevert(ITricklePayroll.InvalidSplit.selector);
        payroll.setSplits(_splits3(1_000, 0, 1_000));
    }

    function test_setSplits_revertsOnDuplicate() public {
        ITricklePayroll.Split[] memory splits = _splits3(1_000, 1_000, 1_000);
        splits[2].recipient = family;
        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(ITricklePayroll.DuplicateRecipient.selector, family));
        payroll.setSplits(splits);
    }

    function test_setSplits_revertsOnTooManyRecipients() public {
        ITricklePayroll.Split[] memory splits = new ITricklePayroll.Split[](4);
        splits[0] = _split(family, 100);
        splits[1] = _split(family2, 100);
        splits[2] = _split(family3, 100);
        splits[3] = _split(stranger, 100);
        vm.prank(worker);
        vm.expectRevert(ITricklePayroll.TooManyRecipients.selector);
        payroll.setSplits(splits);
        assertEq(payroll.MAX_RECIPIENTS(), 3);
    }

    function test_setSplits_failedUpdateKeepsOldList() public {
        vm.startPrank(worker);
        payroll.setSplits(_splits1(family, 2_500));
        vm.expectRevert(ITricklePayroll.InvalidSplit.selector);
        payroll.setSplits(_splits3(5_000, 5_000, 5_000));
        vm.stopPrank();

        assertEq(payroll.splitBpsOf(worker, family), 2_500);
        assertEq(payroll.splitsOf(worker).length, 1);
    }

    function test_setSplits_isPerWorker() public {
        vm.prank(worker);
        payroll.setSplits(_splits1(family, 5_000));
        assertEq(payroll.splitsOf(stranger).length, 0);
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
