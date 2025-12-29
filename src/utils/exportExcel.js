import * as XLSX from 'xlsx'

// Export data to Excel file
export function exportToExcel(data, filename, sheetName = 'Sheet1') {
    // Create workbook
    const wb = XLSX.utils.book_new()

    // Create worksheet from data
    const ws = XLSX.utils.json_to_sheet(data)

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    // Generate and download file
    XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Export multiple sheets to Excel
export function exportMultiSheetExcel(sheets, filename) {
    const wb = XLSX.utils.book_new()

    sheets.forEach(({ data, name }) => {
        const ws = XLSX.utils.json_to_sheet(data)
        XLSX.utils.book_append_sheet(wb, ws, name)
    })

    XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Export credit ledger with header info
export function exportCreditLedger(customer, ledgerEntries, summary) {
    const wb = XLSX.utils.book_new()

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
    const ws = XLSX.utils.aoa_to_sheet(allData)

    // Add to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Credit Ledger')

    // Download
    XLSX.writeFile(wb, `${customer.name}_Credit_Ledger.xlsx`)
}
