import React, { createContext, useState, useContext, useCallback } from 'react';
import apiClient from '../api';
import { useAuth } from './AuthContext'; // We'll need this to get settings

// 1. Create the context
const SchedulesContext = createContext(null);

/**
 * @description A custom hook to easily access the schedules context from any component.
 * @returns {object} The schedules context value.
 */
export const useSchedules = () => {
    return useContext(SchedulesContext);
};

/**
 * @description The provider component that wraps the application and manages all state
 * related to schedules, categories, and Trello members.
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to be rendered.
 */
export const SchedulesProvider = ({ children }) => {
    const [schedules, setSchedules] = useState({});
    const [trelloMembers, setTrelloMembers] = useState([]);
    const [trelloLabels, setTrelloLabels] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const { isAuthenticated } = useAuth();

    /**
     * @description Fetches all schedules from the API.
     */
    const fetchSchedules = useCallback(async () => {
        try {
            const res = await apiClient.get('/api/schedules');
            setSchedules(res.data);
        } catch (err) {
            console.error("Schedules Fetch Error:", err);
            setError("Failed to load schedules.");
        }
    }, []);

    /**
     * @description Fetches all unique categories from the API.
     */
    const fetchCategories = useCallback(async () => {
        try {
            const res = await apiClient.get('/api/schedules/categories');
            setCategories(res.data);
        } catch (err) {
            console.error("Categories Fetch Error:", err);
        }
    }, []);

    /**
     * @description Fetches all Trello-related data (members and labels).
     */
    const fetchTrelloData = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const { data: settings } = await apiClient.get('/api/settings');
            if (settings.isConfigured) {
                await Promise.all([
                    apiClient.get('/api/trello/members').then(res => setTrelloMembers(res.data)),
                    apiClient.get(`/api/trello/labels/${settings.TRELLO_BOARD_ID}`).then(res => setTrelloLabels(res.data))
                ]);
            }
        } catch (err) {
            console.error("Trello Data Fetch Error:", err);
            setError("Failed to load Trello data. Check settings.");
        }
    }, [isAuthenticated]);

    /**
     * @description A comprehensive function to load all data for the application.
     */
    const loadAllData = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoading(true);
        setError(null);
        try {
            await Promise.all([
                fetchSchedules(),
                fetchCategories(),
                fetchTrelloData()
            ]);
        } catch (err) {
            setError("Failed to load initial application data.");
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, fetchSchedules, fetchCategories, fetchTrelloData]);


    // The value that will be provided to all consuming components
    const value = {
        schedules,
        trelloMembers,
        trelloLabels,
        categories,
        isLoading,
        error,
        loadAllData, // Expose a single function to refresh all data
    };

    return (
        <SchedulesContext.Provider value={value}>
            {children}
        </SchedulesContext.Provider>
    );
};