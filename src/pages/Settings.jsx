import { useState, useEffect } from 'react'
import { Calendar, Package, Save, Plus, Edit2, Trash2, DollarSign, TrendingUp } from 'lucide-react'
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

    return (
        <div className="settings">
            <div className="page-header">
                <h1 className="page-title">Settings</h1>
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
            <div className="card">
                <div className="card-header">
                    <div className="flex items-center gap-2">
                        <DollarSign size={20} className="text-primary" />
                        <h3 className="card-title">Pricing Settings</h3>
                    </div>
                </div>
                <div className="form-group">
                    <label>Default Margin per Dozen (₹)</label>
                    <input
                        type="number"
                        value={margin}
                        onChange={(e) => setMargin(parseInt(e.target.value) || 0)}
                        placeholder="300"
                    />
                    <small className="text-muted">
                        Suggested selling price = (Cost per piece × 12) + margin
                    </small>
                </div>
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
        </div>
    )
}

export default Settings
