import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api';

const SchedulerStatus = ({ isConfigured }) => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchStatus = useCallback(async () => {
        if (!isConfigured) {
            setStatus({ error: "Trello is not configured." });
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await apiClient.get('/api/scheduler/status');
            setStatus(res.data);
        } catch (error) {
            console.error("Failed to fetch scheduler status", error);
            setStatus({ error: "Could not load status." });
        }
        setLoading(false);
    }, [isConfigured]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    return (
        <div className="bg-white p-4 rounded-xl shadow-md mb-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-slate-700">Scheduler Status</h3>
                <button onClick={fetchStatus} disabled={loading || !isConfigured} className="text-sm text-sky-600 hover:text-sky-800 disabled:text-slate-400">
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>
            {!status || loading ? <div className="text-center p-4">Loading status...</div> : (
                status.error ? <p className="text-center p-4 text-red-600">{status.error}</p> :
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-center">
                    <div>
                        <p className="text-sm text-slate-500">Last Run</p>
                        <p className="text-lg font-bold text-slate-800">{status.lastRun !== 'Never' ? new Date(status.lastRun).toLocaleString() : 'Never'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500">Duration</p>
                        <p className="text-lg font-bold text-slate-800">{status.duration}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500">Cards Created</p>
                        <p className="text-lg font-bold text-slate-800">{status.cardsCreated}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500">Next Scheduled Run</p>
                        <p className="text-lg font-bold text-slate-800">{new Date(status.nextRun).toLocaleString()}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SchedulerStatus;