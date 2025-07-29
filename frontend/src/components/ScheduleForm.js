/**
 * @file frontend/src/components/ScheduleForm.js
 * @description This version has been updated to ensure that trigger_hour and
 * trigger_minute are always treated as strings within the form's state to prevent
 * validation errors caused by data type mismatches.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import apiClient from '../api';

// --- Helper Data (Specific to this form) ---
const DAYS_OF_WEEK = [ { id: '1', name: 'Mon' }, { id: '2', name: 'Tue' }, { id: '3', name: 'Wed' }, { id: '4', name: 'Thu' }, { id: '5', name: 'Fri' }, { id: '6', name: 'Sat' }, { id: '0', name: 'Sun' }];
const MONTHS_OF_YEAR = [ { id: '1', name: 'January' }, { id: '2', name: 'February' }, { id: '3', name: 'March' }, { id: '4', name: 'April' }, { id: '5', name: 'May' }, { id: '6', name: 'June' }, { id: '7', name: 'July' }, { id: '8', name: 'August' }, { id: '9', name: 'September' }, { id: '10', name: 'October' }, { id: '11', name: 'November' }, { id: '12', name: 'December' }];
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => String(i + 1));

/**
 * @description A reusable combobox component that allows selecting from a list or creating a new entry.
 * @param {object} props - The component props.
 */
