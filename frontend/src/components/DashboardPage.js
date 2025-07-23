/**
 * @file frontend/src/components/DashboardPage.js
 * @description Refactored to use semantic color classes.
 */
import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api';

// --- Helper Components ---
const Spinner = () => <div className="flex justify-center items-center p-10"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;

/**
 * @description A reusable card component for displaying a single statistic.
 * @param {object} props - The component props.
 * @param {string} props.title - The title of the statistic.
 * @param {string|number} props.value - The value of the statistic.
 */
const StatCard = ({ title, value }) => (
    <div className="bg-surface p-6 rounded-xl shadow-md text-center">
        <p className="text-sm font-medium text-text-muted uppercase">{title}</p>
        <p className="mt-1 text-4xl font-bold text-text-primary">{value}</p>
    </div>
);

/**
 * @description A page for administrators to view application statistics.
 */
const DashboardPage = () => {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    /**
     * @description Fetches the statistics from the server when the component mounts.
     */
    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data } = await apiClient.get('/api/stats');
            setStats(data);
        } catch (err) {
            setError('Failed to load dashboard statistics.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    if (isLoading) {
        return <Spinner />;
    }

    if (error) {
        return <p className="text-center text-danger">{error}</p>;
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <h2 className="text-3xl font-semibold text-text-primary">Dashboard</h2>

            {/* --- Main Stat Cards --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard title="Total Schedules" value={stats?.totalSchedules ?? 0} />
                <StatCard title="Total Cards Created" value={stats?.totalCardsCreated ?? 0} />
            </div>

            {/* --- Breakdown Sections --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Schedules per Category */}
                <div className="bg-surface p-6 rounded-xl shadow-md">
                    <h3 className="font-semibold text-text-primary mb-4">Schedules per Category</h3>
                    <ul className="space-y-2">
                        {stats?.schedulesPerCategory.map((item, index) => (
                            <li key={index} className="flex justify-between items-center text-sm">
                                <span className="text-text-secondary">{item.category}</span>
                                <span className="font-bold text-text-primary bg-surface-hover px-2 py-1 rounded-md">{item.count}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Cards Created per User */}
                <div className="bg-surface p-6 rounded-xl shadow-md">
                    <h3 className="font-semibold text-text-primary mb-4">Cards Created per User</h3>
                    <ul className="space-y-2">
                        {stats?.cardsPerUser.map((item, index) => (
                            <li key={index} className="flex justify-between items-center text-sm">
                                <span className="text-text-secondary">{item.username}</span>
                                <span className="font-bold text-text-primary bg-surface-hover px-2 py-1 rounded-md">{item.count}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;