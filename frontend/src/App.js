import React, { useState, useEffect, useCallback } from 'react';

// --- Component Imports ---
import SettingsPage from './components/SettingsPage';
import SchedulerStatus from './components/SchedulerStatus';
import AuditLogViewer from './components/AuditLogViewer';
import ConfirmationModal from './components/ConfirmationModal';
import TrelloConfigBanner from './components/TrelloConfigBanner';
import ScheduleList from './components/ScheduleList';
import ScheduleForm from './components/ScheduleForm';
import ProtectedRoute from './components/ProtectedRoute';
import UserManagementPage from './components/UserManagementPage'; // <-- NEW: Import UserManagementPage

// --- Service & Context Imports ---
import apiClient from './api';
import { useAuth } from './context/AuthContext';

// --- Helper Icon Imports ---
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

/**
 * @description The main application component. It acts as a container for all other components
 * and manages the primary application state that needs to be shared between them.
 */
function App() {
    // --- State Management ---
    const [records, setRecords] = useState([]);
    const [trelloMembers, setTrelloMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('schedules'); // Default to 'schedules'

    // Form-related state
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState(null);
    const [formData, setFormData] = useState({ title: '', owner_name: '', description: '', frequency: 'once', frequency_interval: 1, frequency_details: '1', start_date: '', end_date: '', trigger_hour: '09', trigger_minute: '00', trigger_ampm: 'am' });

    // Modal-related state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState(null);

    // Other state
    const [isTrelloConfigured, setIsTrelloConfigured] = useState(true);
    const [statusKey, setStatusKey] = useState(0); // Used to force-refresh the status component

    const { isAuthenticated, user, logout } = useAuth(); // Get auth status and user info

    // --- Data Fetching and Lifecycle ---

    const fetchRecords = useCallback(async () => {
        try {
            const recordsRes = await apiClient.get('/api/records');
            setRecords(recordsRes.data.map(r => ({...r, start_date: r.start_date ? new Date(r.start_date).toISOString().slice(0, 10) : '', end_date: r.end_date ? new Date(r.end_date).toISOString().slice(0, 10) : ''})));
        } catch (err) {
            console.error("Records Fetch Error:", err);
            setError("Failed to load scheduled cards.");
        }
    }, [setError]);

    const checkTrelloConfig = useCallback(async () => {
        try {
            const res = await apiClient.get('/api/settings');
            const { isConfigured, TRELLO_BOARD_ID, TRELLO_LIST_ID } = res.data;
            const configured = isConfigured && TRELLO_BOARD_ID && TRELLO_LIST_ID;
            setIsTrelloConfigured(configured);
            return configured;
        } catch {
            setIsTrelloConfigured(false);
            return false;
        }
    }, [setIsTrelloConfigured]);

    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const configured = await checkTrelloConfig();
        if (configured) {
            try {
                const membersRes = await apiClient.get('/api/trello/members');
                setTrelloMembers(membersRes.data);
            } catch (err) {
                setError('Failed to load Trello members. Check server logs and Trello config.');
                console.error("Trello Fetch Error:", err);
            }
        }
        await fetchRecords();
        setIsLoading(false);
    }, [checkTrelloConfig, fetchRecords, setError, setIsLoading, setTrelloMembers]);
    
    // Load data only when the user is authenticated.
    useEffect(() => {
        if (isAuthenticated) {
            loadInitialData();
        }
    }, [isAuthenticated, loadInitialData]);

    // --- Event Handlers ---

    const handleFormSubmit = async (submittedFormData) => {
        setIsLoading(true);
        const method = isEditing ? 'put' : 'post';
        const url = isEditing ? `/api/records/${selectedRecordId}` : '/api/records';
        
        try {
          await apiClient[method](url, submittedFormData);
          await fetchRecords();
          resetForm(true);
        } catch (err) {
          setError(`Failed to ${isEditing ? 'update' : 'add'} scheduled card.`);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = (hideForm = false) => {
        setFormData({ title: '', owner_name: '', description: '', frequency: 'once', frequency_interval: 1, frequency_details: '1', start_date: '', end_date: '', trigger_hour: '09', trigger_minute: '00', trigger_ampm: 'am' });
        setIsEditing(false);
        setSelectedRecordId(null);
        setError(null);
        if (hideForm) {
            setIsFormVisible(false);
        }
    };

    const handleEditClick = (record) => {
        setIsEditing(true);
        setSelectedRecordId(record.id);
        setFormData({ ...record, trigger_hour: record.trigger_hour || '09', trigger_minute: record.trigger_minute || '00', trigger_ampm: record.trigger_ampm || 'am' });
        setIsFormVisible(true);
    };
    
    const handleDeleteClick = (record) => {
        setRecordToDelete(record);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!recordToDelete) return;
        try {
            await apiClient.delete(`/api/records/${recordToDelete.id}`);
            await fetchRecords();
        } catch (error) {
            setError("Failed to delete schedule.");
        } finally {
            setShowDeleteModal(false);
            setRecordToDelete(null);
        }
    };

    return (
        <ProtectedRoute>
            {/* Everything inside this ProtectedRoute component will only be rendered if the user is logged in. */}
            {/* Otherwise, the LoginPage will be rendered automatically. */}
            <div className="bg-slate-100 min-h-screen font-sans text-slate-800">
                {showDeleteModal && (
                    <ConfirmationModal 
                        message={`Are you sure you want to delete the schedule for "${recordToDelete?.title}"? This cannot be undone.`}
                        onConfirm={confirmDelete}
                        onCancel={() => setShowDeleteModal(false)}
                    />
                )}
                <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                    <header className="my-8">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-5xl font-bold text-slate-900">Trello Card Scheduler</h1>
                                <p className="text-slate-500 mt-3 text-lg">Automate Trello card creation on a recurring schedule.</p>
                            </div>
                            <div className="text-right">
                                <p className="text-slate-600">Signed in as <span className="font-bold">{user?.username}</span></p>
                                <button onClick={logout} className="text-sm text-sky-600 hover:text-sky-800 hover:underline">Logout</button>
                            </div>
                        </div>
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
                                {/* NEW: User Management Tab - visible only to admins */}
                                {user?.role === 'admin' && (
                                    <button onClick={() => setActiveTab('users')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'users' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                                        User Management
                                    </button>
                                )}
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
                                <ScheduleForm
                                    isEditing={isEditing}
                                    initialData={formData}
                                    trelloMembers={trelloMembers}
                                    isLoading={isLoading}
                                    onSubmit={handleFormSubmit}
                                    onCancel={() => resetForm(true)}
                                />
                            )}

                            <ScheduleList 
                                records={records}
                                trelloMembers={trelloMembers}
                                isLoading={isLoading}
                                triggeringId={null} // This state should be managed in App.js if needed
                                onEditClick={handleEditClick}
                                onDeleteClick={handleDeleteClick}
                                onManualTrigger={() => {}} // This should be implemented in App.js
                            />
                        </>
                    )}

                    {activeTab === 'audit' && user?.role === 'admin' && <AuditLogViewer />}
                    {activeTab === 'settings' && user?.role === 'admin' && <SettingsPage onSettingsSaved={() => { setStatusKey(prev => prev + 1); loadInitialData(); }} />}
                    {activeTab === 'users' && user?.role === 'admin' && <UserManagementPage />}
                </main>
            </div>
        </ProtectedRoute>
    );
}

export default App;