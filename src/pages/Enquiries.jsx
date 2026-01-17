import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Plus,
    Search,
    Calendar,
    Phone,
    Edit2,
    Trash2,
    ShoppingCart,
    CheckCircle,
    XCircle,
    Clock,
    X,
    UserPlus,
    ClipboardList
} from 'lucide-react'
import { supabase } from '../services/supabase'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common'
import {
    formatCurrency,
    formatDate,
    getTodayDate,
    enquiryStatusLabels,
    enquiryTypeLabels
} from '../utils/helpers'
import './Enquiries.css'

function Enquiries() {
    const toast = useToast()
    const navigate = useNavigate()
    const [enquiries, setEnquiries] = useState([])
    const [customers, setCustomers] = useState([])
    const [packageSizes, setPackageSizes] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [showModal, setShowModal] = useState(false)
    const [editingEnquiry, setEditingEnquiry] = useState(null)
    const [formLoading, setFormLoading] = useState(false)

    // Customer autocomplete state
    const [customerSearch, setCustomerSearch] = useState('')
    const [showAutocomplete, setShowAutocomplete] = useState(false)
    const [isCreatingNew, setIsCreatingNew] = useState(false)
    const searchInputRef = useRef(null)

    const [form, setForm] = useState({
        customer_id: '',
        customer_name: '',
        customer_phone: '',
        required_date: getTodayDate(),
        enquiry_type: 'advance_order',
        package_size_id: '',
        quantity: 1,
        notes: ''
    })

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            setLoading(true)

            // Fetch enquiries with related data
            const { data: enquiriesData, error: enquiriesError } = await supabase
                .from('enquiries')
                .select(`
                    *,
                    customers (id, name, phone, type),
                    package_sizes (id, name, pieces_per_box)
                `)
                .order('required_date', { ascending: true })

            if (enquiriesError) throw enquiriesError
            setEnquiries(enquiriesData || [])

            // Fetch customers for autocomplete
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

        } catch (error) {
            toast.error('Failed to load enquiries')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSelectCustomer = (customer) => {
        setForm({
            ...form,
            customer_id: customer.id,
            customer_name: customer.name,
            customer_phone: customer.phone || ''
        })
        setCustomerSearch(customer.name)
        setShowAutocomplete(false)
        setIsCreatingNew(false)
    }

    const handleStartNewCustomer = () => {
        const newCustomerName = customerSearch.trim() || ''
        setForm({
            ...form,
            customer_id: '',
            customer_name: newCustomerName,
            customer_phone: ''
        })
        setIsCreatingNew(true)
        setShowAutocomplete(false)
    }

    const handleClearCustomer = () => {
        setForm({
            ...form,
            customer_id: '',
            customer_name: '',
            customer_phone: ''
        })
        setCustomerSearch('')
        setIsCreatingNew(false)
        setShowAutocomplete(false)
        searchInputRef.current?.focus()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Validate Indian phone number if provided (10 digits starting with 6,7,8,9)
        if (form.customer_phone) {
            const indianPhoneRegex = /^[6-9]\d{9}$/
            if (!indianPhoneRegex.test(form.customer_phone)) {
                toast.error('Please enter a valid 10-digit Indian phone number starting with 6, 7, 8, or 9')
                return
            }
        }

        setFormLoading(true)

        try {
            const enquiryData = {
                customer_id: form.customer_id || null,
                customer_name: form.customer_name || null,
                customer_phone: form.customer_phone || null,
                required_date: form.required_date,
                enquiry_type: form.enquiry_type,
                package_size_id: form.package_size_id || null,
                quantity: form.quantity ? parseInt(form.quantity) : null,
                notes: form.notes || null,
                status: editingEnquiry?.status || 'pending'
            }

            if (editingEnquiry) {
                const { error } = await supabase
                    .from('enquiries')
                    .update(enquiryData)
                    .eq('id', editingEnquiry.id)

                if (error) throw error
                toast.success('Enquiry updated successfully')
            } else {
                const { error } = await supabase
                    .from('enquiries')
                    .insert([{ ...enquiryData, enquiry_date: getTodayDate() }])

                if (error) throw error
                toast.success('Enquiry added successfully')
            }

            closeModal()
            fetchData()
        } catch (error) {
            toast.error('Failed to save enquiry: ' + error.message)
        } finally {
            setFormLoading(false)
        }
    }

    const handleDelete = async (enquiry) => {
        const customerDisplay = enquiry.customers?.name || enquiry.customer_name || 'Unknown'
        if (!confirm(`Delete enquiry from "${customerDisplay}"? This cannot be undone.`)) return

        try {
            const { error } = await supabase
                .from('enquiries')
                .delete()
                .eq('id', enquiry.id)

            if (error) throw error
            toast.success('Enquiry deleted')
            fetchData()
        } catch (error) {
            toast.error('Failed to delete enquiry: ' + error.message)
        }
    }

    const handleStatusChange = async (enquiry, newStatus) => {
        try {
            const { error } = await supabase
                .from('enquiries')
                .update({ status: newStatus })
                .eq('id', enquiry.id)

            if (error) throw error
            toast.success(`Status updated to ${enquiryStatusLabels[newStatus]}`)
            fetchData()
        } catch (error) {
            toast.error('Failed to update status: ' + error.message)
        }
    }

    const handleConvertToSale = (enquiry) => {
        // Navigate to sales page with enquiry data
        navigate(`/sales?enquiry_id=${enquiry.id}`)
    }

    const openEditModal = (enquiry) => {
        setEditingEnquiry(enquiry)
        setForm({
            customer_id: enquiry.customer_id || '',
            customer_name: enquiry.customers?.name || enquiry.customer_name || '',
            customer_phone: enquiry.customers?.phone || enquiry.customer_phone || '',
            required_date: enquiry.required_date,
            enquiry_type: enquiry.enquiry_type,
            package_size_id: enquiry.package_size_id || '',
            quantity: enquiry.quantity || 1,
            notes: enquiry.notes || ''
        })
        setCustomerSearch(enquiry.customers?.name || enquiry.customer_name || '')
        setShowModal(true)
    }

    const openNewModal = () => {
        setEditingEnquiry(null)
        setForm({
            customer_id: '',
            customer_name: '',
            customer_phone: '',
            required_date: getTodayDate(),
            enquiry_type: 'advance_order',
            package_size_id: '',
            quantity: 1,
            notes: ''
        })
        setCustomerSearch('')
        setIsCreatingNew(false)
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingEnquiry(null)
        setCustomerSearch('')
        setIsCreatingNew(false)
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'pending': return <Clock size={14} />
            case 'confirmed': return <CheckCircle size={14} />
            case 'fulfilled': return <ShoppingCart size={14} />
            case 'cancelled': return <XCircle size={14} />
            default: return null
        }
    }

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'pending': return 'badge-warning'
            case 'confirmed': return 'badge-info'
            case 'fulfilled': return 'badge-success'
            case 'cancelled': return 'badge-danger'
            default: return ''
        }
    }

    const filteredEnquiries = enquiries.filter(e => {
        const customerName = e.customers?.name || e.customer_name || ''
        const customerPhone = e.customers?.phone || e.customer_phone || ''
        const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customerPhone.includes(searchQuery)
        const matchesStatus = filterStatus === 'all' || e.status === filterStatus
        return matchesSearch && matchesStatus
    })

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.phone || '').includes(customerSearch)
    )

    return (
        <div className="enquiries-page">
            <div className="page-header">
                <h1 className="page-title">Enquiries</h1>
                <button className="btn btn-primary" onClick={openNewModal}>
                    <Plus size={18} /> Add Enquiry
                </button>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {[
                    { value: 'all', label: 'All' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'confirmed', label: 'Confirmed' },
                    { value: 'fulfilled', label: 'Fulfilled' },
                    { value: 'cancelled', label: 'Cancelled' }
                ].map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setFilterStatus(tab.value)}
                        style={{
                            padding: '0.625rem 1rem',
                            borderRadius: '0.5rem',
                            border: filterStatus === tab.value ? '1px solid #f97316' : '1px solid #e2e8f0',
                            background: filterStatus === tab.value ? '#f97316' : '#ffffff',
                            color: filterStatus === tab.value ? '#ffffff' : '#64748b',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="search-bar">
                <Search size={20} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search by customer name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Enquiries List */}
            {loading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            ) : filteredEnquiries.length === 0 ? (
                <div className="empty-state">
                    <ClipboardList size={48} className="empty-icon" />
                    <p>{searchQuery || filterStatus !== 'all' ? 'No enquiries found' : 'No enquiries added yet'}</p>
                    {!searchQuery && filterStatus === 'all' && (
                        <button className="btn btn-primary mt-2" onClick={openNewModal}>
                            Add Your First Enquiry
                        </button>
                    )}
                </div>
            ) : (
                <div className="mobile-cards">
                    {filteredEnquiries.map((enquiry) => {
                        const customerName = enquiry.customers?.name || enquiry.customer_name || 'Unknown'
                        const customerPhone = enquiry.customers?.phone || enquiry.customer_phone
                        const packageName = enquiry.package_sizes?.name

                        return (
                            <div key={enquiry.id} className="mobile-card enquiry-card">
                                <div className="mobile-card-header">
                                    <div className="enquiry-customer-info">
                                        <span className="mobile-card-title">{customerName}</span>
                                        <span className={`badge ${getStatusBadgeClass(enquiry.status)}`}>
                                            {getStatusIcon(enquiry.status)} {enquiryStatusLabels[enquiry.status]}
                                        </span>
                                    </div>
                                    <span className={`badge badge-outline ${enquiry.enquiry_type === 'advance_order' ? 'badge-primary' : 'badge-secondary'}`}>
                                        {enquiryTypeLabels[enquiry.enquiry_type]}
                                    </span>
                                </div>
                                <div className="mobile-card-body">
                                    <div className="enquiry-detail">
                                        <Calendar size={14} />
                                        <span>Required: <strong>{formatDate(enquiry.required_date)}</strong></span>
                                    </div>
                                    {customerPhone && (
                                        <div className="enquiry-detail">
                                            <Phone size={14} />
                                            <span>{customerPhone}</span>
                                        </div>
                                    )}
                                    {packageName && enquiry.quantity && (
                                        <div className="enquiry-detail">
                                            <ShoppingCart size={14} />
                                            <span>{enquiry.quantity} × {packageName}</span>
                                        </div>
                                    )}
                                    {enquiry.notes && (
                                        <div className="enquiry-notes">
                                            {enquiry.notes}
                                        </div>
                                    )}
                                </div>
                                <div className="mobile-card-actions">
                                    {enquiry.status !== 'fulfilled' && enquiry.status !== 'cancelled' && (
                                        <button
                                            className="btn btn-success btn-sm"
                                            onClick={() => handleConvertToSale(enquiry)}
                                        >
                                            <ShoppingCart size={14} /> Convert to Sale
                                        </button>
                                    )}
                                    {enquiry.status === 'pending' && (
                                        <button
                                            className="btn btn-outline btn-sm"
                                            onClick={() => handleStatusChange(enquiry, 'confirmed')}
                                        >
                                            <CheckCircle size={14} /> Confirm
                                        </button>
                                    )}
                                    <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(enquiry)}>
                                        <Edit2 size={14} />
                                    </button>
                                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(enquiry)}>
                                        <Trash2 size={14} />
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
                title={editingEnquiry ? 'Edit Enquiry' : 'Add New Enquiry'}
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
                    {/* Customer Search with Autocomplete */}
                    <div className="form-group">
                        <label>Customer</label>
                        <div className="customer-search-container">
                            <div className="search-bar compact">
                                <Search size={18} className="search-icon" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search or add new customer..."
                                    value={customerSearch}
                                    onChange={(e) => {
                                        setCustomerSearch(e.target.value)
                                        setShowAutocomplete(e.target.value.length > 0)
                                        if (form.customer_id) {
                                            setForm({ ...form, customer_id: '', customer_name: '' })
                                        }
                                        setIsCreatingNew(false)
                                    }}
                                    onFocus={() => setShowAutocomplete(customerSearch.length > 0)}
                                    disabled={!!form.customer_id}
                                />
                                {(customerSearch || form.customer_id) && (
                                    <button type="button" className="btn-clear-search" onClick={handleClearCustomer}>
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {showAutocomplete && customerSearch && !form.customer_id && (
                                <div className="autocomplete-dropdown">
                                    {filteredCustomers.length > 0 ? (
                                        <>
                                            {filteredCustomers.slice(0, 5).map(customer => (
                                                <div
                                                    key={customer.id}
                                                    className="autocomplete-item"
                                                    onClick={() => handleSelectCustomer(customer)}
                                                >
                                                    <span className="autocomplete-name">{customer.name}</span>
                                                    {customer.phone && (
                                                        <span className="autocomplete-phone">{customer.phone}</span>
                                                    )}
                                                </div>
                                            ))}
                                            <div className="autocomplete-divider"></div>
                                        </>
                                    ) : null}
                                    <div
                                        className="autocomplete-item autocomplete-new"
                                        onClick={handleStartNewCustomer}
                                    >
                                        <UserPlus size={16} />
                                        <span>Add "{customerSearch}" as new</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* New Customer Fields */}
                    {isCreatingNew && !form.customer_id && (
                        <div className="form-group">
                            <label>Phone Number</label>
                            <input
                                type="tel"
                                placeholder="Customer phone"
                                value={form.customer_phone}
                                onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                            />
                        </div>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label>Required Date *</label>
                            <input
                                type="date"
                                value={form.required_date}
                                onChange={(e) => setForm({ ...form, required_date: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Type</label>
                            <select
                                value={form.enquiry_type}
                                onChange={(e) => setForm({ ...form, enquiry_type: e.target.value })}
                            >
                                <option value="advance_order">Advance Order</option>
                                <option value="availability">Availability Check</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Package Size</label>
                            <select
                                value={form.package_size_id}
                                onChange={(e) => setForm({ ...form, package_size_id: e.target.value })}
                            >
                                <option value="">Select Package</option>
                                {packageSizes.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Quantity</label>
                            <input
                                type="number"
                                min="1"
                                value={form.quantity}
                                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Notes</label>
                        <textarea
                            placeholder="Any additional notes..."
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            rows={2}
                        />
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default Enquiries
