/**
 * @file frontend/src/components/TrelloConfigBanner.js
 * @description Refactored to use semantic color classes.
 */
import { useState } from 'react';

const TrelloConfigBanner = ({ onGoToSettings }) => {
    const [isVisible, setIsVisible] = useState(true);
    if (!isVisible) return null;

    return (
        <div className="bg-yellow-100 border-l-4 border-warning text-yellow-700 p-4 rounded-lg mb-8 max-w-5xl mx-auto" role="alert">
            <div className="flex">
                <div className="py-1"><svg className="fill-current h-6 w-6 text-warning mr-4" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zM9 5v6h2V5H9zm0 8h2v2H9v-2z"/></svg></div>
                <div>
                    <p className="font-bold">Configuration Required</p>
                    <p className="text-sm">Please configure your Trello settings to enable scheduling functionality.</p>
                </div>
                <div className="ml-auto flex flex-col items-center justify-center space-y-2">
                     <button onClick={onGoToSettings} className="bg-warning text-warning-text font-bold py-1 px-3 rounded hover:bg-warning-hover">Go to Settings</button>
                     <button onClick={() => setIsVisible(false)} className="text-xs text-yellow-600 hover:underline">Dismiss</button>
                </div>
            </div>
        </div>
    );
};

export default TrelloConfigBanner;