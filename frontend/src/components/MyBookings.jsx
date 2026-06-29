import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { Calendar, Check, Clock, MapPin, AlertTriangle, Star, CalendarPlus, CheckCircle2, CalendarCheck, Sparkles, X, AlertCircle } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import ServiceRatingModal from './ServiceRatingModal';

const getActiveStep = (status, hasDesign) => {
    switch (status) {
        case 'Pending':
            return hasDesign ? 3 : 1;
        case 'Preparing':
            return 4;
        case 'Installing':
            return 5;
        case 'Finished':
        case 'Completed':
            return 6;
        default:
            return -1;
    }
};

const BookingMilestoneTracker = ({ status, hasDesign }) => {
    const activeStep = getActiveStep(status, hasDesign);
    
    const steps = [
        { label: 'Request Submitted', desc: 'Booking request sent' },
        { label: 'AI Layout Created', desc: 'AI design generated' },
        { label: 'Staff Review', desc: 'Reviewing layout details' },
        { label: 'Finalized Studio Plan', desc: 'Ready in 3D Studio' },
        { label: 'Dispatched', desc: 'Crew prepared & routed' },
        { label: 'Work in Progress', desc: 'Installation active on site' },
        { label: 'Completed', desc: 'Project signed off' }
    ];

    if (status === 'Cancelled') {
        return (
            <div style={{
                background: '#FEF2F2',
                border: '1px solid #FEE2E2',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '1.5rem',
                marginBottom: '1.5rem',
            }}>
                <AlertTriangle size={20} style={{ color: '#EF4444', flexShrink: 0 }} />
                <div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#991B1B' }}>Booking Cancelled</h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#B91C1C' }}>
                        This booking has been cancelled. If you need any assistance, please create a new booking request.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ marginTop: '2rem', marginBottom: '2rem', padding: '0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', width: '100%' }}>
                
                {/* Background progress line */}
                <div 
                    className="stepper-line"
                    style={{
                        position: 'absolute',
                        top: '20px',
                        left: '7%',
                        right: '7%',
                        height: '4px',
                        background: '#EDE8DF',
                        zIndex: 0,
                    }} 
                />

                {/* Active progress line fill */}
                {activeStep > 0 && (
                    <div 
                        className="stepper-line-fill"
                        style={{
                            position: 'absolute',
                            top: '20px',
                            left: '7%',
                            width: `${(activeStep / (steps.length - 1)) * 86}%`,
                            height: '4px',
                            background: 'linear-gradient(135deg, #2D4A2D, #4A7A3A)',
                            zIndex: 1,
                            transition: 'width 0.4s ease-in-out',
                        }} 
                    />
                )}

                {/* Steps */}
                {steps.map((step, idx) => {
                    const isCompleted = idx < activeStep;
                    const isActive = idx === activeStep;

                    let nodeStyle = {
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                        transition: 'all 0.3s ease',
                        boxSizing: 'border-box',
                    };

                    if (isCompleted) {
                        nodeStyle = {
                            ...nodeStyle,
                            background: '#4A7A3A',
                            color: '#F7F3EC',
                            border: '2px solid #4A7A3A',
                        };
                    } else if (isActive) {
                        nodeStyle = {
                            ...nodeStyle,
                            background: '#FDFAF6',
                            color: '#4A7A3A',
                            border: '3px solid #4A7A3A',
                        };
                    } else {
                        nodeStyle = {
                            ...nodeStyle,
                            background: '#F5F0E8',
                            color: '#9A9080',
                            border: '2px solid #E8E1D4',
                        };
                    }

                    return (
                        <div key={idx} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            width: `${100 / steps.length}%`,
                            position: 'relative',
                            zIndex: 2,
                        }}>
                            {/* Circle Node */}
                            <div 
                                style={nodeStyle}
                                className={isActive ? "stepper-node stepper-active-node" : "stepper-node"}
                            >
                                {isCompleted ? (
                                    <Check size={18} strokeWidth={3} />
                                ) : isActive ? (
                                    <Clock size={18} strokeWidth={2.5} />
                                ) : (
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{idx + 1}</span>
                                )}
                            </div>

                            {/* Labels */}
                            <div className="stepper-labels-container" style={{ textAlign: 'center', marginTop: '12px' }}>
                                <div className="stepper-label" style={{
                                    fontSize: '0.8rem',
                                    fontWeight: isActive || isCompleted ? 700 : 500,
                                    color: isActive ? '#4A7A3A' : isCompleted ? '#1A2E1A' : '#9A9080',
                                    lineHeight: 1.25,
                                    marginBottom: '4px',
                                }}>
                                    {step.label}
                                </div>
                                <div className="stepper-desc" style={{
                                    fontSize: '0.7rem',
                                    color: '#9A9080',
                                    fontWeight: 500,
                                }}>
                                    {step.desc}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* ─── NewBookingModal Component ─── */
function NewBookingModal({ isOpen, onClose, onSuccess }) {
    const { authTokens } = useAuth();
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
    const location = useLocation();

    // Auto-select design and set service type if user came from AI designer page
    useEffect(() => {
        if (isOpen && location.state?.designId) {
            setSelectedDesignId(String(location.state.designId));
            setServiceType('consultation');
        }
    }, [isOpen, location.state]);

    useEffect(() => {
        if (!isOpen) return;
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
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !authTokens) return;
        const fetchDesigns = async () => {
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
    }, [isOpen, authTokens]);

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
                    notes: notes,
                    design: selectedDesignId ? parseInt(selectedDesignId, 10) : null
                })
            });

            if (res.ok) {
                const newBooking = await res.json();
                onSuccess(newBooking);
                // Reset form
                setSelectedDate(null);
                setContactNumber('');
                setServiceAddress('');
                setPreferredTime('anytime');
                setNotes('');
                setSelectedDesignId('');
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

    if (!isOpen) return null;
    const isError = message.includes('Error') || message.includes('Please select');

    return (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
            style={{ background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-[24px] border border-slate-200 overflow-hidden w-full max-w-[900px] shadow-2xl relative flex flex-col md:flex-row max-h-[90vh]"
                style={{ fontFamily: "'Inter', sans-serif" }}
                onClick={e => e.stopPropagation()}
            >
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer bg-transparent border-none z-10"
                >
                    <X size={20} />
                </button>

                {/* Left Column: Form */}
                <div className="w-full md:w-[60%] p-6 md:p-8 overflow-y-auto max-h-[85vh] md:max-h-[90vh]">
                    <h3 className="text-[22px] font-black text-slate-900 flex items-center gap-2 mb-1">
                        <CalendarPlus style={{ color: '#4A7A3A' }} size={24} />
                        Book a Service
                    </h3>
                    <p className="text-slate-500 text-xs font-semibold mb-6">
                        Select a date, service type, and let us know how we can help.
                    </p>

                    {message && (
                        <div style={{
                            padding: '12px 14px',
                            marginBottom: '1.5rem',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            background: isError ? '#FEF2F2' : '#F0FDF4',
                            border: isError ? '1px solid #FECACA' : '1px solid #BBF7D0',
                            color: isError ? '#991B1B' : '#166534',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                        }}>
                            {isError
                                ? <AlertCircle style={{ flexShrink: 0, marginTop: '2px' }} size={16} />
                                : <CheckCircle2 style={{ flexShrink: 0, marginTop: '2px' }} size={16} />
                            }
                            <span>{message}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {/* Service Type */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Service Type</label>
                            <div className="relative">
                                <select
                                    value={serviceType}
                                    onChange={(e) => setServiceType(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-[12px] text-sm text-slate-800 font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none appearance-none cursor-pointer"
                                >
                                    <option value="maintenance">Maintenance</option>
                                    <option value="consultation">Consultation</option>
                                    <option value="hardscaping">Full Hardscaping</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </div>
                            </div>
                        </div>

                        {/* Contact Number */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Contact Number</label>
                            <input
                                type="tel"
                                value={contactNumber}
                                onChange={(e) => setContactNumber(e.target.value)}
                                placeholder="e.g. 09171234567"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-[12px] text-sm text-slate-800 font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
                                required
                            />
                        </div>

                        {/* Scheduled Date + Preferred Time */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Scheduled Date</label>
                                <div className="relative custom-datepicker-wrapper">
                                    <DatePicker
                                        selected={selectedDate}
                                        onChange={(date) => setSelectedDate(date)}
                                        excludeDates={blackoutDates}
                                        minDate={new Date()}
                                        placeholderText="Select a date"
                                        className="book-date-input"
                                        required
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <CalendarPlus size={16} />
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Preferred Time</label>
                                <div className="relative">
                                    <select
                                        value={preferredTime}
                                        onChange={(e) => setPreferredTime(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-[12px] text-sm text-slate-800 font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="anytime">Anytime</option>
                                        <option value="morning">Morning (8AM – 12PM)</option>
                                        <option value="afternoon">Afternoon (1PM – 5PM)</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Service Address */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Service Address</label>
                                <button
                                    type="button"
                                    onClick={handleLocate}
                                    disabled={locating}
                                    className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 bg-transparent hover:bg-emerald-50 px-2 py-0.5 rounded transition-all uppercase tracking-wider cursor-pointer border-none"
                                >
                                    <MapPin size={10} className={locating ? "animate-spin" : ""} />
                                    {locating ? 'Locating...' : 'Use GPS'}
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
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-[12px] text-sm text-slate-800 font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none resize-none"
                                required
                            />
                            {locatingError && (
                                <p className="text-[10px] text-red-500 font-bold mt-0.5">{locatingError}</p>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Project Details / Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Tell us more about what you need..."
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-[12px] text-sm text-slate-800 font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none resize-none"
                            />
                        </div>

                        {/* Attach Design */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Attach a Saved 3D Design (Optional)</label>
                            {designs.length > 0 ? (
                                <div className="relative">
                                    <select
                                        value={selectedDesignId}
                                        onChange={(e) => setSelectedDesignId(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-[12px] text-sm text-slate-800 font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="">-- Select a saved design --</option>
                                        {designs.map((design) => (
                                            <option key={design.id} value={design.id}>
                                                {design.name || `Design #${design.id}`}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-500 m-0 p-3 bg-slate-50 rounded-[12px] border border-slate-100 leading-normal">
                                    No saved designs found.
                                </p>
                            )}
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-bold rounded-[12px] border-none cursor-pointer shadow-md transition-all mt-2"
                        >
                            {loading ? 'Submitting...' : 'Confirm Booking'}
                        </button>
                    </form>
                </div>

                {/* Right Column: What to Expect */}
                <div className="w-full md:w-[40%] bg-emerald-50/50 p-6 md:p-8 flex flex-col justify-center border-t md:border-t-0 md:border-l border-emerald-100 overflow-y-auto max-h-[85vh] md:max-h-[90vh]">
                    <h4 className="text-[16px] font-black text-emerald-800 mb-6 tracking-normal">What Happens Next?</h4>

                    <div className="flex gap-4 mb-6">
                        <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-100 border-[2px] border-white flex items-center justify-center text-emerald-600 font-bold shadow-sm">
                            <CheckCircle2 size={16} />
                        </div>
                        <div>
                            <div className="font-bold text-emerald-800 text-xs mb-0.5">1. Request Submitted</div>
                            <div className="text-[11px] text-emerald-700/80 leading-relaxed font-medium">
                                Your booking details are securely sent to our management team for initial review.
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 mb-6">
                        <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-100 border-[2px] border-white flex items-center justify-center text-emerald-600 font-bold shadow-sm">
                            <Clock size={16} />
                        </div>
                        <div>
                            <div className="font-bold text-emerald-800 text-xs mb-0.5">2. Expert Review</div>
                            <div className="text-[11px] text-emerald-700/80 leading-relaxed font-medium">
                                Our gardening experts will review your timeline and assess resource availability.
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-100 border-[2px] border-white flex items-center justify-center text-emerald-600 font-bold shadow-sm">
                            <CalendarCheck size={16} />
                        </div>
                        <div>
                            <div className="font-bold text-emerald-800 text-xs mb-0.5">3. Booking Confirmed</div>
                            <div className="text-[11px] text-emerald-700/80 leading-relaxed font-medium">
                                You'll receive an email confirmation with full details of your upcoming service.
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

const MyBookings = () => {
    const { authTokens } = useAuth();
    const [bookings,         setBookings]         = useState([]);
    const [loading,          setLoading]          = useState(true);
    const [reviewedIds,      setReviewedIds]      = useState(new Set());
    const [ratingModal,      setRatingModal]      = useState(null); // bookingId or null
    const [reviewSuccessIds, setReviewSuccessIds] = useState(new Set());
    const [showNewBookingModal, setShowNewBookingModal] = useState(false);
    const location = useLocation();

    // Automatically open the booking modal if user is redirected from AI Designer page
    useEffect(() => {
        if (location.state?.autoOpenModal) {
            setShowNewBookingModal(true);
        }
    }, [location.state]);

    const handleNewBookingSuccess = (newBooking) => {
        setBookings(prev => [newBooking, ...prev]);
        setShowNewBookingModal(false);
    };

    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

    const fetchMyBookings = async () => {
        try {
            const res = await fetch(`${apiBase}/bookings/`, {
                headers: { 'Authorization': `Bearer ${authTokens.access}` }
            });
            const data = await res.json();
            setBookings(data);
        } catch (error) {
            console.error('Error fetching my bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyReviews = async () => {
        try {
            const res = await fetch(`${apiBase}/reviews/`, {
                headers: { 'Authorization': `Bearer ${authTokens.access}` }
            });
            if (res.ok) {
                const data = await res.json();
                setReviewedIds(new Set(data.map(r => r.booking)));
            }
        } catch { /* non-critical */ }
    };

    useEffect(() => {
        fetchMyBookings();
        fetchMyReviews();
    }, []);

    const handleCancelBooking = async (bookingId) => {
        if (window.confirm("Are you sure you want to cancel this booking?")) {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/bookings/${bookingId}/`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${authTokens.access}` }
                });
                if (res.ok) {
                    setBookings(prevBookings => prevBookings.filter(b => b.id !== bookingId));
                } else {
                    alert("Failed to cancel booking.");
                }
            } catch (err) {
                console.error("Error cancelling booking:", err);
            }
        }
    };

    const getStatusBadge = (status) => {
        const base = {
            padding: '4px 14px',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'inline-block',
            letterSpacing: '0.02em',
            border: '1.5px solid transparent'
        };
        switch (status) {
            case 'Pending':
                return { ...base, background: '#FDFAF6', color: '#C9883A', borderColor: '#E8E1D4' };
            case 'Confirmed':
            case 'Preparing':
                return { ...base, background: '#EAF0E4', color: '#4A7A3A', borderColor: '#8FAF7E' };
            case 'In Progress':
            case 'Installing':
                return { ...base, background: '#F0EBE0', color: '#8A7E6E', borderColor: '#D4CAB8' };
            case 'Completed':
            case 'Finished':
                return { ...base, background: '#EAF0E4', color: '#4A7A3A', borderColor: '#8FAF7E' };
            case 'Cancelled':
                return { ...base, background: '#FEF2F2', color: '#991B1B', borderColor: '#FECACA' };
            default:
                return { ...base, background: '#F5F0E8', color: '#9A9080', borderColor: '#E8E1D4' };
        }
    };

    const s = {
        page: {
            minHeight: 'calc(100vh - 64px)',
            background: 'linear-gradient(160deg, #F7F3EC 0%, #EAF0E4 60%, #F0EBE0 100%)',
            padding: '2.5rem 1.5rem',
            fontFamily: "'Inter', system-ui, sans-serif",
        },
        card: {
            width: '100%',
            maxWidth: '1024px',
            margin: '0 auto',
            background: '#FDFAF6',
            borderRadius: '20px',
            border: '1.5px solid #E8E1D4',
            boxShadow: '0 8px 30px rgba(45, 74, 45, 0.05)',
            overflow: 'hidden',
            padding: '2.5rem',
        },
        header: {
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '2rem',
            paddingBottom: '1.25rem',
            borderBottom: '1.5px solid #EDE8DF',
        },
        title: {
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '2rem',
            fontWeight: 800,
            color: '#1A2E1A',
            letterSpacing: '-0.01em',
            margin: 0,
        },
        empty: {
            padding: '4rem 1rem',
            textAlign: 'center',
            color: '#9A9080',
            fontSize: '1rem',
            fontWeight: 500,
        },
        loading: {
            padding: '4rem 1rem',
            textAlign: 'center',
            color: '#9A9080',
            fontSize: '1rem',
            fontWeight: 500,
        },
    };

    return (
        <>
        <div style={s.page}>
            <style>{`
                @keyframes stepperPulse {
                    0% { box-shadow: 0 0 0 0 rgba(74, 122, 58, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(74, 122, 58, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(74, 122, 58, 0); }
                }
                .stepper-active-node {
                    animation: stepperPulse 2s infinite;
                }
                @media (max-width: 768px) {
                    .stepper-desc {
                        display: none !important;
                    }
                    .stepper-label {
                        font-size: 0.65rem !important;
                        margin-top: 4px !important;
                    }
                    .stepper-node {
                        width: 32px !important;
                        height: 32px !important;
                    }
                    .stepper-line, .stepper-line-fill {
                        top: 16px !important;
                    }
                }
                @media (max-width: 480px) {
                    .stepper-label {
                        font-size: 0.55rem !important;
                        font-weight: 800 !important;
                    }
                    .stepper-node {
                        width: 24px !important;
                        height: 24px !important;
                    }
                    .stepper-node span {
                        font-size: 0.7rem !important;
                    }
                    .stepper-line, .stepper-line-fill {
                        top: 12px !important;
                        height: 3px !important;
                    }
                }
            `}</style>
            <div style={s.card}>

                {/* Card Header */}
                <div style={{ ...s.header, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <Calendar size={28} style={{ color: '#4A7A3A' }} />
                        <h2 style={s.title}>My Bookings</h2>
                    </div>
                    <button
                        onClick={() => setShowNewBookingModal(true)}
                        style={{
                            padding: '10px 20px',
                            background: '#4A7A3A',
                            color: '#FDFAF6',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(74, 122, 58, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#3D6130'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#4A7A3A'; }}
                    >
                        <CalendarPlus size={16} /> New Service
                    </button>
                </div>

                {loading ? (
                    <div style={s.loading}>Loading your bookings...</div>
                ) : bookings.length === 0 ? (
                    <div style={s.empty}>You don't have any bookings yet.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {bookings.map(b => (
                            <div key={b.id} style={{
                                background: '#ffffff',
                                borderRadius: '16px',
                                border: '1.5px solid #E8E1D4',
                                padding: '24px',
                                boxShadow: '0 4px 12px rgba(45, 74, 45, 0.03)',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#8FAF7E';
                                e.currentTarget.style.boxShadow = '0 8px 24px rgba(45, 74, 45, 0.08)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#E8E1D4';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(45, 74, 45, 0.03)';
                            }}
                            >
                                {/* Top row: Service Type & Status Badge */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            background: '#EAF0E4',
                                            color: '#4A7A3A',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            Service
                                        </span>
                                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1A2E1A', textTransform: 'capitalize' }}>
                                            {b.service_type}
                                        </h3>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <span style={getStatusBadge(b.status)}>
                                            {b.status}
                                        </span>
                                        {b.status.toLowerCase() === 'pending' && (
                                            <button
                                                onClick={() => handleCancelBooking(b.id)}
                                                style={{
                                                    fontSize: '0.8rem', fontWeight: 700, color: '#EF4444',
                                                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                                    textDecoration: 'none'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                            >
                                                Cancel Booking
                                            </button>
                                        )}
                                        {(b.status === 'Finished' || b.status === 'Completed') && (
                                            reviewSuccessIds.has(b.id) || reviewedIds.has(b.id) ? (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                    fontSize: '0.75rem', fontWeight: 700, color: '#059669',
                                                    background: '#ecfdf5', padding: '4px 10px',
                                                    borderRadius: '9999px', border: '1px solid #a7f3d0',
                                                }}>
                                                    <Star size={11} fill="#059669" color="#059669" /> Reviewed
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => setRatingModal(b.id)}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                        fontSize: '0.78rem', fontWeight: 700, color: '#fff',
                                                        background: '#10b981', border: 'none', padding: '5px 12px',
                                                        borderRadius: '9999px', cursor: 'pointer', transition: 'background .15s',
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                                                    onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
                                                >
                                                    <Star size={12} fill="white" color="white" /> Rate Our Service
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>

                                {/* Booking details grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1.5px solid #F0EBE0' }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8A7E6E', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Date & Time</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#2D2D2D' }}>
                                            {b.scheduled_date} {b.preferred_time ? `• ${b.preferred_time}` : ''}
                                        </span>
                                    </div>
                                    {b.service_address && (
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8A7E6E', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Location</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#2D2D2D', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <MapPin size={14} style={{ color: '#4A7A3A', flexShrink: 0 }} />
                                                {b.service_address}
                                            </span>
                                        </div>
                                    )}
                                    {b.contact_number && (
                                        <div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8A7E6E', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Contact</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#2D2D2D' }}>{b.contact_number}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Milestone Tracker */}
                                <BookingMilestoneTracker status={b.status} hasDesign={!!(b.design || b.design_details)} />

                                {/* Notes section if present */}
                                {b.notes && (
                                    <div style={{ marginTop: '16px', padding: '12px 16px', background: '#F9FAFB', borderRadius: '10px', border: '1px solid #F3F4F6' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Notes</span>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#4B5563', lineHeight: 1.5 }}>{b.notes}</p>
                                    </div>
                                )}

                                {/* Completed Photo Proof */}
                                {b.status === 'Completed' && b.clock_out_photo_url && (
                                    <div style={{ marginTop: '16px', padding: '16px', background: '#ECFDF5', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
                                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#065F46', fontWeight: 800 }}>
                                            Service Completed Proof Photo
                                        </h4>
                                        <img 
                                            src={b.clock_out_photo_url.startsWith('http') ? b.clock_out_photo_url : `${import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000'}${b.clock_out_photo_url}`} 
                                            alt="Finished work proof" 
                                            style={{
                                                maxWidth: '400px',
                                                width: '100%',
                                                height: '240px',
                                                objectFit: 'cover',
                                                borderRadius: '8px',
                                                border: '1px solid #D1D5DB',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

            </div>

            {/* New Service Booking Modal */}
            {showNewBookingModal && (
                <NewBookingModal
                    isOpen={showNewBookingModal}
                    onClose={() => setShowNewBookingModal(false)}
                    onSuccess={handleNewBookingSuccess}
                />
            )}
        </div>

        {ratingModal !== null && (
            <ServiceRatingModal
                bookingId={ratingModal}
                onClose={() => setRatingModal(null)}
                onSuccess={() => {
                    setReviewSuccessIds(prev => new Set([...prev, ratingModal]));
                    setRatingModal(null);
                }}
            />
        )}
        </>
    );
};

export default MyBookings;
