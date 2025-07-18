import React, { useState, useMemo } from 'react';

// --- Helper Components & Data (Copied from App.js) ---
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 hover:text-blue-700"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 hover:text-red-700"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
const Spinner = () => <div className="flex justify-center items-center p-10"><div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div></div>;
const DAYS_OF_WEEK = [ { id: '1', name: 'Mon' }, { id: '2', name: 'Tue' }, { id: '3', name: 'Wed' }, { id: '4', name: 'Thu' }, { id: '5', name: 'Fri' }, { id: '6', name: 'Sat' }, { id: '0', name: 'Sun' }];
const MONTHS_OF_YEAR = [ { id: '1', name: 'January' }, { id: '2', name: 'February' }, { id: '3', name: 'March' }, { id: '4', name: 'April' }, { id: '5', name: 'May' }, { id: '6', name: 'June' }, { id: '7', name: 'July' }, { id: '8', 'name': 'August' }, { id: '9', name: 'September' }, { id: '10', name: 'October' }, { id: '11', name: 'November' }, { id: '12', name: 'December' }];


// --- Component Definition ---
// We accept all the necessary data and functions as props from App.js
const ScheduleList = ({ 
    records, 
    trelloMembers, 
    isLoading, 
    triggeringId,
    onEditClick, 
    onDeleteClick, 
    onManualTrigger 
}) => {
    
    // State for the filters now lives inside this component
    const [filterOwner, setFilterOwner] = useState('all');
    const [filterFrequency, setFilterFrequency] = useState('all');
    const [filterTitle, setFilterTitle] = useState('');

    // The filtering logic also moves here
    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            const ownerMatch = filterOwner === 'all' || record.owner_name === filterOwner;
            const frequencyMatch = filterFrequency === 'all' || record.frequency === filterFrequency;
            const titleMatch = filterTitle === '' || record.title.toLowerCase().includes(filterTitle.toLowerCase());
            return ownerMatch && frequencyMatch && titleMatch;
        });
    }, [records, filterOwner, filterFrequency, filterTitle]);

    // The frequency formatting function is a helper specific to this list
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

    // This is the JSX you already moved, now wrapped in the component function
    return (
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
                                    <button onClick={() => onManualTrigger(record.id)} disabled={triggeringId === record.id} className="text-xs font-semibold bg-green-100 text-green-800 px-3 py-1 rounded-full hover:bg-green-200 disabled:bg-slate-200">
                                        {triggeringId === record.id ? 'Creating...' : 'Create Now'}
                                    </button>
                                    <button onClick={() => onEditClick(record)} className="p-2 rounded-full hover:bg-blue-100"><EditIcon /></button>
                                    <button onClick={() => onDeleteClick(record)} className="p-2 rounded-full hover:bg-red-100"><DeleteIcon /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Export Statement ---
export default ScheduleList;