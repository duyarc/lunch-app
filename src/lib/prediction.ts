import { supabase } from './supabase';
import { type WeatherData } from './weather';
import { getMealTime, getUserId } from './utils';
import { trainRNN, predictRNN } from './rnn';

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
    user_id?: string;
}

// Weights for the algorithm
const WEIGHTS = {
    BASE: 1.0,
    WEATHER: 2.0, // High impact for weather
    DAY: 1.5,     // Medium impact for day of week
    MEAL_TIME: 2.5, // Very High impact for meal time (Breakfast/Lunch/Dinner)
    RECENCY: -0.5 // Penalty for recently chosen (variety)
};

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
    // Strategy: Fetch GLOBAL history for cold start, but prioritize LOCAL for personalization?
    // Actually, for "Hybrid", we should fetch:
    // - Global stats (for fallback scoring)
    // - Local history (for RNN context)

    // For simplicity in this step: Fetch ALL history but separate them.
    const { data: history } = await supabase.from('history').select('*');
    const allHistory = (history || []) as HistoryRecord[];
    const userId = getUserId();
    const userHistory = allHistory.filter(h => h.user_id === userId);

    // Use userHistory for RNN if available, otherwise might fallback to global?
    // The RNN model (Local) expects user history sequence.
    const historyData = userHistory.length >= 3 ? userHistory : allHistory; // Fallback to global if new user


    // 3. Try RNN Prediction if enough history
    if (historyData.length >= 15) {
        try {
            console.log('Using RNN for prediction...');
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

        // Context: Meal Time
        const mealPicks = historyData.filter(h => {
            const hDate = new Date(h.created_at);
            const hHour = hDate.getHours();
            let hMeal = 'dinner';
            if (hHour >= 4 && hHour < 11) hMeal = 'breakfast';
            else if (hHour >= 11 && hHour < 15) hMeal = 'lunch';
            return hMeal === currentMeal;
        }).length;

        if (mealPicks > 0) {
            const rMealPicks = historyData.filter(h => {
                const hDate = new Date(h.created_at);
                const hHour = hDate.getHours();
                let hMeal = 'dinner';
                if (hHour >= 4 && hHour < 11) hMeal = 'breakfast';
                else if (hHour >= 11 && hHour < 15) hMeal = 'lunch';
                return h.restaurant_id === r.id && hMeal === currentMeal;
            }).length;
            const mealProb = rMealPicks / mealPicks;
            score += mealProb * WEIGHTS.MEAL_TIME;
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

    // Fetch ONLY local user history for fine-tuning
    const userId = getUserId();
    const { data: history } = await supabase
        .from('history')
        .select('*')
        .eq('user_id', userId);

    if (restaurants && history && history.length >= 10) {
        console.log('Starting background training (Local Fine-tuning)...');
        await trainRNN(history as HistoryRecord[], restaurants, null, null);
        console.log('Local Training complete.');
    }
}

export async function trainGlobalModel(force: boolean = false) {
    // 1. Check if we need to train
    const { data: latestModel } = await supabase
        .from('models')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!force && latestModel) {
        const lastTrainTime = new Date(latestModel.created_at).getTime();
        const now = new Date().getTime();
        const daysSinceLastTrain = (now - lastTrainTime) / (1000 * 3600 * 24);

        if (daysSinceLastTrain < 3) {
            console.log(`Global model is fresh (${daysSinceLastTrain.toFixed(1)} days old). Skipping.`);
            return false;
        }

        // Check for new data volume
        const { count } = await supabase
            .from('history')
            .select('*', { count: 'exact', head: true })
            .gt('created_at', latestModel.created_at);

        if (count !== null && count < 20) {
            console.log(`Not enough new data (${count} records). Skipping.`);
            return false;
        }
    }

    const { data: restaurants } = await supabase.from('restaurants').select('*').eq('active', true);
    // Fetch ALL history
    const { data: history } = await supabase.from('history').select('*');

    if (restaurants && history && history.length >= 20) {
        console.log('Starting GLOBAL training...');
        await trainRNN(history as HistoryRecord[], restaurants, null, null, true);
        console.log('Global training complete.');
        return true;
    }
    return false;
}

export async function recordChoice(
    restaurantId: string,
    weather: WeatherData | null,
    isSuggestion: boolean,
    lat: number | null,
    long: number | null
) {
    const userId = getUserId();
    const { error } = await supabase.from('history').insert([{
        restaurant_id: restaurantId,
        weather: weather?.condition || 'Unknown',
        day_of_week: new Date().getDay(),
        is_suggestion_hit: isSuggestion,
        lat: lat,
        long: long,
        user_id: userId
    }]);

    if (error) console.error('Error recording choice:', error);
}
