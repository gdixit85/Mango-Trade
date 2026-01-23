import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

const SeasonContext = createContext(null)

export function SeasonProvider({ children }) {
    const [currentSeason, setCurrentSeason] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchActiveSeason()
    }, [])

    const fetchActiveSeason = async () => {
        try {
            const { data, error } = await supabase
                .from('seasons')
                .select('*')
                .eq('is_active', true)
                .single()

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching season:', error)
            }
            setCurrentSeason(data || null)
        } catch (error) {
            console.error('Error fetching season:', error)
        } finally {
            setLoading(false)
        }
    }

    const createSeason = async (seasonData) => {
        // Deactivate all existing active seasons first
        const { error: deactivateError } = await supabase
            .from('seasons')
            .update({ is_active: false })
            .eq('is_active', true)

        if (deactivateError) {
            console.error('Error deactivating existing seasons:', deactivateError)
            throw deactivateError
        }

        const { data, error } = await supabase
            .from('seasons')
            .insert([{ ...seasonData, is_active: true }])
            .select()
            .single()

        if (error) throw error
        setCurrentSeason(data)
        return data
    }

    const updateSeason = async (id, updates) => {
        const { data, error } = await supabase
            .from('seasons')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        setCurrentSeason(data)
        return data
    }

    const endSeason = async () => {
        if (!currentSeason) return

        const { error } = await supabase
            .from('seasons')
            .update({ is_active: false })
            .eq('id', currentSeason.id)

        if (error) throw error
        setCurrentSeason(null)
    }

    return (
        <SeasonContext.Provider value={{
            currentSeason,
            loading,
            createSeason,
            updateSeason,
            endSeason,
            refreshSeason: fetchActiveSeason
        }}>
            {children}
        </SeasonContext.Provider>
    )
}

export function useSeason() {
    const context = useContext(SeasonContext)
    if (!context) {
        throw new Error('useSeason must be used within a SeasonProvider')
    }
    return context
}
