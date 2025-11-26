import * as tf from '@tensorflow/tfjs';
// Force update
import { type WeatherData } from './weather';
import { supabase } from './supabase';
import { type MealTime } from './utils';

const MODEL_PATH = 'indexeddb://lunch-app-rnn-model';
const MIN_HISTORY_FOR_TRAINING = 10; // Low for testing, increase for prod
const EPOCHS = 100;
const LOOKBACK_WINDOW = 3; // How many past meals to look at

// --- Types ---
interface HistoryRecord {
    restaurant_id: string;
    weather: string;
    day_of_week: number;
    created_at: string;
    lat?: number;
    long?: number;
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
// [Day_Sin, Day_Cos, Weather_Index, Lat, Long, Meal_Time_Index]
function createFeatureVector(day: number, weather: string, lat: number | null, long: number | null, meal: MealTime | null) {
    const [dSin, dCos] = getDaySinCos(day);
    const wIdx = getWeatherIndex(weather);
    const l1 = lat ? lat / 90 : 0;
    const l2 = long ? long / 180 : 0;

    let mIdx = 0;
    if (meal === 'breakfast') mIdx = 0;
    else if (meal === 'lunch') mIdx = 0.5;
    else if (meal === 'dinner') mIdx = 1;

    return [dSin, dCos, wIdx / 7, l1, l2, mIdx];
}

// --- Supabase IO Handler ---
class SupabaseIOHandler implements tf.io.IOHandler {
    async save(modelArtifacts: tf.io.ModelArtifacts): Promise<tf.io.SaveResult> {
        let weightDataBuffer: ArrayBuffer;
        if (modelArtifacts.weightData instanceof ArrayBuffer) {
            weightDataBuffer = modelArtifacts.weightData;
        } else if (Array.isArray(modelArtifacts.weightData)) {
            // Concatenate ArrayBuffers if it's an array (rare but possible in types)
            // For simplicity in this context, we assume single buffer or handle first
            // But correct way is to merge.
            // Actually TFJS usually returns single ArrayBuffer for weightData in standard save.
            // Let's cast to any to bypass strict check if we are sure, or handle properly.
            // A safer way for simple save:
            weightDataBuffer = modelArtifacts.weightData as unknown as ArrayBuffer;
        } else {
            weightDataBuffer = new ArrayBuffer(0);
        }

        const weightDataStr = weightDataBuffer.byteLength > 0
            ? btoa(String.fromCharCode(...new Uint8Array(weightDataBuffer)))
            : '';

        const modelJson = {
            modelTopology: modelArtifacts.modelTopology,
            format: modelArtifacts.format,
            generatedBy: modelArtifacts.generatedBy,
            convertedBy: modelArtifacts.convertedBy
        };

        const weightsJson = {
            weightSpecs: modelArtifacts.weightSpecs,
            weightData: weightDataStr
        };

        const { error } = await supabase.from('models').insert([{
            model_json: modelJson,
            weights: weightsJson
        }]);

        if (error) {
            console.error('Error saving model to Supabase:', error);
            throw new Error('Failed to save to Supabase');
        }

        return {
            modelArtifactsInfo: {
                dateSaved: new Date(),
                modelTopologyType: 'JSON',
                weightDataBytes: modelArtifacts.weightData ? (modelArtifacts.weightData as ArrayBuffer).byteLength : 0
            }
        };
    }

    async load(): Promise<tf.io.ModelArtifacts> {
        const { data, error } = await supabase
            .from('models')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) {
            throw new Error('No model found in Supabase');
        }

        const modelJson = data.model_json;
        const weightsJson = data.weights;

        const weightData = weightsJson.weightData
            ? new Uint8Array(atob(weightsJson.weightData).split('').map(c => c.charCodeAt(0))).buffer
            : new ArrayBuffer(0);

        return {
            modelTopology: modelJson.modelTopology,
            format: modelJson.format,
            generatedBy: modelJson.generatedBy,
            convertedBy: modelJson.convertedBy,
            weightSpecs: weightsJson.weightSpecs,
            weightData: weightData
        };
    }
}

// --- Model Logic ---

let model: tf.LayersModel | null = null;

export async function loadOrCreateModel(numRestaurants: number) {
    // 1. Try Local Model (IndexedDB) - Fine-tuned for this user
    try {
        model = await tf.loadLayersModel(MODEL_PATH);
        console.log('Loaded LOCAL model from IndexedDB');
        if (model.outputs[0].shape[1] !== numRestaurants) {
            console.log(`Restaurant count changed (Local): Expected ${numRestaurants}, got ${model.outputs[0].shape[1]}. Recreating model...`);
            throw new Error('Shape mismatch');
        }
        return model;
    } catch (e) {
        console.log('Local model missing, trying Global Model...');
    }

    // 2. Try Global Model (Supabase) - The "Parent" Brain
    try {
        model = await tf.loadLayersModel(new SupabaseIOHandler());
        console.log('Loaded GLOBAL model from Supabase');
        if (model.outputs[0].shape[1] !== numRestaurants) {
            console.log(`Restaurant count changed (Global): Expected ${numRestaurants}, got ${model.outputs[0].shape[1]}.`);
            throw new Error('Shape mismatch');
        }
        // IMPORTANT: Do NOT save this as local model immediately.
        // We only save to local when we actually fine-tune (train) it.
        // This keeps the "clean" global model separate from "dirty" local model until necessary.
        return model;
    } catch (supaError) {
        console.log('Global model missing, creating fresh...');
    }

    // 3. Create Fresh Model (Cold Start)
    const newModel = tf.sequential();
    const inputSize = 6 + numRestaurants;

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
    return model;
}

export async function trainRNN(
    history: HistoryRecord[],
    restaurants: Restaurant[],
    currentLat: number | null,
    currentLong: number | null,
    saveToGlobal: boolean = false // Default to Local Training only
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
            // Use historical location if available, otherwise fallback to current or 0
            const rLat = record.lat !== undefined ? record.lat : (currentLat || 0);
            const rLong = record.long !== undefined ? record.long : (currentLong || 0);

            // Infer meal time from record
            const hHour = new Date(record.created_at).getHours();
            let hMeal: MealTime = 'dinner';
            if (hHour >= 4 && hHour < 11) hMeal = 'breakfast';
            else if (hHour >= 11 && hHour < 15) hMeal = 'lunch';

            const features = createFeatureVector(record.day_of_week, record.weather, rLat, rLong, hMeal);

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

    // Ensure model is compiled before training
    model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    await model.fit(xs, ys, {
        epochs: EPOCHS,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                if (epoch % 10 === 0) console.log(`Epoch ${epoch}: loss = ${logs?.loss}`);
            }
        }
    });

    // ALWAYS save to Local (IndexedDB) after training
    await model.save(MODEL_PATH);
    console.log('Model saved to Local (IndexedDB)');

    // OPTIONALLY save to Global (Supabase)
    if (saveToGlobal) {
        try {
            console.log('Syncing model to Supabase (Global)...');
            await model.save(new SupabaseIOHandler());
            console.log('Model synced to Supabase');
        } catch (err) {
            console.error('Failed to sync model to Supabase:', err);
        }
    }

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

export async function predictRNN(
    weather: WeatherData | null,
    dayOfWeek: number,
    lat: number | null,
    long: number | null,
    currentMeal: MealTime,
    history: HistoryRecord[],
    restaurants: Restaurant[],
    limit: number = 3
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

    const sorted = scored.sort((a, b) => b.score - a.score);
    return limit === -1 ? sorted : sorted.slice(0, limit);
}
