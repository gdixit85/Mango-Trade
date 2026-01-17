import { useState, useEffect } from 'react'
import { Calendar, Package, Save, Plus, Edit2, Trash2, DollarSign, TrendingUp, Wallet } from 'lucide-react'
import { useSeason } from '../context/SeasonContext'
import { supabase } from '../services/supabase'
import { useToast } from '../components/common/Toast'
import { formatCurrency, formatDateForInput, getTodayDate, calculateSuggestedPrice } from '../utils/helpers'
import { Modal } from '../components/common'
import './Settings.css'

function Settings() {
    const { currentSeason, createSeason, updateSeason, endSeason, refreshSeason } = useSeason()
    const toast = useToast()

    // Season form state
    const [seasonForm, setSeasonForm] = useState({
        name: '',
        start_date: getTodayDate(),
        end_date: '',
        rent_amount: '',
        rent_paid: 0
    })
    const [showSeasonForm, setShowSeasonForm] = useState(false)
    const [seasonLoading, setSeaseonLoading] = useState(false)

    // Package sizes state
    const [packageSizes, setPackageSizes] = useState([])
    const [packagePricing, setPackagePricing] = useState({})
    const [showPackageModal, setShowPackageModal] = useState(false)
    const [editingPackage, setEditingPackage] = useState(null)
    const [packageForm, setPackageForm] = useState({
        name: '',
        pieces_per_box: 12,
        transport_cost: 0
    })
    const [packageLoading, setPackageLoading] = useState(false)

    // Margin setting
    const [margin, setMargin] = useState(300)
    const [marginLoading, setMarginLoading] = useState(false)

    // Expense heads state
    const [expenseHeads, setExpenseHeads] = useState([])
    const [showExpenseHeadModal, setShowExpenseHeadModal] = useState(false)
    const [editingExpenseHead, setEditingExpenseHead] = useState(null)
    const [expenseHeadForm, setExpenseHeadForm] = useState({
        name: '',
        description: ''
    })
    const [expenseHeadLoading, setExpenseHeadLoading] = useState(false)

    useEffect(() => {
        if (currentSeason) {
            setSeasonForm({
                name: currentSeason.name || '',
                start_date: formatDateForInput(currentSeason.start_date),
                end_date: formatDateForInput(currentSeason.end_date),
                rent_amount: currentSeason.rent_amount || '',
                rent_paid: currentSeason.rent_paid || 0
            })
        }
        fetchPackageSizes()
        fetchMarginSetting()
        fetchExpenseHeads()
    }, [currentSeason])

    useEffect(() => {
        if (packageSizes.length > 0 && currentSeason) {
            fetchLatestPricing()
        }
    }, [packageSizes, currentSeason])

    const fetchPackageSizes = async () => {
        try {
            const { data, error } = await supabase
                .from('package_sizes')
                .select('*')
                .eq('is_active', true)
                .order('pieces_per_box', { ascending: true })

            if (error) throw error
            setPackageSizes(data || [])
        } catch (error) {
            console.error('Error fetching package sizes:', error)
        }
    }

    const fetchMarginSetting = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'margin_per_dozen')
                .single()

            if (error) throw error
            if (data) {
                setMargin(parseInt(data.value) || 300)
            }
        } catch (error) {
            console.error('Error fetching margin setting:', error)
        }
    }

    const saveMarginSetting = async (newMargin) => {
        setMarginLoading(true)
        try {
            const { error } = await supabase
                .from('app_settings')
                .update({ value: newMargin.toString() })
                .eq('key', 'margin_per_dozen')

            if (error) throw error
            toast.success('Margin setting saved')
        } catch (error) {
            toast.error('Failed to save margin: ' + error.message)
        } finally {
            setMarginLoading(false)
        }
    }

    const fetchLatestPricing = async () => {
        if (!currentSeason) return

        try {
            // Get the latest purchase rate for each package size
            const { data: purchaseItems, error } = await supabase
                .from('purchase_items')
                .select(`
          package_size_id,
          rate_per_unit,
          created_at,
          purchases!inner (season_id, purchase_date)
        `)
                .eq('purchases.season_id', currentSeason.id)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Build pricing map with latest rate per package
            const pricing = {}
            purchaseItems?.forEach(item => {
                if (!pricing[item.package_size_id]) {
                    pricing[item.package_size_id] = {
                        buyingRate: item.rate_per_unit,
                        lastPurchaseDate: item.purchases?.purchase_date
                    }
                }
            })

            setPackagePricing(pricing)
        } catch (error) {
            console.error('Error fetching pricing:', error)
        }
    }

    const handleSeasonSubmit = async (e) => {
        e.preventDefault()
        setSeaseonLoading(true)

        try {
            if (currentSeason) {
                await updateSeason(currentSeason.id, {
                    name: seasonForm.name,
                    start_date: seasonForm.start_date,
                    end_date: seasonForm.end_date,
                    rent_amount: parseFloat(seasonForm.rent_amount) || 0,
                    rent_paid: parseFloat(seasonForm.rent_paid) || 0
                })
                toast.success('Season updated successfully')
            } else {
                await createSeason({
                    name: seasonForm.name,
                    start_date: seasonForm.start_date,
                    end_date: seasonForm.end_date,
                    rent_amount: parseFloat(seasonForm.rent_amount) || 0,
                    rent_paid: 0
                })
                toast.success('Season created successfully')
            }
            setShowSeasonForm(false)
        } catch (error) {
            toast.error('Failed to save season: ' + error.message)
        } finally {
            setSeaseonLoading(false)
        }
    }

    const handleEndSeason = async () => {
        if (!confirm('Are you sure you want to end this season? This cannot be undone.')) return

        try {
            await endSeason()
            toast.success('Season ended successfully')
            setSeasonForm({
                name: '',
                start_date: getTodayDate(),
                end_date: '',
                rent_amount: '',
                rent_paid: 0
            })
        } catch (error) {
            toast.error('Failed to end season: ' + error.message)
        }
    }

    const handlePackageSubmit = async (e) => {
        e.preventDefault()
        setPackageLoading(true)

        try {
            if (editingPackage) {
                const { error } = await supabase
                    .from('package_sizes')
                    .update({
                        name: packageForm.name,
                        pieces_per_box: parseInt(packageForm.pieces_per_box),
                        transport_cost: parseFloat(packageForm.transport_cost) || 0
                    })
                    .eq('id', editingPackage.id)

                if (error) throw error
                toast.success('Package size updated')
            } else {
                const { error } = await supabase
                    .from('package_sizes')
                    .insert([{
                        name: packageForm.name,
                        pieces_per_box: parseInt(packageForm.pieces_per_box),
                        transport_cost: parseFloat(packageForm.transport_cost) || 0,
                        is_active: true
                    }])

                if (error) throw error
                toast.success('Package size added')
            }

            setShowPackageModal(false)
            setEditingPackage(null)
            setPackageForm({ name: '', pieces_per_box: 12, transport_cost: 0 })
            fetchPackageSizes()
        } catch (error) {
            toast.error('Failed to save package: ' + error.message)
        } finally {
            setPackageLoading(false)
        }
    }

    const handleDeletePackage = async (pkg) => {
        if (!confirm(`Delete "${pkg.name}"?`)) return

        try {
            const { error } = await supabase
                .from('package_sizes')
                .update({ is_active: false })
                .eq('id', pkg.id)

            if (error) throw error
            toast.success('Package size deleted')
            fetchPackageSizes()
        } catch (error) {
            toast.error('Failed to delete package: ' + error.message)
        }
    }

    const openEditPackage = (pkg) => {
        setEditingPackage(pkg)
        setPackageForm({
            name: pkg.name,
            pieces_per_box: pkg.pieces_per_box,
            transport_cost: pkg.transport_cost || 0
        })
        setShowPackageModal(true)
    }

    const openNewPackage = () => {
        setEditingPackage(null)
        setPackageForm({ name: '', pieces_per_box: 12, transport_cost: 0 })
        setShowPackageModal(true)
    }

    const getSuggestedSellingPrice = (pkg) => {
        const pricing = packagePricing[pkg.id]
        if (!pricing) return null
        return calculateSuggestedPrice(pricing.buyingRate, pkg.pieces_per_box, margin)
    }

    // Expense Head functions
    const fetchExpenseHeads = async () => {
        try {
            const { data, error } = await supabase
                .from('expense_heads')
                .select('*')
                .eq('is_active', true)
                .order('is_system', { ascending: false })
                .order('name')

            if (error) throw error
            setExpenseHeads(data || [])
        } catch (error) {
            console.error('Error fetching expense heads:', error)
        }
    }

    const handleExpenseHeadSubmit = async (e) => {
        e.preventDefault()
        setExpenseHeadLoading(true)

        try {
            if (editingExpenseHead) {
                const { error } = await supabase
                    .from('expense_heads')
                    .update({
                        name: expenseHeadForm.name,
                        description: expenseHeadForm.description
                    })
                    .eq('id', editingExpenseHead.id)

                if (error) throw error
                toast.success('Expense head updated')
            } else {
                const { error } = await supabase
                    .from('expense_heads')
                    .insert([{
                        name: expenseHeadForm.name,
                        description: expenseHeadForm.description,
                        is_system: false,
                        is_active: true
                    }])

                if (error) throw error
                toast.success('Expense head added')
            }

            setShowExpenseHeadModal(false)
            setEditingExpenseHead(null)
            setExpenseHeadForm({ name: '', description: '' })
            fetchExpenseHeads()
        } catch (error) {
            toast.error('Failed to save expense head: ' + error.message)
        } finally {
            setExpenseHeadLoading(false)
        }
    }

    const handleDeleteExpenseHead = async (head) => {
        if (head.is_system) {
            toast.error('Cannot delete system expense heads')
            return
        }
        if (!confirm(`Delete "${head.name}"? Expenses using this head will still be visible but you won't be able to create new ones.`)) return

        try {
            const { error } = await supabase
                .from('expense_heads')
                .update({ is_active: false })
                .eq('id', head.id)

            if (error) throw error
            toast.success('Expense head deleted')
            fetchExpenseHeads()
        } catch (error) {
            toast.error('Failed to delete expense head: ' + error.message)
        }
    }

    const openEditExpenseHead = (head) => {
        setEditingExpenseHead(head)
        setExpenseHeadForm({
            name: head.name,
            description: head.description || ''
        })
        setShowExpenseHeadModal(true)
    }

    const openNewExpenseHead = () => {
        setEditingExpenseHead(null)
        setExpenseHeadForm({ name: '', description: '' })
        setShowExpenseHeadModal(true)
    }

    // Business Profile & Security state
    const [businessName, setBusinessName] = useState('Dixit Mangoes')
    const [businessLoading, setBusinessLoading] = useState(false)

    const [pinForm, setPinForm] = useState({
        currentPin: '',
        newPin: '',
        confirmPin: ''
    })
    const [pinLoading, setPinLoading] = useState(false)

    useEffect(() => {
        fetchBusinessSettings()
    }, [])

    const fetchBusinessSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'business_name')
                .maybeSingle()

            if (error) throw error
            if (data) {
                setBusinessName(data.value)
            }
        } catch (error) {
            console.error('Error fetching business settings:', error)
        }
    }

    const saveBusinessName = async () => {
        if (!businessName.trim()) {
            toast.error('Business name cannot be empty')
            return
        }

        setBusinessLoading(true)
        try {
            // Upsert business name
            const { error } = await supabase
                .from('app_settings')
                .upsert(
                    { key: 'business_name', value: businessName },
                    { onConflict: 'key' }
                )

            if (error) throw error
            toast.success('Business name updated')
            // Add a small delay then reload to update layout
            setTimeout(() => window.location.reload(), 1000)
        } catch (error) {
            toast.error('Failed to update business name: ' + error.message)
        } finally {
            setBusinessLoading(false)
        }
    }

    const handlePinChange = async (e) => {
        e.preventDefault()
        if (pinForm.newPin.length < 4) {
            toast.error('New PIN must be at least 4 digits')
            return
        }
        if (pinForm.newPin !== pinForm.confirmPin) {
            toast.error('New PINs do not match')
            return
        }

        setPinLoading(true)
        try {
            // Verify current PIN first
            const { data: currentPinData, error: fetchError } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'admin_pin')
                .maybeSingle()

            if (fetchError) throw fetchError

            const storedPin = currentPinData?.value || '1234'

            if (pinForm.currentPin !== storedPin) {
                toast.error('Current PIN is incorrect')
                setPinLoading(false)
                return
            }

            // Update with new PIN
            const { error: updateError } = await supabase
                .from('app_settings')
                .upsert(
                    { key: 'admin_pin', value: pinForm.newPin },
                    { onConflict: 'key' }
                )

            if (updateError) throw updateError

            toast.success('PIN updated successfully')
            setPinForm({ currentPin: '', newPin: '', confirmPin: '' })
        } catch (error) {
            toast.error('Failed to update PIN: ' + error.message)
        } finally {
            setPinLoading(false)
        }
    }

    return (
        <div className="settings">
            <div className="page-header">
                <h1 className="page-title">Settings</h1>
            </div>

            {/* Business Profile */}
            <div className="card mb-3">
                <div className="card-header">
                    <div className="flex items-center gap-2">
                        <Wallet size={20} className="text-primary" />
                        <h3 className="card-title">Business Profile</h3>
                    </div>
                </div>
                <div className="form-group">
                    <label>Business Name</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            placeholder="e.g., Dixit Mangoes"
                            style={{ flex: 1 }}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={saveBusinessName}
                            disabled={businessLoading}
                        >
                            <Save size={16} />
                            {businessLoading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Security Settings */}
            <div className="card mb-3">
                <div className="card-header">
                    <div className="flex items-center gap-2">
                        <Calendar size={20} className="text-primary" />
                        <h3 className="card-title">Security Settings</h3>
                    </div>
                </div>
                <form onSubmit={handlePinChange}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Current PIN</label>
                            <input
                                type="password"
                                value={pinForm.currentPin}
                                onChange={(e) => setPinForm({ ...pinForm, currentPin: e.target.value })}
                                placeholder="Enter current PIN"
                                className="font-mono"
                                required
                            />
                        </div>
                        <div className="form-group"></div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>New PIN</label>
                            <input
                                type="password"
                                value={pinForm.newPin}
                                onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value })}
                                placeholder="Enter new PIN"
                                className="font-mono"
                                required
                                minLength={4}
                            />
                        </div>
                        <div className="form-group">
                            <label>Confirm New PIN</label>
                            <input
                                type="password"
                                value={pinForm.confirmPin}
                                onChange={(e) => setPinForm({ ...pinForm, confirmPin: e.target.value })}
                                placeholder="Confirm new PIN"
                                className="font-mono"
                                required
                                minLength={4}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={pinLoading}
                        >
                            <Save size={16} />
                            {pinLoading ? 'Updating...' : 'Update PIN'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Season Configuration */}
            <div className="card mb-3">
                <div className="card-header">
                    <div className="flex items-center gap-2">
                        <Calendar size={20} className="text-primary" />
                        <h3 className="card-title">Season Configuration</h3>
                    </div>
                    {currentSeason && !showSeasonForm && (
                        <button className="btn btn-outline btn-sm" onClick={() => setShowSeasonForm(true)}>
                            <Edit2 size={16} /> Edit
                        </button>
                    )}
                </div>

                {currentSeason && !showSeasonForm ? (
                    <div className="season-info">
                        <div className="season-status">
                            <span className="badge badge-success">Active Season</span>
                            <h4>{currentSeason.name}</h4>
                        </div>
                        <div className="season-details">
                            <div className="detail-row">
                                <span>Period</span>
                                <span>{formatDateForInput(currentSeason.start_date)} to {formatDateForInput(currentSeason.end_date)}</span>
                            </div>
                            <div className="detail-row">
                                <span>Rent Amount</span>
                                <span>{formatCurrency(currentSeason.rent_amount)}</span>
                            </div>
                            <div className="detail-row">
                                <span>Rent Paid</span>
                                <span>{formatCurrency(currentSeason.rent_paid)}</span>
                            </div>
                            <div className="detail-row">
                                <span>Rent Outstanding</span>
                                <span className={currentSeason.rent_amount - currentSeason.rent_paid > 0 ? 'text-danger' : 'text-success'}>
                                    {formatCurrency((currentSeason.rent_amount || 0) - (currentSeason.rent_paid || 0))}
                                </span>
                            </div>
                        </div>
                        <button className="btn btn-danger btn-block mt-2" onClick={handleEndSeason}>
                            End Season
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSeasonSubmit}>
                        <div className="form-group">
                            <label>Season Name</label>
                            <input
                                type="text"
                                placeholder="e.g., Mango Season 2025"
                                value={seasonForm.name}
                                onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Start Date</label>
                                <input
                                    type="date"
                                    value={seasonForm.start_date}
                                    onChange={(e) => setSeasonForm({ ...seasonForm, start_date: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>End Date</label>
                                <input
                                    type="date"
                                    value={seasonForm.end_date}
                                    onChange={(e) => setSeasonForm({ ...seasonForm, end_date: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Total Rent Amount (₹)</label>
                                <input
                                    type="number"
                                    placeholder="e.g., 45000"
                                    value={seasonForm.rent_amount}
                                    onChange={(e) => setSeasonForm({ ...seasonForm, rent_amount: e.target.value })}
                                    required
                                />
                            </div>
                            {currentSeason && (
                                <div className="form-group">
                                    <label>Rent Paid (₹)</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={seasonForm.rent_paid}
                                        onChange={(e) => setSeasonForm({ ...seasonForm, rent_paid: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" className="btn btn-primary" disabled={seasonLoading}>
                                <Save size={16} />
                                {seasonLoading ? 'Saving...' : (currentSeason ? 'Update Season' : 'Create Season')}
                            </button>
                            {currentSeason && showSeasonForm && (
                                <button type="button" className="btn btn-outline" onClick={() => setShowSeasonForm(false)}>
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                )}
            </div>

            {/* Current Pricing Overview */}
            {currentSeason && packageSizes.length > 0 && (
                <div className="card mb-3">
                    <div className="card-header">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={20} className="text-primary" />
                            <h3 className="card-title">Current Pricing</h3>
                        </div>
                    </div>
                    <p className="text-muted mb-2" style={{ fontSize: '0.875rem' }}>
                        Based on latest purchase rates + ₹{margin} margin per dozen
                    </p>
                    <div className="pricing-grid">
                        {packageSizes.map((pkg) => {
                            const pricing = packagePricing[pkg.id]
                            const suggestedPrice = getSuggestedSellingPrice(pkg)

                            return (
                                <div key={pkg.id} className="pricing-card">
                                    <div className="pricing-header">
                                        <span className="pricing-name">{pkg.name}</span>
                                        <span className="pricing-pieces">{pkg.pieces_per_box} pcs</span>
                                    </div>
                                    {pricing ? (
                                        <div className="pricing-body">
                                            <div className="pricing-row">
                                                <span className="pricing-label">Buying Rate</span>
                                                <span className="pricing-value">{formatCurrency(pricing.buyingRate)}/box</span>
                                            </div>
                                            <div className="pricing-row">
                                                <span className="pricing-label">Per Piece</span>
                                                <span className="pricing-value">{formatCurrency(pricing.buyingRate / pkg.pieces_per_box)}</span>
                                            </div>
                                            <div className="pricing-row suggested">
                                                <span className="pricing-label">Sell @ /dz</span>
                                                <span className="pricing-value text-success">{formatCurrency(suggestedPrice)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pricing-body">
                                            <span className="text-muted">No purchases yet</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Package Sizes */}
            <div className="card mb-3">
                <div className="card-header">
                    <div className="flex items-center gap-2">
                        <Package size={20} className="text-primary" />
                        <h3 className="card-title">Package Sizes</h3>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={openNewPackage}>
                        <Plus size={16} /> Add
                    </button>
                </div>

                {packageSizes.length === 0 ? (
                    <div className="empty-state">
                        <p>No package sizes configured. Add common sizes like "1 Dozen", "2 Dozen", etc.</p>
                    </div>
                ) : (
                    <div className="package-list">
                        {packageSizes.map((pkg) => (
                            <div key={pkg.id} className="package-item">
                                <div className="package-info">
                                    <span className="package-name">{pkg.name}</span>
                                    <span className="package-count">
                                        {pkg.pieces_per_box} pcs • Transport: {formatCurrency(pkg.transport_cost || 0)}
                                    </span>
                                </div>
                                <div className="package-actions">
                                    <button className="btn btn-ghost btn-icon" onClick={() => openEditPackage(pkg)}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button className="btn btn-ghost btn-icon text-danger" onClick={() => handleDeletePackage(pkg)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pricing Margin */}
            <div className="card mb-3">
                <div className="card-header">
                    <div className="flex items-center gap-2">
                        <DollarSign size={20} className="text-primary" />
                        <h3 className="card-title">Pricing Settings</h3>
                    </div>
                </div>
                <div className="form-group">
                    <label>Default Margin per Dozen (₹)</label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={margin}
                            onChange={(e) => setMargin(parseInt(e.target.value) || 0)}
                            placeholder="300"
                            style={{ flex: 1 }}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={() => saveMarginSetting(margin)}
                            disabled={marginLoading}
                        >
                            <Save size={16} />
                            {marginLoading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                    <small className="text-muted">
                        Suggested selling price = (Cost per piece × 12) + margin
                    </small>
                </div>
            </div>

            {/* Expense Heads */}
            <div className="card mb-3">
                <div className="card-header">
                    <div className="flex items-center gap-2">
                        <Wallet size={20} className="text-primary" />
                        <h3 className="card-title">Expense Heads</h3>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={openNewExpenseHead}>
                        <Plus size={16} /> Add
                    </button>
                </div>

                {expenseHeads.length === 0 ? (
                    <div className="empty-state">
                        <p>No expense heads configured. Add expense categories.</p>
                    </div>
                ) : (
                    <div className="package-list">
                        {expenseHeads.map((head) => (
                            <div key={head.id} className="package-item">
                                <div className="package-info">
                                    <span className="package-name">
                                        {head.name}
                                        {head.is_system && (
                                            <span className="badge badge-info ml-1" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                                System
                                            </span>
                                        )}
                                    </span>
                                    {head.description && (
                                        <span className="package-count">{head.description}</span>
                                    )}
                                </div>
                                <div className="package-actions">
                                    <button className="btn btn-ghost btn-icon" onClick={() => openEditExpenseHead(head)}>
                                        <Edit2 size={16} />
                                    </button>
                                    {!head.is_system && (
                                        <button className="btn btn-ghost btn-icon text-danger" onClick={() => handleDeleteExpenseHead(head)}>
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Package Size Modal */}
            <Modal
                isOpen={showPackageModal}
                onClose={() => {
                    setShowPackageModal(false)
                    setEditingPackage(null)
                }}
                title={editingPackage ? 'Edit Package Size' : 'Add Package Size'}
                footer={
                    <>
                        <button
                            className="btn btn-outline"
                            onClick={() => {
                                setShowPackageModal(false)
                                setEditingPackage(null)
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handlePackageSubmit}
                            disabled={packageLoading}
                        >
                            {packageLoading ? 'Saving...' : 'Save'}
                        </button>
                    </>
                }
            >
                <form onSubmit={handlePackageSubmit}>
                    <div className="form-group">
                        <label>Package Name</label>
                        <input
                            type="text"
                            placeholder="e.g., 1 Dozen, 2 Dozen, Crate"
                            value={packageForm.name}
                            onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Pieces per Package</label>
                            <input
                                type="number"
                                placeholder="12"
                                value={packageForm.pieces_per_box}
                                onChange={(e) => setPackageForm({ ...packageForm, pieces_per_box: e.target.value })}
                                min="1"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Transport Cost (₹)</label>
                            <input
                                type="number"
                                placeholder="0"
                                value={packageForm.transport_cost}
                                onChange={(e) => setPackageForm({ ...packageForm, transport_cost: e.target.value })}
                                min="0"
                            />
                            <small className="text-muted">Devgad → Pune per box</small>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Expense Head Modal */}
            <Modal
                isOpen={showExpenseHeadModal}
                onClose={() => {
                    setShowExpenseHeadModal(false)
                    setEditingExpenseHead(null)
                }}
                title={editingExpenseHead ? 'Edit Expense Head' : 'Add Expense Head'}
                footer={
                    <>
                        <button
                            className="btn btn-outline"
                            onClick={() => {
                                setShowExpenseHeadModal(false)
                                setEditingExpenseHead(null)
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleExpenseHeadSubmit}
                            disabled={expenseHeadLoading}
                        >
                            {expenseHeadLoading ? 'Saving...' : 'Save'}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleExpenseHeadSubmit}>
                    <div className="form-group">
                        <label>Expense Head Name *</label>
                        <input
                            type="text"
                            placeholder="e.g., Labor, Utilities, Marketing"
                            value={expenseHeadForm.name}
                            onChange={(e) => setExpenseHeadForm({ ...expenseHeadForm, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Description</label>
                        <input
                            type="text"
                            placeholder="Optional description"
                            value={expenseHeadForm.description}
                            onChange={(e) => setExpenseHeadForm({ ...expenseHeadForm, description: e.target.value })}
                        />
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default Settings
