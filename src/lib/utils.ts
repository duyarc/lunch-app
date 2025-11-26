import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export type MealTime = 'breakfast' | 'lunch' | 'dinner';

export function getMealTime(): MealTime {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    return 'dinner';
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
        case 'dinner': return 'Tối nay ăn gì?';
    }
}
