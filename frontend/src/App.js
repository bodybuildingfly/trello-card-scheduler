import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';

// --- API Base URL ---
// const API_BASE_URL = 'http://localhost:5000';
const API_BASE_URL = '';

// --- Helper Components & Data ---
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 hover:text-blue-700"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 hover:text-red-700"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const Spinner = () => <div className="flex justify-center items-center p-10"><div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div></div>;
const DAYS_OF_WEEK = [ { id: '1', name: 'Mon' }, { id: '2', name: 'Tue' }, { id: '3', name: 'Wed' }, { id: '4', name: 'Thu' }, { id: '5', name: 'Fri' }, { id: '6', name: 'Sat' }, { id: '0', name: 'Sun' }];
const MONTHS_OF_YEAR = [ { id: '1', name: 'January' }, { id: '2', name: 'February' }, { id: '3', name: 'March' }, { id: '4', name: 'April' }, { id: '5', name: 'May' }, { id: '6', name: 'June' }, { id: '7', name: 'July' }, { id: '8', name: 'August' }, { id: '9', name: 'September' }, { id: '10', name: 'October' }, { id: '11', name: 'November' }, { id: '12', name: 'December' }];
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => String(i + 1));

// --- New & Updated Components ---

const TrelloConfigBanner = ({ onGoToSettings }) => {
    const [isVisible, setIsVisible] = useState(true);
    if (!isVisible) return null;

    return (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-lg mb-8 max-w-5xl mx-auto" role="alert">
            <div className="flex">
                <div className="py-1"><svg className="fill-current h-6 w-6 text-yellow-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zM9 5v6h2V5H9zm0 8h2v2H9v-2z"/></svg></div>
                <div>
                    <p className="font-bold">Configuration Required</p>
                    <p className="text-sm">Please configure your Trello settings to enable scheduling functionality.</p>
                </div>
                <div className="ml-auto flex flex-col items-center justify-center space-y-2">
                     <button onClick={onGoToSettings} className="bg-yellow-500 text-white font-bold py-1 px-3 rounded hover:bg-yellow-600">Go to Settings</button>
                     <button onClick={() => setIsVisible(false)} className="text-xs text-yellow-600 hover:underline">Dismiss</button>
                </div>
            </div>
        </div>
    );
};


const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50">
        <div className="bg-white rounded-xl p-8 shadow-2xl w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-4 text-slate-800">Confirm Action</h2>
            <p className="text-slate-600 mb-8">{message}</p>
            <div className="flex justify-end space-x-4">
                <button onClick={onCancel} className="px-5 py-2 rounded-lg bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300">Cancel</button>
                <button onClick={onConfirm} className="px-5 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700">Confirm</button>
            </div>
        </div>
    </div>
);

