import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { useAuth } from '../context/AuthContext';
import { Calendar as CalendarIcon } from 'lucide-react';

const ManageAvailability = () => {
    const { authTokens } = useAuth();
    const [blackoutDates, setBlackoutDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [loading, setLoading] = useState(true);

    const fetchBlackoutDates = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/blackout-dates/`);
            const data = await res.json();
            data.sort((a, b) => new Date(a.date) - new Date(b.date));
            setBlackoutDates(data);
        } catch (error) {
            console.error('Error fetching blackout dates:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBlackoutDates();
    }, []);

    const handleDateChange = async (date) => {
        setSelectedDate(date);
        
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset*60*1000));
        const formattedDate = localDate.toISOString().split('T')[0];
        
        const existingBlackout = blackoutDates.find(b => b.date === formattedDate);

        try {
            if (existingBlackout) {
                // Delete
                await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/blackout-dates/${existingBlackout.id}/`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${authTokens.access}` }
                });
            } else {
                // Add
                await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/blackout-dates/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authTokens.access}`
                    },
                    body: JSON.stringify({ date: formattedDate, reason: 'Manual Blackout' })
                });
            }
            fetchBlackoutDates(); // refresh
        } catch (error) {
            console.error('Error toggling blackout date:', error);
        }
    };

    const highlightWithRanges = [
        {
            "react-datepicker__day--highlighted-custom-1": blackoutDates.map(b => new Date(b.date + 'T00:00:00'))
        }
    ];

    return (
        <div style={{ backgroundColor: '#f1f5f9', minHeight: '100%', padding: '40px', fontFamily: "'Inter', sans-serif" }}>
            <div style={{ 
                maxWidth: '1200px', 
                margin: '0 auto', 
                backgroundColor: '#ffffff', 
                borderRadius: '16px', 
                padding: '32px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)'
            }}>
                
                {/* Header */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    marginBottom: '32px'
                }}>
                    <CalendarIcon size={28} color="#1e293b" style={{ marginRight: '16px' }} />
                    <div>
                        <h1 style={{ color: '#1e293b', fontSize: '24px', margin: '0 0 4px 0', fontWeight: '800' }}>Manage Availability</h1>
                        <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>Click on any date to toggle its blackout status.</p>
                    </div>
                </div>

                <style>{`
                    .custom-datepicker-container .react-datepicker {
                        font-family: 'Inter', sans-serif;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                        padding: 16px;
                    }
                    .custom-datepicker-container .react-datepicker__header {
                        background-color: transparent;
                        border-bottom: none;
                        padding-top: 0;
                    }
                    .custom-datepicker-container .react-datepicker__current-month {
                        color: #1e293b;
                        font-weight: 700;
                        font-size: 16px;
                        margin-bottom: 8px;
                    }
                    .custom-datepicker-container .react-datepicker__day-name {
                        color: #64748b;
                        font-weight: 600;
                        font-size: 13px;
                        width: 40px;
                        margin: 4px;
                    }
                    .custom-datepicker-container .react-datepicker__day {
                        color: #334155;
                        width: 40px;
                        line-height: 40px;
                        margin: 4px;
                        border-radius: 50%;
                        font-weight: 500;
                        transition: all 0.2s;
                    }
                    .custom-datepicker-container .react-datepicker__day:hover {
                        background-color: #f1f5f9;
                        border-radius: 50%;
                    }
                    .custom-datepicker-container .react-datepicker__day--selected,
                    .custom-datepicker-container .react-datepicker__day--keyboard-selected {
                        background-color: #3b82f6 !important;
                        color: white !important;
                        border-radius: 50%;
                        font-weight: 700;
                    }
                    .custom-datepicker-container .react-datepicker__day--highlighted-custom-1 {
                        background-color: #ef4444 !important;
                        color: white !important;
                        border-radius: 50%;
                        font-weight: 700;
                    }
                    .custom-datepicker-container .react-datepicker__navigation {
                        top: 16px;
                    }
                    .custom-datepicker-container .react-datepicker__navigation-icon::before {
                        border-color: #64748b;
                    }
                `}</style>

                <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                    {/* Left Side: Calendar */}
                    <div className="custom-datepicker-container" style={{ flex: '1', minWidth: '350px' }}>
                        {loading ? <p style={{ color: '#64748b' }}>Loading calendar...</p> : (
                            <DatePicker
                                selected={selectedDate}
                                onChange={handleDateChange}
                                inline
                                highlightDates={highlightWithRanges}
                            />
                        )}
                    </div>

                    {/* Right Side: Details Panel */}
                    <div style={{ flex: '1', minWidth: '300px', background: '#f8fafc', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: '16px', fontWeight: '700' }}>Legend</h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
                                <span style={{ color: '#475569', fontSize: '14px', fontWeight: '500' }}>Current / Selected</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                                <span style={{ color: '#475569', fontSize: '14px', fontWeight: '500' }}>Unavailable / Closed</span>
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', marginBottom: '24px' }} />

                        <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: '16px', fontWeight: '700' }}>Upcoming Closed Dates</h3>
                        
                        {blackoutDates.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '14px' }}>No blackout dates set.</p>
                        ) : (
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {blackoutDates.filter(b => new Date(b.date) >= new Date(new Date().setHours(0,0,0,0))).slice(0, 10).map(b => (
                                    <li key={b.id} style={{ color: '#334155', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                                        {new Date(b.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ManageAvailability;
