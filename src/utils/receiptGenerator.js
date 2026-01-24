import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { formatCurrency, formatDate } from './helpers'

export function generateReceipt(sale, businessName = 'Dixit Mangoes') {
    const doc = new jsPDF()

    // Header
    doc.setFontSize(22)
    doc.setTextColor(40, 40, 40)
    doc.text(businessName, 105, 20, { align: 'center' })

    doc.setFontSize(12)
    doc.setTextColor(100, 100, 100)
    doc.text('Pune, Maharashtra', 105, 28, { align: 'center' })

    // Invoice Info
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.text(`Invoice No: ${sale.invoice_number}`, 14, 45)
    doc.text(`Date: ${formatDate(sale.sale_date)}`, 14, 50)

    // Customer Info
    const customerName = sale.customers?.name || sale.customer_name || 'Walk-in Customer'
    doc.text(`Bill To: ${customerName}`, 140, 45)
    if (sale.customers?.phone || sale.customer_phone) {
        doc.text(`Phone: ${sale.customers?.phone || sale.customer_phone}`, 140, 50)
    }

    // Items Table
    const tableBody = sale.sale_items ? sale.sale_items.map(item => [
        item.package_sizes?.name || 'Item',
        item.quantity,
        formatCurrency(item.rate_per_dozen).replace('₹', ''),
        formatCurrency(item.total).replace('₹', '')
    ]) : (sale.items || []).map(item => [
        item.package_size_name || 'Item',
        item.quantity,
        formatCurrency(item.rate_per_dozen).replace('₹', ''),
        formatCurrency(item.total).replace('₹', '')
    ])

    doc.autoTable({
        startY: 60,
        head: [['Item', 'Qty', 'Rate', 'Total']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { halign: 'center' },
            2: { halign: 'right' },
            3: { halign: 'right' }
        }
    })

    // Totals
    const finalY = doc.lastAutoTable.finalY + 10

    if (sale.delivery_charge > 0) {
        doc.text('Delivery Charge:', 140, finalY)
        doc.text(formatCurrency(sale.delivery_charge), 190, finalY, { align: 'right' })
        doc.line(140, finalY + 2, 190, finalY + 2)
    }

    const totalY = sale.delivery_charge > 0 ? finalY + 8 : finalY

    doc.setFontSize(12)
    doc.setFont(undefined, 'bold')
    doc.text('Total Amount:', 140, totalY)
    doc.text(formatCurrency(sale.total_amount), 190, totalY, { align: 'right' })

    // Footer
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(128, 128, 128)
    doc.text('Thank you for your business!', 105, 280, { align: 'center' })

    return doc
}

export function downloadReceipt(sale, businessName) {
    const doc = generateReceipt(sale, businessName)
    doc.save(`${sale.invoice_number}.pdf`)
}

export function shareOnWhatsApp(sale, businessName) {
    const customerPhone = sale.customers?.phone || sale.customer_phone
    // If no customer phone, we can't share directly to them but can open WA with empty number
    const phone = customerPhone ? `91${customerPhone}` : ''

    const total = formatCurrency(sale.total_amount)
    const itemsCount = sale.sale_items?.length || sale.items?.length || 0

    const text = encodeURIComponent(
        `🧾 *Invoice: ${sale.invoice_number}*\n` +
        `From: ${businessName}\n` +
        `Date: ${formatDate(sale.sale_date)}\n` +
        `-------------------\n` +
        `Items: ${itemsCount}\n` +
        `*Total: ${total}*\n` +
        `-------------------\n` +
        `Thank you for your business! 🙏`
    )

    const url = phone
        ? `https://wa.me/${phone}?text=${text}`
        : `https://wa.me/?text=${text}`

    window.open(url, '_blank')
}
