import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { useSeason } from './SeasonContext'

const AppContext = createContext()

export function AppProvider({ children }) {
    const { currentSeason } = useSeason()

    // Global state
    const [farmers, setFarmers] = useState([])
    const [customers, setCustomers] = useState([])
    const [packageSizes, setPackageSizes] = useState([])
    const [latestRates, setLatestRates] = useState({})
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [isLoading, setIsLoading] = useState(true)
    const [lastSync, setLastSync] = useState(null)

    // Monitor online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    // Fetch all base data
    const fetchBaseData = useCallback(async () => {
        if (!currentSeason) {
            setIsLoading(false)
            return
        }

        try {
            setIsLoading(true)

            // Fetch farmers
            const { data: farmersData } = await supabase
                .from('farmers')
                .select('*')
                .order('name')
            setFarmers(farmersData || [])

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

            // Fetch latest purchase rates
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

            setLastSync(new Date())
        } catch (error) {
            console.error('Error fetching base data:', error)
        } finally {
            setIsLoading(false)
        }
    }, [currentSeason])

    useEffect(() => {
        fetchBaseData()
    }, [fetchBaseData])

    // Refresh functions
    const refreshFarmers = async () => {
        const { data } = await supabase
            .from('farmers')
            .select('*')
            .order('name')
        setFarmers(data || [])
    }

    const refreshCustomers = async () => {
        const { data } = await supabase
            .from('customers')
            .select('*')
            .order('name')
        setCustomers(data || [])
    }

    const refreshPackageSizes = async () => {
        const { data } = await supabase
            .from('package_sizes')
            .select('*')
            .eq('is_active', true)
            .order('pieces_per_box')
        setPackageSizes(data || [])
    }

    const refreshLatestRates = async () => {
        if (!currentSeason) return

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
    }

    // Add new farmer and update state
    const addFarmer = async (farmerData) => {
        const { data, error } = await supabase
            .from('farmers')
            .insert([farmerData])
            .select()
            .single()

        if (error) throw error
        setFarmers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        return data
    }

    // Add new customer and update state
    const addCustomer = async (customerData) => {
        const { data, error } = await supabase
            .from('customers')
            .insert([customerData])
            .select()
            .single()

        if (error) throw error
        setCustomers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        return data
    }

    // Update farmer in state
    const updateFarmerInState = (farmerId, updates) => {
        setFarmers(prev => prev.map(f =>
            f.id === farmerId ? { ...f, ...updates } : f
        ))
    }

    // Update customer in state
    const updateCustomerInState = (customerId, updates) => {
        setCustomers(prev => prev.map(c =>
            c.id === customerId ? { ...c, ...updates } : c
        ))
    }

    const value = {
        // State
        farmers,
        customers,
        packageSizes,
        latestRates,
        isOnline,
        isLoading,
        lastSync,

        // Refresh functions
        refreshFarmers,
        refreshCustomers,
        refreshPackageSizes,
        refreshLatestRates,
        refreshAll: fetchBaseData,

        // CRUD helpers
        addFarmer,
        addCustomer,
        updateFarmerInState,
        updateCustomerInState,
    }

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
    const context = useContext(AppContext)
    if (!context) {
        throw new Error('useApp must be used within an AppProvider')
    }
    return context
}

export default AppContext
