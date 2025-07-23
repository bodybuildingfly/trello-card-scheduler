/**
 * @file frontend/src/components/AuditLogViewer.js
 * @description Refactored to use semantic color classes for all log level indicators,
 * including the new "CRITICAL" level.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../api';

// --- Helper Components ---
const Spinner = () => <div className="flex justify-center items-center p-10"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1.5 text-text-muted"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;


/**
 * @description A component for viewing and filtering application audit logs.
 */
const AuditLogViewer = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedLogId, setExpandedLogId] = useState(null);
    const [filterLevel, setFilterLevel] = useState('all');
    const [filterText, setFilterText] = useState('');

    /**
     * @description Fetches the audit logs from the server. Wrapped in useCallback
     * so it can be used in useEffect and attached to a button without causing re-renders.
     */
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/api/audit-logs');
            setLogs(res.data);
        } catch (error) {
            console.error("Failed to fetch audit logs", error);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    /**
     * @description Memoized computation to filter logs based on user-selected criteria.
     */
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const levelMatch = filterLevel === 'all' || log.level.toLowerCase() === filterLevel;
            const textMatch = filterText === '' || 
                              log.message.toLowerCase().includes(filterText.toLowerCase()) ||
                              (log.username && log.username.toLowerCase().includes(filterText.toLowerCase()));
            return levelMatch && textMatch;
        });
    }, [logs, filterLevel, filterText]);

    /**
     * @description Returns the appropriate Tailwind CSS classes for a given log level.
     * @param {string} level - The log level ('INFO', 'ERROR', etc.).
     * @returns {string} The CSS classes for styling.
     */
    const getLogLevelColor = (level) => {
        if (level === 'CRITICAL') return 'bg-critical text-critical-text';
        if (level === 'ERROR') return 'bg-danger-surface text-danger-text';
        if (level === 'INFO') return 'bg-info-surface text-info-text-on-surface';
        return 'bg-secondary text-secondary-text';
    };

    /**
     * @description Toggles the expanded view of a log's details.
     * @param {number} logId - The ID of the log to expand or collapse.
     */
    const toggleLogExpansion = (logId) => {
        setExpandedLogId(expandedLogId === logId ? null : logId);
    };

    /**
     * @description Renders the detailed view of a log entry, with special formatting for before/after changes.
     * @param {object} details - The JSONB details object from the log entry.
     * @returns {React.ReactNode} The rendered JSX for the details.
     */
    const renderDetails = (details) => {
        if (!details) return null;
        if (details.before && details.after) {
            const allKeys = [...new Set([...Object.keys(details.before), ...Object.keys(details.after)])];
            return (
                <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                        <h4 className="font-semibold text-text-secondary border-b mb-2 pb-1">Before</h4>
                        {allKeys.map(key => {
                            const beforeValue = details.before[key];
                            const afterValue = details.after[key];
                            const isChanged = String(beforeValue) !== String(afterValue);
                            return (
                                <div key={key} className={`text-xs break-all ${isChanged ? 'text-danger' : ''}`}>
                                    <strong>{key}:</strong> {String(beforeValue)}
                                </div>
                            );
                        })}
                    </div>
                    <div>
                        <h4 className="font-semibold text-text-secondary border-b mb-2 pb-1">After</h4>
                        {allKeys.map(key => {
                            const beforeValue = details.before[key];
                            const afterValue = details.after[key];
                            const isChanged = String(beforeValue) !== String(afterValue);
                            return (
                                <div key={key} className={`text-xs break-all ${isChanged ? 'text-success' : ''}`}>
                                    <strong>{key}:</strong> {String(afterValue)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return (
            <pre className="mt-1 p-2 bg-surface-muted rounded text-xs overflow-x-auto">
                {JSON.stringify(details, null, 2)}
            </pre>
        );
    };

    return (
        <div className="bg-surface p-6 rounded-2xl shadow-lg max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-semibold text-text-primary">Audit Log</h2>
                <button 
                    onClick={fetchLogs} 
                    disabled={loading}
                    className="px-4 py-2 text-sm rounded-lg bg-surface-muted text-text-secondary font-semibold hover:bg-surface-hover disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-surface-muted rounded-lg">
                <input
                    type="text"
                    placeholder="Search messages or users..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="form-input"
                />
                <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="form-input">
                    <option value="all">All Levels</option>
                    <option value="info">INFO</option>
                    <option value="error">ERROR</option>
                    <option value="critical">CRITICAL</option>
                </select>
            </div>
            {loading ? <Spinner /> : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {filteredLogs.map(log => (
                        <div key={log.id} className="p-3 border rounded-lg font-mono text-sm cursor-pointer hover:bg-surface-hover" onClick={() => toggleLogExpansion(log.id)}>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${getLogLevelColor(log.level)}`}>{log.level}</span>
                                    {/* --- UPDATED SECTION: Display the user if it exists --- */}
                                    {log.username && (
                                        <span className="ml-3 text-text-muted flex items-center">
                                            <UserIcon />
                                            {log.username}
                                        </span>
                                    )}
                                </div>
                                <span className="text-text-muted">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="mt-2 text-text-secondary">{log.message}</p>
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