import * as tf from '@tensorflow/tfjs';
import { type WeatherData } from './weather';

// --- Constants ---
const MODEL_PATH = 'indexeddb://lunch-app-rnn-model';
const MIN_HISTORY_FOR_TRAINING = 5; // Low for testing, increase for prod
const EPOCHS = 50;
const LOOKBACK_WINDOW = 3; // How many past meals to look at

// --- Types ---
interface HistoryRecord {
    restaurant_id: string;
    weather: string;
    day_of_week: number;
    created_at: string;
}

interface Restaurant {
    id: string;
    name: string;
}

// --- Feature Engineering ---

// Map weather string to index
const WEATHER_MAP: Record<string, number> = {
    'Clear': 0,
    'Clouds': 1,
    'Rain': 2,
    'Drizzle': 3,
    'Thunderstorm': 4,
    'Snow': 5,
    'Mist': 6,
    'Unknown': 7
};

function getDaySinCos(dayOfWeek: number) {
    // 0-6 (Sun-Sat)
    const angle = (dayOfWeek / 7) * 2 * Math.PI;
    return [Math.sin(angle), Math.cos(angle)];
}

function getWeatherIndex(weather: string) {
    const main = weather.split(' ')[0]; // Simple heuristic
    return WEATHER_MAP[main] || WEATHER_MAP['Unknown'];
}

// Create a feature vector for a single time step
// [Day_Sin, Day_Cos, Weather_Index, Lat, Long]
function createFeatureVector(day: number, weather: string, lat: number | null, long: number | null) {
    const [dSin, dCos] = getDaySinCos(day);
    const wIdx = getWeatherIndex(weather);
    const l1 = lat ? lat / 90 : 0;
    const l2 = long ? long / 180 : 0;

    return [dSin, dCos, wIdx / 7, l1, l2];
}

// --- Model Logic ---

let model: tf.LayersModel | null = null;

export async function loadOrCreateModel(numRestaurants: number) {
    try {
        model = await tf.loadLayersModel(MODEL_PATH);
        console.log('Loaded model from IndexedDB');
        // Check if output shape matches current restaurants. If not, recreate.
        if (model.outputs[0].shape[1] !== numRestaurants) {
            console.log('Restaurant count changed, recreating model...');
            throw new Error('Shape mismatch');
        }
    } catch (e) {
        console.log('Creating new model...');
        const newModel = tf.sequential();

        // Input: Sequence of [Feature Vector + One-Hot Previous Restaurant]
        // Feature Vector size: 5
        // One-Hot Restaurant size: numRestaurants
        // Total Input Size: 5 + numRestaurants
        const inputSize = 5 + numRestaurants;

        newModel.add(tf.layers.lstm({
            units: 16,
            returnSequences: false,
            inputShape: [LOOKBACK_WINDOW, inputSize]
        }));

        newModel.add(tf.layers.dense({ units: 16, activation: 'relu' }));
        newModel.add(tf.layers.dense({ units: numRestaurants, activation: 'softmax' }));

        newModel.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        model = newModel;
    }
    return model;
}

export async function trainRNN(
    history: HistoryRecord[],
    restaurants: Restaurant[],
    currentLat: number | null,
    currentLong: number | null
) {
    if (history.length < MIN_HISTORY_FOR_TRAINING) return;

    const restaurantIds = restaurants.map(r => r.id);
    const numRestaurants = restaurantIds.length;

    const model = await loadOrCreateModel(numRestaurants);

    // Prepare Data
    // X: Sequence of (Context + Prev Choice)
    // Y: Next Choice
    const inputs: number[][][] = [];
    const labels: number[][] = [];

    // Sort history by date
    const sortedHistory = [...history].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (let i = LOOKBACK_WINDOW; i < sortedHistory.length; i++) {
        const sequence: number[][] = [];

        // Build sequence
        for (let j = 0; j < LOOKBACK_WINDOW; j++) {
            const record = sortedHistory[i - LOOKBACK_WINDOW + j];
            const features = createFeatureVector(record.day_of_week, record.weather, currentLat, currentLong);

            // One-hot encode restaurant
            const rIndex = restaurantIds.indexOf(record.restaurant_id);
            const rVec = new Array(numRestaurants).fill(0);
            if (rIndex !== -1) rVec[rIndex] = 1;

            sequence.push([...features, ...rVec]);
        }

        inputs.push(sequence);

        // Label (The actual choice at step i)
        const targetRecord = sortedHistory[i];
        const targetIndex = restaurantIds.indexOf(targetRecord.restaurant_id);
        const labelVec = new Array(numRestaurants).fill(0);
        if (targetIndex !== -1) labelVec[targetIndex] = 1;
        labels.push(labelVec);
    }

    if (inputs.length === 0) return;

    const xs = tf.tensor3d(inputs);
    const ys = tf.tensor2d(labels);

    await model.fit(xs, ys, {
        epochs: EPOCHS,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                if (epoch % 10 === 0) console.log(`Epoch ${epoch}: loss = ${logs?.loss}`);
            }
        }
    });

    await model.save(MODEL_PATH);

    xs.dispose();
    ys.dispose();
}

export async function predictRNN(
    weather: WeatherData | null,
    dayOfWeek: number,
    lat: number | null,
    long: number | null,
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
    const currentFeatures = createFeatureVector(dayOfWeek, weather?.condition || 'Unknown', lat, long);

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
                contextFeatures = createFeatureVector(r.day_of_week, r.weather, 0, 0); // No loc in history

                // Prev choice
                const prevR = sortedHistory[hIdx - 1];
                if (prevR) {
                    const idx = restaurantIds.indexOf(prevR.restaurant_id);
                    if (idx !== -1) prevChoiceVec[idx] = 1;
                }
            } else {
                contextFeatures = [0, 0, 0, 0, 0]; // Padding
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
