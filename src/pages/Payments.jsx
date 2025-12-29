import { useState, useEffect } from 'react'
import { Plus, Search, Users, UserCheck, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { useSeason } from '../context/SeasonContext'
import { supabase } from '../services/supabase'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common'
import { formatCurrency, formatDate, getTodayDate } from '../utils/helpers'
import './Payments.css'

function Payments() {
    const { currentSeason } = useSeason()
    const toast = useToast()
    const [activeTab, setActiveTab] = useState('customer')
    const [customerPayments, setCustomerPayments] = useState([])
    const [farmerPayments, setFarmerPayments] = useState([])
    const [customers, setCustomers] = useState([])
    const [farmers, setFarmers] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [formLoading, setFormLoading] = useState(false)

    const [form, setForm] = useState({
        type: 'customer', // customer or farmer
        entity_id: '',
        amount: '',
        payment_date: getTodayDate(),
        payment_mode: 'cash',
        notes: ''
    })

    useEffect(() => {
        fetchData()
    }, [currentSeason])

    const fetchData = async () => {
        try {
            setLoading(true)

            // Fetch customers (credit only for payments)
            const { data: customersData } = await supabase
                .from('customers')
                .select('*')
                .eq('type', 'credit')
                .order('name')
            setCustomers(customersData || [])

            // Fetch farmers
            const { data: farmersData } = await supabase
                .from('farmers')
                .select('*')
                .order('name')
            setFarmers(farmersData || [])

            if (currentSeason) {
                // Fetch customer payments
                const { data: custPayments } = await supabase
                    .from('customer_payments')
                    .select(`
            *,
            customers (name)
          `)
                    .eq('season_id', currentSeason.id)
                    .order('payment_date', { ascending: false })
                setCustomerPayments(custPayments || [])

                // Fetch farmer payments
                const { data: farmPayments } = await supabase
                    .from('farmer_payments')
                    .select(`
            *,
            farmers (name)
          `)
                    .eq('season_id', currentSeason.id)
                    .order('payment_date', { ascending: false })
                setFarmerPayments(farmPayments || [])
            }
        } catch (error) {
            toast.error('Failed to load data')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!currentSeason) {
            toast.error('Please create a season first')
            return
        }

        setFormLoading(true)

        try {
            const amount = parseFloat(form.amount)

            if (form.type === 'customer') {
                // Record customer payment
                const { error: paymentError } = await supabase
                    .from('customer_payments')
                    .insert([{
                        customer_id: form.entity_id,
                        season_id: currentSeason.id,
                        amount: amount,
                        payment_date: form.payment_date,
                        payment_mode: form.payment_mode,
                        notes: form.notes
                    }])

                if (paymentError) throw paymentError

                // Update customer total_paid
                const customer = customers.find(c => c.id === form.entity_id)
                if (customer) {
                    await supabase
                        .from('customers')
                        .update({ total_paid: (customer.total_paid || 0) + amount })
                        .eq('id', form.entity_id)
                }

                toast.success('Customer payment recorded')
            } else {
                // Record farmer payment
                const { error: paymentError } = await supabase
                    .from('farmer_payments')
                    .insert([{
                        farmer_id: form.entity_id,
                        season_id: currentSeason.id,
                        amount: amount,
                        payment_date: form.payment_date,
                        notes: form.notes
                    }])

                if (paymentError) throw paymentError

                // Update farmer total_paid
                const farmer = farmers.find(f => f.id === form.entity_id)
                if (farmer) {
                    await supabase
                        .from('farmers')
                        .update({ total_paid: (farmer.total_paid || 0) + amount })
                        .eq('id', form.entity_id)
                }

                toast.success('Farmer payment recorded')
            }

            closeModal()
            fetchData()
        } catch (error) {
            toast.error('Failed to save payment: ' + error.message)
        } finally {
            setFormLoading(false)
        }
    }

    const getEntityOutstanding = () => {
        if (form.type === 'customer') {
            const customer = customers.find(c => c.id === form.entity_id)
            if (customer) {
                return (customer.total_outstanding || 0) - (customer.total_paid || 0)
            }
        } else {
            const farmer = farmers.find(f => f.id === form.entity_id)
            if (farmer) {
                return (farmer.total_credit || 0) - (farmer.total_paid || 0)
            }
        }
        return 0
    }

    const openModal = (type) => {
        setForm({
            type,
            entity_id: '',
            amount: '',
            payment_date: getTodayDate(),
            payment_mode: 'cash',
            notes: ''
        })
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setForm({
            type: 'customer',
            entity_id: '',
            amount: '',
            payment_date: getTodayDate(),
            payment_mode: 'cash',
            notes: ''
        })
    }

    if (!currentSeason) {
        return (
            <div className="payments-page">
                <div className="page-header">
                    <h1 className="page-title">Payments</h1>
                </div>
                <div className="empty-state">
                    <p>Please create a season in Settings to record payments.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="payments-page">
            <div className="page-header">
                <h1 className="page-title">Payments</h1>
            </div>

            {/* Quick Actions */}
            <div className="payment-actions">
                <button className="action-card" onClick={() => openModal('customer')}>
                    <div className="action-icon received">
                        <ArrowDownCircle size={24} />
                    </div>
                    <div className="action-text">
                        <span className="action-title">Receive Payment</span>
                        <span className="action-desc">From credit customer</span>
                    </div>
                </button>
                <button className="action-card" onClick={() => openModal('farmer')}>
                    <div className="action-icon sent">
                        <ArrowUpCircle size={24} />
                    </div>
                    <div className="action-text">
                        <span className="action-title">Pay Farmer</span>
                        <span className="action-desc">Settle farmer dues</span>
                    </div>
                </button>
            </div>

            {/* Tabs */}
            <div className="payment-tabs">
                <button
                    className={`payment-tab ${activeTab === 'customer' ? 'active' : ''}`}
                    onClick={() => setActiveTab('customer')}
                >
                    <UserCheck size={18} />
                    Customer Payments
                </button>
                <button
                    className={`payment-tab ${activeTab === 'farmer' ? 'active' : ''}`}
                    onClick={() => setActiveTab('farmer')}
                >
                    <Users size={18} />
                    Farmer Payments
                </button>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            ) : activeTab === 'customer' ? (
                customerPayments.length === 0 ? (
                    <div className="empty-state">
                        <p>No customer payments recorded yet</p>
                    </div>
                ) : (
                    <div className="mobile-cards">
                        {customerPayments.map((payment) => (
                            <div key={payment.id} className="mobile-card payment-card">
                                <div className="mobile-card-header">
                                    <span className="mobile-card-title">{payment.customers?.name}</span>
                                    <span className="amount text-success">+{formatCurrency(payment.amount)}</span>
                                </div>
                                <div className="mobile-card-body">
                                    <div className="mobile-card-row">
                                        <span>Date</span>
                                        <span>{formatDate(payment.payment_date)}</span>
                                    </div>
                                    <div className="mobile-card-row">
                                        <span>Mode</span>
                                        <span>{payment.payment_mode === 'cash' ? 'Cash' : 'Online'}</span>
                                    </div>
                                    {payment.notes && (
                                        <div className="payment-notes">{payment.notes}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                farmerPayments.length === 0 ? (
                    <div className="empty-state">
                        <p>No farmer payments recorded yet</p>
                    </div>
                ) : (
                    <div className="mobile-cards">
                        {farmerPayments.map((payment) => (
                            <div key={payment.id} className="mobile-card payment-card">
                                <div className="mobile-card-header">
                                    <span className="mobile-card-title">{payment.farmers?.name}</span>
                                    <span className="amount text-danger">-{formatCurrency(payment.amount)}</span>
                                </div>
                                <div className="mobile-card-body">
                                    <div className="mobile-card-row">
                                        <span>Date</span>
                                        <span>{formatDate(payment.payment_date)}</span>
                                    </div>
                                    {payment.notes && (
                                        <div className="payment-notes">{payment.notes}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Payment Modal */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title={form.type === 'customer' ? 'Receive Customer Payment' : 'Pay Farmer'}
                footer={
                    <>
                        <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={formLoading}>
                            {formLoading ? 'Saving...' : 'Record Payment'}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>{form.type === 'customer' ? 'Customer' : 'Farmer'} *</label>
                        <select
                            value={form.entity_id}
                            onChange={(e) => setForm({ ...form, entity_id: e.target.value })}
                            required
                        >
                            <option value="">Select {form.type === 'customer' ? 'customer' : 'farmer'}</option>
                            {form.type === 'customer'
                                ? customers.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} (Due: {formatCurrency((c.total_outstanding || 0) - (c.total_paid || 0))})
                                    </option>
                                ))
                                : farmers.map(f => (
                                    <option key={f.id} value={f.id}>
                                        {f.name} (Due: {formatCurrency((f.total_credit || 0) - (f.total_paid || 0))})
                                    </option>
                                ))
                            }
                        </select>
                    </div>

                    {form.entity_id && (
                        <div className="outstanding-info">
                            Outstanding: <strong>{formatCurrency(getEntityOutstanding())}</strong>
                        </div>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label>Amount (₹) *</label>
                            <input
                                type="number"
                                placeholder="Enter amount"
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                min="1"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Date *</label>
                            <input
                                type="date"
                                value={form.payment_date}
                                onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    {form.type === 'customer' && (
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
                    )}

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

export default Payments
