import jsPDF from 'jspdf'
import { formatCurrency, formatDate } from './helpers'

export const generateReceipt = async (sale) => {
    // A5 size: 148mm x 210mm
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5'
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const centerX = pageWidth / 2
    const margin = 10
    let currentY = 15

    // Colors
    const COLOR_PRIMARY = [245, 158, 11] // #F59E0B (Amber 500)
    const COLOR_PRIMARY_DARK = [217, 119, 6] // #D97706 (Amber 600)
    const COLOR_TEXT = [31, 41, 55] // #1F2937 (Gray 800)
    const COLOR_TEXT_LIGHT = [107, 114, 128] // #6B7280 (Gray 500)
    const COLOR_BORDER = [229, 231, 235] // #E5E7EB (Gray 200)

    // --- Header ---

    // Logo
    try {
        const logoUrl = '/mango.svg'
        const img = await loadImage(logoUrl)
        const logoWidth = 24
        const logoHeight = 24
        doc.addImage(img, 'PNG', centerX - (logoWidth / 2), currentY, logoWidth, logoHeight)
        currentY += logoHeight + 5
    } catch (error) {
        console.error('Failed to load logo:', error)
        // Fallback space if logo fails
        currentY += 10
    }

    // Business Name
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.setTextColor(...COLOR_PRIMARY_DARK)
    doc.text('M/s DIXIT MANGOES', centerX, currentY, { align: 'center' })

    currentY += 6
    doc.setFontSize(10)
    doc.setTextColor(...COLOR_TEXT)
    doc.text('Authentic Devgad Alphanso Trader', centerX, currentY, { align: 'center' })

    currentY += 6
    doc.setFontSize(9)
    doc.setTextColor(...COLOR_TEXT_LIGHT)
    doc.text('GI NO: AU/18105/GI/139/1415', centerX, currentY, { align: 'center' })

    currentY += 5
    doc.setFontSize(8)
    doc.text('AT POST JAMSANDE, TAL.DEVGAD, DIST. SINDHUDURG', centerX, currentY, { align: 'center' })
    currentY += 4
    doc.text('MOB: 9422584166', centerX, currentY, { align: 'center' })

    // Decorative Line
    currentY += 4
    doc.setDrawColor(...COLOR_PRIMARY)
    doc.setLineWidth(0.5)
    doc.line(margin, currentY, pageWidth - margin, currentY)

    // --- Customer & Receipt Info ---
    currentY += 10

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(...COLOR_TEXT)

    // Right Side: Invoice Details
    const invoiceY = currentY
    // Move labels further left to prevent overlap
    doc.text(`Receipt No:`, pageWidth - margin - 45, invoiceY)
    doc.setFont("helvetica", "bold")
    doc.text(`${sale.invoice_number}`, pageWidth - margin, invoiceY, { align: 'right' })

    doc.setFont("helvetica", "normal")
    doc.text(`Date:`, pageWidth - margin - 45, invoiceY + 6)
    doc.setFont("helvetica", "bold")
    doc.text(`${formatDate(sale.sale_date)}`, pageWidth - margin, invoiceY + 6, { align: 'right' })

    // Left Side: Customer Details
    doc.setFont("helvetica", "normal")
    doc.text(`Customer:`, margin, currentY)
    doc.setFont("helvetica", "bold")
    // Truncate customer name if too long to prevent hitting date
    const customerName = sale.customers?.name || 'Walk-in'
    let safeName = customerName
    if (customerName.length > 20) {
        safeName = customerName.substring(0, 18) + '...'
    }
    doc.text(safeName, margin + 20, currentY)

    // --- Items Section ---
    currentY += 20

    // Table Header
    doc.setFillColor(255, 251, 235) // Very light amber bg
    doc.rect(margin, currentY - 5, pageWidth - (margin * 2), 8, 'F')

    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(...COLOR_PRIMARY_DARK)
    doc.text('ITEM', margin + 2, currentY)
    doc.text('QTY', pageWidth - margin - 40, currentY, { align: 'right' }) // Approx position
    doc.text('RATE', pageWidth - margin - 20, currentY, { align: 'right' })
    doc.text('TOTAL', pageWidth - margin - 2, currentY, { align: 'right' })

    currentY += 8
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLOR_TEXT)

    // Items List
    sale.sale_items?.forEach((item, index) => {
        const itemName = item.package_sizes?.name || 'Item'
        const qty = item.quantity.toString()
        const rate = formatCurrency(item.rate_per_dozen).replace('₹', '')
        const total = formatCurrency(item.quantity * item.rate_per_dozen).replace('₹', '')

        doc.text(`${index + 1}. ${itemName}`, margin + 2, currentY)
        doc.text(qty, pageWidth - margin - 40, currentY, { align: 'right' })
        doc.text(rate, pageWidth - margin - 20, currentY, { align: 'right' })
        doc.text(total, pageWidth - margin - 2, currentY, { align: 'right' })

        // Light separator line
        doc.setDrawColor(...COLOR_BORDER)
        doc.setLineWidth(0.1)
        doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2)

        currentY += 8
    })

    // Delivery Charge
    if (sale.delivery_charge > 0) {
        doc.text('Delivery Charge', margin + 2, currentY)
        doc.text(formatCurrency(sale.delivery_charge).replace('₹', ''), pageWidth - margin - 2, currentY, { align: 'right' })
        currentY += 8
    }

    // --- Totals ---
    currentY += 2

    // Total Line
    doc.setDrawColor(...COLOR_PRIMARY)
    doc.setLineWidth(0.5)
    doc.line(pageWidth - margin - 60, currentY, pageWidth - margin, currentY)
    currentY += 6

    // Total Amount
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(...COLOR_PRIMARY_DARK)
    doc.text(`TOTAL`, pageWidth - margin - 35, currentY, { align: 'right' })
    doc.text(formatCurrency(sale.total_amount).replace('₹', ''), pageWidth - margin - 2, currentY, { align: 'right' })

    // Payment Status
    currentY += 6
    doc.setFontSize(10)

    // Payment Mode or Credit Status
    let paymentLabel = ''
    if (sale.payment_status === 'paid') {
        const mode = sale.payment_mode === 'cash' ? 'CASH' : 'ONLINE'
        paymentLabel = `Via ${mode}`
    } else {
        paymentLabel = 'CREDIT'
    }

    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLOR_TEXT_LIGHT)
    doc.text(paymentLabel, pageWidth - margin - 2, currentY, { align: 'right' })

    // Balance/Paid Indicator
    currentY += 8
    const balance = sale.total_amount - (sale.amount_paid || 0) // Handle legacy data

    if (balance > 0) {
        doc.setTextColor(239, 68, 68) // Red
        doc.setFont("helvetica", "bold")
        // Split label and value for better control
        doc.text(`Balance:`, pageWidth - margin - 35, currentY, { align: 'right' })
        doc.text(`${formatCurrency(balance)}`, pageWidth - margin - 2, currentY, { align: 'right' })
    } else {
        doc.setTextColor(16, 185, 129) // Green
        doc.setFont("helvetica", "bold")
        doc.text('PAID', pageWidth - margin - 2, currentY, { align: 'right' })
    }

    // --- Footer ---
    const pageHeight = doc.internal.pageSize.getHeight()
    let footerY = pageHeight - 25

    // Payment Details Box
    doc.setDrawColor(...COLOR_BORDER)
    doc.setFillColor(250, 250, 250)
    doc.rect(margin, footerY - 5, pageWidth - (margin * 2), 15, 'FD')

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(...COLOR_TEXT)
    doc.text('Payment Details:', margin + 5, footerY + 2)

    doc.setFont("helvetica", "normal")
    doc.text('Gpay/PhonePe', margin + 5, footerY + 7)

    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text('8956439266', margin + 35, footerY + 7)

    // Message
    footerY += 18
    doc.setFont("helvetica", "italic")
    doc.setFontSize(9)
    doc.setTextColor(...COLOR_PRIMARY_DARK)
    doc.text('Thank you for choosing Dixit Mangoes!', centerX, footerY, { align: 'center' })

    return doc
}

const loadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
    })
}

export const shareReceiptOnWhatsApp = async (sale) => {
    const doc = await generateReceipt(sale)
    const fileName = `Invoice_${sale.invoice_number}.pdf`

    // Check if Web Share API is supported and can share files
    if (navigator.share) {
        try {
            const pdfBlob = doc.output('blob')
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' })

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({
                    title: `Invoice ${sale.invoice_number}`,
                    text: `Thank you for your order! Total: ${formatCurrency(sale.total_amount)}`,
                    files: [file]
                }).catch(err => console.error('Error sharing:', err))
                return // Exit if share initiated
            }
        } catch (e) {
            console.log("File sharing not supported, falling back to basic share")
        }
    }

    // Fallback: Download and open WhatsApp with text
    doc.save(fileName)

    const text = `*Invoice: ${sale.invoice_number}*\n` +
        `Customer: ${sale.customers?.name || 'Walk-in'}\n` +
        `Date: ${formatDate(sale.sale_date)}\n` +
        `Amount: ${formatCurrency(sale.total_amount)}\n\n` +
        `Thank you for your business!`

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(whatsappUrl, '_blank')
}
