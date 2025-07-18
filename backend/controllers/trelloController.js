import axios from 'axios';
import * as trelloService from '../services/trelloService.js';

export const testCredentials = async (req, res) => {
    const { apiKey, apiToken } = req.body;
    if (!apiKey || !apiToken) {
        return res.status(400).json({ message: 'API Key and Token are required.' });
    }
    try {
        await axios.get(`https://api.trello.com/1/members/me?key=${apiKey}&token=${apiToken}`);
        res.status(200).json({ message: 'Connection successful!' });
    } catch (error) {
        let errorMessage = 'Connection failed. Please check your API Key and Token.';
        if (error.response && error.response.status === 401) {
            errorMessage = 'Connection failed: Invalid API Key or Token.';
        }
        console.error('[ERROR] Trello credential test failed:', error.message);
        res.status(401).json({ message: errorMessage });
    }
};

export const getBoards = async (req, res) => {
    // Get appSettings from the request object provided by the middleware
    const { appSettings } = req;
    const { TRELLO_API_KEY, TRELLO_API_TOKEN } = appSettings;

    if (!TRELLO_API_KEY || !TRELLO_API_TOKEN) {
        return res.status(400).json({ message: 'Trello credentials are not configured on the server.' });
    }
    try {
        const response = await axios.get(`https://api.trello.com/1/members/me/boards?fields=name,id&key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`);
        res.status(200).json(response.data);
    } catch (error) {
        console.error('[ERROR] Failed to fetch Trello boards:', error.message);
        res.status(500).json({ message: 'Failed to fetch Trello boards.' });
    }
};

export const getLists = async (req, res) => {
    const { appSettings } = req;
    const { boardId } = req.params;
    const { TRELLO_API_KEY, TRELLO_API_TOKEN } = appSettings;

    if (!TRELLO_API_KEY || !TRELLO_API_TOKEN) {
        return res.status(400).json({ message: 'Trello credentials are not configured on the server.' });
    }
    try {
        const response = await axios.get(`https://api.trello.com/1/boards/${boardId}/lists?fields=name,id&key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`);
        res.status(200).json(response.data);
    } catch (error) {
        console.error(`[ERROR] Failed to fetch lists for board ${boardId}:`, error.message);
        res.status(500).json({ message: 'Failed to fetch Trello lists.' });
    }
};

export const getLabels = async (req, res) => {
    const { appSettings } = req;
    const { boardId } = req.params;
    const { TRELLO_API_KEY, TRELLO_API_TOKEN } = appSettings;

    if (!TRELLO_API_KEY || !TRELLO_API_TOKEN) {
        return res.status(400).json({ message: 'Trello credentials are not configured on the server.' });
    }
    try {
        const response = await axios.get(`https://api.trello.com/1/boards/${boardId}/labels?fields=name,id&key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`);
        res.status(200).json(response.data);
    } catch (error) {
        console.error(`[ERROR] Failed to fetch labels for board ${boardId}:`, error.message);
        res.status(500).json({ message: 'Failed to fetch Trello labels.' });
    }
};

export const getMembers = async (req, res) => {
    const { appSettings } = req;
    const { TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID } = appSettings;
    
    try {
        const members = await trelloService.getTrelloBoardMembers(TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID);
        res.status(200).json(members);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch members from Trello.' });
    }
};