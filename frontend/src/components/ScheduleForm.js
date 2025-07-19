import React, { useState, useEffect, useRef } from 'react';

// --- Helper Data (Specific to this form) ---
const DAYS_OF_WEEK = [ { id: '1', name: 'Mon' }, { id: '2', name: 'Tue' }, { id: '3', name: 'Wed' }, { id: '4', name: 'Thu' }, { id: '5', name: 'Fri' }, { id: '6', name: 'Sat' }, { id: '0', name: 'Sun' }];
const MONTHS_OF_YEAR = [ { id: '1', name: 'January' }, { id: '2', name: 'February' }, { id: '3', name: 'March' }, { id: '4', name: 'April' }, { id: '5', name: 'May' }, { id: '6', name: 'June' }, { id: '7', name: 'July' }, { id: '8', name: 'August' }, { id: '9', name: 'September' }, { id: '10', name: 'October' }, { id: '11', name: 'November' }, { id: '12', name: 'December' }];
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => String(i + 1));

/**
 * @description A form for creating and editing scheduled Trello cards.
 * It manages its own internal state and calls parent functions via props on submit or cancel.
 * @param {object} props - The component props.
 * @param {boolean} props.isEditing - Flag to determine if the form is in edit mode.
 * @param {object} props.initialData - The initial data to populate the form with, especially for editing.
 * @param {object[]} props.trelloMembers - The list of Trello members for the assignee dropdown.
 * @param {boolean} props.isLoading - Flag to disable the submit button during API calls.
 * @param {function} props.onSubmit - The function to call when the form is submitted.
 * @param {function} props.onCancel - The function to call when the cancel button is clicked.
 */
const ScheduleForm = ({ 
    isEditing, 
    initialData, 
    trelloMembers, 
    isLoading,
    onSubmit, 
    onCancel 
}) => {
    
    const [formData, setFormData] = useState(initialData);
    const [showDates, setShowDates] = useState(!!(initialData.start_date || initialData.end_date));
    const [error, setError] = useState('');
    const formRef = useRef(null);

    useEffect(() => {
        setFormData(initialData);
        setShowDates(!!(initialData.start_date || initialData.end_date));
    }, [initialData]);

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

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!formData.title || !formData.owner_name) {
            setError('Title and Owner are required fields.');
            return;
        }
        onSubmit(formData);
    };

    const [yearlyMonth, yearlyDay] = (formData.frequency_details || '1-1').split('-');

    return (
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

                <div>
                    <label htmlFor="category" className="form-label">Category</label>
                    <input type="text" name="category" value={formData.category} onChange={handleInputChange} className="form-input" placeholder="e.g., Fitness, Work, Personal" />
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
                    <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-lg bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300">Cancel</button>
                    <button type="submit" disabled={isLoading} className="flex items-center justify-center px-6 py-2.5 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 disabled:bg-sky-300 shadow-md">
                        {isLoading ? 'Saving...' : (isEditing ? 'Update Schedule' : 'Schedule Card')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ScheduleForm;