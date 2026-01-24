import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import { useSeason } from '../context/SeasonContext'
import { supabase } from '../services/supabase'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common'
import { formatCurrency, formatDate, getTodayDate, formatDateForInput, calculateSuggestedPrice } from '../utils/helpers'
import './Purchases.css'

function Purchases() {
    const { currentSeason } = useSeason()
    const toast = useToast()
    const [purchases, setPurchases] = useState([])
    const [farmers, setFarmers] = useState([])
    const [packageSizes, setPackageSizes] = useState([])
    const [marginPerDozen, setMarginPerDozen] = useState(300) // Default
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [editingPurchase, setEditingPurchase] = useState(null)

    const [form, setForm] = useState({
        farmer_id: '',
        purchase_date: getTodayDate(),
        notes: '',
        items: [{ package_size_id: '', quantity: 1, rate_per_unit: '' }]
    })

    useEffect(() => {
        fetchData()
    }, [currentSeason])

    const fetchData = async () => {
        try {
            setLoading(true)

            // Fetch farmers
            const { data: farmersData } = await supabase
                .from('farmers')
                .select('*')
                .order('name')
            setFarmers(farmersData || [])

            // Fetch package sizes
            const { data: packageData } = await supabase
                .from('package_sizes')
                .select('*')
                .eq('is_active', true)
                .order('pieces_per_box')
            setPackageSizes(packageData || [])

            // Fetch margin setting
            const { data: marginSetting } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'margin_per_dozen')
                .single()

            if (marginSetting?.value) {
                setMarginPerDozen(parseInt(marginSetting.value))
            }

            // Fetch purchases
            if (currentSeason) {
                const { data: purchasesData } = await supabase
                    .from('purchases')
                    .select(`
            *,
            farmers (name),
            purchase_items (
              *,
              package_sizes (name, pieces_per_box)
            )
          `)
                    .eq('season_id', currentSeason.id)
                    .order('purchase_date', { ascending: false })
                setPurchases(purchasesData || [])
            }
        } catch (error) {
            toast.error('Failed to load data')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddItem = () => {
        setForm({
            ...form,
            items: [...form.items, { package_size_id: '', quantity: 1, rate_per_unit: '' }]
        })
    }

    const handleRemoveItem = (index) => {
        if (form.items.length === 1) return
        setForm({
            ...form,
            items: form.items.filter((_, i) => i !== index)
        })
    }

    const handleItemChange = (index, field, value) => {
        const newItems = [...form.items]
        newItems[index] = { ...newItems[index], [field]: value }
        setForm({ ...form, items: newItems })
    }

    const calculateTotal = () => {
        return form.items.reduce((sum, item) => {
            const qty = parseFloat(item.quantity) || 0
            const rate = parseFloat(item.rate_per_unit) || 0
            return sum + (qty * rate)
        }, 0)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!currentSeason) {
            toast.error('Please create a season first')
            return
        }

        setFormLoading(true)

        try {
            const totalAmount = calculateTotal()

            if (editingPurchase) {
                // Update existing purchase
                const oldTotal = editingPurchase.total_amount || 0
                const difference = totalAmount - oldTotal

                const { error: purchaseError } = await supabase
                    .from('purchases')
                    .update({
                        farmer_id: form.farmer_id,
                        purchase_date: form.purchase_date,
                        total_amount: totalAmount,
                        notes: form.notes
                    })
                    .eq('id', editingPurchase.id)

                if (purchaseError) throw purchaseError

                // Delete old items
                await supabase
                    .from('purchase_items')
                    .delete()
                    .eq('purchase_id', editingPurchase.id)

                // Insert new items
                const items = form.items.map(item => ({
                    purchase_id: editingPurchase.id,
                    package_size_id: item.package_size_id,
                    quantity: parseInt(item.quantity),
                    rate_per_unit: parseFloat(item.rate_per_unit),
                    total: parseInt(item.quantity) * parseFloat(item.rate_per_unit)
                }))

                await supabase.from('purchase_items').insert(items)

                // Update farmer credit if farmer changed or amount changed
                if (editingPurchase.farmer_id !== form.farmer_id) {
                    // Subtract from old farmer
                    const oldFarmer = farmers.find(f => f.id === editingPurchase.farmer_id)
                    if (oldFarmer) {
                        await supabase
                            .from('farmers')
                            .update({ total_credit: Math.max(0, (oldFarmer.total_credit || 0) - oldTotal) })
                            .eq('id', editingPurchase.farmer_id)
                    }
                    // Add to new farmer
                    const newFarmer = farmers.find(f => f.id === form.farmer_id)
                    if (newFarmer) {
                        await supabase
                            .from('farmers')
                            .update({ total_credit: (newFarmer.total_credit || 0) + totalAmount })
                            .eq('id', form.farmer_id)
                    }
                } else if (difference !== 0) {
                    // Same farmer, update credit difference
                    const farmer = farmers.find(f => f.id === form.farmer_id)
                    if (farmer) {
                        await supabase
                            .from('farmers')
                            .update({ total_credit: Math.max(0, (farmer.total_credit || 0) + difference) })
                            .eq('id', form.farmer_id)
                    }
                }

                toast.success('Purchase updated successfully')
            } else {
                // Create new purchase
                const { data: purchase, error: purchaseError } = await supabase
                    .from('purchases')
                    .insert([{
                        season_id: currentSeason.id,
                        farmer_id: form.farmer_id,
                        purchase_date: form.purchase_date,
                        total_amount: totalAmount,
                        notes: form.notes
                    }])
                    .select()
                    .single()

                if (purchaseError) throw purchaseError

                // Create purchase items
                const items = form.items.map(item => ({
                    purchase_id: purchase.id,
                    package_size_id: item.package_size_id,
                    quantity: parseInt(item.quantity),
                    rate_per_unit: parseFloat(item.rate_per_unit),
                    total: parseInt(item.quantity) * parseFloat(item.rate_per_unit)
                }))

                const { error: itemsError } = await supabase
                    .from('purchase_items')
                    .insert(items)

                if (itemsError) throw itemsError

                // Update farmer's total credit
                const farmer = farmers.find(f => f.id === form.farmer_id)
                if (farmer) {
                    await supabase
                        .from('farmers')
                        .update({ total_credit: (farmer.total_credit || 0) + totalAmount })
                        .eq('id', form.farmer_id)
                }

                toast.success('Purchase recorded successfully')
            }

            closeModal()
            fetchData()
        } catch (error) {
            toast.error('Failed to save purchase: ' + error.message)
        } finally {
            setFormLoading(false)
        }
    }

    const handleDelete = async (purchase) => {
        if (!confirm(`Delete this purchase from ${purchase.farmers?.name}?\n\nThis will also reduce their outstanding credit.`)) return

        try {
            // Delete purchase (cascade will delete items)
            const { error } = await supabase
                .from('purchases')
                .delete()
                .eq('id', purchase.id)

            if (error) throw error

            // Update farmer's credit
            const farmer = farmers.find(f => f.id === purchase.farmer_id)
            if (farmer) {
                await supabase
                    .from('farmers')
                    .update({ total_credit: Math.max(0, (farmer.total_credit || 0) - (purchase.total_amount || 0)) })
                    .eq('id', purchase.farmer_id)
            }

            toast.success('Purchase deleted')
            fetchData()
        } catch (error) {
            toast.error('Failed to delete purchase: ' + error.message)
        }
    }

    const openEditModal = (purchase) => {
        setEditingPurchase(purchase)
        setForm({
            farmer_id: purchase.farmer_id,
            purchase_date: formatDateForInput(purchase.purchase_date),
            notes: purchase.notes || '',
            items: purchase.purchase_items?.map(item => ({
                package_size_id: item.package_size_id,
                quantity: item.quantity,
                rate_per_unit: item.rate_per_unit
            })) || [{ package_size_id: '', quantity: 1, rate_per_unit: '' }]
        })
        setShowModal(true)
    }

    const openNewModal = () => {
        setEditingPurchase(null)
        setForm({
            farmer_id: '',
            purchase_date: getTodayDate(),
            notes: '',
            items: [{ package_size_id: '', quantity: 1, rate_per_unit: '' }]
        })
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingPurchase(null)
        setForm({
            farmer_id: '',
            purchase_date: getTodayDate(),
            notes: '',
            items: [{ package_size_id: '', quantity: 1, rate_per_unit: '' }]
        })
    }

    const getSuggestedPrice = (item) => {
        const pkg = packageSizes.find(p => p.id === item.package_size_id)
        if (!pkg || !item.rate_per_unit) return null
        return calculateSuggestedPrice(parseFloat(item.rate_per_unit), pkg.pieces_per_box, marginPerDozen)
    }

    if (!currentSeason) {
        return (
            <div className="purchases-page">
                <div className="page-header">
                    <h1 className="page-title">Purchases</h1>
                </div>
                <div className="empty-state">
                    <p>Please create a season in Settings to start recording purchases.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="purchases-page">
            <div className="page-header">
                <h1 className="page-title">Purchases</h1>
                <button className="btn btn-primary" onClick={openNewModal}>
                    <Plus size={18} /> New Purchase
                </button>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            ) : purchases.length === 0 ? (
                <div className="empty-state">
                    <p>No purchases recorded yet</p>
                    <button className="btn btn-primary mt-2" onClick={openNewModal}>
                        Record First Purchase
                    </button>
                </div>
            ) : (
                <div className="mobile-cards">
                    {purchases.map((purchase) => (
                        <div key={purchase.id} className="mobile-card purchase-card">
                            <div className="mobile-card-header">
                                <div>
                                    <span className="mobile-card-title">{purchase.farmers?.name}</span>
                                    <span className="text-muted"> • {formatDate(purchase.purchase_date)}</span>
                                </div>
                                <span className="amount">{formatCurrency(purchase.total_amount)}</span>
                            </div>
                            <div className="purchase-items">
                                {purchase.purchase_items?.map((item, idx) => (
                                    <div key={idx} className="purchase-item-row">
                                        <span>{item.package_sizes?.name} × {item.quantity}</span>
                                        <span>@ {formatCurrency(item.rate_per_unit)}</span>
                                    </div>
                                ))}
                            </div>
                            {purchase.notes && (
                                <div className="purchase-notes">{purchase.notes}</div>
                            )}
                            <div className="mobile-card-actions">
                                <button className="btn btn-outline btn-sm" onClick={() => openEditModal(purchase)}>
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(purchase)}>
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* New/Edit Purchase Modal */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title={editingPurchase ? 'Edit Purchase' : 'New Purchase'}
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
                    <div className="form-row">
                        <div className="form-group">
                            <label>Farmer *</label>
                            <select
                                value={form.farmer_id}
                                onChange={(e) => setForm({ ...form, farmer_id: e.target.value })}
                                required
                            >
                                <option value="">Select farmer</option>
                                {farmers.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Date *</label>
                            <input
                                type="date"
                                value={form.purchase_date}
                                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="items-section">
                        <label>Items</label>
                        {form.items.map((item, index) => {
                            const suggestedPrice = getSuggestedPrice(item)
                            return (
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
                                        placeholder="Rate"
                                        value={item.rate_per_unit}
                                        onChange={(e) => handleItemChange(index, 'rate_per_unit', e.target.value)}
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
                                    {suggestedPrice && (
                                        <div className="suggested-price">
                                            Sell @ {formatCurrency(suggestedPrice)}/dz
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        <button type="button" className="btn btn-outline btn-sm" onClick={handleAddItem}>
                            <Plus size={14} /> Add Item
                        </button>
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

export default Purchases
