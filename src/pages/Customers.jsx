import { useState, useEffect } from 'react'
import { Plus, Search, Phone, MapPin, CreditCard, UserCheck, Truck, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../services/supabase'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common'
import { formatCurrency, customerTypeLabels } from '../utils/helpers'
import './Customers.css'

function Customers() {
    const toast = useToast()
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState('all')
    const [showModal, setShowModal] = useState(false)
    const [editingCustomer, setEditingCustomer] = useState(null)
    const [form, setForm] = useState({
        name: '',
        phone: '',
        address: '',
        type: 'walk-in'
    })
    const [formLoading, setFormLoading] = useState(false)

    useEffect(() => {
        fetchCustomers()
    }, [])

    const fetchCustomers = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name', { ascending: true })

            if (error) throw error
            setCustomers(data || [])
        } catch (error) {
            toast.error('Failed to load customers')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setFormLoading(true)

        try {
            if (editingCustomer) {
                const { error } = await supabase
                    .from('customers')
                    .update({
                        name: form.name || 'Walk-in Customer',
                        phone: form.phone,
                        address: form.address,
                        type: form.type
                    })
                    .eq('id', editingCustomer.id)

                if (error) throw error
                toast.success('Customer updated successfully')
            } else {
                const { error } = await supabase
                    .from('customers')
                    .insert([{
                        name: form.name || 'Walk-in Customer',
                        phone: form.phone,
                        address: form.address,
                        type: form.type,
                        total_outstanding: 0,
                        total_paid: 0
                    }])

                if (error) throw error
                toast.success('Customer added successfully')
            }

            closeModal()
            fetchCustomers()
        } catch (error) {
            toast.error('Failed to save customer: ' + error.message)
        } finally {
            setFormLoading(false)
        }
    }

    const handleDelete = async (customer) => {
        if (!confirm(`Delete customer "${customer.name}"? This cannot be undone.`)) return

        try {
            const { error } = await supabase
                .from('customers')
                .delete()
                .eq('id', customer.id)

            if (error) throw error
            toast.success('Customer deleted')
            fetchCustomers()
        } catch (error) {
            toast.error('Failed to delete customer: ' + error.message)
        }
    }

    const openEditModal = (customer) => {
        setEditingCustomer(customer)
        setForm({
            name: customer.name,
            phone: customer.phone || '',
            address: customer.address || '',
            type: customer.type
        })
        setShowModal(true)
    }

    const openNewModal = () => {
        setEditingCustomer(null)
        setForm({ name: '', phone: '', address: '', type: 'walk-in' })
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingCustomer(null)
        setForm({ name: '', phone: '', address: '', type: 'walk-in' })
    }

    const getTypeIcon = (type) => {
        switch (type) {
            case 'walk-in': return <UserCheck size={14} />
            case 'delivery': return <Truck size={14} />
            case 'credit': return <CreditCard size={14} />
            default: return null
        }
    }

    const getTypeBadgeClass = (type) => {
        switch (type) {
            case 'walk-in': return 'badge-info'
            case 'delivery': return 'badge-warning'
            case 'credit': return 'badge-danger'
            default: return ''
        }
    }

    const filteredCustomers = customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.phone && c.phone.includes(searchQuery))
        const matchesType = filterType === 'all' || c.type === filterType
        return matchesSearch && matchesType
    })

    return (
        <div className="customers-page">
            <div className="page-header">
                <h1 className="page-title">Customers</h1>
                <button className="btn btn-primary" onClick={openNewModal}>
                    <Plus size={18} /> Add Customer
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="filter-tabs">
                <button
                    className={`filter-tab ${filterType === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterType('all')}
                >
                    All
                </button>
                <button
                    className={`filter-tab ${filterType === 'walk-in' ? 'active' : ''}`}
                    onClick={() => setFilterType('walk-in')}
                >
                    Walk-in
                </button>
                <button
                    className={`filter-tab ${filterType === 'delivery' ? 'active' : ''}`}
                    onClick={() => setFilterType('delivery')}
                >
                    Delivery
                </button>
                <button
                    className={`filter-tab ${filterType === 'credit' ? 'active' : ''}`}
                    onClick={() => setFilterType('credit')}
                >
                    Credit
                </button>
            </div>

            {/* Search */}
            <div className="search-bar">
                <Search size={20} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Customers List */}
            {loading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            ) : filteredCustomers.length === 0 ? (
                <div className="empty-state">
                    <p>{searchQuery || filterType !== 'all' ? 'No customers found' : 'No customers added yet'}</p>
                    {!searchQuery && filterType === 'all' && (
                        <button className="btn btn-primary mt-2" onClick={openNewModal}>
                            Add Your First Customer
                        </button>
                    )}
                </div>
            ) : (
                <div className="mobile-cards">
                    {filteredCustomers.map((customer) => {
                        const outstanding = (customer.total_outstanding || 0) - (customer.total_paid || 0)
                        return (
                            <div key={customer.id} className="mobile-card customer-card">
                                <div className="mobile-card-header">
                                    <div>
                                        <span className="mobile-card-title">{customer.name}</span>
                                        <span className={`badge ${getTypeBadgeClass(customer.type)}`}>
                                            {getTypeIcon(customer.type)} {customerTypeLabels[customer.type]}
                                        </span>
                                    </div>
                                    {customer.type === 'credit' && (
                                        <span className={`amount ${outstanding > 0 ? 'text-danger' : 'text-success'}`}>
                                            {formatCurrency(outstanding)}
                                        </span>
                                    )}
                                </div>
                                <div className="mobile-card-body">
                                    {customer.phone && (
                                        <div className="customer-detail">
                                            <Phone size={14} />
                                            <span>{customer.phone}</span>
                                        </div>
                                    )}
                                    {customer.address && (
                                        <div className="customer-detail">
                                            <MapPin size={14} />
                                            <span>{customer.address}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="mobile-card-actions">
                                    <button className="btn btn-outline btn-sm" onClick={() => openEditModal(customer)}>
                                        <Edit2 size={14} /> Edit
                                    </button>
                                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(customer)}>
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                footer={
                    <>
                        <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={formLoading}>
                            {formLoading ? 'Saving...' : 'Save'}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Customer Type *</label>
                        <select
                            value={form.type}
                            onChange={(e) => setForm({ ...form, type: e.target.value })}
                            required
                        >
                            <option value="walk-in">Walk-in</option>
                            <option value="delivery">Delivery</option>
                            <option value="credit">Credit</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Customer Name {form.type !== 'walk-in' && '*'}</label>
                        <input
                            type="text"
                            placeholder={form.type === 'walk-in' ? 'Optional for walk-in' : 'Enter customer name'}
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required={form.type !== 'walk-in'}
                        />
                    </div>
                    <div className="form-group">
                        <label>Phone Number</label>
                        <input
                            type="tel"
                            placeholder="Enter phone number"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                    </div>
                    {(form.type === 'delivery' || form.type === 'credit') && (
                        <div className="form-group">
                            <label>Address</label>
                            <textarea
                                placeholder="Enter delivery address"
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                rows={3}
                            />
                        </div>
                    )}
                </form>
            </Modal>
        </div>
    )
}

export default Customers
