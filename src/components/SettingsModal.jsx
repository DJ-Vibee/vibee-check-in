import React, { useState } from 'react';
import { X, Settings, ExternalLink } from 'lucide-react';
import { useSettings } from '../utils/SettingsContext';
import '../styles/components.css';

const SettingsModal = ({ isOpen, onClose }) => {
    const { settings, updateSettings } = useSettings();
    const [form, setForm] = useState(settings);

    if (!isOpen) return null;

    const handleSave = () => {
        updateSettings(form);
        onClose();
    };

    const handleChange = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="glass-panel modal-content settings-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><Settings size={20} /> Settings</h2>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="settings-form">
                    <div className="form-group">
                        <label>Header Name</label>
                        <input
                            type="text"
                            value={form.headerName}
                            onChange={(e) => handleChange('headerName', e.target.value)}
                            placeholder="Check-In System"
                        />
                    </div>

                    <div className="form-group">
                        <label>Header Subtitle</label>
                        <input
                            type="text"
                            value={form.headerSubtitle}
                            onChange={(e) => handleChange('headerSubtitle', e.target.value)}
                            placeholder="Vibee Experience 2026"
                        />
                    </div>

                    <div className="form-group">
                        <label>JotForm URL</label>
                        <input
                            type="url"
                            value={form.jotformUrl}
                            onChange={(e) => handleChange('jotformUrl', e.target.value)}
                            placeholder="https://vibee.jotform.com/251891714013958"
                        />
                        <span className="form-hint">Order number will be appended as ?typeA=XXX</span>
                    </div>

                    <div className="form-group">
                        <label>JotForm API Key</label>
                        <input
                            type="password"
                            value={form.jotformApiKey || ''}
                            onChange={(e) => handleChange('jotformApiKey', e.target.value)}
                            placeholder="Enter your JotForm API key"
                        />
                        <span className="form-hint">Required for auto-verifying waiver submissions. Get from JotForm → Settings → API</span>
                    </div>

                    <div className="form-group">
                        <label>Metabase URL</label>
                        <input
                            type="url"
                            value={form.metabaseUrl}
                            onChange={(e) => handleChange('metabaseUrl', e.target.value)}
                            placeholder="https://your-metabase-instance.com"
                        />
                    </div>

                    <div className="form-group">
                        <label>Google Sheet URL</label>
                        <input
                            type="url"
                            value={form.googleSheetUrl}
                            onChange={(e) => handleChange('googleSheetUrl', e.target.value)}
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                        />
                    </div>

                    <div className="settings-divider">
                        <span>Event Filters (Metabase Data)</span>
                    </div>

                    <div className="form-group">
                        <label>Event Name (contains)</label>
                        <input
                            type="text"
                            value={form.eventNameFilter || ''}
                            onChange={(e) => handleChange('eventNameFilter', e.target.value)}
                            placeholder="e.g., Backstreet Boys"
                        />
                        <span className="form-hint">Filter events containing this text</span>
                    </div>

                    <div className="form-group">
                        <label>Event Week</label>
                        <input
                            type="number"
                            min="1"
                            max="52"
                            value={form.eventWeek || ''}
                            onChange={(e) => handleChange('eventWeek', e.target.value)}
                            placeholder="e.g., 1"
                        />
                        <span className="form-hint">Week of year (1-52). Weeks start on Monday.</span>
                    </div>

                    <div className="form-group">
                        <label>Event Dates (optional)</label>
                        <input
                            type="text"
                            value={form.eventDates || ''}
                            onChange={(e) => handleChange('eventDates', e.target.value)}
                            placeholder="e.g., 12/26/2025, 12/27/2025"
                        />
                        <span className="form-hint">Comma-separated dates to filter by. Leave blank to use Event Week.</span>
                    </div>
                </div>

                <div className="modal-actions">
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={handleSave}>Save Settings</button>
                </div>

                {(form.metabaseUrl || form.googleSheetUrl) && (
                    <div className="quick-links">
                        <span>Quick Links:</span>
                        {form.metabaseUrl && (
                            <a href={form.metabaseUrl} target="_blank" rel="noopener noreferrer" className="quick-link">
                                <ExternalLink size={14} /> Metabase
                            </a>
                        )}
                        {form.googleSheetUrl && (
                            <a href={form.googleSheetUrl} target="_blank" rel="noopener noreferrer" className="quick-link">
                                <ExternalLink size={14} /> Google Sheet
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsModal;
