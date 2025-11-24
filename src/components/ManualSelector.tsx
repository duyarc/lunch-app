import { useState, useMemo } from 'react';
import { Search, ChevronUp, Check } from 'lucide-react';

interface Restaurant {
    id: string;
    name: string;
}

interface ManualSelectorProps {
    restaurants: Restaurant[];
    onSelect: (restaurantId: string) => void;
}

export function ManualSelector({ restaurants, onSelect }: ManualSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredRestaurants = useMemo(() => {
        return restaurants.filter((r) =>
            r.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [restaurants, searchTerm]);

    return (
        <div className="mt-4">
            {!isOpen ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-full bg-white/50 hover:bg-white/70 text-white border-2 border-dashed border-white/40 rounded-xl p-4 flex items-center justify-center gap-2 transition-all"
                >
                    <Search className="w-5 h-5" />
                    <span className="font-medium">Không thích gợi ý? Chọn quán khác</span>
                </button>
            ) : (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                        <Search className="w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm tên quán..."
                            className="flex-1 outline-none text-slate-700 placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
                        >
                            <ChevronUp className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto">
                        {filteredRestaurants.length > 0 ? (
                            <div className="divide-y divide-slate-50">
                                {filteredRestaurants.map((restaurant) => (
                                    <button
                                        key={restaurant.id}
                                        onClick={() => onSelect(restaurant.id)}
                                        className="w-full text-left px-4 py-3 hover:bg-orange-50 flex items-center justify-between group transition-colors"
                                    >
                                        <span className="text-slate-700 group-hover:text-orange-700 font-medium">
                                            {restaurant.name}
                                        </span>
                                        <Check className="w-4 h-4 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-slate-500 text-sm">
                                Không tìm thấy quán nào.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
