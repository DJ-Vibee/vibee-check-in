import React, { useState, useMemo } from 'react';
import { Check, Shield, Ship, Sparkles, FileCheck, Users, Calendar, ChevronDown, Filter, IdCard } from 'lucide-react';
import '../styles/components.css';

const ReportsTab = ({ guests }) => {
    const [dateFilter, setDateFilter] = useState('all'); // 'all', 'week', 'range'
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    // Parse date string to Date object
    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        // Handle both MM/DD/YYYY and YYYY-MM-DD formats
        const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
        if (parts.length === 3) {
            if (dateStr.includes('/')) {
                return new Date(parts[2], parts[0] - 1, parts[1]);
            } else {
                return new Date(parts[0], parts[1] - 1, parts[2]);
            }
        }
        return new Date(dateStr);
    };

    // Get week number from date
    const getWeekKey = (date) => {
        if (!date || isNaN(date)) return 'Unknown';
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    };

    // Get week label for display
    const getWeekLabel = (weekKey) => {
        if (weekKey === 'Unknown') return 'Unknown Date';
        const [year, week] = weekKey.split('-W');
        // Calculate start of week
        const startOfYear = new Date(parseInt(year), 0, 1);
        const daysOffset = (parseInt(week) - 1) * 7 - startOfYear.getDay();
        const weekStart = new Date(startOfYear);
        weekStart.setDate(weekStart.getDate() + daysOffset);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const format = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `Week of ${format(weekStart)} - ${format(weekEnd)}`;
    };

    // Get unique weeks from all guests
    const allWeeks = useMemo(() => {
        const weeks = new Set();
        guests.forEach(g => {
            const date = parseDate(g.eventDate);
            if (date && !isNaN(date)) {
                weeks.add(getWeekKey(date));
            }
        });
        return Array.from(weeks).sort();
    }, [guests]);

    // Filter guests based on date selection
    const filteredGuests = useMemo(() => {
        if (dateFilter === 'all') return guests;

        return guests.filter(g => {
            const date = parseDate(g.eventDate);
            if (!date || isNaN(date)) return false;

            if (dateFilter === 'week' && selectedWeek) {
                return getWeekKey(date) === selectedWeek;
            }

            if (dateFilter === 'range') {
                const start = dateRange.start ? new Date(dateRange.start) : null;
                const end = dateRange.end ? new Date(dateRange.end) : null;
                if (start && date < start) return false;
                if (end && date > end) return false;
                return true;
            }

            return true;
        });
    }, [guests, dateFilter, selectedWeek, dateRange]);

    // Group guests by event date
    const groupByEventDate = (guestList) => {
        const groups = {};
        guestList.forEach(g => {
            const date = g.eventDate || 'Unknown';
            if (!groups[date]) groups[date] = [];
            groups[date].push(g);
        });
        return groups;
    };

    // Group guests by week
    const groupByWeek = (guestList) => {
        const groups = {};
        guestList.forEach(g => {
            const date = parseDate(g.eventDate);
            const weekKey = date && !isNaN(date) ? getWeekKey(date) : 'Unknown';
            if (!groups[weekKey]) groups[weekKey] = [];
            groups[weekKey].push(g);
        });
        return groups;
    };

    // Calculate stats for a group of guests
    const calculateStats = (guestList) => {
        const total = guestList.length;
        if (total === 0) return null;

        const stats = {
            total,
            waiverSigned: guestList.filter(g => g.jotformWaiver).length,
            idChecked: guestList.filter(g => g.idChecked).length,
            checkedIn: guestList.filter(g => g.checked).length,
            laminatePickedUp: guestList.filter(g => g.laminatePickUp).length,
            gondolaTotal: guestList.filter(g => g.gondolaAddon).length,
            gondolaPickedUp: guestList.filter(g => g.gondolaAddon && g.gondola).length,
            wellnessTotal: guestList.filter(g => g.wellness).length,
            wellnessPickedUp: guestList.filter(g => g.wellness && g.wellnessPU).length,
        };

        // Calculate percentages
        stats.waiverPct = ((stats.waiverSigned / total) * 100).toFixed(1);
        stats.idCheckedPct = ((stats.idChecked / total) * 100).toFixed(1);
        stats.checkedInPct = ((stats.checkedIn / total) * 100).toFixed(1);
        stats.laminatePct = ((stats.laminatePickedUp / total) * 100).toFixed(1);
        stats.gondolaPct = stats.gondolaTotal > 0 ? ((stats.gondolaPickedUp / stats.gondolaTotal) * 100).toFixed(1) : 0;
        stats.wellnessPct = stats.wellnessTotal > 0 ? ((stats.wellnessPickedUp / stats.wellnessTotal) * 100).toFixed(1) : 0;

        return stats;
    };

    // Group by access type within a guest list
    const groupByAccessType = (guestList) => {
        const vip = guestList.filter(g => (g.ticketType || '').toUpperCase() === 'VIP');
        const std = guestList.filter(g => (g.ticketType || '').toUpperCase() !== 'VIP');
        return { VIP: vip, Signature: std };
    };

    const overallStats = calculateStats(filteredGuests);
    const weekGroups = groupByWeek(filteredGuests);

    const StatCard = ({ icon: Icon, label, completed, total, percentage, color }) => (
        <div className="stat-card">
            <div className="stat-icon" style={{ background: color }}>
                <Icon size={20} />
            </div>
            <div className="stat-content">
                <div className="stat-label">{label}</div>
                <div className="stat-numbers">
                    <span className="stat-main">{completed} / {total}</span>
                    <span className="stat-percentage" style={{ color }}>{percentage}%</span>
                </div>
            </div>
            <div className="stat-progress">
                <div
                    className="stat-progress-bar"
                    style={{ width: `${percentage}%`, background: color }}
                />
            </div>
        </div>
    );

    const StatsSection = ({ stats }) => {
        if (!stats) return null;
        return (
            <div className="stats-grid">
                <StatCard
                    icon={FileCheck}
                    label="Waivers Signed"
                    completed={stats.waiverSigned}
                    total={stats.total}
                    percentage={stats.waiverPct}
                    color="var(--accent-primary)"
                />
                <StatCard
                    icon={IdCard}
                    label="ID Verified"
                    completed={stats.idChecked}
                    total={stats.total}
                    percentage={stats.idCheckedPct}
                    color="#06b6d4"
                />
                <StatCard
                    icon={Check}
                    label="Checked In"
                    completed={stats.checkedIn}
                    total={stats.total}
                    percentage={stats.checkedInPct}
                    color="var(--success)"
                />
                <StatCard
                    icon={Shield}
                    label="Laminates"
                    completed={stats.laminatePickedUp}
                    total={stats.total}
                    percentage={stats.laminatePct}
                    color="#f59e0b"
                />
                {stats.gondolaTotal > 0 && (
                    <StatCard
                        icon={Ship}
                        label="Gondola Pickups"
                        completed={stats.gondolaPickedUp}
                        total={stats.gondolaTotal}
                        percentage={stats.gondolaPct}
                        color="#8b5cf6"
                    />
                )}
                {stats.wellnessTotal > 0 && (
                    <StatCard
                        icon={Sparkles}
                        label="Wellness Pickups"
                        completed={stats.wellnessPickedUp}
                        total={stats.wellnessTotal}
                        percentage={stats.wellnessPct}
                        color="#ec4899"
                    />
                )}
            </div>
        );
    };

    return (
        <div className="reports-tab">
            {/* Filter Controls */}
            <div className="glass-panel reports-filter-bar">
                <div className="filter-controls">
                    <button
                        className={`filter-btn ${dateFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setDateFilter('all')}
                    >
                        All Dates
                    </button>
                    <div className="filter-dropdown">
                        <button
                            className={`filter-btn ${dateFilter === 'week' ? 'active' : ''}`}
                            onClick={() => setShowFilterMenu(!showFilterMenu)}
                        >
                            <Calendar size={16} />
                            {dateFilter === 'week' && selectedWeek ? getWeekLabel(selectedWeek) : 'By Week'}
                            <ChevronDown size={14} />
                        </button>
                        {showFilterMenu && (
                            <div className="dropdown-menu">
                                {allWeeks.map(week => (
                                    <button
                                        key={week}
                                        className={`dropdown-item ${selectedWeek === week ? 'active' : ''}`}
                                        onClick={() => {
                                            setDateFilter('week');
                                            setSelectedWeek(week);
                                            setShowFilterMenu(false);
                                        }}
                                    >
                                        {getWeekLabel(week)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="date-range-inputs">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => {
                                setDateRange(prev => ({ ...prev, start: e.target.value }));
                                setDateFilter('range');
                            }}
                            placeholder="Start"
                        />
                        <span>to</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => {
                                setDateRange(prev => ({ ...prev, end: e.target.value }));
                                setDateFilter('range');
                            }}
                            placeholder="End"
                        />
                    </div>
                </div>
                <div className="filter-summary">
                    Showing <strong>{filteredGuests.length.toLocaleString()}</strong> of <strong>{guests.length.toLocaleString()}</strong> guests
                </div>
            </div>

            {/* Overall Summary */}
            <div className="glass-panel reports-section">
                <div className="reports-header">
                    <h2><Users size={22} /> Overall Summary</h2>
                    <span className="guest-count">{filteredGuests.length.toLocaleString()} guests</span>
                </div>
                <StatsSection stats={overallStats} />

                {/* By Access Type */}
                <div className="access-breakdown">
                    {Object.entries(groupByAccessType(filteredGuests)).map(([type, typeGuests]) => {
                        if (typeGuests.length === 0) return null;
                        const typeStats = calculateStats(typeGuests);
                        return (
                            <div key={type} className="access-type-row">
                                <span className={`access-badge ${type.toLowerCase()}`}>{type}</span>
                                <span className="type-stat">{typeGuests.length.toLocaleString()} guests</span>
                                <span className="type-stat">{typeStats?.checkedInPct}% checked in</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* By Week */}
            {Object.entries(weekGroups).sort().map(([weekKey, weekGuests]) => {
                const weekStats = calculateStats(weekGuests);
                const dateGroups = groupByEventDate(weekGuests);

                return (
                    <div key={weekKey} className="glass-panel reports-section">
                        <div className="reports-header">
                            <h2>📅 {getWeekLabel(weekKey)}</h2>
                            <span className="guest-count">{weekGuests.length.toLocaleString()} guests</span>
                        </div>

                        <StatsSection stats={weekStats} />

                        {/* Individual Dates within Week */}
                        <div className="date-breakdown">
                            {Object.entries(dateGroups).sort().map(([date, dateGuests]) => {
                                const dateStats = calculateStats(dateGuests);
                                const accessGroups = groupByAccessType(dateGuests);

                                return (
                                    <details key={date} className="date-detail">
                                        <summary className="date-summary">
                                            <span className="date-label">{date}</span>
                                            <span className="date-guests">{dateGuests.length} guests</span>
                                            <span className="date-pct">{dateStats?.checkedInPct}% checked in</span>
                                        </summary>
                                        <div className="date-content">
                                            {Object.entries(accessGroups).map(([type, typeGuests]) => {
                                                if (typeGuests.length === 0) return null;
                                                const typeStats = calculateStats(typeGuests);
                                                return (
                                                    <div key={type} className="type-row">
                                                        <span className={`access-badge sm ${type.toLowerCase()}`}>{type}</span>
                                                        <span>{typeGuests.length} guests</span>
                                                        <span>{typeStats?.waiverPct}% waiver</span>
                                                        <span>{typeStats?.checkedInPct}% checked in</span>
                                                        <span>{typeStats?.laminatePct}% laminate</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </details>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ReportsTab;
