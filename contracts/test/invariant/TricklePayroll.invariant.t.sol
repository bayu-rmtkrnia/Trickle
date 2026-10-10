// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TricklePayroll} from "../../src/TricklePayroll.sol";
import {ITricklePayroll} from "../../src/ITricklePayroll.sol";
import {MockAUSD} from "../../src/mocks/MockAUSD.sol";

/// @dev Drives the payroll with random but valid actions. Calls that would revert are skipped
/// so every run explores real state changes.
contract PayrollHandler is Test {
    TricklePayroll internal immutable payroll;
    MockAUSD internal immutable token;

    address[] internal employers;
    address[] internal workers;
    address[] internal recipients;

    uint256[] public streamIds;

    uint256 public ghostDeposited;
    uint256 public ghostPaidOut;

    constructor(TricklePayroll payroll_, MockAUSD token_) {
        payroll = payroll_;
        token = token_;
        for (uint256 i; i < 3; i++) {
            employers.push(makeAddr(string.concat("employer", vm.toString(i))));
            workers.push(makeAddr(string.concat("worker", vm.toString(i))));
            recipients.push(makeAddr(string.concat("family", vm.toString(i))));
        }
    }

    function streamCount() external view returns (uint256) {
        return streamIds.length;
    }

    function createStream(uint256 employerSeed, uint256 workerSeed, uint128 amount, uint32 duration)
        external
    {
        address employer = employers[employerSeed % employers.length];
        address worker = workers[workerSeed % workers.length];
        amount = uint128(bound(amount, 1, 1_000_000e6));
        duration = uint32(bound(duration, 1, 60 days));

        token.mint(employer, amount);
        vm.startPrank(employer);
        token.approve(address(payroll), amount);
        uint256 id = payroll.createStream(worker, amount, 0, uint40(block.timestamp + duration));
        vm.stopPrank();

        streamIds.push(id);
        ghostDeposited += amount;
    }

    function withdraw(uint256 streamSeed) external {
        if (streamIds.length == 0) return;
        uint256 id = streamIds[streamSeed % streamIds.length];
        if (payroll.withdrawable(id) == 0) return;

        ghostPaidOut += payroll.withdrawable(id);
        vm.prank(payroll.getStream(id).worker);
        payroll.withdraw(id);
    }

    function cancel(uint256 streamSeed) external {
        if (streamIds.length == 0) return;
        uint256 id = streamIds[streamSeed % streamIds.length];
        ITricklePayroll.Stream memory s = payroll.getStream(id);
        if (s.canceled || block.timestamp >= s.end) return;

        uint256 before = token.balanceOf(address(payroll));
        vm.prank(s.employer);
        payroll.cancel(id);
        ghostPaidOut += before - token.balanceOf(address(payroll));
    }

    function setSplit(uint256 workerSeed, uint256 recipientSeed, uint16 bps, bool disable)
        external
    {
        address worker = workers[workerSeed % workers.length];
        vm.prank(worker);
        if (disable) {
            payroll.setSplit(address(0), 0);
        } else {
            payroll.setSplit(
                recipients[recipientSeed % recipients.length], uint16(bound(bps, 0, 10_000))
            );
        }
    }

    function warp(uint32 seconds_) external {
        vm.warp(block.timestamp + bound(seconds_, 1, 7 days));
    }
}

contract TricklePayrollInvariantTest is Test {
    TricklePayroll internal payroll;
    MockAUSD internal token;
    PayrollHandler internal handler;

    function setUp() public {
        vm.warp(1_760_000_000);
        token = new MockAUSD();
        payroll = new TricklePayroll(IERC20(address(token)));
        handler = new PayrollHandler(payroll, token);
        targetContract(address(handler));
    }

    /// PLAN 6.2: for every stream, withdrawn + refunded <= amount.
    function invariant_streamNeverPaysMoreThanAmount() public view {
        for (uint256 i; i < handler.streamCount(); i++) {
            ITricklePayroll.Stream memory s = payroll.getStream(handler.streamIds(i));
            assertLe(uint256(s.withdrawn) + s.refunded, s.amount);
        }
    }

    /// PLAN 6.2: contract balance = sum of (amount - withdrawn - refunded) over all streams.
    function invariant_balanceMatchesOutstanding() public view {
        uint256 outstanding;
        for (uint256 i; i < handler.streamCount(); i++) {
            ITricklePayroll.Stream memory s = payroll.getStream(handler.streamIds(i));
            outstanding += s.amount - s.withdrawn - s.refunded;
        }
        assertEq(token.balanceOf(address(payroll)), outstanding);
    }

    function invariant_withdrawnNeverExceedsStreamed() public view {
        for (uint256 i; i < handler.streamCount(); i++) {
            uint256 id = handler.streamIds(i);
            assertLe(payroll.getStream(id).withdrawn, payroll.streamedAmount(id));
        }
    }

    function invariant_tokensConserved() public view {
        assertEq(
            handler.ghostDeposited(),
            handler.ghostPaidOut() + token.balanceOf(address(payroll)),
            "deposited = paid out + held"
        );
    }

    function invariant_idsAreSequential() public view {
        assertEq(payroll.nextStreamId(), handler.streamCount() + 1);
    }
}