const SchedulerStatus = ({ onStatusUpdate, isConfigured }) => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        if (!isConfigured) {
            setStatus({ error: "Trello is not configured." });
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/scheduler/status`);
            setStatus(res.data);
        } catch (error) {
            console.error("Failed to fetch scheduler status", error);
            setStatus({ error: "Could not load status." });
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 60000);
        return () => clearInterval(interval);
    }, [isConfigured]);

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
                const res = await axios.get(`${API_BASE_URL}/api/audit-logs`);
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

const SettingsPage = ({ onSettingsSaved }) => {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState({ status: '', message: '' });

    const cronToTime = (cronString) => {
        const parts = (cronString || '0 1 * * *').split(' ');
        if (parts.length < 2) return { hour: '01', ampm: 'am' };
        const hour24 = parseInt(parts[1], 10);
        const ampm = hour24 >= 12 ? 'pm' : 'am';
        let hour12 = hour24 % 12;
        if (hour12 === 0) hour12 = 12;
        return { hour: String(hour12).padStart(2, '0'), ampm };
    };

    const timeToCron = (hour12, ampm) => {
        let hour24 = parseInt(hour12, 10);
        if (ampm === 'pm' && hour24 !== 12) hour24 += 12;
        if (ampm === 'am' && hour24 === 12) hour24 = 0;
        return `0 ${hour24} * * *`;
    };

    const [scheduleTime, setScheduleTime] = useState(cronToTime(settings.CRON_SCHEDULE));

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${API_BASE_URL}/api/settings`);
                setSettings(res.data);
                setScheduleTime(cronToTime(res.data.CRON_SCHEDULE));
            } catch (err) {
                setError('Failed to load settings.');
            }
            setLoading(false);
        };
        fetchSettings();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleTimeChange = (e) => {
        const { name, value } = e.target;
        const newTime = { ...scheduleTime, [name]: value };
        setScheduleTime(newTime);
        setSettings(prev => ({ ...prev, CRON_SCHEDULE: timeToCron(newTime.hour, newTime.ampm) }));
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult({ status: '', message: '' });
        try {
            const res = await axios.post(`${API_BASE_URL}/api/trello/test`, settings);
            setTestResult({ status: 'success', message: res.data.message });
        } catch (err) {
            setTestResult({ status: 'error', message: err.response?.data?.message || 'An unknown error occurred.' });
        }
        setIsTesting(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            await axios.put(`${API_BASE_URL}/api/settings`, settings);
            setSuccess('Settings saved successfully! The scheduler has been updated.');
            if (onSettingsSaved) onSettingsSaved();
        } catch (err) {
            setError('Failed to save settings.');
        }
    };

    if (loading) return <Spinner />;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg max-w-3xl mx-auto">
            <h2 className="text-3xl font-semibold text-slate-800 mb-6">Application Settings</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-lg">Trello Configuration</h3>
                        <button type="button" onClick={handleTestConnection} disabled={isTesting} className="px-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 disabled:bg-slate-50">
                            {isTesting ? 'Testing...' : 'Test Connection'}
                        </button>
                    </div>
                    {testResult.message && (
                        <div className={`p-3 mb-4 rounded-lg text-center text-sm ${testResult.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {testResult.message}
                        </div>
                    )}
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="TRELLO_API_KEY" className="form-label">Trello API Key</label>
                            <input type="password" name="TRELLO_API_KEY" id="TRELLO_API_KEY" value={settings.TRELLO_API_KEY || ''} onChange={handleChange} className="form-input" placeholder="Enter your Trello API Key" />
                        </div>
                        <div>
                            <label htmlFor="TRELLO_API_TOKEN" className="form-label">Trello API Token</label>
                            <input type="password" name="TRELLO_API_TOKEN" id="TRELLO_API_TOKEN" value={settings.TRELLO_API_TOKEN || ''} onChange={handleChange} className="form-input" placeholder="Enter your Trello API Token" />
                        </div>
                        <div>
                            <label htmlFor="TRELLO_BOARD_ID" className="form-label">Trello Board ID</label>
                            <input type="text" name="TRELLO_BOARD_ID" id="TRELLO_BOARD_ID" value={settings.TRELLO_BOARD_ID || ''} onChange={handleChange} className="form-input" />
                        </div>
                        <div>
                            <label htmlFor="TRELLO_LIST_ID" className="form-label">ID for "To Do" List</label>
                            <input type="text" name="TRELLO_LIST_ID" id="TRELLO_LIST_ID" value={settings.TRELLO_LIST_ID || ''} onChange={handleChange} className="form-input" />
                        </div>
                        <div>
                            <label htmlFor="TRELLO_DONE_LIST_ID" className="form-label">ID for "Done" List</label>
                            <input type="text" name="TRELLO_DONE_LIST_ID" id="TRELLO_DONE_LIST_ID" value={settings.TRELLO_DONE_LIST_ID || ''} onChange={handleChange} className="form-input" />
                        </div>
                    </div>
                </div>

                <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg mb-4">Scheduler Configuration</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="form-label">Daily Run Time</label>
                            <div className="flex items-center gap-2">
                                <select name="hour" value={scheduleTime.hour} onChange={handleTimeChange} className="form-input">
                                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                                <select name="ampm" value={scheduleTime.ampm} onChange={handleTimeChange} className="form-input">
                                    <option value="am">AM</option>
                                    <option value="pm">PM</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {error && <p className="text-red-600 bg-red-100 p-3 rounded-lg text-center">{error}</p>}
                {success && <p className="text-green-600 bg-green-100 p-3 rounded-lg text-center">{success}</p>}

                <div className="flex justify-end pt-4">
                    <button type="submit" className="px-6 py-2.5 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 shadow-md">
                        Save Settings
                    </button>
                </div>
            </form>
        </div>
    );
};

// --- Main App Component ---
function App() {
  const [records, setRecords] = useState([]);
  const [trelloMembers, setTrelloMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDates, setShowDates] = useState(false);
  const [triggeringId, setTriggeringId] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('schedules');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [isTrelloConfigured, setIsTrelloConfigured] = useState(true);
  const [statusKey, setStatusKey] = useState(0);
  
  const [filterOwner, setFilterOwner] = useState('all');
  const [filterFrequency, setFilterFrequency] = useState('all');
  const [filterTitle, setFilterTitle] = useState('');

  const formRef = useRef(null);

  const initialFormState = { title: '', owner_name: '', description: '', frequency: 'once', frequency_interval: 1, frequency_details: '1', start_date: '', end_date: '', trigger_hour: '09', trigger_minute: '00', trigger_ampm: 'am' };
  const [formData, setFormData] = useState(initialFormState);

  const checkTrelloConfig = async () => {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/settings`);
        const { isConfigured, TRELLO_BOARD_ID, TRELLO_LIST_ID } = res.data;

        // Use the 'isConfigured' flag from the backend, and check for board/list IDs
        if (isConfigured && TRELLO_BOARD_ID && TRELLO_LIST_ID) {
            setIsTrelloConfigured(true);
            return true;
        } else {
            setIsTrelloConfigured(false);
            return false;
        }
    } catch {
        setIsTrelloConfigured(false);
        return false;
    }
  };

  const fetchRecords = async () => {
    try {
        const recordsRes = await axios.get(`${API_BASE_URL}/api/records`);
        setRecords(recordsRes.data.map(r => ({...r, start_date: r.start_date ? new Date(r.start_date).toISOString().slice(0, 10) : '', end_date: r.end_date ? new Date(r.end_date).toISOString().slice(0, 10) : ''})));
    } catch (err) {
        console.error("Records Fetch Error:", err);
        setError("Failed to load scheduled cards.");
    }
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    const configured = await checkTrelloConfig();
    if (configured) {
        try {
            const membersRes = await axios.get(`${API_BASE_URL}/api/trello/members`);
            setTrelloMembers(membersRes.data);
        } catch (err) {
            setError('Failed to load Trello members. Check server logs and Trello config.');
            console.error("Trello Fetch Error:", err);
        }
    }
    await fetchRecords();
    setIsLoading(false);
  };
  
  useEffect(() => {
    loadInitialData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'weekly_day') {
        const currentDays = formData.frequency_details ? formData.frequency_details.split(',') : [];
        const newDays = checked ? [...currentDays, value] : currentDays.filter(day => day !== value);
        setFormData(prev => ({ ...prev, frequency_details: newDays.sort().join(',') }));
    } else if (name === 'showDates') {
        setShowDates(checked);
        if (!checked) {
            setFormData(prev => ({ ...prev, start_date: '', end_date: '' }));
        }
    } else if (name === 'yearly_month' || name === 'yearly_day') {
        const [currentMonth, currentDay] = (formData.frequency_details || '1-1').split('-');
        const newMonth = name === 'yearly_month' ? value : currentMonth;
        const newDay = name === 'yearly_day' ? value : currentDay;
        setFormData(prev => ({ ...prev, frequency_details: `${newMonth}-${newDay}` }));
    }
    else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.owner_name) {
        setError('Title and Owner are required fields.');
        return;
    }
    
    const method = isEditing ? 'put' : 'post';
    const url = isEditing ? `${API_BASE_URL}/api/records/${selectedRecordId}` : `${API_BASE_URL}/api/records`;
    
    const submissionData = { ...formData };
    if (!['weekly', 'monthly', 'yearly'].includes(submissionData.frequency)) {
        submissionData.frequency_details = '';
    }
    if (!showDates) {
        submissionData.start_date = null;
        submissionData.end_date = null;
    }

    try {
      await axios[method](url, submissionData);
      await fetchRecords();
      resetForm(true);
    } catch (err) {
      setError(`Failed to ${isEditing ? 'update' : 'add'} scheduled card.`);
    }
  };

  const resetForm = (hideForm = false) => {
    setFormData(initialFormState);
    setIsEditing(false);
    setSelectedRecordId(null);
    setShowDates(false);
    setError(null);
    if (hideForm) {
        setIsFormVisible(false);
    }
  };

  const handleEditClick = (record) => {
    setIsEditing(true);
    setSelectedRecordId(record.id);
    const hasDates = !!(record.start_date || record.end_date);
    setShowDates(hasDates);
    setFormData({ ...record, trigger_hour: record.trigger_hour || '09', trigger_minute: record.trigger_minute || '00', trigger_ampm: record.trigger_ampm || 'am' });
    setIsFormVisible(true);
    setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  };
  
  const handleDeleteClick = (record) => {
    setRecordToDelete(record);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    try {
        await axios.delete(`${API_BASE_URL}/api/records/${recordToDelete.id}`);
        await fetchRecords();
    } catch (error) {
        setError("Failed to delete schedule.");
    } finally {
        setShowDeleteModal(false);
        setRecordToDelete(null);
    }
  };

  const handleManualTrigger = async (recordId) => {
    setTriggeringId(recordId);
    try {
        await axios.post(`${API_BASE_URL}/api/records/${recordId}/trigger`);
        await fetchRecords();
    } catch (error) {
        console.error("Manual trigger failed", error);
        setError("Manual trigger failed. Check server logs.");
    } finally {
        setTriggeringId(null);
    }
  };

  const formatFrequency = (record) => {
    const { frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm } = record;
    const interval = parseInt(frequency_interval, 10) || 1;
    let text = '';
    switch (frequency) {
        case 'daily': text = interval === 1 ? 'Daily' : `Every ${interval} days`; break;
        case 'weekly':
            const dayNames = frequency_details ? frequency_details.split(',').map(d => DAYS_OF_WEEK.find(day => day.id === d)?.name).filter(Boolean).join(', ') : '';
            text = interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
            if (dayNames) text += ` on ${dayNames}`;
            break;
        case 'monthly':
            text = interval === 1 ? 'Monthly' : `Every ${interval} months`;
            if (frequency_details) text += ` on the ${frequency_details}`;
            break;
        case 'yearly':
            text = interval === 1 ? 'Yearly' : `Every ${interval} years`;
            if (frequency_details) {
                const [monthId, day] = frequency_details.split('-');
                const monthName = MONTHS_OF_YEAR.find(m => m.id === monthId)?.name;
                if(monthName && day) text += ` on ${monthName} ${day}`;
            }
            break;
        default: text = 'Once';
    }

    if (frequency !== 'once' && trigger_hour && trigger_minute && trigger_ampm) {
        const hour = String(trigger_hour).padStart(2, '0');
        const minute = String(trigger_minute).padStart(2, '0');
        text += ` at ${hour}:${minute} ${trigger_ampm.toUpperCase()}`;
    }
    return text;
  };

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
        const ownerMatch = filterOwner === 'all' || record.owner_name === filterOwner;
        const frequencyMatch = filterFrequency === 'all' || record.frequency === filterFrequency;
        const titleMatch = filterTitle === '' || record.title.toLowerCase().includes(filterTitle.toLowerCase());
        return ownerMatch && frequencyMatch && titleMatch;
    });
  }, [records, filterOwner, filterFrequency, filterTitle]);

  const [yearlyMonth, yearlyDay] = (formData.frequency_details || '1-1').split('-');

  return (
    <div className="bg-slate-100 min-h-screen font-sans text-slate-800">
        {showDeleteModal && (
            <ConfirmationModal 
                message={`Are you sure you want to delete the schedule for "${recordToDelete?.title}"? This cannot be undone.`}
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteModal(false)}
            />
        )}
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="text-center my-8">
          <h1 className="text-5xl font-bold text-slate-900">Trello Card Scheduler</h1>
          <p className="text-slate-500 mt-3 text-lg">Automate Trello card creation on a recurring schedule.</p>
        </header>

        {!isTrelloConfigured && <TrelloConfigBanner onGoToSettings={() => setActiveTab('settings')} />}

        <SchedulerStatus key={statusKey} isConfigured={isTrelloConfigured} onStatusUpdate={() => setStatusKey(prev => prev + 1)} />

        <div className="max-w-5xl mx-auto mb-8">
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('schedules')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'schedules' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                        Schedules
                    </button>
                    <button onClick={() => setActiveTab('audit')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'audit' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                        Audit Log
                    </button>
                    <button onClick={() => setActiveTab('settings')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'settings' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                        Settings
                    </button>
                </nav>
            </div>
        </div>

        {activeTab === 'schedules' && (
            <>
                {!isFormVisible && (
                    <div className="text-center mb-8">
                        <button onClick={() => { resetForm(); setIsFormVisible(true); }} disabled={!isTrelloConfigured} className="flex items-center justify-center mx-auto px-6 py-3 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed">
                            <PlusIcon /> <span className="ml-2">Schedule a New Card</span>
                        </button>
                    </div>
                )}
                
                {isFormVisible && (
                    <div ref={formRef} className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg mb-10 max-w-3xl mx-auto">
                        <h2 className="text-3xl font-semibold text-slate-800 mb-6 border-b border-slate-200 pb-4">{isEditing ? 'Edit Scheduled Card' : 'Schedule a New Card'}</h2>
                        <form onSubmit={handleFormSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="title" className="form-label">Card Title <span className="text-red-500">*</span></label>
                                    <input type="text" name="title" value={formData.title} onChange={handleInputChange} required className="form-input" placeholder="e.g., Review weekly metrics" />
                                </div>
                                <div>
                                    <label htmlFor="owner_name" className="form-label">Assign to Member <span className="text-red-500">*</span></label>
                                    <select name="owner_name" id="owner_name" value={formData.owner_name} onChange={handleInputChange} required className="form-input">
                                        <option value="" disabled>Select a Trello member</option>
                                        {trelloMembers.map(member => <option key={member.id} value={member.fullName}>{member.fullName}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="p-4 border border-slate-200 rounded-lg space-y-4">
                                <h3 className="font-semibold text-lg">Frequency</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="frequency" className="form-label">Repeats</label>
                                        <select name="frequency" value={formData.frequency} onChange={handleInputChange} className="form-input">
                                            <option value="once">Once</option>
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                            <option value="yearly">Yearly</option>
                                        </select>
                                    </div>
                                    {formData.frequency !== 'once' && (
                                        <div>
                                            <label htmlFor="frequency_interval" className="form-label">Repeat Every</label>
                                            <div className="flex items-center">
                                                <input type="number" name="frequency_interval" value={formData.frequency_interval} onChange={handleInputChange} min="1" className="form-input w-20 mr-2" />
                                                <span className="text-slate-600">{formData.frequency}{formData.frequency_interval > 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {formData.frequency === 'weekly' && (
                                    <div>
                                        <label className="form-label">Repeat On</label>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {DAYS_OF_WEEK.map(day => (
                                                <label key={day.id} className="flex items-center space-x-2 cursor-pointer">
                                                    <input type="checkbox" name="weekly_day" value={day.id} checked={formData.frequency_details?.includes(day.id)} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"/>
                                                    <span>{day.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {formData.frequency === 'monthly' && (
                                    <div>
                                        <label htmlFor="frequency_details" className="form-label">Repeat on Day</label>
                                        <select name="frequency_details" value={formData.frequency_details} onChange={handleInputChange} className="form-input">
                                            {DAYS_OF_MONTH.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                )}
                                {formData.frequency === 'yearly' && (
                                    <div>
                                        <label className="form-label">Repeat On</label>
                                        <div className="flex items-center gap-2">
                                            <select name="yearly_month" value={yearlyMonth} onChange={handleInputChange} className="form-input">
                                                {MONTHS_OF_YEAR.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                            </select>
                                            <select name="yearly_day" value={yearlyDay} onChange={handleInputChange} className="form-input">
                                                {DAYS_OF_MONTH.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}
                                {formData.frequency !== 'once' && (
                                    <div>
                                        <label className="form-label">Due at</label>
                                        <div className="flex items-center gap-2">
                                            <select name="trigger_hour" value={formData.trigger_hour} onChange={handleInputChange} className="form-input">
                                                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                            <span>:</span>
                                            <select name="trigger_minute" value={formData.trigger_minute} onChange={handleInputChange} className="form-input">
                                                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                            <select name="trigger_ampm" value={formData.trigger_ampm} onChange={handleInputChange} className="form-input">
                                                <option value="am">AM</option>
                                                <option value="pm">PM</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label htmlFor="description" className="form-label">Card Description</label>
                                <textarea name="description" rows="4" value={formData.description} onChange={handleInputChange} className="form-input" placeholder="Add details to the Trello card description..."></textarea>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex items-center">
                                    <input type="checkbox" id="showDates" name="showDates" checked={showDates} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
                                    <label htmlFor="showDates" className="ml-2 block text-sm text-slate-900">Set start & end date</label>
                                </div>
                                {showDates && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border border-slate-200 rounded-lg">
                                        <div>
                                            <label htmlFor="start_date" className="form-label">Start Date</label>
                                            <input type="date" name="start_date" value={formData.start_date} onChange={handleInputChange} className="form-input" />
                                        </div>
                                        <div>
                                            <label htmlFor="end_date" className="form-label">End Date</label>
                                            <input type="date" name="end_date" value={formData.end_date} onChange={handleInputChange} className="form-input" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {error && <p className="text-red-600 bg-red-100 p-3 rounded-lg text-center">{error}</p>}

                            <div className="flex items-center justify-end space-x-4 pt-4">
                                <button type="button" onClick={() => resetForm(true)} className="px-6 py-2.5 rounded-lg bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300">Cancel</button>
                                <button type="submit" disabled={isLoading} className="flex items-center justify-center px-6 py-2.5 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 disabled:bg-sky-300 shadow-md">
                                    {isLoading ? 'Saving...' : (isEditing ? 'Update Schedule' : 'Schedule Card')}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl font-semibold text-slate-800 mb-6 text-center">Currently Scheduled Cards</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
                        <input type="text" placeholder="Search by title..." value={filterTitle} onChange={e => setFilterTitle(e.target.value)} className="form-input md:col-span-1" />
                        <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} className="form-input">
                            <option value="all">All Assignees</option>
                            {trelloMembers.map(member => <option key={member.id} value={member.fullName}>{member.fullName}</option>)}
                        </select>
                        <select value={filterFrequency} onChange={e => setFilterFrequency(e.target.value)} className="form-input">
                            <option value="all">All Frequencies</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                            <option value="once">Once</option>
                        </select>
                    </div>
                    {isLoading ? <Spinner /> : (
                        <div className="space-y-4">
                            {filteredRecords.map(record => (
                                <div key={record.id} className="bg-white p-5 rounded-xl shadow-md hover:shadow-xl transition-shadow">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800">{record.title}</h3>
                                            <p className="text-slate-500 mt-1">{record.description}</p>
                                            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-3 text-sm text-slate-600">
                                                <span className="bg-sky-100 text-sky-800 px-3 py-1 rounded-full font-medium">{formatFrequency(record)}</span>
                                                <span>|</span>
                                                <span>Assignee: <span className="font-semibold">{record.owner_name}</span></span>
                                                {record.active_card_id && (
                                                    <>
                                                        <span>|</span>
                                                        <a href={`https://trello.com/c/${record.active_card_id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline">
                                                            Active Card: {record.active_card_id.substring(0,8)}...
                                                        </a>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                                            <button onClick={() => handleManualTrigger(record.id)} disabled={triggeringId === record.id} className="text-xs font-semibold bg-green-100 text-green-800 px-3 py-1 rounded-full hover:bg-green-200 disabled:bg-slate-200">
                                                {triggeringId === record.id ? 'Creating...' : 'Create Now'}
                                            </button>
                                            <button onClick={() => handleEditClick(record)} className="p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                            <button onClick={() => handleDeleteClick(record)} className="p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </>
        )}

        {activeTab === 'audit' && <AuditLogViewer />}
        {activeTab === 'settings' && <SettingsPage onSettingsSaved={() => { setStatusKey(prev => prev + 1); loadInitialData(); }} />}

        <style jsx global>{` .form-label { @apply block text-sm font-medium text-slate-600 mb-1; } `}</style>
      </main>
    </div>
  );
}

export default App;