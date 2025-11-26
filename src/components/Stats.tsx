import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, TrendingUp, Calendar, Cloud, Clock } from 'lucide-react';
import { type MealTime } from '../lib/utils';

interface StatsData {
    totalPicks: number;
    accuracy: number;
    topRestaurants: { name: string; count: number }[];
    byWeather: { weather: string; count: number }[];
    byMeal: { meal: string; top: { name: string; count: number }[] }[];
}

export function Stats() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    async function fetchStats() {
        try {
            const { data: history, error } = await supabase
                .from('history')
                .select('*, restaurants(name)');

            if (error) throw error;

            if (!history || history.length === 0) {
                setStats({ totalPicks: 0, accuracy: 0, topRestaurants: [], byWeather: [], byMeal: [] });
                return;
            }

            // Calculate Metrics
            const totalPicks = history.length;
            const hits = history.filter((h: any) => h.is_suggestion_hit).length;
            const accuracy = (hits / totalPicks) * 100;

            // Top Restaurants
            const restaurantCounts: Record<string, number> = {};
            history.forEach((h: any) => {
                const name = h.restaurants?.name || 'Unknown';
                restaurantCounts[name] = (restaurantCounts[name] || 0) + 1;
            });
            const topRestaurants = Object.entries(restaurantCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            // By Weather
            const weatherCounts: Record<string, number> = {};
            history.forEach((h: any) => {
                const w = h.weather || 'Unknown';
                weatherCounts[w] = (weatherCounts[w] || 0) + 1;
            });
            const byWeather = Object.entries(weatherCounts)
                .map(([weather, count]) => ({ weather, count }))
                .sort((a, b) => b.count - a.count);

            // By Meal Time
            const mealGroups: Record<string, Record<string, number>> = {
                breakfast: {},
                lunch: {},
                dinner: {}
            };

            history.forEach((h: any) => {
                const date = new Date(h.created_at);
                const hour = date.getHours();
                let meal: MealTime = 'dinner';
                if (hour >= 4 && hour < 11) meal = 'breakfast';
                else if (hour >= 11 && hour < 15) meal = 'lunch';

                const name = h.restaurants?.name || 'Unknown';
                mealGroups[meal][name] = (mealGroups[meal][name] || 0) + 1;
            });

            const byMeal = Object.entries(mealGroups).map(([meal, counts]) => {
                const top = Object.entries(counts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 3);
                return { meal, top };
            });

            setStats({ totalPicks, accuracy, topRestaurants, byWeather, byMeal });
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="text-center py-8">Đang tải thống kê...</div>;
    if (!stats) return null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-500 mb-2">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase">Độ chính xác</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{stats.accuracy.toFixed(1)}%</div>
                    <div className="text-xs text-slate-400 mt-1">Tỷ lệ chọn theo gợi ý</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-500 mb-2">
                        <BarChart3 className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase">Tổng lượt chọn</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{stats.totalPicks}</div>
                    <div className="text-xs text-slate-400 mt-1">Bữa trưa đã ghi nhận</div>
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    Top Quán Ăn
                </h3>
                <div className="space-y-3">
                    {stats.topRestaurants.map((r, idx) => (
                        <div key={r.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                </span>
                                <span className="text-sm font-medium text-slate-700">{r.name}</span>
                            </div>
                            <span className="text-sm font-bold text-slate-900">{r.count}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-blue-500" />
                    Theo Thời Tiết
                </h3>
                <div className="space-y-2">
                    {stats.byWeather.map((w) => (
                        <div key={w.weather} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 capitalize">{w.weather}</span>
                            <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{ width: `${(w.count / stats.totalPicks) * 100}%` }}
                                    />
                                </div>
                                <span className="text-slate-900 font-medium w-6 text-right">{w.count}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-500" />
                    Theo Bữa Ăn
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {stats.byMeal.map((group) => (
                        <div key={group.meal} className="bg-slate-50 p-3 rounded-lg">
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 border-b border-slate-200 pb-1">
                                {group.meal === 'breakfast' ? 'Sáng' : group.meal === 'lunch' ? 'Trưa' : 'Tối'}
                            </h4>
                            {group.top.length > 0 ? (
                                <div className="space-y-1">
                                    {group.top.map((r, idx) => (
                                        <div key={r.name} className="flex justify-between text-sm">
                                            <span className="text-slate-700 truncate">{idx + 1}. {r.name}</span>
                                            <span className="font-medium text-slate-900">{r.count}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-xs text-slate-400 italic">Chưa có dữ liệu</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Admin Zone */}
            <div className="mt-8 p-4 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Admin Zone</h4>
                <button
                    onClick={async () => {
                        if (confirm('Bạn có chắc muốn train lại Model Tổng (Global) từ dữ liệu của TẤT CẢ mọi người không? Việc này sẽ tốn tài nguyên.')) {
                            try {
                                alert('Đã bắt đầu train Global Model. Vui lòng đợi...');
                                const result = await import('../lib/prediction').then(m => m.trainGlobalModel());
                                if (result) {
                                    alert('Training successful! Model đã được cập nhật lên Supabase.');
                                } else {
                                    alert('Training skipped. Không đủ dữ liệu (cần ít nhất 20 records).');
                                }
                            } catch (e) {
                                console.error(e);
                                alert('Training failed. Kiểm tra console để biết chi tiết.');
                            }
                        }
                    }}
                    className="text-xs text-slate-500 hover:text-orange-600 underline"
                >
                    Train Global Brain
                </button>
            </div>
        </div>
    );
}
