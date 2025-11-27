import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, Store } from 'lucide-react';

interface Restaurant {
    id: string;
    name: string;
    active: boolean;
    lat?: number;
    long?: number;
    phone?: string;
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
                {restaurants.map((restaurant) => {
                    let Icon = Store;
                    let iconColorClass = "text-slate-600";
                    let bgColorClass = "bg-slate-100";

                    if (restaurant.lat && restaurant.long) {
                        Icon = MapPin;
                        iconColorClass = "text-orange-600";
                        bgColorClass = "bg-orange-100";
                    } else if (restaurant.phone) {
                        Icon = Phone;
                        iconColorClass = "text-blue-600";
                        bgColorClass = "bg-blue-100";
                    }

                    return (
                        <div
                            key={restaurant.id}
                            onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                            className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 cursor-pointer hover:border-orange-300 hover:shadow-md transition-all"
                        >
                            <div className={`w-10 h-10 rounded-full ${bgColorClass} flex items-center justify-center ${iconColorClass}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <span className="font-medium">{restaurant.name}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
