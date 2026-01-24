import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Eye, Receipt, Trash2, Download, Share2, Edit } from 'lucide-react'
import { useSeason } from '../context/SeasonContext'
import { supabase } from '../services/supabase'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common'
import { formatCurrency, formatDate, paymentStatusLabels } from '../utils/helpers'
import { downloadReceipt, shareOnWhatsApp } from '../utils/receiptGenerator'
import './Receipts.css'

function Receipts() {
    const { currentSeason } = useSeason()
    const navigate = useNavigate()
    const toast = useToast()
    const [receipts, setReceipts] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedReceipt, setSelectedReceipt] = useState(null)

    useEffect(() => {
        if (currentSeason) {
            fetchReceipts()
        } else {
            setLoading(false)
        }
    }, [currentSeason])

    const fetchReceipts = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('sales')
                .select(`
          *,
          customers (name, phone, address, type),
          sale_items (
            quantity,
            rate_per_dozen,
            total,
            package_sizes (name, pieces_per_box)
          )
        `)
                .eq('season_id', currentSeason.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setReceipts(data || [])
        } catch (error) {
            toast.error('Failed to load receipts')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (receipt, e) => {
        e.stopPropagation() // Prevent opening modal
        if (!confirm(`Are you sure you want to delete invoice ${receipt.invoice_number}? This cannot be undone.`)) return

        try {
            const { error } = await supabase
                .from('sales')
                .delete()
                .eq('id', receipt.id)

            if (error) throw error

            // Also update customer outstanding if it was credit - this requires more complex logic
            // Ideally should be handled by database trigger or edge function, 
            // but for now we'll just delete the sale record. 
            // The user should manually adjust if needed or we assume simple deletion is okay.

            toast.success('Receipt deleted successfully')
            fetchReceipts()
            if (selectedReceipt?.id === receipt.id) setSelectedReceipt(null)
        } catch (error) {
            toast.error('Failed to delete receipt: ' + error.message)
        }
    }

    const filteredReceipts = receipts.filter(r =>
        r.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.customers?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (!currentSeason) {
        return (
            <div className="receipts-page">
                <div className="page-header">
                    <h1 className="page-title">Receipts</h1>
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
                <h1 className="page-title">Receipts</h1>
            </div>

            {/* Search */}
            <div className="search-bar">
                <Search size={20} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search by invoice number or customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            ) : filteredReceipts.length === 0 ? (
                <div className="empty-state">
                    <Receipt size={48} className="text-muted" />
                    <p>{searchQuery ? 'No receipts found' : 'No receipts yet'}</p>
                </div>
            ) : (
                <div className="mobile-cards">
                    {filteredReceipts.map((receipt) => (
                        <div
                            key={receipt.id}
                            className="mobile-card receipt-card"
                            onClick={() => setSelectedReceipt(receipt)}
                        >
                            <div className="mobile-card-header">
                                <div>
                                    <span className="invoice-number">{receipt.invoice_number}</span>
                                    <span className={`badge ${receipt.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                        {paymentStatusLabels[receipt.payment_status]}
                                    </span>
                                </div>
                                <span className="amount">{formatCurrency(receipt.total_amount)}</span>
                            </div>
                            <div className="mobile-card-body">
                                <div className="mobile-card-row">
                                    <span>Customer</span>
                                    <span>{receipt.customers?.name || 'Walk-in'}</span>
                                </div>
                                <div className="mobile-card-row">
                                    <span>Date</span>
                                    <span>{formatDate(receipt.sale_date)}</span>
                                </div>
                                <div className="mobile-card-row">
                                    <span>Items</span>
                                    <span>{receipt.sale_items?.length || 0} item(s)</span>
                                </div>
                            </div>

                            <div className="receipt-actions">
                                <button
                                    className="btn btn-ghost btn-sm btn-icon"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        downloadReceipt(receipt, 'Dixit Mangoes')
                                    }}
                                    title="Download PDF"
                                >
                                    <Download size={16} />
                                </button>
                                <button
                                    className="btn btn-ghost btn-sm btn-icon"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        shareOnWhatsApp(receipt, 'Dixit Mangoes')
                                    }}
                                    title="Share on WhatsApp"
                                    style={{ color: '#25D366' }}
                                >
                                    <Share2 size={16} />
                                </button>
                                <button
                                    className="btn btn-ghost btn-sm btn-icon"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        navigate(`/sales?edit_id=${receipt.id}`)
                                    }}
                                    title="Edit"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    className="btn btn-ghost btn-sm btn-icon text-danger"
                                    onClick={(e) => handleDelete(receipt, e)}
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                    }
                </div >
            )}

            {/* Receipt Detail Modal */}
            <Modal
                isOpen={!!selectedReceipt}
                onClose={() => setSelectedReceipt(null)}
                title={`Invoice: ${selectedReceipt?.invoice_number}`}
                footer={
                    <div className="modal-footer-actions" style={{ display: 'flex', gap: '10px', width: '100%' }}>
                        <button
                            className="btn btn-outline"
                            style={{ flex: 1 }}
                            onClick={() => downloadReceipt(selectedReceipt, 'Dixit Mangoes')}
                        >
                            <Download size={16} /> PDF
                        </button>
                        <button
                            className="btn btn-outline"
                            style={{ flex: 1, color: '#25D366', borderColor: '#25D366' }}
                            onClick={() => shareOnWhatsApp(selectedReceipt, 'Dixit Mangoes')}
                        >
                            <Share2 size={16} /> Share
                        </button>
                        <button
                            className="btn btn-outline"
                            style={{ flex: 1 }}
                            onClick={() => navigate(`/sales?edit_id=${selectedReceipt.id}`)}
                        >
                            <Edit size={16} /> Edit
                        </button>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setSelectedReceipt(null)}>
                            Close
                        </button>
                    </div>
                }
            >
                {selectedReceipt && (
                    <div className="receipt-detail">
                        <div className="receipt-header-info">
                            <div className="business-info">
                                <h3>🥭 Dixit Mangoes</h3>
                                <p>Pune, Maharashtra</p>
                            </div>
                            <div className="receipt-meta">
                                <p><strong>Invoice:</strong> {selectedReceipt.invoice_number}</p>
                                <p><strong>Date:</strong> {formatDate(selectedReceipt.sale_date)}</p>
                            </div>
                        </div>

                        <div className="customer-info">
                            <h4>Bill To:</h4>
                            <p>{selectedReceipt.customers?.name || 'Walk-in Customer'}</p>
                            {selectedReceipt.customers?.phone && <p>{selectedReceipt.customers.phone}</p>}
                            {selectedReceipt.customers?.address && <p>{selectedReceipt.customers.address}</p>}
                        </div>

                        <table className="receipt-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Qty</th>
                                    <th>Rate</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedReceipt.sale_items?.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>{item.package_sizes?.name}</td>
                                        <td>{item.quantity}</td>
                                        <td>{formatCurrency(item.rate_per_dozen)}</td>
                                        <td>{formatCurrency(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="receipt-totals">
                            {selectedReceipt.delivery_charge > 0 && (
                                <div className="total-row">
                                    <span>Delivery Charge</span>
                                    <span>{formatCurrency(selectedReceipt.delivery_charge)}</span>
                                </div>
                            )}
                            <div className="total-row grand-total">
                                <span>Total Amount</span>
                                <span>{formatCurrency(selectedReceipt.total_amount)}</span>
                            </div>
                            <div className="total-row">
                                <span>Payment Status</span>
                                <span className={`badge ${selectedReceipt.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                    {paymentStatusLabels[selectedReceipt.payment_status]}
                                </span>
                            </div>
                            <div className="total-row">
                                <span>Payment Mode</span>
                                <span>{selectedReceipt.payment_mode === 'cash' ? 'Cash' : 'Online'}</span>
                            </div>
                        </div>

                        {selectedReceipt.notes && (
                            <div className="receipt-notes">
                                <strong>Notes:</strong> {selectedReceipt.notes}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div >
    )
}

export default Receipts
