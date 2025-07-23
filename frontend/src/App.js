/**
 * @file frontend/src/App.js
 * @description The ThemeToggle component has been added to the sidebar footer.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';

// --- Component Imports ---
import SettingsPage from './components/SettingsPage';
import SchedulerStatus from './components/SchedulerStatus';
import AuditLogViewer from './components/AuditLogViewer';
import ConfirmationModal from './components/ConfirmationModal';
import TrelloConfigBanner from './components/TrelloConfigBanner';
import ScheduleList from './components/ScheduleList';
import ScheduleForm from './components/ScheduleForm';
import ProtectedRoute from './components/ProtectedRoute';
import UserManagementPage from './components/UserManagementPage';
import DashboardPage from './components/DashboardPage';
import ThemeToggle from './components/ThemeToggle'; // Import the new component

// --- Service & Context Imports ---
import apiClient from './api';
import { useAuth } from './context/AuthContext';
import { useSchedules } from './context/SchedulesContext';

// --- Helper Icon Imports ---
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>;
const AuditLogIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>;
const UsersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;
const DashboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>;

/**
 * @description A placeholder component to display in the main content area.
 */
const WelcomeScreen = () => (
    <div className="flex flex-col items-center justify-center h-full text-center text-text-muted">
        <h2 className="text-3xl font-bold mb-2">Trello Card Scheduler</h2>
        <p>Select a schedule on the left to view its details, or click "Schedule a New Card" to begin.</p>
    </div>
);

/**
 * @description The main application component.
 */
