// Format currency in Indian Rupees
export function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '₹0'
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

// Format date in Indian format
export function formatDate(dateString) {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}

// Format date for input field
export function formatDateForInput(dateString) {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toISOString().split('T')[0]
}

// Get today's date for input field
export function getTodayDate() {
    return new Date().toISOString().split('T')[0]
}

// Calculate suggested selling price
// buyingRate is per unit (box), piecesPerBox is the package size
// We want to add ₹300 margin per dozen
export function calculateSuggestedPrice(buyingRatePerUnit, piecesPerBox, marginPerDozen = 300) {
    if (!buyingRatePerUnit || !piecesPerBox) return 0
    // Cost per piece
    const costPerPiece = buyingRatePerUnit / piecesPerBox
    // Cost per dozen
    const costPerDozen = costPerPiece * 12
    // Add margin
    return Math.ceil(costPerDozen + marginPerDozen)
}

// Generate invoice number
export function generateInvoiceNumber(prefix = 'INV') {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `${prefix}${year}${month}${day}${random}`
}

// Debounce function
export function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout)
            func(...args)
        }
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
    }
}

// Customer type labels (delivery is now a separate toggle)
export const customerTypeLabels = {
    'walk-in': 'Walk-in',
    'credit': 'Credit'
}

// Payment status labels
export const paymentStatusLabels = {
    'paid': 'Paid',
    'pending': 'Pending',
    'partial': 'Partial'
}

// Expense category labels
export const expenseCategoryLabels = {
    'rent': 'Rent',
    'transport': 'Transport',
    'daily': 'Daily Expenses',
    'delivery': 'Delivery',
    'misc': 'Miscellaneous'
}

// Enquiry status labels
export const enquiryStatusLabels = {
    'pending': 'Pending',
    'confirmed': 'Confirmed',
    'fulfilled': 'Fulfilled',
    'cancelled': 'Cancelled'
}

// Enquiry type labels
export const enquiryTypeLabels = {
    'availability': 'Availability Check',
    'advance_order': 'Advance Order'
}

