import { useState, useEffect } from 'react';

interface GeolocationState {
    latitude: number | null;
    longitude: number | null;
    error: string | null;
    loading: boolean;
}

export function useGeolocation() {
    const [state, setState] = useState<GeolocationState>({
        latitude: null,
        longitude: null,
        error: null,
        loading: true,
    });

    // Helper to calculate distance in meters
    const getDistanceFromLatLonInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // Radius of the earth in meters
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in meters
        return d;
    };

    const deg2rad = (deg: number) => {
        return deg * (Math.PI / 180);
    };

    useEffect(() => {
        if (!navigator.geolocation) {
            setState((prev) => ({
                ...prev,
                error: 'Geolocation is not supported by your browser',
                loading: false,
            }));
            return;
        }

        const handleSuccess = (position: GeolocationPosition) => {
            setState((prev) => {
                // If we have a previous position, check distance
                if (prev.latitude && prev.longitude) {
                    const dist = getDistanceFromLatLonInMeters(
                        prev.latitude,
                        prev.longitude,
                        position.coords.latitude,
                        position.coords.longitude
                    );
                    // Only update if moved more than 50 meters
                    if (dist < 50) {
                        return prev;
                    }
                }

                return {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    error: null,
                    loading: false,
                };
            });
        };

        const handleError = (error: GeolocationPositionError) => {
            setState((prev) => ({
                ...prev,
                error: error.message,
                loading: false,
            }));
        };

        navigator.geolocation.getCurrentPosition(handleSuccess, handleError);

        const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError);

        return () => {
            navigator.geolocation.clearWatch(watchId);
        };
    }, []);

    return state;
}
