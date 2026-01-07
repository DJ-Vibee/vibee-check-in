import React, { useState, useEffect, createContext, useContext } from 'react';

const defaultSettings = {
    headerName: 'Check-In System',
    headerSubtitle: 'Vibee Experience 2026',
    jotformUrl: 'https://vibee.jotform.com/251891714013958',
    jotformApiKey: '',
    jotformFormId: '251891714013958',
    metabaseUrl: '',
    googleSheetUrl: '',
    // Event filters for Metabase data
    eventNameFilter: '',  // Filter events containing this text
    eventWeek: '',        // Week number (weeks start on Monday)
    eventDates: ''        // Optional: comma-separated dates (e.g., "12/26/2025,12/27/2025")
};

const SettingsContext = createContext(defaultSettings);

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('appSettings');
        return saved ? JSON.parse(saved) : defaultSettings;
    });

    const updateSettings = (newSettings) => {
        setSettings(newSettings);
        localStorage.setItem('appSettings', JSON.stringify(newSettings));
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export default SettingsContext;
