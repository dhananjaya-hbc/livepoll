import { describe, test, expect } from 'vitest'
import {
    buildResultRows,
    buildResultsCsv,
    buildSummaryText,
    toFilenameStem,
} from './exportResults'

describe('buildResultRows', () => {
    test('keeps the poll option order and fills in missing counts', () => {
        const rows = buildResultRows(['Tea', 'Coffee', 'Neither'], { Coffee: 1, Tea: 3 })

        expect(rows.map((row) => row.option)).toEqual(['Tea', 'Coffee', 'Neither'])
        expect(rows.map((row) => row.count)).toEqual([3, 1, 0])
    })

    test('reports zero percent rather than dividing by zero', () => {
        const rows = buildResultRows(['Tea', 'Coffee'], {})

        expect(rows.every((row) => row.percentage === 0)).toBe(true)
    })

    test('computes percentages against the total', () => {
        const rows = buildResultRows(['Tea', 'Coffee'], { Tea: 3, Coffee: 1 })

        expect(rows[0].percentage).toBe(75)
        expect(rows[1].percentage).toBe(25)
    })
})

describe('buildResultsCsv', () => {
    test('writes a header and one row per option', () => {
        const csv = buildResultsCsv(buildResultRows(['Tea'], { Tea: 2 }))

        expect(csv).toBe('Option,Votes,Percentage\r\nTea,2,100%')
    })

    test('quotes options containing commas so columns do not shift', () => {
        const csv = buildResultsCsv(buildResultRows(['Tea, please'], { 'Tea, please': 1 }))

        expect(csv).toContain('"Tea, please",1,100%')
    })

    test('escapes embedded quotes by doubling them', () => {
        const csv = buildResultsCsv(buildResultRows(['The "best" one'], { 'The "best" one': 1 }))

        expect(csv).toContain('"The ""best"" one"')
    })

    test('quotes options containing newlines', () => {
        const csv = buildResultsCsv(buildResultRows(['Two\nlines'], { 'Two\nlines': 1 }))

        expect(csv).toContain('"Two\nlines"')
    })
})

describe('buildSummaryText', () => {
    test('reads as a pasteable summary', () => {
        const rows = buildResultRows(['Tea', 'Coffee'], { Tea: 3, Coffee: 1 })
        const summary = buildSummaryText('Tea or coffee?', rows, 'closed', 'https://x/poll/1')

        expect(summary).toContain('Tea or coffee?')
        expect(summary).toContain('4 votes · closed')
        expect(summary).toContain('Tea — 3 (75%)')
        expect(summary).toContain('https://x/poll/1')
    })

    test('uses the singular for a single vote', () => {
        const rows = buildResultRows(['Tea'], { Tea: 1 })

        expect(buildSummaryText('Q?', rows, 'open', 'url')).toContain('1 vote · open')
    })
})

describe('toFilenameStem', () => {
    test.each([
        ['Tea or coffee?', 'tea-or-coffee'],
        ['  Spaces  everywhere  ', 'spaces-everywhere'],
        ['!!!', 'poll'],
    ])('turns %j into %j', (question, expected) => {
        expect(toFilenameStem(question)).toBe(expected)
    })

    test('caps very long questions', () => {
        expect(toFilenameStem('a'.repeat(200)).length).toBeLessThanOrEqual(60)
    })
})
