import { useState, useEffect } from 'react'
import { Search, Trash2, Edit2 } from 'lucide-react'
import { useSeason } from '../context/SeasonContext'
import { supabase } from '../services/supabase'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common'
import { formatCurrency, formatDate, getTodayDate, formatDateForInput, customerTypeLabels, paymentStatusLabels } from '../utils/helpers'
import './AllSales.css'

function AllSales() {
    const { currentSeason } = useSeason()
    const toast = useToast()
    const [sales, setSales] = useState([])
    const [customers, setCustomers] = useState([])
    const [packageSizes, setPackageSizes] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [editingSale, setEditingSale] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')

    const [form, setForm] = useState({
        customer_id: '',
        customer_type: 'walk-in',
        customer_name: '',
        customer_phone: '',
        customer_address: '',
        sale_date: getTodayDate(),
        payment_mode: 'cash',
        payment_status: 'paid',
        items: [{ package_size_id: '', quantity: 1, rate_per_dozen: '', buying_rate: 0 }],
        delivery_charge: 0,
        notes: ''
    })

    useEffect(() => {
        fetchData()
    }, [currentSeason])

    const fetchData = async () => {
        try {
            setLoading(true)

            // Fetch customers
            const { data: customersData } = await supabase
                .from('customers')
                .select('*')
                .order('name')
            setCustomers(customersData || [])

            // Fetch package sizes
            const { data: packageData } = await supabase
                .from('package_sizes')
                .select('*')
                .eq('is_active', true)
                .order('pieces_per_box')
            setPackageSizes(packageData || [])

            // Fetch sales
            if (currentSeason) {
                const { data: salesData } = await supabase
                    .from('sales')
                    .select(`
                        *,
                        customers (name, type, phone, address),
                        sale_items (
                            *,
                            package_sizes (name, pieces_per_box)
                        )
                    `)
                    .eq('season_id', currentSeason.id)
                    .order('sale_date', { ascending: false })
                setSales(salesData || [])
            }
        } catch (error) {
            toast.error('Failed to load data')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleItemChange = (index, field, value) => {
        const newItems = [...form.items]
        newItems[index] = { ...newItems[index], [field]: value }
        setForm({ ...form, items: newItems })
    }

    const handleAddItem = () => {
        setForm({
            ...form,
            items: [...form.items, { package_size_id: '', quantity: 1, rate_per_dozen: '', buying_rate: 0 }]
        })
    }

    const handleRemoveItem = (index) => {
        if (form.items.length === 1) return
        setForm({
            ...form,
            items: form.items.filter((_, i) => i !== index)
        })
    }

    const calculateTotal = () => {
        const itemsTotal = form.items.reduce((sum, item) => {
            const qty = parseFloat(item.quantity) || 0
            const rate = parseFloat(item.rate_per_dozen) || 0
            return sum + (qty * rate)
        }, 0)
        return itemsTotal + (parseFloat(form.delivery_charge) || 0)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!currentSeason) {
            toast.error('Please create a season first')
            return
        }

        setFormLoading(true)

        try {
            let customerId = form.customer_id
            let isNewCustomer = false

            // Create new customer if needed
            if (!customerId && form.customer_name) {
                const { data: newCustomer, error: customerError } = await supabase
                    .from('customers')
                    .insert([{
                        name: form.customer_name,
                        phone: form.customer_phone || null,
                        address: form.customer_address || null,
                        type: form.customer_type,
                        total_outstanding: 0,
                        total_paid: 0
                    }])
                    .select()
                    .single()

                if (customerError) throw customerError
                customerId = newCustomer.id
                isNewCustomer = true

                // Add to local customers list
                setCustomers([...customers, newCustomer])
            }

            if (!customerId) {
                toast.error('Please select or create a customer')
                return
            }

            const totalAmount = calculateTotal()
            const amountPaid = form.payment_status === 'paid' ? totalAmount : 0

            if (editingSale) {
                // Update existing sale
                const oldTotal = editingSale.total_amount || 0
                const oldCustomerId = editingSale.customer_id
                const newCustomerId = customerId

                const { error: saleError } = await supabase
                    .from('sales')
                    .update({
                        customer_id: newCustomerId,
                        sale_date: form.sale_date,
                        payment_mode: form.payment_mode,
                        payment_status: form.payment_status,
                        total_amount: totalAmount,
                        amount_paid: amountPaid,
                        delivery_charge: parseFloat(form.delivery_charge) || 0,
                        notes: form.notes
                    })
                    .eq('id', editingSale.id)

                if (saleError) throw saleError

                // Delete old items
                await supabase
                    .from('sale_items')
                    .delete()
                    .eq('sale_id', editingSale.id)

                // Insert new items
                const items = form.items.map(item => ({
                    sale_id: editingSale.id,
                    package_size_id: item.package_size_id,
                    quantity: parseInt(item.quantity),
                    rate_per_dozen: parseFloat(item.rate_per_dozen),
                    buying_rate: parseFloat(item.buying_rate) || 0,
                    total: parseInt(item.quantity) * parseFloat(item.rate_per_dozen)
                }))

                await supabase.from('sale_items').insert(items)

                // Update customer balances
                if (oldCustomerId !== newCustomerId) {
                    // Different customers - adjust both

                    // Reduce old customer's balance
                    if (editingSale.payment_status !== 'paid') {
                        const oldCustomer = customers.find(c => c.id === oldCustomerId)
                        if (oldCustomer) {
                            await supabase
                                .from('customers')
                                .update({
                                    total_outstanding: Math.max(0, (oldCustomer.total_outstanding || 0) - oldTotal)
                                })
                                .eq('id', oldCustomerId)
                        }
                    }

                    // Add to new customer's balance
                    if (form.payment_status !== 'paid') {
                        await supabase
                            .from('customers')
                            .update({
                                total_outstanding: totalAmount
                            })
                            .eq('id', newCustomerId)
                    }
                } else {
                    // Same customer - adjust balance difference
                    const outstandingDiff = (form.payment_status !== 'paid' ? totalAmount : 0) -
                        (editingSale.payment_status !== 'paid' ? oldTotal : 0)

                    if (outstandingDiff !== 0) {
                        const customer = customers.find(c => c.id === newCustomerId)
                        if (customer) {
                            await supabase
                                .from('customers')
                                .update({
                                    total_outstanding: Math.max(0, (customer.total_outstanding || 0) + outstandingDiff)
                                })
                                .eq('id', newCustomerId)
                        }
                    }
                }

                toast.success('Sale updated successfully')
            }

            closeModal()
            fetchData()
        } catch (error) {
            toast.error('Failed to save sale: ' + error.message)
        } finally {
            setFormLoading(false)
        }
    }

    const handleDelete = async (sale) => {
        if (!confirm(`Delete this sale to ${sale.customers?.name || 'Walk-in'}?\n\nThis will update customer balances if applicable.`)) return

        try {
            // Delete sale items first
            await supabase
                .from('sale_items')
                .delete()
                .eq('sale_id', sale.id)

            // Delete sale
            const { error } = await supabase
                .from('sales')
                .delete()
                .eq('id', sale.id)

            if (error) throw error

            // Update customer outstanding if it was a credit sale
            if (sale.payment_status !== 'paid') {
                const customer = customers.find(c => c.id === sale.customer_id)
                if (customer) {
                    await supabase
                        .from('customers')
                        .update({
                            total_outstanding: Math.max(0, (customer.total_outstanding || 0) - (sale.total_amount || 0))
                        })
                        .eq('id', sale.customer_id)
                }
            }

            toast.success('Sale deleted')
            fetchData()
        } catch (error) {
            toast.error('Failed to delete sale: ' + error.message)
        }
    }

    const openEditModal = (sale) => {
        setEditingSale(sale)
        const customer = customers.find(c => c.id === sale.customer_id)
        setForm({
            customer_id: sale.customer_id,
            customer_type: customer?.type || 'walk-in',
            customer_name: sale.customers?.name || '',
            customer_phone: sale.customers?.phone || '',
            customer_address: sale.customers?.address || '',
            sale_date: formatDateForInput(sale.sale_date),
            payment_mode: sale.payment_mode,
            payment_status: sale.payment_status,
            items: sale.sale_items?.map(item => ({
                package_size_id: item.package_size_id,
                quantity: item.quantity,
                rate_per_dozen: item.rate_per_dozen,
                buying_rate: item.buying_rate || 0
            })) || [{ package_size_id: '', quantity: 1, rate_per_dozen: '', buying_rate: 0 }],
            delivery_charge: sale.delivery_charge || 0,
            notes: sale.notes || ''
        })
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingSale(null)
        setForm({
            customer_id: '',
            customer_type: 'walk-in',
            customer_name: '',
            customer_phone: '',
            customer_address: '',
            sale_date: getTodayDate(),
            payment_mode: 'cash',
            payment_status: 'paid',
            items: [{ package_size_id: '', quantity: 1, rate_per_dozen: '', buying_rate: 0 }],
            delivery_charge: 0,
            notes: ''
        })
    }

    const filteredSales = sales.filter(s =>
        (s.customers?.name || 'Walk-in').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (!currentSeason) {
        return (
            <div className="all-sales-page">
                <div className="page-header">
                    <h1 className="page-title">All Sales</h1>
                </div>
                <div className="empty-state">
                    <p>Please create a season in Settings to view sales.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="all-sales-page">
            <div className="page-header">
                <h1 className="page-title">All Sales</h1>
            </div>

            {/* Search */}
            <div className="search-bar">
                <Search size={20} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search by customer or invoice..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            ) : filteredSales.length === 0 ? (
                <div className="empty-state">
                    <p>{searchQuery ? 'No sales found' : 'No sales recorded yet'}</p>
                </div>
            ) : (
                <div className="sales-list">
                    {filteredSales.map((sale) => (
                        <div key={sale.id} className="sale-card">
                            <div className="sale-card-header">
                                <div>
                                    <span className="customer-name">{sale.customers?.name || 'Walk-in'}</span>
                                    <span className="invoice-number">{sale.invoice_number}</span>
                                </div>
                                <span className="amount">{formatCurrency(sale.total_amount)}</span>
                            </div>
                            <div className="sale-card-body">
                                <div className="sale-info-row">
                                    <span className="label">Date:</span>
                                    <span>{formatDate(sale.sale_date)}</span>
                                </div>
                                <div className="sale-info-row">
                                    <span className="label">Payment:</span>
                                    <span>
                                        {sale.payment_mode === 'cash' ? 'Cash' : 'Online'} -
                                        <span className={`badge ${sale.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                            {paymentStatusLabels[sale.payment_status]}
                                        </span>
                                    </span>
                                </div>
                                <div className="sale-items">
                                    {sale.sale_items?.map((item, idx) => (
                                        <div key={idx} className="sale-item">
                                            <span>{item.package_sizes?.name} × {item.quantity}</span>
                                            <span>@ {formatCurrency(item.rate_per_dozen)}</span>
                                        </div>
                                    ))}
                                </div>
                                {sale.notes && (
                                    <div className="sale-notes">
                                        <span className="label">Notes:</span> {sale.notes}
                                    </div>
                                )}
                            </div>
                            <div className="sale-card-actions">
                                <button className="btn btn-outline btn-sm" onClick={() => openEditModal(sale)}>
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(sale)}>
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Sale Modal */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title="Edit Sale"
                footer={
                    <>
                        <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={formLoading}>
                            {formLoading ? 'Saving...' : `Save (${formatCurrency(calculateTotal())})`}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Customer</label>
                        <select
                            value={form.customer_id}
                            onChange={(e) => {
                                if (e.target.value === 'new') {
                                    // New customer option
                                    setForm({
                                        ...form,
                                        customer_id: '',
                                        customer_type: 'walk-in',
                                        customer_name: '',
                                        customer_phone: '',
                                        customer_address: ''
                                    })
                                } else if (e.target.value) {
                                    const customer = customers.find(c => c.id === e.target.value)
                                    setForm({
                                        ...form,
                                        customer_id: e.target.value,
                                        customer_type: customer?.type || 'walk-in',
                                        customer_name: customer?.name || '',
                                        customer_phone: customer?.phone || '',
                                        customer_address: customer?.address || ''
                                    })
                                }
                            }}
                        >
                            <option value="">Select customer</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({customerTypeLabels[c.type]})</option>
                            ))}
                            <option value="new">+ Create New Customer</option>
                        </select>
                    </div>

                    {/* Show customer detail fields if creating new or no customer selected */}
                    {!form.customer_id && (
                        <>
                            <div className="form-group">
                                <label>Customer Name *</label>
                                <input
                                    type="text"
                                    placeholder="Enter customer name"
                                    value={form.customer_name}
                                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Phone</label>
                                    <input
                                        type="tel"
                                        placeholder="Phone number"
                                        value={form.customer_phone}
                                        onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Type</label>
                                    <select
                                        value={form.customer_type}
                                        onChange={(e) => setForm({
                                            ...form,
                                            customer_type: e.target.value,
                                            payment_status: e.target.value === 'credit' ? 'pending' : 'paid'
                                        })}
                                    >
                                        <option value="walk-in">Walk-in</option>
                                        <option value="delivery">Delivery</option>
                                        <option value="credit">Credit</option>
                                    </select>
                                </div>
                            </div>

                            {(form.customer_type === 'delivery' || form.customer_type === 'credit') && (
                                <div className="form-group">
                                    <label>Address</label>
                                    <input
                                        type="text"
                                        placeholder="Delivery address"
                                        value={form.customer_address}
                                        onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label>Date</label>
                            <input
                                type="date"
                                value={form.sale_date}
                                onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Payment Mode</label>
                            <select
                                value={form.payment_mode}
                                onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
                            >
                                <option value="cash">Cash</option>
                                <option value="online">Online</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Payment Status</label>
                        <select
                            value={form.payment_status}
                            onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
                        >
                            <option value="paid">Paid</option>
                            <option value="pending">Pending</option>
                            <option value="partial">Partial</option>
                        </select>
                    </div>

                    <div className="items-section">
                        <label>Items</label>
                        {form.items.map((item, index) => (
                            <div key={index} className="item-row">
                                <select
                                    value={item.package_size_id}
                                    onChange={(e) => handleItemChange(index, 'package_size_id', e.target.value)}
                                    required
                                >
                                    <option value="">Package</option>
                                    {packageSizes.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    placeholder="Qty"
                                    value={item.quantity}
                                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                    min="1"
                                    required
                                />
                                <input
                                    type="number"
                                    placeholder="Rate/dz"
                                    value={item.rate_per_dozen}
                                    onChange={(e) => handleItemChange(index, 'rate_per_dozen', e.target.value)}
                                    min="0"
                                    step="0.01"
                                    required
                                />
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-icon"
                                    onClick={() => handleRemoveItem(index)}
                                    disabled={form.items.length === 1}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <button type="button" className="btn btn-outline btn-sm" onClick={handleAddItem}>
                            <Edit2 size={14} /> Add Item
                        </button>
                    </div>

                    <div className="form-group">
                        <label>Delivery Charge</label>
                        <input
                            type="number"
                            value={form.delivery_charge}
                            onChange={(e) => setForm({ ...form, delivery_charge: e.target.value })}
                            min="0"
                            placeholder="0"
                        />
                    </div>

                    <div className="form-group">
                        <label>Notes</label>
                        <input
                            type="text"
                            placeholder="Optional notes"
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        />
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default AllSales
