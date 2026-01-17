import { useApp } from '../../context/AppContext'
import { WifiOff, RefreshCw } from 'lucide-react'
import './OfflineIndicator.css'

function OfflineIndicator() {
    const { isOnline, isLoading, refreshAll, lastSync } = useApp()

    if (isOnline && !isLoading) return null

    return (
        <div className={`offline-indicator ${!isOnline ? 'offline' : 'syncing'}`}>
            {!isOnline ? (
                <>
                    <WifiOff size={16} />
                    <span>You're offline</span>
                </>
            ) : isLoading ? (
                <>
                    <RefreshCw size={16} className="spinning" />
                    <span>Syncing...</span>
                </>
            ) : null}
            {isOnline && !isLoading && lastSync && (
                <button className="sync-btn" onClick={refreshAll}>
                    <RefreshCw size={14} />
                </button>
            )}
        </div>
    )
}

export default OfflineIndicator
