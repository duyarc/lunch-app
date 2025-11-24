// Open-Meteo does not require an API key.
// Note: In a real app, this should be in .env. For this demo, I'll use a hardcoded free key if available or ask user.
// Wait, the plan said "Will use OpenWeatherMap (requires API Key)". I don't have one.
// I will implement a mock service first, and then ask the user for a key or use a free public API that doesn't need auth if possible (Open-Meteo is good for this).
// Open-Meteo does not require an API key. I will switch to Open-Meteo.

export interface WeatherData {
    temperature: number;
    condition: 'Clear' | 'Rain' | 'Clouds' | 'Thunderstorm' | 'Drizzle' | 'Unknown';
    description: string;
}

export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
    try {
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
        );
        const data = await response.json();

        const code = data.current.weather_code;
        const temp = data.current.temperature_2m;

        // Map WMO Weather interpretation codes (WW)
        // https://open-meteo.com/en/docs
        let condition: WeatherData['condition'] = 'Unknown';
        let description = 'Unknown';

        if (code === 0) { condition = 'Clear'; description = 'Trời quang'; }
        else if (code >= 1 && code <= 3) { condition = 'Clouds'; description = 'Có mây'; }
        else if (code >= 51 && code <= 67) { condition = 'Drizzle'; description = 'Mưa phùn'; }
        else if (code >= 80 && code <= 99) { condition = 'Rain'; description = 'Mưa rào'; }
        else if (code >= 95) { condition = 'Thunderstorm'; description = 'Dông bão'; }
        else { condition = 'Rain'; description = 'Mưa'; } // Fallback

        return {
            temperature: temp,
            condition,
            description
        };
    } catch (error) {
        console.error('Error fetching weather:', error);
        return {
            temperature: 30,
            condition: 'Clear',
            description: 'Không xác định'
        };
    }
}
