import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Loader2 } from 'lucide-react';

interface AddRestaurantProps {
    onAdded: () => void;
}

export function AddRestaurant({ onAdded }: AddRestaurantProps) {
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) return;

        try {
            setIsSubmitting(true);
            const { error } = await supabase
                .from('restaurants')
                .insert([{ name: name.trim() }]);

            if (error) throw error;

            setName('');
            onAdded();
        } catch (err) {
            console.error('Error adding restaurant:', err);
            alert('Có lỗi xảy ra khi thêm quán.');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="mt-6">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Thêm quán mới..."
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    disabled={isSubmitting}
                />
                <button
                    type="submit"
                    disabled={isSubmitting || !name.trim()}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Plus className="w-4 h-4" />
                    )}
                    Thêm
                </button>
            </div>
        </form>
    );
}
