import { useState, useEffect } from 'react'
import { Search, Download, Edit2, Trash2, Eye, Share2 } from 'lucide-react'
import { useSeason } from '../context/SeasonContext'
import { supabase } from '../services/supabase'
import { useToast } from '../components/common/Toast'
import { formatCurrency, formatDate, customerTypeLabels, paymentStatusLabels } from '../utils/helpers'
import { generateReceipt, shareReceiptOnWhatsApp } from '../utils/receiptGenerator'
import { Modal } from '../components/common'
import './Receipts.css'

function Receipts() {
    const { currentSeason } = useSeason()
    const toast = useToast()
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [viewingSale, setViewingSale] = useState(null)
    const [showViewModal, setShowViewModal] = useState(false)

    useEffect(() => {
        fetchSales()
    }, [currentSeason])

    const fetchSales = async () => {
        if (!currentSeason) {
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('sales')
                .select(`
                    *,
                    customers (name, phone, type),
                    sale_items (
                        *,
                        package_sizes (name, pieces_per_box)
                    )
                `)
                .eq('season_id', currentSeason.id)
                .order('sale_date', { ascending: false })

            if (error) throw error
            setSales(data || [])
        } catch (error) {
            toast.error('Failed to load receipts')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleViewReceipt = (sale) => {
        setViewingSale(sale)
        setShowViewModal(true)
    }

    const handleDownloadReceipt = async (sale) => {
        try {
            const doc = await generateReceipt(sale)
            doc.save(`Invoice_${sale.invoice_number}.pdf`)
            toast.success('Receipt downloaded')
        } catch (error) {
            console.error('Error generating receipt:', error)
            toast.error('Failed to generate receipt')
        }
    }

    const handleShareReceipt = async (sale) => {
        await shareReceiptOnWhatsApp(sale)
    }

    const handleDeleteSale = async (sale) => {
        if (!confirm(`Delete sale ${sale.invoice_number}? This cannot be undone.`)) return

        try {
            const { error } = await supabase
                .from('sales')
                .delete()
                .eq('id', sale.id)

            if (error) throw error
            toast.success('Sale deleted')
            fetchSales()
        } catch (error) {
            toast.error('Failed to delete sale: ' + error.message)
        }
    }

    const filteredSales = sales.filter(s =>
        (s.customers?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (!currentSeason) {
        return (
            <div className="receipts-page">
                <div className="page-header">
                    <h1 className="page-title">All Receipts</h1>
                </div>
                <div className="empty-state">
                    <p>Please create a season in Settings to view receipts.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="receipts-page">
            <div className="page-header">
                <h1 className="page-title">All Receipts</h1>
            </div>

            {/* Search */}
            <div className="search-bar">
                <Search size={20} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search by customer or invoice number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Receipts List */}
            {loading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            ) : filteredSales.length === 0 ? (
                <div className="empty-state">
                    <p>{searchQuery ? 'No receipts found' : 'No receipts yet'}</p>
                </div>
            ) : (
                <div className="receipts-list">
                    {filteredSales.map((sale) => (
                        <div key={sale.id} className="receipt-card">
                            <div className="receipt-header">
                                <div className="receipt-info">
                                    <h3>{sale.customers?.name || 'Walk-in Customer'}</h3>
                                    <p className="invoice-number">{sale.invoice_number}</p>
                                </div>
                                <div className="receipt-amount">
                                    {formatCurrency(sale.total_amount)}
                                </div>
                            </div>

                            <div className="receipt-meta">
                                <span className="receipt-date">{formatDate(sale.sale_date)}</span>
                                <span className={`badge ${sale.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                    {paymentStatusLabels[sale.payment_status]}
                                </span>
                            </div>

                            <div className="receipt-actions">
                                <button
                                    className="btn btn-sm btn-ghost"
                                    onClick={() => handleViewReceipt(sale)}
                                    title="View Details"
                                >
                                    <Eye size={16} /> View
                                </button>
                                <button
                                    className="btn btn-sm btn-ghost"
                                    onClick={() => handleDownloadReceipt(sale)}
                                    title="Download PDF"
                                >
                                    <Download size={16} /> Download
                                </button>
                                <button
                                    className="btn btn-sm btn-ghost"
                                    onClick={() => handleShareReceipt(sale)}
                                    title="Share on WhatsApp"
                                >
                                    <Share2 size={16} /> Share
                                </button>
                                <button
                                    className="btn btn-sm btn-ghost text-danger"
                                    onClick={() => handleDeleteSale(sale)}
                                    title="Delete"
                                >
                                    <Trash2 size={16} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* View Receipt Modal */}
            <Modal
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
                title={`Receipt: ${viewingSale?.invoice_number}`}
            >
                {viewingSale && (
                    <div className="receipt-details">
                        <div className="receipt-logo-container">
                            <img
                                src="/icons/android-chrome-512x512.png"
                                alt="Swara Mangoes"
                                className="receipt-logo"
                            />
                            <h3 className="receipt-business-name">M/s SWARA MANGOES</h3>
                        </div>

                        <div className="detail-section">
                            <h4>Customer Details</h4>
                            <p><strong>Name:</strong> {viewingSale.customers?.name || 'Walk-in Customer'}</p>
                            {viewingSale.customers?.phone && (
                                <p><strong>Phone:</strong> {viewingSale.customers.phone}</p>
                            )}
                            <p><strong>Type:</strong> {customerTypeLabels[viewingSale.customers?.type] || 'Walk-in'}</p>
                        </div>

                        <div className="detail-section">
                            <h4>Sale Details</h4>
                            <p><strong>Date:</strong> {formatDate(viewingSale.sale_date)}</p>
                            <p><strong>Payment Mode:</strong> {viewingSale.payment_mode === 'cash' ? 'Cash' : 'Online'}</p>
                            <p><strong>Payment Status:</strong> {paymentStatusLabels[viewingSale.payment_status]}</p>
                        </div>

                        <div className="detail-section">
                            <h4>Items</h4>
                            <table className="items-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Qty</th>
                                        <th>Rate</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewingSale.sale_items?.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{item.package_sizes?.name}</td>
                                            <td>{item.quantity}</td>
                                            <td>{formatCurrency(item.rate_per_dozen)}</td>
                                            <td>{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {viewingSale.delivery_charge > 0 && (
                            <div className="detail-row">
                                <span>Delivery Charge:</span>
                                <span>{formatCurrency(viewingSale.delivery_charge)}</span>
                            </div>
                        )}

                        <div className="detail-total">
                            <span>Total Amount:</span>
                            <span>{formatCurrency(viewingSale.total_amount)}</span>
                        </div>

                        {viewingSale.notes && (
                            <div className="detail-section">
                                <h4>Notes</h4>
                                <p>{viewingSale.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default Receipts