function App() {
    // --- State Management ---
    const { 
        schedules, 
        trelloMembers, 
        trelloLabels, 
        categories, 
        isLoading, 
        error: dataError,
        loadAllData 
    } = useSchedules();
    
    const [appVersion, setAppVersion] = useState('');
    const [activeView, setActiveView] = useState('welcome');
    const [expandedItemId, setExpandedItemId] = useState(null);
    const [formError, setFormError] = useState(null);

    // Form-related state
    const [isEditing, setIsEditing] = useState(false);
    const [selectedScheduleId, setSelectedScheduleId] = useState(null);
    const initialFormState = { title: '', owner_name: '', description: '', category: '', frequency: 'daily', frequency_interval: 1, frequency_details: '1', start_date: '', end_date: '', trigger_hour: '09', trigger_minute: '00', trigger_ampm: 'am', trello_label_id: '', is_active: true };
    const [formData, setFormData] = useState(initialFormState);

    // Modal-related state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [scheduleToDelete, setScheduleToDelete] = useState(null);

    // Other state
    const [isTrelloConfigured, setIsTrelloConfigured] = useState(true);
    const [statusKey, setStatusKey] = useState(0);
    const [triggeringId, setTriggeringId] = useState(null);
    const [collapsedCategories, setCollapsedCategories] = useState(() => {
        try {
            const item = window.localStorage.getItem('collapsedCategories');
            return item ? JSON.parse(item) : {};
        } catch (error) {
            console.error(error);
            return {};
        }
    });

    // Filter state
    const [filterOwner, setFilterOwner] = useState('all');
    const [filterFrequency, setFilterFrequency] = useState('all');
    const [filterTitle, setFilterTitle] = useState('');

    const { isAuthenticated, user, logout, isAdmin } = useAuth();

    const filteredAndGroupedSchedules = useMemo(() => {
        const filtered = {};
        for (const category in schedules) {
            const filteredSchedules = schedules[category].filter(schedule => {
                const ownerMatch = filterOwner === 'all' || schedule.owner_name === filterOwner;
                const frequencyMatch = filterFrequency === 'all' || schedule.frequency === filterFrequency;
                const titleMatch = filterTitle === '' || schedule.title.toLowerCase().includes(filterTitle.toLowerCase());
                return ownerMatch && frequencyMatch && titleMatch;
            });
            if (filteredSchedules.length > 0) {
                filtered[category] = filteredSchedules;
            }
        }
        return filtered;
    }, [schedules, filterOwner, filterFrequency, filterTitle]);

    // --- Data Fetching and Lifecycle ---
    useEffect(() => {
        apiClient.get('/api/version')
            .then(res => setAppVersion(res.data.version))
            .catch(err => console.error("Could not fetch app version", err));
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            loadAllData();
        }
    }, [isAuthenticated, loadAllData]);

    useEffect(() => {
        const checkConfig = async () => {
            try {
                const res = await apiClient.get('/api/settings');
                setIsTrelloConfigured(res.data.isConfigured);
            } catch {
                setIsTrelloConfigured(false);
            }
        };
        if (isAuthenticated) {
            checkConfig();
        }
    }, [isAuthenticated, schedules]);

    useEffect(() => {
        try {
            window.localStorage.setItem('collapsedCategories', JSON.stringify(collapsedCategories));
        } catch (error) {
            console.error(error);
        }
    }, [collapsedCategories]);

    // --- Event Handlers ---
    const handleFormSubmit = async (submittedFormData, setError) => {
        try {
          const dataToSubmit = {
            ...submittedFormData,
            frequency_interval: parseInt(submittedFormData.frequency_interval, 10)
          };
    
          await apiClient[isEditing ? 'put' : 'post'](
              isEditing ? `/api/schedules/${selectedScheduleId}` : '/api/schedules',
              dataToSubmit
          );
          await loadAllData();
          resetForm(true);
        } catch (err) {
            if (err.response?.data?.errors) {
                const formattedErrors = err.response.data.errors.map(e => e.message).join(' ');
                setError(formattedErrors);
            } else {
                setError(`Failed to ${isEditing ? 'update' : 'add'} schedule.`);
            }
        }
    };

    const resetForm = (hideForm = false) => {
        setFormData(initialFormState);
        setIsEditing(false);
        setSelectedScheduleId(null);
        setFormError(null);
        if (hideForm) {
            setActiveView('welcome');
            setExpandedItemId(null);
        }
    };

    const handleItemSelect = (schedule) => {
        setIsEditing(true);
        setSelectedScheduleId(schedule.id);
        setFormData({ ...initialFormState, ...schedule });
        setActiveView('form');
        setExpandedItemId(prevId => (prevId === schedule.id ? null : schedule.id));
    };
    
    const handleDeleteClick = (schedule) => {
        setScheduleToDelete(schedule);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!scheduleToDelete) return;
        try {
            await apiClient.delete(`/api/schedules/${scheduleToDelete.id}`);
            await loadAllData();
        } catch (error) {
            setFormError("Failed to delete schedule.");
        } finally {
            setShowDeleteModal(false);
            setScheduleToDelete(null);
        }
    };
    
    const handleManualTrigger = async (scheduleId) => {
        setTriggeringId(scheduleId);
        try {
            const { data: newCard } = await apiClient.post(`/api/schedules/${scheduleId}/trigger`);
            setFormData(prev => ({ ...prev, active_card_id: newCard.id }));
            await loadAllData();
        } catch (error) {
            console.error("Manual trigger failed", error);
            setFormError("Manual trigger failed. Check server logs.");
        } finally {
            setTriggeringId(null);
        }
    };

    const handleCloneClick = async (scheduleId) => {
        try {
            await apiClient.post(`/api/schedules/${scheduleId}/clone`);
            await loadAllData();
        } catch (error) {
            console.error("Clone failed", error);
            setFormError("Failed to clone schedule. Check server logs.");
        }
    };

    const toggleCategory = (categoryName) => {
        setCollapsedCategories(prev => ({
            ...prev,
            [categoryName]: !prev[categoryName]
        }));
    };

    const handleToggleActive = async (scheduleId, newStatus) => {
        await apiClient.put(`/api/schedules/${scheduleId}/toggle-active`, { is_active: newStatus });
        await loadAllData();
    };

    return (
        <ProtectedRoute>
            <div className="h-screen w-screen font-sans text-text-primary grid grid-cols-12">
                {showDeleteModal && (
                    <ConfirmationModal 
                        message={`Are you sure you want to delete the schedule for "${scheduleToDelete?.title}"? This cannot be undone.`}
                        onConfirm={confirmDelete}
                        onCancel={() => setShowDeleteModal(false)}
                    />
                )}

                {/* --- Left Sidebar --- */}
                <aside className="col-span-4 bg-surface border-r border-border-color flex flex-col h-screen">
                    <div className="p-6 flex-shrink-0">
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-bold text-text-primary">Trello Scheduler</h1>
                            {appVersion && (
                                <a 
                                    href="https://github.com/bodybuildingfly/trello-card-scheduler" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-text-muted mt-1 hover:text-text-accent hover:underline"
                                >
                                    Version {appVersion}
                                </a>
                            )}
                        </div>

                        <div className="mb-6">
                            <button 
                                onClick={() => { resetForm(); setActiveView('form'); }} 
                                disabled={!isTrelloConfigured} 
                                className="w-full flex items-center justify-center px-4 py-3 rounded-lg bg-primary text-primary-text font-semibold hover:bg-primary-hover shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <PlusIcon /> <span className="ml-2">Schedule a New Card</span>
                            </button>
                        </div>
                    </div>

                    <div className="px-6 pb-4 flex-shrink-0">
                        <div className="p-4 bg-surface-muted rounded-lg">
                            <h3 className="font-semibold text-text-secondary mb-2">Filters</h3>
                            <div className="space-y-2">
                                <input type="text" placeholder="Search by title..." value={filterTitle} onChange={e => setFilterTitle(e.target.value)} className="form-input" />
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
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto min-h-0 px-6">
                        <ScheduleList 
                            schedules={filteredAndGroupedSchedules}
                            isLoading={isLoading}
                            triggeringId={triggeringId}
                            expandedItemId={expandedItemId}
                            onItemSelect={handleItemSelect}
                            onDeleteClick={handleDeleteClick}
                            onCloneClick={handleCloneClick}
                            onManualTrigger={handleManualTrigger}
                            collapsedCategories={collapsedCategories}
                            onToggleCategory={toggleCategory}
                        />
                    </div>

                    {/* --- Admin & User Section --- */}
                    <div className="p-6 flex-shrink-0 pt-6 border-t border-border-color">
                        {isAdmin && (
                            <nav className="space-y-2 mb-4">
                                <p className="px-3 text-xs font-semibold uppercase text-text-muted">Admin</p>
                                <button onClick={() => setActiveView('dashboard')} className={`w-full flex items-center px-3 py-2 text-text-secondary hover:bg-surface-hover rounded-md ${activeView === 'dashboard' && 'bg-surface-hover font-bold'}`}>
                                    <DashboardIcon /> <span className="ml-3">Dashboard</span>
                                </button>
                                <button onClick={() => setActiveView('settings')} className={`w-full flex items-center px-3 py-2 text-text-secondary hover:bg-surface-hover rounded-md ${activeView === 'settings' && 'bg-surface-hover font-bold'}`}>
                                    <SettingsIcon /> <span className="ml-3">Settings</span>
                                </button>
                                <button onClick={() => setActiveView('audit')} className={`w-full flex items-center px-3 py-2 text-text-secondary hover:bg-surface-hover rounded-md ${activeView === 'audit' && 'bg-surface-hover font-bold'}`}>
                                    <AuditLogIcon /> <span className="ml-3">Audit Log</span>
                                </button>
                                <button onClick={() => setActiveView('users')} className={`w-full flex items-center px-3 py-2 text-text-secondary hover:bg-surface-hover rounded-md ${activeView === 'users' && 'bg-surface-hover font-bold'}`}>
                                    <UsersIcon /> <span className="ml-3">User Management</span>
                                </button>
                            </nav>
                        )}
                        <div className="grid grid-cols-3 items-center">
                            <div />
                            <div className="text-center">
                                <p className="text-sm text-text-secondary">Signed in as <span className="font-bold">{user?.username}</span></p>
                                <button onClick={logout} className="text-sm text-text-accent hover:underline">Logout</button>
                            </div>
                            <div className="flex justify-end">
                                <ThemeToggle />
                            </div>
                        </div>
                    </div>
                </aside>

                {/* --- Main Content Area --- */}
                <main className="col-span-8 p-8 overflow-y-auto">
                    {(dataError || formError) && (
                        <div className="bg-danger-surface border-l-4 border-danger text-danger-text p-4 rounded-lg mb-6" role="alert">
                            <p className="font-bold">An Error Occurred</p>
                            <p>{dataError || formError}</p>
                        </div>
                    )}
                    {!isTrelloConfigured && <TrelloConfigBanner onGoToSettings={() => setActiveView('settings')} />}
                    <SchedulerStatus key={statusKey} isConfigured={isTrelloConfigured} onStatusUpdate={() => setStatusKey(prev => prev + 1)} />
                    
                    <div className="mt-8">
                        {activeView === 'welcome' && <WelcomeScreen />}
                        {activeView === 'form' && (
                            <ScheduleForm
                                isEditing={isEditing}
                                initialData={formData}
                                trelloMembers={trelloMembers}
                                trelloLabels={trelloLabels}
                                categories={categories}
                                isLoading={isLoading}
                                triggeringId={triggeringId}
                                onSubmit={handleFormSubmit}
                                onCancel={() => resetForm(true)}
                                onManualTrigger={handleManualTrigger}
                                onToggleActive={handleToggleActive}
                            />
                        )}
                        {isAdmin && activeView === 'dashboard' && <DashboardPage />}
                        {isAdmin && activeView === 'audit' && <AuditLogViewer />}
                        {isAdmin && activeView === 'settings' && <SettingsPage onSettingsSaved={() => { setStatusKey(prev => prev + 1); loadAllData(); }} />}
                        {isAdmin && activeView === 'users' && <UserManagementPage />}
                    </div>
                </main>
            </div>
        </ProtectedRoute>
    );
}

export default App;