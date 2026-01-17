// Dynamically import xlsx only when needed (reduces initial bundle by ~870KB)
let XLSX = null

async function loadXLSX() {
    if (!XLSX) {
        XLSX = await import('xlsx')
    }
    return XLSX
}

// Export data to Excel file
export async function exportToExcel(data, filename, sheetName = 'Sheet1') {
    const xlsx = await loadXLSX()

    // Create workbook
    const wb = xlsx.utils.book_new()

    // Create worksheet from data
    const ws = xlsx.utils.json_to_sheet(data)

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(wb, ws, sheetName)

    // Generate and download file
    xlsx.writeFile(wb, `${filename}.xlsx`)
}

// Export multiple sheets to Excel
export async function exportMultiSheetExcel(sheets, filename) {
    const xlsx = await loadXLSX()
    const wb = xlsx.utils.book_new()

    sheets.forEach(({ data, name }) => {
        const ws = xlsx.utils.json_to_sheet(data)
        xlsx.utils.book_append_sheet(wb, ws, name)
    })

    xlsx.writeFile(wb, `${filename}.xlsx`)
}

// Export credit ledger with header info
export async function exportCreditLedger(customer, ledgerEntries, summary) {
    const xlsx = await loadXLSX()
    const wb = xlsx.utils.book_new()

    // Create summary data
    const summaryData = [
        ['Customer Name', customer.name],
        ['Phone', customer.phone || 'N/A'],
        ['Address', customer.address || 'N/A'],
        [''],
        ['Total Purchases', summary.totalPurchases],
        ['Total Payments', summary.totalPayments],
        ['Outstanding Balance', summary.outstanding],
        ['']
    ]

    // Create ledger headers
    const ledgerHeaders = [['Date', 'Description', 'Type', 'Debit (Dr)', 'Credit (Cr)', 'Balance']]

    // Format ledger entries
    const ledgerData = ledgerEntries.map(entry => [
        entry.date,
        entry.description,
        entry.type,
        entry.debit || '',
        entry.credit || '',
        entry.balance
    ])

    // Combine all data
    const allData = [...summaryData, ...ledgerHeaders, ...ledgerData]

    // Create worksheet
    const ws = xlsx.utils.aoa_to_sheet(allData)

    // Add to workbook
    xlsx.utils.book_append_sheet(wb, ws, 'Credit Ledger')

    // Download
    xlsx.writeFile(wb, `${customer.name}_Credit_Ledger.xlsx`)
}
