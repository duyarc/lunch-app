import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export type MealTime = 'breakfast' | 'lunch' | 'afternoon' | 'dinner' | 'latenight';

export interface Restaurant {
    id: string;
    name: string;
    lat?: number;
    long?: number;
    score?: number;
}

export function getMealTime(): MealTime {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 15 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'dinner';
    return 'latenight';
}

export function getUserId(): string {
    const STORAGE_KEY = 'lunch_user_id';
    let userId = localStorage.getItem(STORAGE_KEY);

    if (!userId) {
        // Generate UUID v4
        userId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        localStorage.setItem(STORAGE_KEY, userId);
    }

    return userId;
}

export function getMealTitle(meal: MealTime): string {
    switch (meal) {
        case 'breakfast': return 'Sáng nay ăn gì?';
        case 'lunch': return 'Trưa nay ăn gì?';
        case 'afternoon': return 'Chiều nay ăn gì?';
        case 'dinner': return 'Tối nay ăn gì?';
        case 'latenight': return 'Đêm khuya ăn gì?';
    }
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}
