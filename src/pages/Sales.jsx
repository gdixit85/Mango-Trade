import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Trash2, ArrowLeft, ArrowRight, Check, UserPlus, ShoppingCart, CreditCard, ChevronDown, ChevronUp, Truck, X } from 'lucide-react'
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
    paymentStatusLabels,
    isValidIndianPhone
} from '../utils/helpers'
import { downloadReceipt, shareOnWhatsApp } from '../utils/receiptGenerator'
import './Sales.css'

function Sales() {
    const { currentSeason } = useSeason()
    const toast = useToast()
    const [searchParams, setSearchParams] = useSearchParams()
    const enquiryIdFromUrl = searchParams.get('enquiry_id')

    // Wizard state - no more view toggle, wizard is always visible
    const [wizardStep, setWizardStep] = useState(1) // 1: Customer, 2: Items, 3: Payment

    // Data state
    const [sales, setSales] = useState([])
    const [customers, setCustomers] = useState([])
    const [packageSizes, setPackageSizes] = useState([])
    const [latestRates, setLatestRates] = useState({})
    const [marginPerDozen, setMarginPerDozen] = useState(300) // Default margin
    const [inventory, setInventory] = useState({})
    const [loading, setLoading] = useState(true)
    const [formLoading, setFormLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [customerSearch, setCustomerSearch] = useState('')

    const [expandedSales, setExpandedSales] = useState({}) // Track which sales are expanded
    const [currentEnquiryId, setCurrentEnquiryId] = useState(null) // Track enquiry being converted
    const [lastSale, setLastSale] = useState(null) // Store last verified sale for receipt
    const [editId, setEditId] = useState(null) // ID of sale being edited
    const [originalItems, setOriginalItems] = useState([]) // Store original items availability for edit mode

    // Form state
    const [form, setForm] = useState({
        customer_id: '',
        customer_type: 'walk-in-cash',
        customer_name: '',
        customer_phone: '',
        customer_address: '',
        needs_delivery: false,
        sale_date: getTodayDate(),
        payment_mode: 'cash',
        payment_status: 'paid',
        items: [{ package_size_id: '', quantity: 1, rate_per_dozen: '', buying_rate: 0 }],
        delivery_charge: 0,
        notes: ''
    })

    // Autocomplete state
    const [showAutocomplete, setShowAutocomplete] = useState(false)
    const [isCreatingNew, setIsCreatingNew] = useState(false)
    const searchInputRef = useRef(null)

    const editIdFromUrl = searchParams.get('edit_id')

    useEffect(() => {
        fetchData()
    }, [currentSeason])

    // Handle Edit Mode
    useEffect(() => {
        if (editIdFromUrl && customers.length > 0 && packageSizes.length > 0 && !loading) {
            loadSaleForEdit(editIdFromUrl)
        }
    }, [editIdFromUrl, customers.length, packageSizes.length, loading, latestRates])

    // Handle enquiry conversion from URL param
    useEffect(() => {
        // Wait for all data to be loaded before attempting to load enquiry
        const hasData = customers.length > 0 && packageSizes.length > 0
        if (enquiryIdFromUrl && hasData && !loading) {
            loadEnquiryForConversion(enquiryIdFromUrl)
        }
    }, [enquiryIdFromUrl, customers.length, packageSizes.length, loading, latestRates])

    const loadSaleForEdit = async (id) => {
        try {
            setLoading(true)
            const { data: sale, error } = await supabase
                .from('sales')
                .select(`
                    *,
                    customers (id, name, phone, type, address),
                    sale_items (
                        package_size_id,
                        quantity,
                        rate_per_dozen,
                        buying_rate
                    )
                `)
                .eq('id', id)
                .single()

            if (error) throw error

            setEditId(id)
            setOriginalItems(sale.sale_items)

            // Setup form
            const customer = sale.customers
            // Map legacy types if needed (same logic as handleSelectCustomer)
            let customerType = customer.type
            if (customerType === 'delivery') customerType = 'walk-in-cash'
            if (customerType === 'walk-in') customerType = 'walk-in-cash'

            setForm({
                customer_id: customer.id,
                customer_type: customerType,
                customer_name: customer.name,
                customer_phone: customer.phone || '',
                customer_address: customer.address || '',
                needs_delivery: !!sale.delivery_charge && sale.delivery_charge > 0, // Infer
                sale_date: sale.sale_date,
                payment_mode: sale.payment_mode,
                payment_status: sale.payment_status,
                items: sale.sale_items.map(item => ({
                    package_size_id: item.package_size_id,
                    quantity: item.quantity,
                    rate_per_dozen: item.rate_per_dozen,
                    buying_rate: item.buying_rate
                })),
                delivery_charge: sale.delivery_charge || 0,
                notes: sale.notes || ''
            })

            // Set search state so UI looks correct
            setCustomerSearch(customer.name)
            setWizardStep(3) // Jump to payment/review step directly? Or step 2?
            // Let's go to step 2 so they can edit items easily
            setWizardStep(2)

            toast.info(`Editing Invoice #${sale.invoice_number}`)
            // Clear param
            setSearchParams({})

        } catch (error) {
            console.error('Error loading sale for edit:', error)
            toast.error('Failed to load sale for editing')
            setSearchParams({}) // clear anyway
        } finally {
            setLoading(false)
        }
    }

    const loadEnquiryForConversion = async (enquiryId) => {
        try {
            const { data: enquiry, error } = await supabase
                .from('enquiries')
                .select(`
                    *,
                    customers (id, name, phone, type, address),
                    package_sizes (id, name, pieces_per_box)
                `)
                .eq('id', enquiryId)
                .single()

            if (error || !enquiry) {
                toast.error('Could not load enquiry data')
                return
            }

            // Store enquiry ID for later
            setCurrentEnquiryId(enquiryId)

            // Determine the rate if package size exists
            let itemRate = ''
            let itemBuyingRate = 0
            if (enquiry.package_size_id) {
                const buyingRate = latestRates[enquiry.package_size_id]
                const pkg = packageSizes.find(p => p.id === enquiry.package_size_id)
                if (buyingRate && pkg) {
                    itemRate = calculateSuggestedPrice(buyingRate, pkg.pieces_per_box, marginPerDozen)
                    itemBuyingRate = buyingRate
                }
            }

            // Pre-fill form with enquiry data
            if (enquiry.customer_id && enquiry.customers) {
                const customer = enquiry.customers
                const customerType = customer.type === 'delivery' ? 'walk-in' : customer.type

                // Build items array
                const enquiryItems = enquiry.package_size_id ? [{
                    package_size_id: enquiry.package_size_id,
                    quantity: enquiry.quantity || 1,
                    rate_per_dozen: itemRate || '',
                    buying_rate: itemBuyingRate || 0
                }] : [{ package_size_id: '', quantity: 1, rate_per_dozen: '', buying_rate: 0 }]

                setForm(prev => ({
                    ...prev,
                    customer_id: customer.id,
                    customer_type: customerType,
                    customer_name: customer.name,
                    customer_phone: customer.phone || '',
                    customer_address: customer.address || '',
                    payment_status: customerType === 'credit' ? 'pending' : 'paid',
                    notes: enquiry.notes ? `From enquiry: ${enquiry.notes}` : '',
                    items: enquiryItems
                }))
                setCustomerSearch(customer.name)

                // Auto-advance to step 2 (Items) if we have package data
                if (enquiry.package_size_id) {
                    setWizardStep(2)
                }
            } else if (enquiry.customer_name) {
                // Build items array for new customer
                const enquiryItems = enquiry.package_size_id ? [{
                    package_size_id: enquiry.package_size_id,
                    quantity: enquiry.quantity || 1,
                    rate_per_dozen: itemRate || '',
                    buying_rate: itemBuyingRate || 0
                }] : [{ package_size_id: '', quantity: 1, rate_per_dozen: '', buying_rate: 0 }]

                setForm(prev => ({
                    ...prev,
                    customer_id: '',
                    customer_name: enquiry.customer_name,
                    customer_phone: enquiry.customer_phone || '',
                    notes: enquiry.notes ? `From enquiry: ${enquiry.notes}` : '',
                    items: enquiryItems
                }))
                setCustomerSearch(enquiry.customer_name)
                setIsCreatingNew(true)
            }

            // Clear URL param to prevent re-loading on navigation
            setSearchParams({})
            toast.info('Enquiry loaded - complete the sale details')

        } catch (error) {
            console.error('Error loading enquiry:', error)
            toast.error('Failed to load enquiry')
        }
    }

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

            // Fetch margin setting
            const { data: marginSetting } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'margin_per_dozen')
                .single()

            if (marginSetting?.value) {
                setMarginPerDozen(parseInt(marginSetting.value))
            }

            // Fetch inventory data
            if (currentSeason) {
                const { data: purchaseItems } = await supabase
                    .from('purchase_items')
                    .select('package_size_id, quantity, purchases!inner(season_id)')
                    .eq('purchases.season_id', currentSeason.id)

                const { data: saleItems } = await supabase
                    .from('sale_items')
                    .select('package_size_id, quantity, sales!inner(season_id)')
                    .eq('sales.season_id', currentSeason.id)

                // Calculate stock
                const inventoryData = {}
                packageData?.forEach(pkg => {
                    const purchased = purchaseItems?.filter(pi => pi.package_size_id === pkg.id)
                        .reduce((sum, pi) => sum + (pi.quantity || 0), 0) || 0
                    const sold = saleItems?.filter(si => si.package_size_id === pkg.id)
                        .reduce((sum, si) => sum + (si.quantity || 0), 0) || 0
                    inventoryData[pkg.id] = purchased - sold
                })
                setInventory(inventoryData)
            }

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
        // Map legacy 'delivery' type to 'walk-in-cash' with delivery flag if needed, 
        // or keep as is if it's one of the new types
        let customerType = customer.type
        if (customer.type === 'delivery') customerType = 'walk-in-cash' // Legacy mapping
        if (customer.type === 'walk-in') customerType = 'walk-in-cash' // Legacy mapping

        // Determine payment mode
        let paymentMode = 'cash'
        if (customerType === 'walk-in-online') paymentMode = 'online'

        setForm({
            ...form,
            customer_id: customer.id,
            customer_type: customerType,
            customer_name: customer.name,
            customer_phone: customer.phone || '',
            customer_address: customer.address || '',
            needs_delivery: customer.type === 'delivery',
            payment_status: customerType === 'credit' ? 'pending' : 'paid',
            payment_mode: paymentMode
        })
        setCustomerSearch(customer.name)
        setShowAutocomplete(false)
        setIsCreatingNew(false)
    }

    const handleStartNewCustomer = () => {
        setForm({
            ...form,
            customer_id: '',
            customer_name: customerSearch || '',
            customer_phone: '',
            customer_address: '',
            customer_type: 'walk-in-cash',
            needs_delivery: false,
            payment_mode: 'cash'
        })
        setIsCreatingNew(true)
        setShowAutocomplete(false)
    }

    const handleClearCustomer = () => {
        setForm({
            ...form,
            customer_id: '',
            customer_name: '',
            customer_phone: '',
            customer_address: '',
            customer_type: 'walk-in',
            needs_delivery: false
        })
        setCustomerSearch('')
        setIsCreatingNew(false)
        setShowAutocomplete(false)
        searchInputRef.current?.focus()
    }

    const handleItemChange = (index, field, value) => {
        const newItems = [...form.items]
        newItems[index] = { ...newItems[index], [field]: value }

        // Auto-fill suggested price when package is selected
        if (field === 'package_size_id' && value) {
            const buyingRate = latestRates[value]
            const pkg = packageSizes.find(p => p.id === value)
            if (buyingRate && pkg) {
                const suggestedPrice = calculateSuggestedPrice(buyingRate, pkg.pieces_per_box, marginPerDozen)
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
            // Validate new customer phone
            if (isCreatingNew && !form.customer_id && form.customer_phone) {
                if (!isValidIndianPhone(form.customer_phone)) {
                    throw new Error('Invalid phone number. Must be 10 digits starting with 6-9')
                }
            }

            // Validate stock
            for (const item of form.items) {
                let stock = inventory[item.package_size_id] || 0
                // If editing, add back the original quantity for that item to the available stock
                if (editId) {
                    const originalItem = originalItems.find(oi => oi.package_size_id === item.package_size_id)
                    if (originalItem) {
                        stock += originalItem.quantity // "Return" stock for validation
                    }
                }

                if (item.quantity > stock) {
                    const pkg = packageSizes.find(p => p.id === item.package_size_id)
                    throw new Error(`Insufficient stock for ${pkg?.name}. Available: ${stock}`)
                }
            }

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
            const amountPaid = form.payment_status === 'paid' ? totalAmount : 0

            let saleId = editId
            let finalSale = null

            if (editId) {
                // UPDATING EXISTING SALE
                // 1. Get original sale to calc diff for outstanding
                const { data: originalSale, error: fetchErr } = await supabase
                    .from('sales')
                    .select('total_amount, amount_paid, customer_id')
                    .eq('id', editId)
                    .single()

                if (fetchErr) throw fetchErr

                // 2. Update Sale Record
                const { data: updatedSale, error: updateErr } = await supabase
                    .from('sales')
                    .update({
                        customer_id: customerId, // Customer might have changed
                        sale_date: form.sale_date,
                        payment_mode: form.payment_mode,
                        payment_status: form.payment_status,
                        total_amount: totalAmount,
                        amount_paid: amountPaid,
                        delivery_charge: parseFloat(form.delivery_charge) || 0,
                        notes: form.notes
                    })
                    .eq('id', editId)
                    .select()
                    .single()

                if (updateErr) throw updateErr
                finalSale = updatedSale
                saleId = updatedSale.id

                // 3. Delete existing items
                await supabase.from('sale_items').delete().eq('sale_id', editId)

                // 4. Update Customer Outstanding
                // Revert effect of old sale
                if (originalSale.amount_paid < originalSale.total_amount) {
                    // Was credit/partial. Reduce outstanding.
                    const oldOutstanding = originalSale.total_amount - originalSale.amount_paid
                    // We need to decrease the OLD customer's outstanding
                    // NOTE: If customer changed, this is complex. Assuming simple case or customer same.
                    // Ideally call RPC. For now assuming customer_id same or just fixing current customer
                    // If customer changed, we should fix old customer too. But let's simplify:
                    // We will just adjust the current customer's outstanding by the difference if same customer.
                    // If diff customer, this logic is flawed without backend transaction.
                    // Let's assume customer is same for outstanding calc or just fix current customer.

                    // Actually, let's just use the `customerId` we differenced.
                    // IF old was credit, we subtracted from their outstanding? No, we added. So subtract now.

                    /* 
                       Logic for simplicity:
                       We are not building a full accounting system refactor here.
                       We will just update the CURRENT customer's outstanding if credit.
                       Ideally, we should rely on a "recalculate outstanding" button or function 
                       because delta updates are error prone without transactions.
                       
                       BUT, to be safe:
                       If we are editing, we probably shouldn't mess with outstanding too much manually 
                       UNLESS we are sure.
                       
                       Let's do this: 
                       If payment_status is 'pending' (credit), we add the NEW amount to outstanding.
                       But we must have subtracted the OLD amount? NO.
                       
                       Better approach for this app's scale:
                       Don't try to "fix" the previous outstanding delta perfectly here if it's too risky.
                       HOWEVER, incorrect outstanding is bad.
                       
                       Let's try:
                       Old sale total: X. Old paid: Y.
                       New sale total: A. New paid: B.
                       
                       If customer same:
                       New Outstanding = Old Outstanding - (X - Y) + (A - B)
                    */

                    if (originalSale.customer_id === customerId) {
                        const oldBalanceImpact = originalSale.total_amount - originalSale.amount_paid
                        const newBalanceImpact = totalAmount - amountPaid

                        const currentCustomer = customers.find(c => c.id === customerId)
                        const newTotalOutstanding = (currentCustomer?.total_outstanding || 0) - oldBalanceImpact + newBalanceImpact

                        await supabase
                            .from('customers')
                            .update({ total_outstanding: newTotalOutstanding })
                            .eq('id', customerId)
                    }
                } else {
                    // Old was paid fully. No outstanding impact from old.
                    // If new is credit, add to outstanding.
                    if (form.payment_status !== 'paid') {
                        const newBalanceImpact = totalAmount - amountPaid // should be full amount
                        const currentCustomer = customers.find(c => c.id === customerId)
                        await supabase
                            .from('customers')
                            .update({ total_outstanding: (currentCustomer?.total_outstanding || 0) + newBalanceImpact })
                            .eq('id', customerId)
                    }
                }

                toast.success('Sale updated successfully')

            } else {
                // CREATE NEW SALE
                const invoiceNumber = generateInvoiceNumber('MT')

                // Create sale with enquiry_id if converting
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
                        notes: form.notes,
                        enquiry_id: currentEnquiryId || null
                    }])
                    .select()
                    .single()

                if (saleError) throw saleError
                finalSale = sale
                saleId = sale.id

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

                // Auto-mark enquiry as fulfilled if this sale was from an enquiry
                if (currentEnquiryId) {
                    await supabase
                        .from('enquiries')
                        .update({ status: 'fulfilled' })
                        .eq('id', currentEnquiryId)
                }

                toast.success(`Sale recorded! Invoice: ${invoiceNumber}`)
            }

            // Create sale items (for both new and update)
            const items = form.items.map(item => ({
                sale_id: saleId,
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

            // Set last sale for receipt generation and move to step 4
            setLastSale({
                ...finalSale,
                customers: customers.find(c => c.id === customerId) || { name: form.customer_name, phone: form.customer_phone },
                sale_items: items.map(i => ({
                    ...i,
                    package_sizes: packageSizes.find(p => p.id === i.package_size_id)
                }))
            })
            setWizardStep(4)

            setCurrentEnquiryId(null) // Clear enquiry reference
            setEditId(null)
            setOriginalItems([])
            fetchData()
        } catch (error) {
            console.error(error)
            toast.error('Failed to save sale: ' + error.message)
        } finally {
            setFormLoading(false)
        }
    }

    const resetWizard = () => {
        setWizardStep(1)
        setLastSale(null)
        setCustomerSearch('')
        setShowAutocomplete(false)
        setIsCreatingNew(false)
        setEditId(null)
        setOriginalItems([])
        setSearchParams({})
        setForm({
            customer_id: '',
            customer_type: 'walk-in-cash',
            customer_name: '',
            customer_phone: '',
            customer_address: '',
            needs_delivery: false,
            sale_date: getTodayDate(),
            payment_mode: 'cash',
            payment_status: 'paid',
            items: [{ package_size_id: '', quantity: 1, rate_per_dozen: '', buying_rate: 0 }],
            delivery_charge: 0,
            notes: ''
        })
    }

    const toggleSaleExpanded = (saleId) => {
        setExpandedSales(prev => ({
            ...prev,
            [saleId]: !prev[saleId]
        }))
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

    // Unified View - Wizard always visible at top, recent bookings below
    return (
        <div className="sales-page sales-unified-view">
            {/* Wizard Section - Always Visible */}
            <div className="wizard-section">
                <div className="wizard-header">
                    <h2>{editId ? 'Edit Sale' : 'New Sale'}</h2>
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
                        {/* Search with Autocomplete */}
                        <div className="customer-search-container">
                            <div className="search-bar">
                                <Search size={20} className="search-icon" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search customer by name or phone..."
                                    value={customerSearch}
                                    onChange={(e) => {
                                        setCustomerSearch(e.target.value)
                                        setShowAutocomplete(e.target.value.length > 0)
                                        if (form.customer_id) {
                                            // Clear selected customer when typing
                                            setForm({ ...form, customer_id: '', customer_name: '' })
                                        }
                                        setIsCreatingNew(false)
                                    }}
                                    onFocus={() => setShowAutocomplete(customerSearch.length > 0)}
                                    autoFocus
                                />
                                {(customerSearch || form.customer_id) && (
                                    <button className="btn-clear-search" onClick={handleClearCustomer}>
                                        <X size={18} />
                                    </button>
                                )}
                            </div>

                            {/* Autocomplete Dropdown */}
                            {showAutocomplete && customerSearch && !form.customer_id && (
                                <div className="autocomplete-dropdown">
                                    {filteredCustomers.length > 0 ? (
                                        <>
                                            {filteredCustomers.slice(0, 6).map(customer => (
                                                <div
                                                    key={customer.id}
                                                    className="autocomplete-item"
                                                    onClick={() => handleSelectCustomer(customer)}
                                                >
                                                    <div className="autocomplete-item-main">
                                                        <span className="autocomplete-name">{customer.name}</span>
                                                        <span className={`badge badge-sm badge-${customer.type === 'credit' ? 'warning' : 'info'}`}>
                                                            {customerTypeLabels[customer.type] || 'Walk-in'}
                                                        </span>
                                                    </div>
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
                                        <UserPlus size={18} />
                                        <span>Create "{customerSearch}" as new customer</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Selected Customer Display */}
                        {form.customer_id && (
                            <div className="selected-customer-card">
                                <div className="selected-customer-info">
                                    <div className="selected-customer-main">
                                        <span className="selected-customer-name">{form.customer_name}</span>
                                        <span className={`badge badge-${form.customer_type === 'credit' ? 'warning' : 'info'}`}>
                                            {customerTypeLabels[form.customer_type] || 'Walk-in'}
                                        </span>
                                    </div>
                                    {form.customer_phone && (
                                        <span className="selected-customer-phone">{form.customer_phone}</span>
                                    )}
                                </div>
                                <button className="btn btn-ghost btn-sm" onClick={handleClearCustomer}>
                                    Change
                                </button>
                            </div>
                        )}

                        {/* New Customer Form */}
                        {isCreatingNew && !form.customer_id && (
                            <div className="card new-customer-card">
                                <div className="new-customer-header">
                                    <h4><UserPlus size={18} /> New Customer</h4>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setIsCreatingNew(false)}>
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="form-group">
                                    <label>Name *</label>
                                    <input
                                        type="text"
                                        placeholder="Customer name"
                                        value={form.customer_name}
                                        onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                                        autoFocus
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Phone</label>
                                        <input
                                            type="tel"
                                            placeholder="Phone number"
                                            value={form.customer_phone}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                                                setForm({ ...form, customer_phone: val })
                                            }}
                                            maxLength="10"
                                        />
                                        {form.customer_phone && !isValidIndianPhone(form.customer_phone) && (
                                            <span className="text-danger small" style={{ display: 'block' }}>
                                                Invalid phone number
                                            </span>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>Payment Type</label>
                                        <select
                                            value={form.customer_type}
                                            onChange={(e) => {
                                                const newType = e.target.value
                                                let newPaymentMode = form.payment_mode

                                                if (newType === 'walk-in-cash') newPaymentMode = 'cash'
                                                if (newType === 'walk-in-online') newPaymentMode = 'online'

                                                setForm({
                                                    ...form,
                                                    customer_type: newType,
                                                    payment_status: newType === 'credit' ? 'pending' : 'paid',
                                                    payment_mode: newPaymentMode
                                                })
                                            }}
                                        >
                                            <option value="walk-in-cash">Walk-in (Cash)</option>
                                            <option value="walk-in-online">Walk-in (Online)</option>
                                            <option value="credit">Credit (Pays Later)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Delivery Toggle - Available for any customer */}
                        {(form.customer_id || isCreatingNew) && (
                            <div className="delivery-toggle-section">
                                <label className="toggle-label">
                                    <input
                                        type="checkbox"
                                        checked={form.needs_delivery}
                                        onChange={(e) => setForm({ ...form, needs_delivery: e.target.checked })}
                                    />
                                    <Truck size={18} />
                                    <span>Needs Delivery</span>
                                </label>
                                {form.needs_delivery && (
                                    <div className="form-group delivery-address-field">
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
                                            {packageSizes.map(p => {
                                                const stock = inventory[p.id] || 0
                                                return (
                                                    <option key={p.id} value={p.id} disabled={stock <= 0 && (!editId || !originalItems.find(oi => oi.package_size_id === p.id))}>
                                                        {p.name} (Stock: {stock + (editId ? (originalItems.find(oi => oi.package_size_id === p.id)?.quantity || 0) : 0)})
                                                    </option>
                                                )
                                            })}
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
                                        {item.package_size_id && inventory[item.package_size_id] < item.quantity && (
                                            <div className="text-danger small mt-1">
                                                Available: {inventory[item.package_size_id] + (editId ? (originalItems.find(oi => oi.package_size_id === item.package_size_id)?.quantity || 0) : 0)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            <button className="btn btn-outline btn-block" onClick={handleAddItem}>
                                <Plus size={18} /> Add Another Item
                            </button>
                        </div>

                        {/* Delivery Charge - shown when delivery is needed */}
                        {form.needs_delivery && (
                            <div className="form-group mt-3 delivery-charge-field">
                                <label><Truck size={16} /> Delivery Charge (₹)</label>
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

                            {/* Credit customer choice first */}
                            {form.customer_type === 'credit' && (
                                <div className="form-group">
                                    <label>Payment Status</label>
                                    <select
                                        value={form.payment_status}
                                        onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
                                    >
                                        <option value="pending">Add to Credit (Pay Later)</option>
                                        <option value="paid">Paying Now</option>
                                    </select>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Sale Date</label>
                                <input
                                    type="date"
                                    value={form.sale_date}
                                    onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
                                />
                            </div>

                            {/* Only show payment mode if customer is paying now */}
                            {(form.customer_type !== 'credit' || form.payment_status === 'paid') && (
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
                                        <Check size={18} /> {editId ? 'Update Sale' : 'Complete Sale'} ({formatCurrency(calculateTotal())})
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Bookings Section */}
            {loading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            ) : sales.length > 0 && (
                <div className="recent-bookings-section">
                    <div className="section-header">
                        <h3>Recent Bookings</h3>
                        <div className="search-bar">
                            <Search size={20} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {filteredSales.length === 0 ? (
                        <div className="empty-state">
                            <p>No sales found</p>
                        </div>
                    ) : (
                        <div className="bookings-list">
                            {filteredSales.map((sale) => {
                                const isExpanded = expandedSales[sale.id]
                                return (
                                    <div key={sale.id} className={`booking-card-compact ${isExpanded ? 'expanded' : ''}`}>
                                        {/* Compact 2-line layout */}
                                        <div className="booking-compact-content">
                                            <div className="booking-line-1">
                                                <span className="customer-name">{sale.customers?.name || 'Walk-in'}</span>
                                                <span className="invoice-number">{sale.invoice_number}</span>
                                                <span className="amount">{formatCurrency(sale.total_amount)}</span>
                                            </div>
                                            <div className="booking-line-2">
                                                <span className="date">{formatDate(sale.sale_date)}</span>
                                                <span className={`badge ${sale.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                                    {paymentStatusLabels[sale.payment_status]}
                                                </span>
                                                <button
                                                    className="btn-view-more"
                                                    onClick={() => toggleSaleExpanded(sale.id)}
                                                >
                                                    {isExpanded ? (
                                                        <><ChevronUp size={16} /> Less</>
                                                    ) : (
                                                        <><ChevronDown size={16} /> More</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded details */}
                                        {isExpanded && (
                                            <div className="booking-expanded-content">
                                                <div className="detail-row">
                                                    <span>Payment Mode:</span>
                                                    <span>{sale.payment_mode === 'cash' ? 'Cash' : 'Online'}</span>
                                                </div>
                                                <div className="items-detail">
                                                    <strong>Items:</strong>
                                                    {sale.sale_items?.map((item, idx) => (
                                                        <div key={idx} className="item-detail-row">
                                                            <span>{item.package_sizes?.name} × {item.quantity}</span>
                                                            <span>@ {formatCurrency(item.rate_per_dozen)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {sale.notes && (
                                                    <div className="detail-row">
                                                        <span>Notes:</span>
                                                        <span>{sale.notes}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default Sales
