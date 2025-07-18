import { useState, useEffect, useMemo } from 'react';
import apiClient from '../api';

const Spinner = () => <div className="flex justify-center items-center p-10"><div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div></div>;

const AuditLogViewer = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedLogId, setExpandedLogId] = useState(null);
    const [filterLevel, setFilterLevel] = useState('all');
    const [filterText, setFilterText] = useState('');

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const res = await apiClient.get('/api/audit-logs');
                setLogs(res.data);
            } catch (error) {
                console.error("Failed to fetch audit logs", error);
            }
            setLoading(false);
        };
        fetchLogs();
    }, []);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const levelMatch = filterLevel === 'all' || log.level.toLowerCase() === filterLevel;
            const textMatch = filterText === '' || log.message.toLowerCase().includes(filterText.toLowerCase());
            return levelMatch && textMatch;
        });
    }, [logs, filterLevel, filterText]);

    const getLogLevelColor = (level) => {
        if (level === 'ERROR') return 'bg-red-100 text-red-800';
        if (level === 'INFO') return 'bg-sky-100 text-sky-800';
        return 'bg-slate-100 text-slate-800';
    };

    const toggleLogExpansion = (logId) => {
        setExpandedLogId(expandedLogId === logId ? null : logId);
    };

    const renderDetails = (details) => {
        if (!details) return null;
        if (details.before && details.after) {
            const allKeys = [...new Set([...Object.keys(details.before), ...Object.keys(details.after)])];
            return (
                <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                        <h4 className="font-semibold text-slate-600 border-b mb-2 pb-1">Before</h4>
                        {allKeys.map(key => {
                            const beforeValue = details.before[key];
                            const afterValue = details.after[key];
                            const isChanged = String(beforeValue) !== String(afterValue);
                            return (
                                <div key={key} className={`text-xs break-all ${isChanged ? 'text-red-600' : ''}`}>
                                    <strong>{key}:</strong> {String(beforeValue)}
                                </div>
                            );
                        })}
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-600 border-b mb-2 pb-1">After</h4>
                        {allKeys.map(key => {
                            const beforeValue = details.before[key];
                            const afterValue = details.after[key];
                            const isChanged = String(beforeValue) !== String(afterValue);
                            return (
                                <div key={key} className={`text-xs break-all ${isChanged ? 'text-green-600' : ''}`}>
                                    <strong>{key}:</strong> {String(afterValue)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return (
            <pre className="mt-1 p-2 bg-slate-50 rounded text-xs overflow-x-auto">
                {JSON.stringify(details, null, 2)}
            </pre>
        );
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg max-w-5xl mx-auto">
            <h2 className="text-3xl font-semibold text-slate-800 mb-6">Audit Log</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
                <input
                    type="text"
                    placeholder="Search messages..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="form-input"
                />
                <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="form-input">
                    <option value="all">All Levels</option>
                    <option value="info">INFO</option>
                    <option value="error">ERROR</option>
                </select>
            </div>
            {loading ? <Spinner /> : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {filteredLogs.map(log => (
                        <div key={log.id} className="p-3 border rounded-lg font-mono text-sm cursor-pointer hover:bg-slate-50" onClick={() => toggleLogExpansion(log.id)}>
                            <div className="flex items-center justify-between">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${getLogLevelColor(log.level)}`}>{log.level}</span>
                                <span className="text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="mt-2 text-slate-700">{log.message}</p>
                            {expandedLogId === log.id && (
                                <div className="mt-2 border-t pt-2">
                                    {renderDetails(log.details)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AuditLogViewer;