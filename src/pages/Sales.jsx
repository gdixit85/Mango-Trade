import { useState, useEffect } from 'react'
import { Plus, Search, Trash2, ArrowLeft, ArrowRight, Check, UserPlus, ShoppingCart, CreditCard } from 'lucide-react'
import { useSeason } from '../context/SeasonContext'
import { supabase } from '../services/supabase'
import { useToast } from '../components/common/Toast'
import {
    formatCurrency,
    formatDate,
    getTodayDate,
    calculateSuggestedPrice,
    generateInvoiceNumber,
    customerTypeLabels,
    paymentStatusLabels
} from '../utils/helpers'
import './Sales.css'

function Sales() {
    const { currentSeason } = useSeason()
    const toast = useToast()

    // View state
    const [view, setView] = useState('list') // 'list' or 'wizard'
    const [wizardStep, setWizardStep] = useState(1) // 1: Customer, 2: Items, 3: Payment

    // Data state
    const [sales, setSales] = useState([])
    const [customers, setCustomers] = useState([])
    const [packageSizes, setPackageSizes] = useState([])
    const [latestRates, setLatestRates] = useState({})
    const [loading, setLoading] = useState(true)
    const [formLoading, setFormLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [customerSearch, setCustomerSearch] = useState('')

    // Form state
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

            // Fetch latest purchase rates for suggested pricing
            if (currentSeason) {
                const { data: latestPurchases } = await supabase
                    .from('purchase_items')
                    .select(`
            package_size_id,
            rate_per_unit,
            purchases!inner (season_id)
          `)
                    .eq('purchases.season_id', currentSeason.id)
                    .order('created_at', { ascending: false })

                const rates = {}
                latestPurchases?.forEach(p => {
                    if (!rates[p.package_size_id]) {
                        rates[p.package_size_id] = p.rate_per_unit
                    }
                })
                setLatestRates(rates)

                // Fetch sales
                const { data: salesData } = await supabase
                    .from('sales')
                    .select(`
            *,
            customers (name, type),
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

    // Customer selection/creation
    const handleSelectCustomer = (customer) => {
        setForm({
            ...form,
            customer_id: customer.id,
            customer_type: customer.type,
            customer_name: customer.name,
            customer_phone: customer.phone || '',
            customer_address: customer.address || '',
            payment_status: customer.type === 'credit' ? 'pending' : 'paid'
        })
        setWizardStep(2)
    }

    const handleCreateNewCustomer = () => {
        setForm({
            ...form,
            customer_id: '',
            customer_name: customerSearch || '',
            customer_phone: '',
            customer_address: '',
            customer_type: 'walk-in'
        })
    }

    const handleItemChange = (index, field, value) => {
        const newItems = [...form.items]
        newItems[index] = { ...newItems[index], [field]: value }

        // Auto-fill suggested price when package is selected
        if (field === 'package_size_id' && value) {
            const buyingRate = latestRates[value]
            const pkg = packageSizes.find(p => p.id === value)
            if (buyingRate && pkg) {
                const suggestedPrice = calculateSuggestedPrice(buyingRate, pkg.pieces_per_box)
                newItems[index].rate_per_dozen = suggestedPrice
                newItems[index].buying_rate = buyingRate
            }
        }

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

    const handleSubmit = async () => {
        if (!currentSeason) {
            toast.error('Please create a season first')
            return
        }

        setFormLoading(true)

        try {
            let customerId = form.customer_id

            // Create new customer if needed
            if (!customerId) {
                const { data: newCustomer, error: customerError } = await supabase
                    .from('customers')
                    .insert([{
                        name: form.customer_name || 'Walk-in Customer',
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

                // Add to local customers list
                setCustomers([...customers, newCustomer])
            }

            const totalAmount = calculateTotal()
            const invoiceNumber = generateInvoiceNumber('MT')
            const amountPaid = form.payment_status === 'paid' ? totalAmount : 0

            // Create sale
            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .insert([{
                    season_id: currentSeason.id,
                    customer_id: customerId,
                    sale_date: form.sale_date,
                    invoice_number: invoiceNumber,
                    payment_mode: form.payment_mode,
                    payment_status: form.payment_status,
                    total_amount: totalAmount,
                    amount_paid: amountPaid,
                    delivery_charge: parseFloat(form.delivery_charge) || 0,
                    notes: form.notes
                }])
                .select()
                .single()

            if (saleError) throw saleError

            // Create sale items
            const items = form.items.map(item => ({
                sale_id: sale.id,
                package_size_id: item.package_size_id,
                quantity: parseInt(item.quantity),
                rate_per_dozen: parseFloat(item.rate_per_dozen),
                buying_rate: parseFloat(item.buying_rate) || 0,
                total: parseInt(item.quantity) * parseFloat(item.rate_per_dozen)
            }))

            const { error: itemsError } = await supabase
                .from('sale_items')
                .insert(items)

            if (itemsError) throw itemsError

            // Update customer outstanding if credit
            if (form.payment_status !== 'paid') {
                const customer = customers.find(c => c.id === customerId)
                await supabase
                    .from('customers')
                    .update({
                        total_outstanding: (customer?.total_outstanding || 0) + totalAmount
                    })
                    .eq('id', customerId)
            }

            toast.success(`Sale recorded! Invoice: ${invoiceNumber}`)
            resetWizard()
            fetchData()
        } catch (error) {
            toast.error('Failed to save sale: ' + error.message)
        } finally {
            setFormLoading(false)
        }
    }

    const startNewSale = () => {
        resetWizard()
        setView('wizard')
    }

    const resetWizard = () => {
        setView('list')
        setWizardStep(1)
        setCustomerSearch('')
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

    const canProceedToStep2 = () => {
        return form.customer_id || form.customer_name.trim()
    }

    const canProceedToStep3 = () => {
        return form.items.every(item => item.package_size_id && item.quantity > 0 && item.rate_per_dozen > 0)
    }

    const filteredSales = sales.filter(s =>
        (s.customers?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.phone || '').includes(customerSearch)
    )

    if (!currentSeason) {
        return (
            <div className="sales-page">
                <div className="page-header">
                    <h1 className="page-title">Sales</h1>
                </div>
                <div className="empty-state">
                    <p>Please create a season in Settings to start recording sales.</p>
                </div>
            </div>
        )
    }

    // Wizard View
    if (view === 'wizard') {
        return (
            <div className="sales-page wizard-view">
                {/* Wizard Header */}
                <div className="wizard-header">
                    <button className="btn btn-ghost" onClick={resetWizard}>
                        <ArrowLeft size={20} /> Cancel
                    </button>
                    <h2>New Sale</h2>
                    <div className="wizard-total">
                        {formatCurrency(calculateTotal())}
                    </div>
                </div>

                {/* Progress Steps */}
                <div className="wizard-steps">
                    <div className={`wizard-step ${wizardStep >= 1 ? 'active' : ''} ${wizardStep > 1 ? 'completed' : ''}`}>
                        <div className="step-icon"><UserPlus size={18} /></div>
                        <span>Customer</span>
                    </div>
                    <div className="step-line"></div>
                    <div className={`wizard-step ${wizardStep >= 2 ? 'active' : ''} ${wizardStep > 2 ? 'completed' : ''}`}>
                        <div className="step-icon"><ShoppingCart size={18} /></div>
                        <span>Items</span>
                    </div>
                    <div className="step-line"></div>
                    <div className={`wizard-step ${wizardStep >= 3 ? 'active' : ''}`}>
                        <div className="step-icon"><CreditCard size={18} /></div>
                        <span>Payment</span>
                    </div>
                </div>

                {/* Step 1: Customer Selection */}
                {wizardStep === 1 && (
                    <div className="wizard-content">
                        <div className="search-bar">
                            <Search size={20} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search customer by name or phone..."
                                value={customerSearch}
                                onChange={(e) => {
                                    setCustomerSearch(e.target.value)
                                    handleCreateNewCustomer()
                                }}
                                autoFocus
                            />
                        </div>

                        {/* New Customer Form */}
                        {(!form.customer_id && (customerSearch || form.customer_name)) && (
                            <div className="card new-customer-card mb-3">
                                <h4>Create New Customer</h4>
                                <div className="form-group">
                                    <label>Name</label>
                                    <input
                                        type="text"
                                        placeholder="Customer name"
                                        value={form.customer_name}
                                        onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
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
                            </div>
                        )}

                        {/* Existing Customers List */}
                        {filteredCustomers.length > 0 && (
                            <div className="customer-list">
                                <h4>Select Existing Customer</h4>
                                {filteredCustomers.slice(0, 10).map(customer => (
                                    <div
                                        key={customer.id}
                                        className={`customer-option ${form.customer_id === customer.id ? 'selected' : ''}`}
                                        onClick={() => handleSelectCustomer(customer)}
                                    >
                                        <div className="customer-info">
                                            <span className="customer-name">{customer.name}</span>
                                            <span className={`badge badge-${customer.type === 'credit' ? 'warning' : 'info'}`}>
                                                {customerTypeLabels[customer.type]}
                                            </span>
                                        </div>
                                        {customer.phone && <span className="customer-phone">{customer.phone}</span>}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Continue Button */}
                        <div className="wizard-actions">
                            <button
                                className="btn btn-primary btn-block"
                                onClick={() => setWizardStep(2)}
                                disabled={!canProceedToStep2()}
                            >
                                Continue to Items <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Add Items */}
                {wizardStep === 2 && (
                    <div className="wizard-content">
                        <div className="selected-customer-bar">
                            <span>Customer: <strong>{form.customer_name || 'Walk-in'}</strong></span>
                            <button className="btn btn-ghost btn-sm" onClick={() => setWizardStep(1)}>Change</button>
                        </div>

                        <div className="items-section">
                            <h4>Add Items</h4>
                            {form.items.map((item, index) => (
                                <div key={index} className="item-card">
                                    <div className="item-row-main">
                                        <select
                                            value={item.package_size_id}
                                            onChange={(e) => handleItemChange(index, 'package_size_id', e.target.value)}
                                        >
                                            <option value="">Select Package</option>
                                            {packageSizes.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-icon text-danger"
                                            onClick={() => handleRemoveItem(index)}
                                            disabled={form.items.length === 1}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                    <div className="item-row-details">
                                        <div className="form-group">
                                            <label>Quantity</label>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                min="1"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Rate/Dozen (₹)</label>
                                            <input
                                                type="number"
                                                value={item.rate_per_dozen}
                                                onChange={(e) => handleItemChange(index, 'rate_per_dozen', e.target.value)}
                                                min="0"
                                            />
                                        </div>
                                        <div className="item-total">
                                            {formatCurrency((item.quantity || 0) * (item.rate_per_dozen || 0))}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button className="btn btn-outline btn-block" onClick={handleAddItem}>
                                <Plus size={18} /> Add Another Item
                            </button>
                        </div>

                        {/* Delivery Charge */}
                        {(form.customer_type === 'delivery' || form.customer_type === 'credit') && (
                            <div className="form-group mt-3">
                                <label>Delivery Charge (₹)</label>
                                <input
                                    type="number"
                                    value={form.delivery_charge}
                                    onChange={(e) => setForm({ ...form, delivery_charge: e.target.value })}
                                    min="0"
                                    placeholder="0"
                                />
                            </div>
                        )}

                        <div className="wizard-actions">
                            <button className="btn btn-outline" onClick={() => setWizardStep(1)}>
                                <ArrowLeft size={18} /> Back
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => setWizardStep(3)}
                                disabled={!canProceedToStep3()}
                            >
                                Continue to Payment <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Payment & Confirm */}
                {wizardStep === 3 && (
                    <div className="wizard-content">
                        <div className="order-summary">
                            <h4>Order Summary</h4>
                            <div className="summary-customer">
                                <span>{form.customer_name || 'Walk-in Customer'}</span>
                                <span className={`badge badge-${form.customer_type === 'credit' ? 'warning' : 'info'}`}>
                                    {customerTypeLabels[form.customer_type]}
                                </span>
                            </div>

                            <div className="summary-items">
                                {form.items.map((item, idx) => {
                                    const pkg = packageSizes.find(p => p.id === item.package_size_id)
                                    return (
                                        <div key={idx} className="summary-item">
                                            <span>{pkg?.name} × {item.quantity}</span>
                                            <span>{formatCurrency((item.quantity || 0) * (item.rate_per_dozen || 0))}</span>
                                        </div>
                                    )
                                })}
                                {form.delivery_charge > 0 && (
                                    <div className="summary-item">
                                        <span>Delivery</span>
                                        <span>{formatCurrency(form.delivery_charge)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="summary-total">
                                <span>Total</span>
                                <span>{formatCurrency(calculateTotal())}</span>
                            </div>
                        </div>

                        <div className="payment-options">
                            <h4>Payment</h4>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        value={form.sale_date}
                                        onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
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

                            {form.customer_type === 'credit' && (
                                <div className="form-group">
                                    <label>Payment Status</label>
                                    <select
                                        value={form.payment_status}
                                        onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
                                    >
                                        <option value="pending">Add to Credit</option>
                                        <option value="paid">Paid Now</option>
                                    </select>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Notes (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Add any notes..."
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="wizard-actions">
                            <button className="btn btn-outline" onClick={() => setWizardStep(2)}>
                                <ArrowLeft size={18} /> Back
                            </button>
                            <button
                                className="btn btn-success"
                                onClick={handleSubmit}
                                disabled={formLoading}
                            >
                                {formLoading ? 'Processing...' : (
                                    <>
                                        <Check size={18} /> Complete Sale ({formatCurrency(calculateTotal())})
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // List View
    return (
        <div className="sales-page">
            <div className="page-header">
                <h1 className="page-title">Sales</h1>
                <button className="btn btn-primary" onClick={startNewSale}>
                    <Plus size={18} /> New Sale
                </button>
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
                    {!searchQuery && (
                        <button className="btn btn-primary mt-2" onClick={startNewSale}>
                            Make First Sale
                        </button>
                    )}
                </div>
            ) : (
                <div className="mobile-cards">
                    {filteredSales.map((sale) => (
                        <div key={sale.id} className="mobile-card sale-card">
                            <div className="mobile-card-header">
                                <div>
                                    <span className="mobile-card-title">{sale.customers?.name || 'Walk-in'}</span>
                                    <span className={`badge ${sale.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                        {paymentStatusLabels[sale.payment_status]}
                                    </span>
                                </div>
                                <span className="amount">{formatCurrency(sale.total_amount)}</span>
                            </div>
                            <div className="mobile-card-body">
                                <div className="mobile-card-row">
                                    <span>Invoice</span>
                                    <span>{sale.invoice_number}</span>
                                </div>
                                <div className="mobile-card-row">
                                    <span>Date</span>
                                    <span>{formatDate(sale.sale_date)}</span>
                                </div>
                                <div className="mobile-card-row">
                                    <span>Payment</span>
                                    <span>{sale.payment_mode === 'cash' ? 'Cash' : 'Online'}</span>
                                </div>
                            </div>
                            <div className="sale-items">
                                {sale.sale_items?.map((item, idx) => (
                                    <div key={idx} className="sale-item-row">
                                        <span>{item.package_sizes?.name} × {item.quantity}</span>
                                        <span>@ {formatCurrency(item.rate_per_dozen)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default Sales
