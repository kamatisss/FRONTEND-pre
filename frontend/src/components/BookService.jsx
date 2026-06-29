import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { useAuth } from '../context/AuthContext';
import { CalendarPlus, CheckCircle2, Clock, CalendarCheck, AlertCircle, MapPin, Sparkles } from 'lucide-react';

const BookService = () => {
    const { authTokens } = useAuth();
    const location = useLocation();
    const incomingDesign = location.state || {};

    const [blackoutDates, setBlackoutDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [serviceType, setServiceType] = useState('maintenance');
    const [contactNumber, setContactNumber] = useState('');
    const [serviceAddress, setServiceAddress] = useState('');
    const [preferredTime, setPreferredTime] = useState('anytime');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [locating, setLocating] = useState(false);
    const [locatingError, setLocatingError] = useState('');
    const [designs, setDesigns] = useState([]);
    const [selectedDesignId, setSelectedDesignId] = useState('');

    // Pre-populated states from AI Designer Context
    const [budget, setBudget] = useState('');
    const [lotWidth, setLotWidth] = useState('');
    const [lotLength, setLotLength] = useState('');
    const [designProfile, setDesignProfile] = useState('');
    const [estimatedPricing, setEstimatedPricing] = useState('');
    const [previewImage, setPreviewImage] = useState('');

    // Load pending booking context on mount
    useEffect(() => {
        const contextStr = localStorage.getItem('pending_booking_context');
        if (contextStr) {
            try {
                const context = JSON.parse(contextStr);
                if (context) {
                    if (context.budget) setBudget(context.budget);
                    if (context.lotWidth) setLotWidth(context.lotWidth);
                    if (context.lotLength) setLotLength(context.lotLength);
                    if (context.selectedProfile || context.designName) {
                        setDesignProfile(context.selectedProfile || context.designName);
                    }
                    if (context.estimatedPricing || context.totalCost) {
                        setEstimatedPricing(context.estimatedPricing || context.totalCost);
                    }
                    if (context.imagePreview) {
                        setPreviewImage(context.imagePreview);
                    }
                    setServiceType('consultation');
                }
            } catch (e) {
                console.error("Error parsing pending_booking_context:", e);
            }
        }
    }, []);

    useEffect(() => {
        const fetchBlackoutDates = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/blackout-dates/`);
                const data = await res.json();
                setBlackoutDates(data.map(b => new Date(b.date + 'T00:00:00')));
            } catch (error) {
                console.error('Error fetching blackout dates:', error);
            }
        };
        fetchBlackoutDates();
    }, []);

    useEffect(() => {
        const fetchDesigns = async () => {
            if (!authTokens) return;
            try {
                const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/designs/`, {
                    headers: {
                        'Authorization': `Bearer ${authTokens.access}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    setDesigns(data);
                }
            } catch (error) {
                console.error('Error fetching designs:', error);
            }
        };
        fetchDesigns();
    }, [authTokens]);

    // Auto-select the design that was passed from the AI Designer
    useEffect(() => {
        if (!incomingDesign.designId || designs.length === 0) return;
        const match = designs.find(
            d => String(d.id) === String(incomingDesign.designId)
        );
        if (match) {
            setSelectedDesignId(String(match.id));
            setServiceType('consultation');
        }
    }, [designs, incomingDesign.designId]);

    const handleLocate = () => {
        setLocating(true);
        setLocatingError("");

        if (!navigator.geolocation) {
            setLocatingError("Could not get location. Geolocation is not supported by your device browser. Please type your address.");
            setLocating(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'GardenStudio-App/1.0'
                        }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.display_name) {
                            setServiceAddress(data.display_name);
                        } else {
                            setLocatingError("Could not get location. Please type your address.");
                        }
                    } else {
                        setLocatingError("Could not get location. Please type your address.");
                    }
                } catch (err) {
                    console.error("Reverse geocoding failed:", err);
                    setLocatingError("Could not get location. Please type your address.");
                } finally {
                    setLocating(false);
                }
            },
            (err) => {
                let errorDetails = "";
                if (err.code === err.PERMISSION_DENIED) {
                    errorDetails = "Location permission denied. Please allow GPS access.";
                } else if (err.code === err.POSITION_UNAVAILABLE) {
                    errorDetails = "Location unavailable. Ensure GPS/Wi-Fi is on.";
                } else if (err.code === err.TIMEOUT) {
                    errorDetails = "Location request timed out. Please try again.";
                }
                const finalMsg = errorDetails
                    ? `Could not get location. ${errorDetails} Please type your address.`
                    : "Could not get location. Please type your address.";
                setLocatingError(finalMsg);
                setLocating(false);
                setTimeout(() => {
                    setLocatingError("");
                }, 5000);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedDate) {
            setMessage('Please select a valid date.');
            return;
        }

        setLoading(true);
        setMessage('');

        const offset = selectedDate.getTimezoneOffset();
        const localDate = new Date(selectedDate.getTime() - (offset*60*1000));
        const formattedDate = localDate.toISOString().split('T')[0];

        // Format custom notes to append budget & dimensions for server tracking
        let finalNotes = notes;
        if (budget || lotWidth || lotLength || designProfile) {
            finalNotes += `\n\n--- AI Designer Context ---`;
            if (designProfile) finalNotes += `\nDesign Profile: ${designProfile}`;
            if (estimatedPricing) finalNotes += `\nEstimated Pricing: ₱${Number(estimatedPricing).toLocaleString()}`;
            if (budget) finalNotes += `\nBudget: ₱${Number(budget).toLocaleString()}`;
            if (lotWidth || lotLength) finalNotes += `\nDimensions: ${lotWidth}m x ${lotLength}m`;
        }

        try {
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/bookings/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authTokens.access}`
                },
                body: JSON.stringify({
                    service_type: serviceType,
                    scheduled_date: formattedDate,
                    contact_number: contactNumber,
                    preferred_time: preferredTime,
                    service_address: serviceAddress,
                    notes: finalNotes,
                    design: selectedDesignId ? parseInt(selectedDesignId, 10) : null
                })
            });

            if (res.ok) {
                setMessage('Booking submitted successfully! Our staff will review it shortly.');
                setSelectedDate(null);
                setContactNumber('');
                setServiceAddress('');
                setPreferredTime('anytime');
                setNotes('');
                setSelectedDesignId('');
                
                // Clear the temporary storage item once the final booking payload is safely committed to the server
                localStorage.removeItem('pending_booking_context');
                setBudget('');
                setLotWidth('');
                setLotLength('');
                setDesignProfile('');
                setEstimatedPricing('');
                setPreviewImage('');
            } else {
                const data = await res.json();
                setMessage('Error: ' + JSON.stringify(data));
            }
        } catch (error) {
            setMessage('Error submitting booking.');
        } finally {
            setLoading(false);
        }
    };

    /* Inline style objects -- guarantees rendering regardless of Tailwind JIT */
    const styles = {
        page: {
            minHeight: '100vh',
            background: '#F3F4F6',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '6rem 2rem 5rem 2rem',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            boxSizing: 'border-box',
            overflowY: 'auto',
        },
        card: {
            width: '100%',
            maxWidth: '960px',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
        },
        leftCol: {
            width: '55%',
            padding: '3rem 3rem 80px 3rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
        },
        rightCol: {
            width: '45%',
            background: '#F0FDF4',
            padding: '3rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            borderLeft: '1px solid #DCFCE7',
        },
        heading: {
            fontSize: '1.75rem',
            fontWeight: 900,
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px',
            letterSpacing: '-0.02em',
        },
        subtitle: {
            fontSize: '1rem',
            color: '#6b7280',
            fontWeight: 500,
            marginBottom: '2rem',
        },
        label: {
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#334155',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
        },
        inputBase: {
            width: '100%',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            color: '#334155',
            fontSize: '0.95rem',
            fontWeight: 500,
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s, box-shadow 0.2s',
        },
        selectWrap: {
            position: 'relative',
        },
        selectArrow: {
            position: 'absolute',
            right: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: '#94a3b8',
        },
        formGroup: {
            marginBottom: '1.5rem',
        },
        twoColRow: {
            display: 'flex',
            gap: '1rem',
        },
        halfCol: {
            flex: 1,
        },
        button: {
            width: '100%',
            padding: '16px',
            background: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: '2rem',
            marginBottom: '1rem',
            boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
            transition: 'background 0.2s, transform 0.15s',
        },
        buttonDisabled: {
            background: '#86efac',
            cursor: 'not-allowed',
        },
        rightHeading: {
            fontSize: '1.4rem',
            fontWeight: 700,
            color: '#14532d',
            marginBottom: '2rem',
            letterSpacing: '-0.01em',
        },
        stepRow: {
            display: 'flex',
            gap: '16px',
            marginBottom: '2rem',
        },
        stepIcon: {
            flexShrink: 0,
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#DCFCE7',
            border: '3px solid #ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#16a34a',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        },
        stepTitle: {
            fontWeight: 700,
            color: '#14532d',
            fontSize: '1.05rem',
            marginBottom: '4px',
        },
        stepDesc: {
            color: 'rgba(22,101,52,0.75)',
            fontSize: '0.85rem',
            lineHeight: 1.5,
        },
        alertSuccess: {
            padding: '14px 16px',
            marginBottom: '1.5rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#166534',
            fontSize: '0.88rem',
            fontWeight: 500,
        },
        alertError: {
            padding: '14px 16px',
            marginBottom: '1.5rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            fontSize: '0.88rem',
            fontWeight: 500,
        },
    };

    const isError = message.includes('Error') || message.includes('Please select');

    return (
        <div style={styles.page}>
            <div style={styles.card}>

                {/* Left Column: The Form */}
                <div style={styles.leftCol}>
                    <h2 style={styles.heading}>
                        <CalendarPlus style={{ color: '#10b981' }} size={30} />
                        Book a Service
                    </h2>
                    <p style={styles.subtitle}>
                        Select a date, service type, and let us know how we can help.
                    </p>

                    {message && (
                        <div style={isError ? styles.alertError : styles.alertSuccess}>
                            {isError
                                ? <AlertCircle style={{ flexShrink: 0, marginTop: '2px' }} size={18} />
                                : <CheckCircle2 style={{ flexShrink: 0, marginTop: '2px' }} size={18} />
                            }
                            <span>{message}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Service Type */}
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Service Type</label>
                            <div style={styles.selectWrap}>
                                <select
                                    value={serviceType}
                                    onChange={(e) => setServiceType(e.target.value)}
                                    style={{ ...styles.inputBase, appearance: 'none', cursor: 'pointer', paddingRight: '40px' }}
                                >
                                    <option value="maintenance">Maintenance</option>
                                    <option value="consultation">Consultation</option>
                                    <option value="hardscaping">Full Hardscaping</option>
                                    <option value="Softscape">Softscape / Planting Services</option>
                                </select>
                                <div style={styles.selectArrow}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </div>
                            </div>
                        </div>

                        {/* Budget (₱) */}
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Budget (₱)</label>
                            <input
                                type="number"
                                value={budget}
                                onChange={(e) => setBudget(e.target.value)}
                                placeholder="e.g. 5000"
                                style={styles.inputBase}
                            />
                        </div>

                        {/* Dimensions (Lot Width x Lot Length in meters) */}
                        <div style={{ ...styles.formGroup, ...styles.twoColRow }}>
                            <div style={styles.halfCol}>
                                <label style={styles.label}>Lot Width (m)</label>
                                <input
                                    type="number"
                                    value={lotWidth}
                                    onChange={(e) => setLotWidth(e.target.value)}
                                    placeholder="e.g. 10"
                                    style={styles.inputBase}
                                />
                            </div>
                            <div style={styles.halfCol}>
                                <label style={styles.label}>Lot Length (m)</label>
                                <input
                                    type="number"
                                    value={lotLength}
                                    onChange={(e) => setLotLength(e.target.value)}
                                    placeholder="e.g. 15"
                                    style={styles.inputBase}
                                />
                            </div>
                        </div>

                        {/* Contact Number */}
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Contact Number</label>
                            <input
                                type="tel"
                                value={contactNumber}
                                onChange={(e) => setContactNumber(e.target.value)}
                                placeholder="e.g. 09171234567"
                                style={styles.inputBase}
                            />
                        </div>

                        {/* Scheduled Date + Preferred Time (Side by Side) */}
                        <div style={{ ...styles.formGroup, ...styles.twoColRow }}>
                            <div style={styles.halfCol}>
                                <label style={styles.label}>Scheduled Date</label>
                                <div className="custom-datepicker-wrapper" style={{ position: 'relative' }}>
                                    <DatePicker
                                        selected={selectedDate}
                                        onChange={(date) => setSelectedDate(date)}
                                        excludeDates={blackoutDates}
                                        minDate={new Date()}
                                        placeholderText="Select a date"
                                        className="book-date-input"
                                    />
                                    <div style={styles.selectArrow}>
                                        <CalendarPlus size={18} />
                                    </div>
                                </div>
                                <style>{`
                                    .custom-datepicker-wrapper .react-datepicker-wrapper {
                                        width: 100%;
                                    }
                                    .book-date-input {
                                        width: 100%;
                                        padding: 12px 40px 12px 16px;
                                        border-radius: 10px;
                                        border: 1px solid #e2e8f0;
                                        background: #f8fafc;
                                        color: #334155;
                                        font-size: 0.95rem;
                                        font-weight: 500;
                                        outline: none;
                                        box-sizing: border-box;
                                        cursor: pointer;
                                        transition: border-color 0.2s, box-shadow 0.2s;
                                    }
                                    .book-date-input:focus {
                                        border-color: #10b981;
                                        box-shadow: 0 0 0 3px rgba(16,185,129,0.15);
                                    }
                                    .book-date-input::placeholder {
                                        color: #94a3b8;
                                    }
                                    .react-datepicker {
                                        font-family: inherit;
                                        border: 1px solid #e2e8f0;
                                        border-radius: 12px;
                                        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                                        padding: 8px;
                                    }
                                    .react-datepicker__header {
                                        background-color: white;
                                        border-bottom: 1px solid #f1f5f9;
                                    }
                                    .react-datepicker__day--selected,
                                    .react-datepicker__day--keyboard-selected {
                                        background-color: #10b981 !important;
                                        color: white !important;
                                        border-radius: 8px;
                                    }
                                    .react-datepicker__day:hover {
                                        border-radius: 8px;
                                        background-color: #d1fae5;
                                    }
                                    .react-datepicker__day--excluded {
                                        color: #cbd5e1 !important;
                                        text-decoration: line-through;
                                    }
                                    @keyframes spin {
                                        from { transform: rotate(0deg); }
                                        to { transform: rotate(360deg); }
                                    }
                                `}</style>
                            </div>
                            <div style={styles.halfCol}>
                                <label style={styles.label}>Preferred Time</label>
                                <div style={styles.selectWrap}>
                                    <select
                                        value={preferredTime}
                                        onChange={(e) => setPreferredTime(e.target.value)}
                                        style={{ ...styles.inputBase, appearance: 'none', cursor: 'pointer', paddingRight: '40px' }}
                                    >
                                        <option value="anytime">Anytime</option>
                                        <option value="morning">Morning (8AM – 12PM)</option>
                                        <option value="afternoon">Afternoon (1PM – 5PM)</option>
                                    </select>
                                    <div style={styles.selectArrow}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Service Address */}
                        <div style={styles.formGroup}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ ...styles.label, margin: 0 }}>Service Address</label>
                                <button
                                    type="button"
                                    onClick={handleLocate}
                                    disabled={locating}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: locating ? '#94a3b8' : '#10b981',
                                        background: 'none',
                                        border: 'none',
                                        cursor: locating ? 'not-allowed' : 'pointer',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        transition: 'background 0.2s',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.03em',
                                    }}
                                    onMouseEnter={(e) => { if (!locating) e.currentTarget.style.background = '#f0fdf4'; }}
                                    onMouseLeave={(e) => { if (!locating) e.currentTarget.style.background = 'none'; }}
                                >
                                    <MapPin size={12} style={{ animation: locating ? 'spin 1.5s linear infinite' : 'none' }} />
                                    {locating ? 'Locating...' : 'Use Current Location'}
                                </button>
                            </div>
                            <textarea
                                value={serviceAddress}
                                onChange={(e) => {
                                    setServiceAddress(e.target.value);
                                    setLocatingError("");
                                }}
                                rows={2}
                                placeholder="Full address where the service will be performed"
                                style={{ ...styles.inputBase, resize: 'none' }}
                            />
                            {locatingError && (
                                <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: '4px 0 0 0', fontWeight: 600 }}>
                                    {locatingError}
                                </p>
                            )}
                        </div>

                        {/* Notes */}
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Project Details / Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                placeholder="Tell us more about what you need..."
                                style={{ ...styles.inputBase, resize: 'none' }}
                            />
                        </div>

                        {/* Attach a Saved 3D Design (Optional) */}
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Attach a Saved 3D Design (Optional)</label>

                            {/* Confirmation badge — shown when navigated from AI Designer or loaded from context */}
                            {(incomingDesign.designName || designProfile) && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    padding: '14px 18px',
                                    background: '#F0FDF4',
                                    border: '1.5px solid #BBF7D0',
                                    borderRadius: '12px',
                                    marginBottom: '14px',
                                }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <Sparkles size={15} color="#10b981" style={{ flexShrink: 0 }} />
                                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                Pre-filled from AI Designer
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#14532d', marginBottom: '4px' }}>
                                            {incomingDesign.designName || designProfile}
                                        </div>
                                        {(incomingDesign.totalCost != null || estimatedPricing) && (
                                            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                                                Estimated Pricing: <span style={{ color: '#10b981' }}>₱{Number(incomingDesign.totalCost || estimatedPricing).toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                    {(previewImage || incomingDesign.previewImage) && (
                                        <div style={{ flexShrink: 0 }}>
                                            <img
                                                src={previewImage || incomingDesign.previewImage}
                                                alt="Design Preview"
                                                style={{
                                                    maxWidth: '120px',
                                                    height: 'auto',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #BBF7D0',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                                    display: 'block'
                                                }}
                                            />
                                        </div>
                                    )}
                                    {(selectedDesignId || designProfile) && (
                                        <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0 }} />
                                    )}
                                </div>
                            )}

                            {designs.length > 0 ? (
                                <div style={styles.selectWrap}>
                                    <select
                                        value={selectedDesignId}
                                        onChange={(e) => setSelectedDesignId(e.target.value)}
                                        style={{ ...styles.inputBase, appearance: 'none', cursor: 'pointer', paddingRight: '40px' }}
                                    >
                                        <option value="">-- Select a saved design --</option>
                                        {designs.map((design) => (
                                            <option key={design.id} value={design.id}>
                                                {design.name || `Design #${design.id}`}
                                            </option>
                                        ))}
                                    </select>
                                    <div style={styles.selectArrow}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                    </div>
                                </div>
                            ) : (
                                <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0, padding: '12px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', lineHeight: 1.5 }}>
                                    No saved designs found. You can create one in the <a href="/studio" style={{ color: '#10b981', fontWeight: 600, textDecoration: 'none' }}>My 3D Studio</a> link above before booking.
                                </p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                ...styles.button,
                                ...(loading ? styles.buttonDisabled : {}),
                            }}
                            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#059669'; }}
                            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#10b981'; }}
                        >
                            {loading ? 'Submitting...' : 'Confirm Booking'}
                        </button>
                    </form>
                </div>

                {/* Right Column: What to Expect */}
                <div style={styles.rightCol}>
                    <h3 style={styles.rightHeading}>What Happens Next?</h3>

                    <div style={styles.stepRow}>
                        <div style={styles.stepIcon}>
                            <CheckCircle2 size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div style={styles.stepTitle}>1. Request Submitted</div>
                            <div style={styles.stepDesc}>
                                Your booking details are securely sent to our management team for initial review.
                            </div>
                        </div>
                    </div>

                    <div style={styles.stepRow}>
                        <div style={styles.stepIcon}>
                            <Clock size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div style={styles.stepTitle}>2. Expert Review</div>
                            <div style={styles.stepDesc}>
                                Our gardening experts will review your timeline and assess resource availability.
                            </div>
                        </div>
                    </div>

                    <div style={{ ...styles.stepRow, marginBottom: 0 }}>
                        <div style={styles.stepIcon}>
                            <CalendarCheck size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div style={styles.stepTitle}>3. Booking Confirmed</div>
                            <div style={styles.stepDesc}>
                                You'll receive an email confirmation with full details of your upcoming service.
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BookService;
