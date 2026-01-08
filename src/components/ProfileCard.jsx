import React from 'react';
import { Check, X, Shield, Ship, Sparkles, FileCheck, ExternalLink, IdCard } from 'lucide-react';
import '../styles/components.css';

const ProfileCard = ({ guest, onToggle, jotformUrl }) => {
    const getInitials = (first, last) => `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`;
    const isVIP = guest.ticketType === 'VIP';
    const hasGondola = guest.gondolaAddon && guest.gondolaAddon !== '';
    const hasWellness = guest.wellness && guest.wellness !== '';

    // Display name for ticket types
    const getTicketDisplayName = (type) => {
        const displayNames = {
            'STD': 'Signature',
            'VIP': 'VIP'
        };
        return displayNames[type] || type;
    };

    const getWaiverUrl = () => {
        const orderNum = guest.orderNumber?.replace('#', '') || '';
        const baseUrl = jotformUrl || 'https://vibee.jotform.com/251891714013958';
        // typeA is the JotForm unique name for the widget field
        // order param is read by custom JS in the form
        return `${baseUrl}?typeA=${encodeURIComponent(orderNum)}&order=${encodeURIComponent(orderNum)}`;
    };

    const handleWaiverClick = () => {
        if (!guest.jotformWaiver) {
            window.open(getWaiverUrl(), '_blank');
        } else {
            onToggle(guest.id, 'jotformWaiver');
        }
    };

    return (
        <div className="glass-panel profile-card">
            <div className="avatar">{getInitials(guest.billingFirst, guest.billingLast)}</div>

            <div className="card-header">
                <h3 className="guest-name">{guest.billingFirst} {guest.billingLast}</h3>
                <span className={`ticket-badge ${!isVIP ? 'standard' : ''}`}>{getTicketDisplayName(guest.ticketType)}</span>
                {guest.checked && (
                    <span className="status-text"><Check size={12} /> Checked In</span>
                )}
            </div>

            <div className="card-body">
                <div className="info-row">
                    <span className="info-label">Order:</span>
                    <span>#{guest.orderNumber}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Email:</span>
                    <span>{guest.email}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Hotel:</span>
                    <span>{guest.hotel}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Check-In:</span>
                    <span>{guest.checkInDate}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Event:</span>
                    <span>{guest.eventDate}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Ticket:</span>
                    <span>{guest.ticketTierName} ({guest.quantity})</span>
                </div>
                <div className="addons-row">
                    {hasWellness && <div className="addon-tag"><Sparkles size={12} /> Wellness</div>}
                    {hasGondola && <div className="addon-tag"><Ship size={12} /> Gondola</div>}
                </div>
            </div>

            <div className="card-actions">
                <button
                    className={`toggle-btn ${guest.jotformWaiver ? 'active' : 'warning'}`}
                    onClick={handleWaiverClick}
                    title={guest.jotformWaiver ? 'Waiver signed' : 'Click to open waiver form'}
                >
                    {guest.jotformWaiver ? <FileCheck size={14} /> : <ExternalLink size={14} />}
                    Waiver
                </button>

                <button
                    className={`toggle-btn ${guest.idChecked ? 'active' : 'warning'} ${!guest.jotformWaiver ? 'disabled' : ''}`}
                    onClick={() => guest.jotformWaiver && onToggle(guest.id, 'idChecked')}
                    title={!guest.jotformWaiver ? 'Complete waiver first' : (guest.idChecked ? 'ID Verified' : 'Verify guest ID')}
                    disabled={!guest.jotformWaiver}
                >
                    <IdCard size={14} /> ID Check
                </button>

                <button
                    className={`toggle-btn ${guest.checked ? 'active' : ''} ${!guest.jotformWaiver || !guest.idChecked ? 'disabled' : ''}`}
                    onClick={() => guest.jotformWaiver && guest.idChecked && onToggle(guest.id, 'checked')}
                    title={!guest.jotformWaiver ? 'Complete waiver first' : (!guest.idChecked ? 'Verify ID first' : 'Check In')}
                    disabled={!guest.jotformWaiver || !guest.idChecked}
                >
                    <Check size={14} /> Check In
                </button>

                <button
                    className={`toggle-btn ${guest.laminatePickUp ? 'active' : ''} ${!guest.idChecked ? 'disabled' : ''}`}
                    onClick={() => guest.idChecked && onToggle(guest.id, 'laminatePickUp')}
                    title={!guest.idChecked ? 'Verify ID first' : 'Laminate Pick Up'}
                    disabled={!guest.idChecked}
                >
                    <Shield size={14} /> Laminate
                </button>

                {hasGondola && (
                    <button
                        className={`toggle-btn ${guest.gondola ? 'active' : ''} ${!guest.idChecked ? 'disabled' : ''}`}
                        onClick={() => guest.idChecked && onToggle(guest.id, 'gondola')}
                        title={!guest.idChecked ? 'Verify ID first' : 'Gondola Pick Up'}
                        disabled={!guest.idChecked}
                    >
                        <Ship size={14} /> Gondola
                    </button>
                )}

                {hasWellness && (
                    <button
                        className={`toggle-btn ${guest.wellnessPU ? 'active' : ''} ${!guest.idChecked ? 'disabled' : ''}`}
                        onClick={() => guest.idChecked && onToggle(guest.id, 'wellnessPU')}
                        title={!guest.idChecked ? 'Verify ID first' : 'Wellness Pick Up'}
                        disabled={!guest.idChecked}
                    >
                        <Sparkles size={14} /> Wellness
                    </button>
                )}
            </div>
        </div>
    );
};

export default ProfileCard;
