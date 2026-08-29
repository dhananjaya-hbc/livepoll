export interface ResultRow {
    option: string
    count: number
    percentage: number
}

/** Rows in the poll's own option order, so the export matches what's on screen. */
export function buildResultRows(
    options: string[],
    counts: Record<string, number>
): ResultRow[] {
    const total = options.reduce((sum, option) => sum + (counts[option] || 0), 0)

    return options.map((option) => {
        const count = counts[option] || 0
        return {
            option,
            count,
            percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        }
    })
}

/**
 * Quotes a field only when it needs it. Option text is host-authored, so commas,
 * quotes and newlines all have to survive the round trip into a spreadsheet.
 */
function escapeCsvField(value: string): string {
    if (!/[",\n\r]/.test(value)) return value
    return `"${value.replace(/"/g, '""')}"`
}

export function buildResultsCsv(rows: ResultRow[]): string {
    const lines = [
        ['Option', 'Votes', 'Percentage'].join(','),
        ...rows.map((row) =>
            [escapeCsvField(row.option), String(row.count), `${row.percentage}%`].join(',')
        ),
    ]

    return lines.join('\r\n')
}

/** Plain-text summary shaped for pasting into Slack or a message. */
export function buildSummaryText(
    question: string,
    rows: ResultRow[],
    status: string,
    url: string
): string {
    const total = rows.reduce((sum, row) => sum + row.count, 0)

    return [
        question,
        `${total} vote${total === 1 ? '' : 's'} · ${status}`,
        '',
        ...rows.map((row) => `${row.option} — ${row.count} (${row.percentage}%)`),
        '',
        url,
    ].join('\n')
}

/** Filesystem-safe stem derived from the question, e.g. "tea-or-coffee". */
export function toFilenameStem(question: string): string {
    const slug = question
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)

    return slug || 'poll'
}

/** Hands the browser a file without a server round trip. */
export function downloadFile(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
