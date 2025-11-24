import { useState, useEffect } from 'react';
import { getCurrentWeather, type WeatherData } from '../lib/weather';

export interface AppContext {
    weather: WeatherData | null;
    location: { lat: number; lon: number } | null;
    loading: boolean;
    dayOfWeek: number; // 0-6
    hour: number;
}

export function useAppContext() {
    const [context, setContext] = useState<AppContext>({
        weather: null,
        location: null,
        loading: true,
        dayOfWeek: new Date().getDay(),
        hour: new Date().getHours(),
    });

    useEffect(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const weather = await getCurrentWeather(latitude, longitude);

                    setContext(prev => ({
                        ...prev,
                        location: { lat: latitude, lon: longitude },
                        weather,
                        loading: false
                    }));
                },
                (error) => {
                    console.error('Error getting location:', error);
                    // Fallback to Hanoi/HCM or just generic
                    setContext(prev => ({ ...prev, loading: false }));
                }
            );
        } else {
            setContext(prev => ({ ...prev, loading: false }));
        }
    }, []);

    return context;
}
