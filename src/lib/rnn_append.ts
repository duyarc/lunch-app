
export async function predictRNN(
    weather: WeatherData | null,
    dayOfWeek: number,
    lat: number | null,
    long: number | null,
    currentMeal: MealTime,
    history: HistoryRecord[],
    restaurants: Restaurant[]
): Promise<Restaurant[]> {
    const restaurantIds = restaurants.map(r => r.id);
    const numRestaurants = restaurantIds.length;

    const model = await loadOrCreateModel(numRestaurants);

    // Build input sequence from the LAST 'LOOKBACK_WINDOW' records
    const sortedHistory = [...history].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // If not enough history for a full window, pad with zeros or repeat
    const recentHistory = sortedHistory.slice(-LOOKBACK_WINDOW);

    // Pad if needed (simple padding)
    while (recentHistory.length < LOOKBACK_WINDOW) {
        recentHistory.unshift({
            restaurant_id: '',
            weather: 'Unknown',
            day_of_week: 0,
            created_at: new Date().toISOString()
        });
    }

    // We need the CURRENT context (Today).
    const currentFeatures = createFeatureVector(dayOfWeek, weather?.condition || 'Unknown', lat, long, currentMeal);

    // Re-building sequence correctly:
    const predictionSequence: number[][] = [];

    for (let i = 0; i < LOOKBACK_WINDOW; i++) {
        let contextFeatures: number[];
        let prevChoiceVec = new Array(numRestaurants).fill(0);

        if (i === LOOKBACK_WINDOW - 1) {
            // This is TODAY (The step we are predicting for)
            contextFeatures = currentFeatures;
            // Prev choice is the actual last record in history
            if (sortedHistory.length > 0) {
                const r = sortedHistory[sortedHistory.length - 1];
                const idx = restaurantIds.indexOf(r.restaurant_id);
                if (idx !== -1) prevChoiceVec[idx] = 1;
            }
        } else {
            const hIdx = sortedHistory.length - (LOOKBACK_WINDOW - 1 - i);

            if (hIdx >= 0 && hIdx < sortedHistory.length) {
                const r = sortedHistory[hIdx];

                // Infer meal time
                const hHour = new Date(r.created_at).getHours();
                let hMeal: MealTime = 'dinner';
                if (hHour >= 4 && hHour < 11) hMeal = 'breakfast';
                else if (hHour >= 11 && hHour < 15) hMeal = 'lunch';

                // Use historical location if available, otherwise fallback to current or 0
                const rLat = r.lat !== undefined ? r.lat : (lat || 0);
                const rLong = r.long !== undefined ? r.long : (long || 0);

                contextFeatures = createFeatureVector(r.day_of_week, r.weather, rLat, rLong, hMeal);

                // Prev choice
                const prevR = sortedHistory[hIdx - 1];
                if (prevR) {
                    const idx = restaurantIds.indexOf(prevR.restaurant_id);
                    if (idx !== -1) prevChoiceVec[idx] = 1;
                }
            } else {
                contextFeatures = [0, 0, 0, 0, 0, 0]; // Padding
            }
        }

        predictionSequence.push([...contextFeatures, ...prevChoiceVec]);
    }

    const xs = tf.tensor3d([predictionSequence]);
    const prediction = model.predict(xs) as tf.Tensor;
    const probs = await prediction.data();

    xs.dispose();
    prediction.dispose();

    // Map probs to restaurants
    const scored = restaurants.map((r, i) => ({
        ...r,
        score: probs[i]
    }));

    return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}
