import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Loader2 } from 'lucide-react';

interface AddRestaurantProps {
    onAdded: () => void;
}

export function AddRestaurant({ onAdded }: AddRestaurantProps) {
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<string>('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) return;

        try {
            setIsSubmitting(true);
            setStatus('');
            const { error } = await supabase
                .from('restaurants')
                .insert([{ name: name.trim() }]);

            if (error) throw error;

            setName('');
            onAdded();

            // Trigger Auto-Retrain
            setStatus('Đang cập nhật trí tuệ nhân tạo (AI)...');
            import('../lib/prediction').then(m => {
                m.trainGlobalModel().then(() => {
                    setStatus('Đã cập nhật AI thành công!');
                    setTimeout(() => setStatus(''), 3000);
                });
            });

        } catch (err) {
            console.error('Error adding restaurant:', err);
            alert('Có lỗi xảy ra khi thêm quán.');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="mt-6">
            <form onSubmit={handleSubmit} className="flex gap-2">
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
            </form>
            {status && (
                <div className="mt-2 text-xs text-orange-600 flex items-center gap-1 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {status}
                </div>
            )}
        </div>
    );
}
