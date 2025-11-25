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

export function getMealTitle(meal: MealTime): string {
    switch (meal) {
        case 'breakfast': return 'Sáng nay ăn gì?';
        case 'lunch': return 'Trưa nay ăn gì?';
        case 'dinner': return 'Tối nay ăn gì?';
    }
}
