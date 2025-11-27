import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, Store, Search, Check } from 'lucide-react';

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
    onChoose: (id: string) => void;
}

export function RestaurantList({ restaurants, onChoose }: RestaurantListProps) {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            if (/android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent)) {
                setIsMobile(true);
            }
        };
        checkMobile();
    }, []);

    const filteredRestaurants = restaurants.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-transparent transition-all">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Tìm kiếm quán ăn..."
                    className="flex-1 outline-none text-slate-700 placeholder:text-slate-400 bg-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="max-h-96 overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {filteredRestaurants.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">
                        {searchTerm ? 'Không tìm thấy quán nào.' : 'Chưa có quán nào. Hãy thêm quán mới!'}
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {filteredRestaurants.map((restaurant) => {
                            let Icon = Store;
                            let iconColorClass = "text-slate-600";
                            let bgColorClass = "bg-slate-100";
                            let isMap = false;

                            if (restaurant.lat && restaurant.long) {
                                Icon = MapPin;
                                iconColorClass = "text-orange-600";
                                bgColorClass = "bg-orange-100";
                                isMap = true;
                            } else if (restaurant.phone) {
                                Icon = Phone;
                                iconColorClass = "text-blue-600";
                                bgColorClass = "bg-blue-100";
                            }

                            const IconContainer = ({ children }: { children: React.ReactNode }) => {
                                if (isMobile && isMap && restaurant.lat && restaurant.long) {
                                    return (
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${restaurant.lat},${restaurant.long}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`w-10 h-10 rounded-full ${bgColorClass} flex items-center justify-center ${iconColorClass} hover:scale-110 transition-transform`}
                                        >
                                            {children}
                                        </a>
                                    );
                                }
                                return (
                                    <div className={`w-10 h-10 rounded-full ${bgColorClass} flex items-center justify-center ${iconColorClass}`}>
                                        {children}
                                    </div>
                                );
                            };

                            return (
                                <div
                                    key={restaurant.id}
                                    onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-orange-300 hover:shadow-md transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <IconContainer>
                                            <Icon className="w-5 h-5" />
                                        </IconContainer>
                                        <span className="font-medium text-slate-700 group-hover:text-slate-900">{restaurant.name}</span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onChoose(restaurant.id);
                                        }}
                                        className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                        title="Chọn quán này"
                                    >
                                        <Check className="w-5 h-5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
