// Generated from TricklePayroll.json by scripts/gen-abi.mjs. Do not edit by hand.
export const tricklePayrollAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'token_',
        type: 'address',
        internalType: 'contract IERC20',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'MAX_RECIPIENTS',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cancel',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createStream',
    inputs: [
      {
        name: 'worker',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'start',
        type: 'uint40',
        internalType: 'uint40',
      },
      {
        name: 'end',
        type: 'uint40',
        internalType: 'uint40',
      },
    ],
    outputs: [
      {
        name: 'streamId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getStream',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct ITricklePayroll.Stream',
        components: [
          {
            name: 'employer',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'start',
            type: 'uint40',
            internalType: 'uint40',
          },
          {
            name: 'end',
            type: 'uint40',
            internalType: 'uint40',
          },
          {
            name: 'canceled',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'worker',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'amount',
            type: 'uint128',
            internalType: 'uint128',
          },
          {
            name: 'withdrawn',
            type: 'uint128',
            internalType: 'uint128',
          },
          {
            name: 'refunded',
            type: 'uint128',
            internalType: 'uint128',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextStreamId',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setSplits',
    inputs: [
      {
        name: 'splits',
        type: 'tuple[]',
        internalType: 'struct ITricklePayroll.Split[]',
        components: [
          {
            name: 'recipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'bps',
            type: 'uint16',
            internalType: 'uint16',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'splitBpsOf',
    inputs: [
      {
        name: 'worker',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'splitsOf',
    inputs: [
      {
        name: 'worker',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct ITricklePayroll.Split[]',
        components: [
          {
            name: 'recipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'bps',
            type: 'uint16',
            internalType: 'uint16',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'streamedAmount',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint128',
        internalType: 'uint128',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'token',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IERC20',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawable',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint128',
        internalType: 'uint128',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'SplitPaid',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'worker',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SplitUpdated',
    inputs: [
      {
        name: 'worker',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'splits',
        type: 'tuple[]',
        indexed: false,
        internalType: 'struct ITricklePayroll.Split[]',
        components: [
          {
            name: 'recipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'bps',
            type: 'uint16',
            internalType: 'uint16',
          },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'StreamCanceled',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'streamedAtCancel',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'refunded',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'StreamCreated',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'employer',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'worker',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'start',
        type: 'uint40',
        indexed: false,
        internalType: 'uint40',
      },
      {
        name: 'end',
        type: 'uint40',
        indexed: false,
        internalType: 'uint40',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Withdrawn',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'worker',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'toWorker',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'toRecipients',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'DuplicateRecipient',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidSplit',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidTimeRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotEmployer',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'NotWorker',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'NothingToWithdraw',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'StreamAlreadyCanceled',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'StreamAlreadyEnded',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'StreamNotFound',
    inputs: [
      {
        name: 'streamId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'TooManyRecipients',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAmount',
    inputs: [],
  },
] as const
