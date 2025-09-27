import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useStore } from '@tanstack/react-store';
import { f1Store } from '~/store/f1-store';

const formatXAxis = (time: string) => {
    const date = new Date(time);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatXAxisTooltip = (time: string) => {
    const date = new Date(time);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

const WindDirectionArrow = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.WindDirection === undefined || cx === null || cy === null) {
        return null;
    }
    const angle = payload.WindDirection;

    return (
        <svg x={cx - 8} y={cy - 8} width="16" height="16" viewBox="0 0 24 24" fill="#8884d8">
            <path transform={`rotate(${angle}, 12, 12)`} d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
        </svg>
    );
};

export const WeatherCharts: React.FC = () => {
    const weatherDataSeries = useStore(f1Store, (state) => state.weatherDataSeries);

    if (!weatherDataSeries) {
        return null;
    }

    const chartData = weatherDataSeries.Series.map(entry => ({
        time: entry.Timestamp,
        AirTemp: parseFloat(entry.Weather.AirTemp),
        TrackTemp: parseFloat(entry.Weather.TrackTemp),
        WindSpeed: parseFloat(entry.Weather.WindSpeed),
        WindDirection: parseInt(entry.Weather.WindDirection, 10),
    }));

    return (
        <div className="w-full h-full flex flex-col bg-white dark:bg-black">
            {/* Temperature Chart */}
            <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="5 5" stroke="#4B5563" />
                        <XAxis dataKey="time" tickFormatter={formatXAxis} stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', offset: 5, fill: '#9CA3AF' }} stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <Tooltip
                            labelFormatter={formatXAxisTooltip}
                            contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', border: '1px solid #3f3f46' }}
                            labelStyle={{ color: '#d4d4d8' }}
                            formatter={(value: number, name: string) => [`${value.toFixed(1)}°C`, name]}
                        />
                        <Legend wrapperStyle={{ top: 0 }} />
                        <Line type="monotone" dataKey="AirTemp" name="Air Temp" stroke="#3b82f6" dot={false} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="TrackTemp" name="Track Temp" stroke="#f97316" dot={false} activeDot={{ r: 6 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Wind Chart */}
            <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                        <XAxis dataKey="time" tickFormatter={formatXAxis} stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis label={{ value: 'Wind (m/s)', angle: -90, position: 'insideLeft', offset: 5, fill: '#9CA3AF' }} stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <Tooltip
                            labelFormatter={formatXAxisTooltip}
                            contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', border: '1px solid #3f3f46' }}
                            labelStyle={{ color: '#d4d4d8' }}
                            formatter={(value: number, name: string, props: any) => {
                                if (name === 'WindSpeed') {
                                    const direction = props.payload.WindDirection;
                                    return [`${value.toFixed(1)} km/h (${direction}°)`, `Wind`];
                                }
                                return [value, name];
                            }}
                        />
                        <Legend wrapperStyle={{ top: 0 }} />
                        <Line type="monotone" dataKey="WindSpeed" name="Wind" stroke="#8884d8" dot={<WindDirectionArrow />} activeDot={{ r: 6 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
