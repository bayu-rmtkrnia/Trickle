import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Amount } from '../components/trickle/amount'
import { formatIdr, formatUsd } from '../lib/format'

test('USD uses exactly two decimals, including zero and rounding', () => {
  assert.equal(formatUsd(240.52), '$240.52')
  assert.equal(formatUsd(0), '$0.00')
  assert.equal(formatUsd(12), '$12.00')
  assert.equal(formatUsd(1234.567), '$1,234.57')
  assert.equal(formatUsd(-12.5), '-$12.50')
})

test('IDR uses Indonesian currency grouping with no fractional digits', () => {
  assert.equal(formatIdr(3897000).replace(/\u00a0/g, ' '), 'Rp 3.897.000')
  assert.equal(formatIdr(0).replace(/\u00a0/g, ' '), 'Rp 0')
  assert.equal(formatIdr(1234.56).replace(/\u00a0/g, ' '), 'Rp 1.235')
})

test('Amount renders caller amounts and omits an absent IDR estimate', () => {
  const both = renderToStaticMarkup(createElement(Amount, { usd: 240.52, idr: 3897000 }))
  assert.ok(both.includes('$240.52'))
  assert.ok(both.includes('≈'))
  assert.ok(both.includes('3.897.000'))
  const usdOnly = renderToStaticMarkup(createElement(Amount, { usd: 0 }))
  assert.ok(usdOnly.includes('$0.00'))
  assert.ok(!usdOnly.includes('Rp'))
  assert.ok(!usdOnly.includes('≈'))
  const zero = renderToStaticMarkup(createElement(Amount, { usd: 0, idr: 0 }))
  assert.ok(zero.includes('Rp'))
})

test('invalid monetary inputs fail clearly rather than displaying NaN or Infinity', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => formatUsd(value), RangeError)
    assert.throws(() => formatIdr(value), RangeError)
  }
})
