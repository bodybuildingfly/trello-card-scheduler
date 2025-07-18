import React, { useState, useEffect, useCallback, useRef } from 'react';
import SettingsPage from './components/SettingsPage';
import SchedulerStatus from './components/SchedulerStatus';
import AuditLogViewer from './components/AuditLogViewer';
import ConfirmationModal from './components/ConfirmationModal';
import TrelloConfigBanner from './components/TrelloConfigBanner';
import ScheduleList from './components/ScheduleList';
import ScheduleForm from './components/ScheduleForm';
import apiClient from './api';

// --- Helper Components & Data ---
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

// --- Main App Component ---
function App() {
  const [records, setRecords] = useState([]);
  const [trelloMembers, setTrelloMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setError] = useState(null);
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
  
  const formRef = useRef(null);

  const initialFormState = { title: '', owner_name: '', description: '', frequency: 'once', frequency_interval: 1, frequency_details: '1', start_date: '', end_date: '', trigger_hour: '09', trigger_minute: '00', trigger_ampm: 'am' };
  const [formData, setFormData] = useState(initialFormState);

  const checkTrelloConfig = useCallback(async () => {
    try {
        const res = await apiClient.get('/api/settings');
        const { isConfigured, TRELLO_BOARD_ID, TRELLO_TO_DO_LIST_ID } = res.data;

        // Use the 'isConfigured' flag from the backend, and check for board/list IDs
        if (isConfigured && TRELLO_BOARD_ID && TRELLO_TO_DO_LIST_ID) {
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
  }, [setIsTrelloConfigured]);

  const fetchRecords = useCallback(async () => {
    try {
        const recordsRes = await apiClient.get('/api/records');
        setRecords(recordsRes.data.map(r => ({...r, start_date: r.start_date ? new Date(r.start_date).toISOString().slice(0, 10) : '', end_date: r.end_date ? new Date(r.end_date).toISOString().slice(0, 10) : ''})));
    } catch (err) {
        console.error("Records Fetch Error:", err);
        setError("Failed to load scheduled cards.");
    }
  }, [setError]);

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
  }, [checkTrelloConfig, fetchRecords, setError, setTrelloMembers, setIsLoading])
  
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.owner_name) {
        setError('Title and Owner are required fields.');
        return;
    }
    
    const method = isEditing ? 'put' : 'post';
    const url = isEditing ? `/api/records/${selectedRecordId}` : '/api/records';
    
    const submissionData = { ...formData };
    if (!['weekly', 'monthly', 'yearly'].includes(submissionData.frequency)) {
        submissionData.frequency_details = '';
    }
    if (!showDates) {
        submissionData.start_date = null;
        submissionData.end_date = null;
    }

    try {
      await apiClient[method](url, submissionData);
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
        await apiClient.delete(`/api/records/${recordToDelete.id}`);
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
        await apiClient.post(`/api/records/${recordId}/trigger`);
        await fetchRecords();
    } catch (error) {
        console.error("Manual trigger failed", error);
        setError("Manual trigger failed. Check server logs.");
    } finally {
        setTriggeringId(null);
    }
  };

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
                    triggeringId={triggeringId}
                    onEditClick={handleEditClick}
                    onDeleteClick={handleDeleteClick}
                    onManualTrigger={handleManualTrigger}
                />
            </>
        )}

        {activeTab === 'audit' && <AuditLogViewer />}
        {activeTab === 'settings' && <SettingsPage onSettingsSaved={() => { setStatusKey(prev => prev + 1); loadInitialData(); }} />}
      </main>
    </div>
  );
}

export default App;