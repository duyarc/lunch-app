import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, MapPin } from 'lucide-react';

interface Restaurant {
    id: string;
    name: string;
    active: boolean;
}

export function RestaurantList() {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRestaurants();
    }, []);

    async function fetchRestaurants() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('restaurants')
                .select('*')
                .order('name');

            if (error) throw error;
            setRestaurants(data || []);
        } catch (err) {
            console.error('Error fetching restaurants:', err);
            setError('Không thể tải danh sách quán ăn.');
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500 text-center py-4">{error}</div>;
    }

    if (restaurants.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500">
                Chưa có quán nào. Hãy thêm quán mới!
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Danh sách quán ăn</h2>
            <div className="grid gap-3">
                {restaurants.map((restaurant) => (
                    <div
                        key={restaurant.id}
                        className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3"
                    >
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <span className="font-medium">{restaurant.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
