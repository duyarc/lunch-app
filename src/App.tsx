import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RestaurantList } from './components/RestaurantList';
import { AddRestaurant } from './components/AddRestaurant';
import { Stats } from './components/Stats';
import { ManualSelector } from './components/ManualSelector';
import { RestaurantDetail } from './components/RestaurantDetail';
import { useAppContext } from './hooks/useAppContext';
import { useGeolocation } from './hooks/useGeolocation';
import { getSuggestions, recordChoice, trainModelIfNeeded } from './lib/prediction';
import { getMealTime, getMealTitle } from './lib/utils';
import { Loader2, PieChart, Home } from 'lucide-react';

function HomePage() {
  // Key to force re-render of list when adding new item
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState<'home' | 'stats'>('home');
  const navigate = useNavigate();

  const handleRestaurantAdded = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const { weather, loading: contextLoading, dayOfWeek } = useAppContext();
  const { latitude, longitude } = useGeolocation();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [allRestaurants, setAllRestaurants] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    trainModelIfNeeded();
  }, []);

  useEffect(() => {
    if (!contextLoading && weather) {
      loadSuggestions();
    }
    const meal = getMealTime();
    document.title = getMealTitle(meal);
  }, [contextLoading, weather, refreshKey, latitude, longitude]);

  async function loadSuggestions() {
    setLoadingSuggestions(true);
    // Fetch ALL suggestions sorted by probability
    const allSorted = await getSuggestions(weather, dayOfWeek, latitude, longitude, -1);

    setSuggestions(allSorted.slice(0, 3)); // Top 3 for "Gợi ý"
    setAllRestaurants(allSorted); // All for "Danh sách"
    setLoadingSuggestions(false);
  }

  async function handleChoose(restaurantId: string, rank: number) {
    const isSuggestionHit = rank === 0; // Only count as hit if it's the first suggestion (Rank 1)
    await recordChoice(restaurantId, weather, isSuggestionHit, latitude, longitude);
    alert('Đã lưu lựa chọn! Chúc ngon miệng.');
    handleRestaurantAdded(); // Refresh stats/history if we had it displayed

    // Trigger background training
    trainModelIfNeeded();
    // Check if Global Brain needs update (Smart Trigger)
    import('./lib/prediction').then(m => m.trainGlobalModel(false));
  }

  return (
    <Layout hideHeader={true}>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setView(view === 'home' ? 'stats' : 'home')}
          className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-2"
        >
          {view === 'home' ? (
            <>
              <PieChart className="w-4 h-4" /> Xem Thống kê
            </>
          ) : (
            <>
              <Home className="w-4 h-4" /> Quay lại
            </>
          )}
        </button>
      </div>

      {view === 'stats' ? (
        <Stats />
      ) : (
        <div className="space-y-8">
          <section>
            <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-6 text-white shadow-lg mb-6">
              <h2 className="text-2xl font-bold mb-2">{getMealTitle(getMealTime())}</h2>
              <div className="flex items-center gap-2 text-orange-100 text-sm mb-4">
                <span>{weather?.description || 'Đang tải thời tiết...'}</span>
                <span>•</span>
                <span>{weather?.temperature ? `${weather.temperature}°C` : ''}</span>
              </div>

              {loadingSuggestions ? (
                <div className="mt-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </div>
              ) : suggestions.length > 0 ? (
                <div className="grid gap-3 mt-4">
                  {suggestions.map((s, idx) => (
                    <div key={s.id} className="bg-white text-slate-900 p-4 rounded-xl shadow-sm flex justify-between items-center">
                      <div className="cursor-pointer" onClick={() => navigate(`/restaurant/${s.id}`)}>
                        <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">Gợi ý #{idx + 1}</span>
                        <h3 className="font-bold text-lg hover:underline">{s.name}</h3>
                      </div>
                      <button
                        onClick={() => handleChoose(s.id, idx)}
                        className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-200"
                      >
                        Chọn
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 text-center">
                  <span className="text-sm font-medium">Chưa đủ dữ liệu để gợi ý. Hãy chọn món bên dưới!</span>
                </div>
              )}

              <ManualSelector
                restaurants={allRestaurants}
                onSelect={(id) => handleChoose(id, -1)}
              />
            </div>
          </section>

          <section>
            <RestaurantList key={refreshKey} restaurants={allRestaurants} />
            <AddRestaurant onAdded={handleRestaurantAdded} />
          </section>
        </div>
      )}
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/restaurant/:id" element={<RestaurantDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
