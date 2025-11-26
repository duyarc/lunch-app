import { useNavigate } from 'react-router-dom';
import { Loader2, MapPin } from 'lucide-react';

interface Restaurant {
    id: string;
    name: string;
    active: boolean;
}

interface RestaurantListProps {
    restaurants: Restaurant[];
}

export function RestaurantList({ restaurants }: RestaurantListProps) {
    const navigate = useNavigate();

    if (restaurants.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500">
                Chưa có quán nào. Hãy thêm quán mới!
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Danh sách quán</h2>
            <div className="grid gap-3">
                {restaurants.map((restaurant, idx) => (
                    <div
                        key={restaurant.id}
                        onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                        className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 cursor-pointer hover:border-orange-300 hover:shadow-md transition-all"
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
