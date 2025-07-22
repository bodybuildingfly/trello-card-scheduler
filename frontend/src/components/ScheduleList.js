import React from 'react';

// --- Helper Icon Imports ---
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-500 group-hover:text-red-700"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
const CloneIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-500 group-hover:text-green-700"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>;
const Spinner = () => <div className="flex justify-center items-center p-10"><div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div></div>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><polyline points="6 9 12 15 18 9"></polyline></svg>;
const DAYS_OF_WEEK = [ { id: '1', name: 'Mon' }, { id: '2', name: 'Tue' }, { id: '3', name: 'Wed' }, { id: '4', name: 'Thu' }, { id: '5', name: 'Fri' }, { id: '6', name: 'Sat' }, { id: '0', name: 'Sun' }];
const MONTHS_OF_YEAR = [ { id: '1', name: 'January' }, { id: '2', name: 'February' }, { id: '3', name: 'March' }, { id: '4', name: 'April' }, { id: '5', name: 'May' }, { id: '6', name: 'June' }, { id: '7', name: 'July' }, { id: '8', name: 'August' }, { id: '9', name: 'September' }, { id: '10', name: 'October' }, { id: '11', name: 'November' }, { id: '12', name: 'December' }];

/**
 * @description Formats a date string into a more readable format.
 * @param {string} dateString - The date string to format.
 * @returns {string} The formatted date string or 'N/A'.
 */
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
    });
};

/**
 * @description A component that displays a single collapsible category of schedules.
 * @param {object} props - The component props.
 */
const CategorySection = ({ categoryName, schedules, isCategoryExpanded, onToggleCategory, ...rest }) => {
    return (
        <div>
            <button 
                onClick={() => onToggleCategory(categoryName)} 
                className="w-full flex justify-between items-center text-left py-2 px-2 rounded-md hover:bg-slate-100"
            >
                <span className="font-bold text-slate-700">{categoryName} ({schedules.length})</span>
                <span className={`transform transition-transform duration-200 ${isCategoryExpanded ? 'rotate-180' : 'rotate-0'}`}>
                    <ChevronDownIcon />
                </span>
            </button>
            {isCategoryExpanded && (
                <div className="pl-4 border-l-2 border-slate-200 ml-2">
                    {schedules.map(schedule => (
                        <ScheduleItem 
                            key={schedule.id} 
                            schedule={schedule} 
                            {...rest} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * @description A component that displays a single scheduled item in the list, with an expandable details section.
 * @param {object} props - The component props.
 */
const ScheduleItem = ({ schedule, isExpanded, onItemSelect, triggeringId, onDeleteClick, onCloneClick, onManualTrigger, formatFrequency }) => (
    <div className="py-2 group border-b border-slate-100 last:border-b-0">
        <div className="flex items-start justify-between cursor-pointer" onClick={() => onItemSelect(schedule)}>
            <div>
                <h3 className={`font-semibold transition-colors ${isExpanded ? 'text-sky-600' : 'text-slate-800 group-hover:text-sky-600'}`}>{schedule.title}</h3>
                <p className="text-sm text-slate-500 mt-1">Assignee: {schedule.owner_name}</p>
            </div>
            <div className="flex items-center space-x-1 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); onCloneClick(schedule.id); }} className="p-2 rounded-full hover:bg-slate-200" title="Clone Schedule"><CloneIcon /></button>
                <button onClick={(e) => { e.stopPropagation(); onDeleteClick(schedule); }} className="p-2 rounded-full hover:bg-slate-200" title="Delete Schedule"><DeleteIcon /></button>
            </div>
        </div>
        {isExpanded && (
            <div className="mt-3 pl-1 space-y-2 text-sm text-slate-600">
                {schedule.description && <p className="italic">"{schedule.description.split('\n')[0]}"</p>}
                <p><strong>Frequency:</strong> {formatFrequency(schedule)}</p>
                {(schedule.start_date || schedule.end_date) && (
                    <p><strong>Active Dates:</strong> {formatDate(schedule.start_date)} to {formatDate(schedule.end_date)}</p>
                )}
                {schedule.active_card_id && (
                    <p><strong>Active Card:</strong> <a href={`https://trello.com/c/${schedule.active_card_id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline">View on Trello</a></p>
                )}
            </div>
        )}
    </div>
);


/**
 * @description The main component for displaying the list of schedules.
 * @param {object} props - The component props.
 */
const ScheduleList = ({ 
    schedules,
    isLoading, 
    expandedItemId,
    onItemSelect,
    collapsedCategories,
    onToggleCategory,
    ...rest 
}) => {
    
    const formatFrequency = (schedule) => {
        const { frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm } = schedule;
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

    return (
        <div>
            {isLoading ? <Spinner /> : (
                <div className="space-y-2">
                    {Object.keys(schedules).sort().map(categoryName => (
                        <CategorySection
                            key={categoryName}
                            categoryName={categoryName}
                            schedules={schedules[categoryName]}
                            isCategoryExpanded={!collapsedCategories[categoryName]}
                            onToggleCategory={onToggleCategory}
                            expandedItemId={expandedItemId}
                            onItemSelect={onItemSelect}
                            formatFrequency={formatFrequency}
                            {...rest}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ScheduleList;