import { useState, useEffect } from 'react'
import { Plus, Search, Phone, MapPin, Wallet, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../services/supabase'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common'
import { formatCurrency, isValidIndianPhone } from '../utils/helpers'
import './Farmers.css'

function Farmers() {
    const toast = useToast()
    const [farmers, setFarmers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editingFarmer, setEditingFarmer] = useState(null)
    const [form, setForm] = useState({
        name: '',
        phone: '',
        village: ''
    })
    const [phoneError, setPhoneError] = useState('')
    const [formLoading, setFormLoading] = useState(false)

    useEffect(() => {
        fetchFarmers()
    }, [])

    const fetchFarmers = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('farmers')
                .select('*')
                .order('name', { ascending: true })

            if (error) throw error
            setFarmers(data || [])
        } catch (error) {
            toast.error('Failed to load farmers')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Validate phone if present
        if (form.phone && !isValidIndianPhone(form.phone)) {
            setPhoneError('Must be 10 digits starting with 6-9')
            return
        }

        setFormLoading(true)

        try {
            if (editingFarmer) {
                const { error } = await supabase
                    .from('farmers')
                    .update({
                        name: form.name,
                        phone: form.phone,
                        village: form.village
                    })
                    .eq('id', editingFarmer.id)

                if (error) throw error
                toast.success('Farmer updated successfully')
            } else {
                const { error } = await supabase
                    .from('farmers')
                    .insert([{
                        name: form.name,
                        phone: form.phone,
                        village: form.village,
                        total_credit: 0,
                        total_paid: 0
                    }])

                if (error) throw error
                toast.success('Farmer added successfully')
            }

            closeModal()
            fetchFarmers()
        } catch (error) {
            toast.error('Failed to save farmer: ' + error.message)
        } finally {
            setFormLoading(false)
        }
    }

    const handleDelete = async (farmer) => {
        if (!confirm(`Delete farmer "${farmer.name}"? This cannot be undone.`)) return

        try {
            const { error } = await supabase
                .from('farmers')
                .delete()
                .eq('id', farmer.id)

            if (error) throw error
            toast.success('Farmer deleted')
            fetchFarmers()
        } catch (error) {
            toast.error('Failed to delete farmer: ' + error.message)
        }
    }

    const openEditModal = (farmer) => {
        setEditingFarmer(farmer)
        setForm({
            name: farmer.name,
            phone: farmer.phone || '',
            village: farmer.village || ''
        })
        setPhoneError('')
        setShowModal(true)
    }

    const openNewModal = () => {
        setEditingFarmer(null)
        setForm({ name: '', phone: '', village: '' })
        setPhoneError('')
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingFarmer(null)
        setForm({ name: '', phone: '', village: '' })
        setPhoneError('')
    }

    const filteredFarmers = farmers.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.phone && f.phone.includes(searchQuery)) ||
        (f.village && f.village.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    return (
        <div className="farmers-page">
            <div className="page-header">
                <h1 className="page-title">Farmers</h1>
                <button className="btn btn-primary" onClick={openNewModal}>
                    <Plus size={18} /> Add Farmer
                </button>
            </div>

            {/* Search */}
            <div className="search-bar">
                <Search size={20} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search by name, phone, or village..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Farmers List */}
            {loading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            ) : filteredFarmers.length === 0 ? (
                <div className="empty-state">
                    <p>{searchQuery ? 'No farmers found matching your search' : 'No farmers added yet'}</p>
                    {!searchQuery && (
                        <button className="btn btn-primary mt-2" onClick={openNewModal}>
                            Add Your First Farmer
                        </button>
                    )}
                </div>
            ) : (
                <div className="mobile-cards">
                    {filteredFarmers.map((farmer) => {
                        const outstanding = (farmer.total_credit || 0) - (farmer.total_paid || 0)
                        return (
                            <div key={farmer.id} className="mobile-card farmer-card">
                                <div className="mobile-card-header">
                                    <span className="mobile-card-title">{farmer.name}</span>
                                    <span className={`amount ${outstanding > 0 ? 'text-danger' : 'text-success'}`}>
                                        {formatCurrency(outstanding)}
                                    </span>
                                </div>
                                <div className="mobile-card-body">
                                    {farmer.phone && (
                                        <div className="farmer-detail">
                                            <Phone size={14} />
                                            <span>{farmer.phone}</span>
                                        </div>
                                    )}
                                    {farmer.village && (
                                        <div className="farmer-detail">
                                            <MapPin size={14} />
                                            <span>{farmer.village}</span>
                                        </div>
                                    )}
                                    <div className="farmer-detail">
                                        <Wallet size={14} />
                                        <span>Total Credit: {formatCurrency(farmer.total_credit || 0)}</span>
                                    </div>
                                </div>
                                <div className="mobile-card-actions">
                                    <button className="btn btn-outline btn-sm" onClick={() => openEditModal(farmer)}>
                                        <Edit2 size={14} /> Edit
                                    </button>
                                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(farmer)}>
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
                title={editingFarmer ? 'Edit Farmer' : 'Add New Farmer'}
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
                        <label>Farmer Name *</label>
                        <input
                            type="text"
                            placeholder="Enter farmer name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Phone Number</label>
                        <input
                            type="tel"
                            placeholder="Enter phone number"
                            value={form.phone}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                                setForm({ ...form, phone: val })
                                if (val && !isValidIndianPhone(val)) {
                                    setPhoneError('Must be 10 digits starting with 6-9')
                                } else {
                                    setPhoneError('')
                                }
                            }}
                            maxLength="10"
                        />
                        {phoneError && <span className="text-danger small">{phoneError}</span>}
                    </div>
                    <div className="form-group">
                        <label>Village</label>
                        <input
                            type="text"
                            placeholder="Enter village name"
                            value={form.village}
                            onChange={(e) => setForm({ ...form, village: e.target.value })}
                        />
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default Farmers
