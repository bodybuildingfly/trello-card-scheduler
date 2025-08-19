import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import ReactMarkdown from 'react-markdown';

const ReleasesPage = () => {
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchReleases = async () => {
            try {
                const response = await apiClient.get('/api/releases');
                setReleases(response.data);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch releases. Please try again later.');
                setLoading(false);
            }
        };

        fetchReleases();
    }, []);

    if (loading) {
        return <div>Loading releases...</div>;
    }

    if (error) {
        return <div className="text-danger">{error}</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Application Releases</h1>
            <div className="space-y-6">
                {releases.map(release => (
                    <div key={release.id} className="bg-surface-secondary p-4 rounded-lg shadow">
                        <h2 className="text-xl font-semibold text-text-primary">{release.name}</h2>
                        <p className="text-sm text-text-muted mb-2">
                            Published on {new Date(release.published_at).toLocaleDateString()}
                        </p>
                        <div className="prose prose-sm max-w-none">
                            <ReactMarkdown>{release.body}</ReactMarkdown>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReleasesPage;
