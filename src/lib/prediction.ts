import { supabase } from './supabase';
import { type WeatherData } from './weather';
import { getMealTime, type MealTime } from './utils';

interface Restaurant {
    id: string;
    name: string;
}

interface HistoryRecord {
    restaurant_id: string;
    weather: string;
    day_of_week: number;
    created_at: string;
    lat?: number;
    long?: number;
}

// Weights for the algorithm
const WEIGHTS = {
    BASE: 1.0,
    WEATHER: 2.0, // High impact for weather
    DAY: 1.5,     // Medium impact for day of week
    MEAL_TIME: 2.5, // Very High impact for meal time (Breakfast/Lunch/Dinner)
    RECENCY: -0.5 // Penalty for recently chosen (variety)
};

import { trainRNN, predictRNN } from './rnn';

export async function getSuggestions(
    weather: WeatherData | null,
    dayOfWeek: number,
    lat: number | null,
    long: number | null
): Promise<Restaurant[]> {
    // 1. Fetch all restaurants
    const { data: restaurants } = await supabase.from('restaurants').select('*').eq('active', true);
    if (!restaurants || restaurants.length === 0) return [];

    // 2. Fetch history for context analysis
    const { data: history } = await supabase.from('history').select('*');
    const historyData = (history || []) as HistoryRecord[];

    // 3. Try RNN Prediction if enough history
    if (historyData.length >= 10) {
        try {
            console.log('Using RNN for prediction...');
            // Train in background if needed (or assume trained)
            // For MVP, let's just train here if it's fast, or rely on App.tsx to have triggered it.
            // But to be safe, let's just call predict. If model missing, it will error or we handle it.
            // Actually rnn.ts loads model.
            return await predictRNN(weather, dayOfWeek, lat, long, getMealTime(), historyData, restaurants);
        } catch (e) {
            console.warn('RNN Prediction failed, falling back to scoring:', e);
        }
    }

    // 4. Fallback: Scoring Algorithm
    console.log('Using Weighted Scoring for prediction...');
    const currentMeal = getMealTime();
    const scores = restaurants.map(r => {
        let score = WEIGHTS.BASE;

        // Calculate Popularity (Base Probability)
        const totalPicks = historyData.length;
        const restaurantPicks = historyData.filter(h => h.restaurant_id === r.id).length;
        const popularity = totalPicks > 0 ? restaurantPicks / totalPicks : 0;
        score += popularity * WEIGHTS.BASE;

        // Context: Weather
        if (weather) {
            const weatherPicks = historyData.filter(h => h.weather === weather.condition).length;
            if (weatherPicks > 0) {
                const rWeatherPicks = historyData.filter(h => h.restaurant_id === r.id && h.weather === weather.condition).length;
                const weatherProb = rWeatherPicks / weatherPicks;
                score += weatherProb * WEIGHTS.WEATHER;
            }
        }

        // Context: Day of Week
        const dayPicks = historyData.filter(h => h.day_of_week === dayOfWeek).length;
        if (dayPicks > 0) {
            const rDayPicks = historyData.filter(h => h.restaurant_id === r.id && h.day_of_week === dayOfWeek).length;
            const dayProb = rDayPicks / dayPicks;
            score += dayProb * WEIGHTS.DAY;
        }

        // Context: Recency (Penalty)
        // Find last time this restaurant was picked
        const lastPick = historyData
            .filter(h => h.restaurant_id === r.id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        if (lastPick) {
            const daysSince = (new Date().getTime() - new Date(lastPick.created_at).getTime()) / (1000 * 3600 * 24);
            if (daysSince < 3) { // If picked within last 3 days
                score += WEIGHTS.RECENCY * (3 - daysSince); // Penalty reduces as time passes
            }
        }

        return { ...r, score };
    });

    // 5. Sort and return top 3
    return scores
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(s => ({ id: s.id, name: s.name }));
}

export async function trainModelIfNeeded() {
    const { data: restaurants } = await supabase.from('restaurants').select('*').eq('active', true);
    const { data: history } = await supabase.from('history').select('*');
    if (restaurants && history && history.length >= 5) {
        console.log('Starting background training...');
        await trainRNN(history as HistoryRecord[], restaurants, null, null); // Lat/Long ignored for training for now
        console.log('Training complete.');
    }
}

export async function recordChoice(
    restaurantId: string,
    weather: WeatherData | null,
    isSuggestion: boolean,
    lat: number | null,
    long: number | null
) {
    const { error } = await supabase.from('history').insert([{
        restaurant_id: restaurantId,
        weather: weather?.condition || 'Unknown',
        day_of_week: new Date().getDay(),
        is_suggestion_hit: isSuggestion,
        lat: lat,
        long: long
    }]);

    if (error) console.error('Error recording choice:', error);
}
