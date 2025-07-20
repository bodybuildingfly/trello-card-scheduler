import React, { useState, useEffect } from 'react';
import apiClient from '../api';

// --- Helper Components ---
const Spinner = () => <div className="flex justify-center items-center p-10"><div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div></div>;

/**
 * @description A page for administrators to configure application settings.
 * @param {object} props - The component props.
 * @param {function} props.onSettingsSaved - A callback function to run after settings are successfully saved.
 */
const SettingsPage = ({ onSettingsSaved }) => {
    // --- State Management ---
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Step 1: Credentials State
    const [apiKey, setApiKey] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState({ status: '', message: '' });
    const [areCredentialsSaved, setAreCredentialsSaved] = useState(false);

    // Step 2: Board/List State
    const [boards, setBoards] = useState([]);
    const [lists, setLists] = useState([]);
    const [isLoadingBoards, setIsLoadingBoards] = useState(false);
    const [isLoadingLists, setIsLoadingLists] = useState(false);
    
    // Step 3: Combined Form State
    const [formData, setFormData] = useState({
        TRELLO_BOARD_ID: '',
        TRELLO_TO_DO_LIST_ID: '',
        TRELLO_DONE_LIST_ID: '',
        CRON_SCHEDULE: '0 1 * * *',
    });

    // --- Helper Functions ---
    const cronToTime = (cronString) => {
        const parts = (cronString || '0 1 * * *').split(' ');
        if (parts.length < 2) return { hour: '01', minute: '00', ampm: 'am' };
        
        const minute = String(parts[0]).padStart(2, '0');
        const hour24 = parseInt(parts[1], 10);
        const ampm = hour24 >= 12 ? 'pm' : 'am';
        let hour12 = hour24 % 12;
        if (hour12 === 0) hour12 = 12;
        
        return { hour: String(hour12).padStart(2, '0'), minute, ampm };
    };

    const timeToCron = (hour12, minute, ampm) => {
        let hour24 = parseInt(hour12, 10);
        if (ampm === 'pm' && hour24 !== 12) hour24 += 12;
        if (ampm === 'am' && hour24 === 12) hour24 = 0;
        
        return `${parseInt(minute, 10)} ${hour24} * * *`;
    };

    // --- Data Fetching ---
    useEffect(() => {
        const fetchInitialSettings = async () => {
            setIsLoading(true);
            try {
                const res = await apiClient.get('/api/settings');
                setAreCredentialsSaved(res.data.areCredentialsSaved);
                setFormData({
                    TRELLO_BOARD_ID: res.data.TRELLO_BOARD_ID || '',
                    TRELLO_TO_DO_LIST_ID: res.data.TRELLO_TO_DO_LIST_ID || '',
                    TRELLO_DONE_LIST_ID: res.data.TRELLO_DONE_LIST_ID || '',
                    CRON_SCHEDULE: res.data.CRON_SCHEDULE || '0 1 * * *',
                });
            } catch (err) {
                setError('Failed to load settings.');
            }
            setIsLoading(false);
        };
        fetchInitialSettings();
    }, []);

    useEffect(() => {
        if (areCredentialsSaved) {
            setIsLoadingBoards(true);
            apiClient.get('/api/trello/boards')
                .then(res => setBoards(res.data))
                .catch(() => setError('Could not fetch Trello boards. Please check credentials.'))
                .finally(() => setIsLoadingBoards(false));
        }
    }, [areCredentialsSaved]);

    useEffect(() => {
        if (formData.TRELLO_BOARD_ID) {
            setIsLoadingLists(true);
            apiClient.get(`/api/trello/lists/${formData.TRELLO_BOARD_ID}`)
                .then(res => {
                    setLists(res.data);
                })
                .catch(() => setError('Could not fetch lists for the selected board.'))
                .finally(() => setIsLoadingLists(false));
        }
    }, [formData.TRELLO_BOARD_ID]);

    // --- Event Handlers ---
    const handleCredentialTest = async () => {
        setIsTesting(true);
        setTestResult({ status: '', message: '' });
        try {
            const res = await apiClient.post('/api/trello/credentials/test', { apiKey, apiToken });
            setTestResult({ status: 'success', message: res.data.message });
        } catch (err) {
            setTestResult({ status: 'error', message: err.response?.data?.message || 'An unknown error occurred.' });
        }
        setIsTesting(false);
    };

    const handleCredentialSave = async () => {
        try {
            await apiClient.put('/api/settings/credentials', { TRELLO_API_KEY: apiKey, TRELLO_API_TOKEN: apiToken });
            setSuccess('Credentials saved successfully!');
            setAreCredentialsSaved(true);
            setApiKey('');
            setApiToken('');
            setTestResult({ status: '', message: '' });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save credentials.');
        }
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTimeChange = (e) => {
        const { name, value } = e.target;
        const currentTime = cronToTime(formData.CRON_SCHEDULE);
        const newTime = { ...currentTime, [name]: value };
        setFormData(prev => ({ ...prev, CRON_SCHEDULE: timeToCron(newTime.hour, newTime.minute, newTime.ampm) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            await apiClient.put('/api/settings', formData);
            setSuccess('Settings saved successfully! The scheduler has been updated.');
            if (onSettingsSaved) onSettingsSaved();
        } catch (err) {
            setError('Failed to save settings.');
        }
    };

    if (isLoading) return <Spinner />;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg max-w-3xl mx-auto">
            <h2 className="text-3xl font-semibold text-slate-800 mb-6">Application Settings</h2>
            <form onSubmit={handleSubmit} className="space-y-8">
                {/* --- Step 1: Credentials --- */}
                <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg mb-1">Step 1: Trello Credentials</h3>
                    <p className="text-sm text-slate-500 mb-4">Securely connect to your Trello account.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="form-label">Trello API Key</label>
                            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="form-input" placeholder={areCredentialsSaved ? 'Saved (update if needed)' : 'Enter your Trello API Key'} />
                        </div>
                        <div>
                            <label className="form-label">Trello API Token</label>
                            <input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} className="form-input" placeholder={areCredentialsSaved ? 'Saved (update if needed)' : 'Enter your Trello API Token'} />
                        </div>
                        {testResult.message && (
                            <div className={`p-3 rounded-lg text-center text-sm ${testResult.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {testResult.message}
                            </div>
                        )}
                        <div className="flex justify-end space-x-2">
                             <button type="button" onClick={handleCredentialTest} disabled={isTesting || !apiKey || !apiToken} className="form-button-secondary">
                                {isTesting ? 'Testing...' : 'Test Connection'}
                            </button>
                            <button type="button" onClick={handleCredentialSave} disabled={!apiKey || !apiToken} className="form-button-primary">Save Credentials</button>
                        </div>
                    </div>
                </div>

                {/* --- Step 2: Board & List Selection --- */}
                <div className={`p-4 border rounded-lg ${!areCredentialsSaved && 'opacity-50'}`}>
                    <h3 className="font-semibold text-lg mb-1">Step 2: Target Board and Lists</h3>
                    <p className="text-sm text-slate-500 mb-4">Choose where to create and track cards.</p>
                    {!areCredentialsSaved && <p className="text-center text-sm text-slate-500 p-4">Please save your credentials first.</p>}
                    <div className={`space-y-4 ${!areCredentialsSaved && 'pointer-events-none'}`}>
                         <div>
                            <label htmlFor="TRELLO_BOARD_ID" className="form-label">Trello Board</label>
                            <select name="TRELLO_BOARD_ID" id="TRELLO_BOARD_ID" value={formData.TRELLO_BOARD_ID} onChange={handleFormChange} className="form-input" disabled={isLoadingBoards}>
                                <option value="">{isLoadingBoards ? 'Loading...' : 'Select a Board'}</option>
                                {boards.map(board => <option key={board.id} value={board.id}>{board.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="TRELLO_TO_DO_LIST_ID" className="form-label">ID for "To Do" List</label>
                             <select name="TRELLO_TO_DO_LIST_ID" id="TRELLO_TO_DO_LIST_ID" value={formData.TRELLO_TO_DO_LIST_ID} onChange={handleFormChange} className="form-input" disabled={isLoadingLists || !formData.TRELLO_BOARD_ID}>
                                <option value="">{isLoadingLists ? 'Loading...' : 'Select a List'}</option>
                                {lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="TRELLO_DONE_LIST_ID" className="form-label">ID for "Done" List</label>
                             <select name="TRELLO_DONE_LIST_ID" id="TRELLO_DONE_LIST_ID" value={formData.TRELLO_DONE_LIST_ID} onChange={handleFormChange} className="form-input" disabled={isLoadingLists || !formData.TRELLO_BOARD_ID}>
                                <option value="">{isLoadingLists ? 'Loading...' : 'Select a List'}</option>
                                {lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                
                {/* --- Step 3: Scheduler Configuration --- */}
                <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg mb-1">Step 3: Scheduler Configuration</h3>
                    <p className="text-sm text-slate-500 mb-4">Set the time of day for the scheduler to run.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="form-label">Daily Run Time</label>
                            <div className="flex items-center gap-2">
                                <select 
                                    name="hour" 
                                    value={cronToTime(formData.CRON_SCHEDULE).hour} 
                                    onChange={handleTimeChange} 
                                    className="form-input"
                                >
                                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                                <span>:</span>
                                <select 
                                    name="minute" 
                                    value={cronToTime(formData.CRON_SCHEDULE).minute} 
                                    onChange={handleTimeChange} 
                                    className="form-input"
                                >
                                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <select 
                                    name="ampm" 
                                    value={cronToTime(formData.CRON_SCHEDULE).ampm} 
                                    onChange={handleTimeChange} 
                                    className="form-input"
                                >
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
                    <button type="submit" disabled={!areCredentialsSaved} className="form-button-primary w-full sm:w-auto">
                        Save All Settings
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SettingsPage;