const CategoryCombobox = ({ value, onChange, options }) => {
    const [inputValue, setInputValue] = useState(value || '');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = useMemo(() => {
        const isExistingOption = options.some(opt => opt.toLowerCase() === (inputValue || '').toLowerCase());

        if (!inputValue || (isOpen && isExistingOption)) {
            return options;
        }

        return options.filter(option => 
            option.toLowerCase().includes(inputValue.toLowerCase())
        );
    }, [inputValue, options, isOpen]);

    const handleSelect = (selectedValue) => {
        onChange(selectedValue);
        setInputValue(selectedValue);
        setIsOpen(false);
    };

    const canCreateNew = inputValue && !options.some(opt => opt.toLowerCase() === inputValue.toLowerCase());

    return (
        <div className="relative" ref={wrapperRef}>
            <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    onChange(e.target.value);
                }}
                onFocus={() => setIsOpen(true)}
                className="form-input"
                placeholder="e.g., Fitness, Work, Personal"
            />
            {isOpen && (
                <ul className="absolute z-10 w-full bg-surface border border-border-color rounded-md shadow-lg mt-1 max-h-60 overflow-auto">
                    {filteredOptions.map(option => (
                        <li
                            key={option}
                            onClick={() => handleSelect(option)}
                            className="px-3 py-2 text-sm text-text-secondary cursor-pointer hover:bg-surface-hover"
                        >
                            {option}
                        </li>
                    ))}
                    {canCreateNew && (
                        <li
                            onClick={() => handleSelect(inputValue)}
                            className="px-3 py-2 text-sm text-text-accent font-semibold cursor-pointer hover:bg-surface-hover"
                        >
                            Create new category: "{inputValue}"
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
};


/**
 * @description A form for creating and editing scheduled Trello cards.
 * @param {object} props - The component props.
 */
const ScheduleForm = ({ 
    isEditing, 
    initialData, 
    trelloMembers, 
    trelloLabels,
    categories,
    isLoading,
    triggeringId,
    onSubmit, 
    onCancel,
    onManualTrigger,
    onToggleActive
}) => {
    
    const [formData, setFormData] = useState(initialData);
    const [showDates, setShowDates] = useState(!!(initialData.start_date || initialData.end_date));
    const [error, setError] = useState('');
    const [warning, setWarning] = useState(''); // State for non-blocking warnings
    const formRef = useRef(null);

    /**
     * @description Formats a date string from the API (e.g., ISO string) into YYYY-MM-DD format.
     * @param {string} dateString - The date string to format.
     * @returns {string} The formatted date string or an empty string.
     */
    const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        // The date from the DB is a full timestamp, e.g., "2025-07-23T04:00:00.000Z"
        // The input[type="date"] needs "YYYY-MM-DD"
        const date = new Date(dateString);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    useEffect(() => {
        let dataToSet = { 
            ...initialData,
            start_date: formatDateForInput(initialData.start_date),
            end_date: formatDateForInput(initialData.end_date),
            frequency_interval: parseInt(initialData.frequency_interval, 10) || 1,
            // Ensure time components are strings for the form state to prevent validation errors.
            trigger_hour: String(initialData.trigger_hour || '09').padStart(2, '0'),
            trigger_minute: String(initialData.trigger_minute || '00').padStart(2, '0'),
        };
        setWarning(''); // Clear previous warnings

        // Check for orphaned schedules when editing
        if (isEditing && initialData.owner_name && trelloMembers.length > 0) {
            const ownerExists = trelloMembers.some(member => member.fullName === initialData.owner_name);
            if (!ownerExists) {
                setWarning(`Warning: The previously assigned user "${initialData.owner_name}" is no longer a member of this Trello board. Please select a new assignee.`);
                // Clear the invalid owner from the form data
                dataToSet.owner_name = '';
            }
        }
        
        setFormData(dataToSet);
        setShowDates(!!(initialData.start_date || initialData.end_date));
    }, [initialData, isEditing, trelloMembers]);

    const handleInputChange = (e) => {
        const { name, value, checked } = e.target;
        
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
        setError('');
        if (!formData.title || !formData.owner_name) {
            setError('Title and Owner are required fields.');
            return;
        }
        onSubmit(formData, setError);
    };

    const handleToggleActive = async () => {
        try {
            const newStatus = !formData.is_active;
            await onToggleActive(formData.id, newStatus);
            setFormData(prev => ({ ...prev, is_active: newStatus }));
        } catch (err) {
            setError('Failed to update schedule status.');
        }
    };

    const [yearlyMonth, yearlyDay] = (formData.frequency_details || '1-1').split('-');

    return (
        <div ref={formRef} className="bg-surface p-6 sm:p-8 rounded-2xl shadow-lg mb-10 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6 border-b border-border-color pb-4">
                <h2 className="text-3xl font-semibold text-text-primary">{isEditing ? 'Edit Schedule' : 'Schedule a New Card'}</h2>
                {isEditing && formData.active_card_id && (
                    <div className="p-2 bg-surface-accent border border-border-color rounded-lg text-center">
                        <a href={`https://trello.com/c/${formData.active_card_id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-text-on-accent hover:underline">
                            View Active Card
                        </a>
                    </div>
                )}
            </div>
            
            {warning && (
                <div className="mb-6 p-4 bg-warning-surface border border-yellow-300 text-warning-text-on-surface rounded-lg" role="alert">
                    <p className="font-semibold">Attention Required</p>
                    <p>{warning}</p>
                </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="title" className="form-label">Card Title <span className="text-danger">*</span></label>
                        <input type="text" name="title" value={formData.title} onChange={handleInputChange} required className="form-input" placeholder="e.g., Review weekly metrics" />
                    </div>
                    <div>
                        <label htmlFor="owner_name" className="form-label">Assign to Member <span className="text-danger">*</span></label>
                        <select name="owner_name" id="owner_name" value={formData.owner_name} onChange={handleInputChange} required className="form-input">
                            <option value="" disabled>Select a Trello member</option>
                            {trelloMembers.map(member => <option key={member.id} value={member.fullName}>{member.fullName}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="category" className="form-label">Category</label>
                        <CategoryCombobox 
                            value={formData.category}
                            onChange={(newCategory) => setFormData(prev => ({ ...prev, category: newCategory }))}
                            options={categories}
                        />
                    </div>
                    <div>
                        <label htmlFor="trello_label_id" className="form-label">Trello Label</label>
                        <select 
                            name="trello_label_id" 
                            id="trello_label_id" 
                            value={formData.trello_label_id || ''} 
                            onChange={handleInputChange} 
                            className="form-input"
                        >
                            <option value="">None</option>
                            {trelloLabels.map(label => <option key={label.id} value={label.id}>{label.name}</option>)}
                        </select>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 border border-border-color rounded-lg space-y-4">
                        <h3 className="font-semibold text-lg">Frequency</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="frequency" className="form-label">Repeats</label>
                                <select name="frequency" value={formData.frequency} onChange={handleInputChange} className="form-input">
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
                                        <span className="text-text-secondary">{formData.frequency}{formData.frequency_interval > 1 ? 's' : ''}</span>
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
                                            <input type="checkbox" name="weekly_day" value={day.id} checked={formData.frequency_details?.includes(day.id)} onChange={handleInputChange} className="h-4 w-4 rounded border-border-color text-primary focus:ring-primary"/>
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

                    <div className="p-4 border border-border-color rounded-lg space-y-4">
                         <div className="flex items-center">
                            <input type="checkbox" id="showDates" name="showDates" checked={showDates} onChange={handleInputChange} className="h-4 w-4 rounded border-border-color text-primary focus:ring-primary" />
                            <label htmlFor="showDates" className="ml-2 block text-sm text-text-primary">Set start & end date</label>
                        </div>
                        {showDates && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                </div>

                <div>
                    <label htmlFor="description" className="form-label">Card Description</label>
                    <textarea name="description" rows="4" value={formData.description} onChange={handleInputChange} className="form-input" placeholder="Add details to the Trello card description..."></textarea>
                </div>

                {error && <p className="text-danger-text bg-danger-surface p-3 rounded-lg text-center">{error}</p>}

                <div className="flex items-center justify-between space-x-4 pt-4">
                    <div className="flex items-center space-x-4">
                        {isEditing && (
                            <button 
                                type="button"
                                onClick={() => onManualTrigger(formData.id)}
                                disabled={triggeringId === formData.id}
                                className="px-4 py-2.5 rounded-lg bg-success-surface text-success-text-on-surface font-semibold hover:bg-success-surface-hover disabled:bg-disabled-surface disabled:text-disabled-text"
                            >
                                {triggeringId === formData.id ? 'Creating...' : 'Create Card Now'}
                            </button>
                        )}
                        {isEditing && (
                            <button
                                type="button"
                                onClick={handleToggleActive}
                                className={`px-4 py-2.5 rounded-lg font-semibold ${formData.is_active ? 'bg-warning-surface text-warning-text-on-surface hover:bg-warning-surface-hover' : 'bg-secondary text-secondary-text hover:bg-secondary-hover'}`}
                            >
                                {formData.is_active ? 'Disable' : 'Enable'}
                            </button>
                        )}
                    </div>
                    <div className="flex items-center space-x-4">
                        <button type="button" onClick={onCancel} className="form-button-secondary px-6 py-2.5">Cancel</button>
                        <button type="submit" disabled={isLoading} className="form-button-primary flex items-center justify-center px-6 py-2.5">
                            {isLoading ? 'Saving...' : (isEditing ? 'Update Schedule' : 'Schedule Card')}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ScheduleForm;