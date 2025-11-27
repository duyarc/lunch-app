import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Layout } from './Layout';
import { MapPicker } from './MapPicker';
import { useGeolocation } from '../hooks/useGeolocation';
import { ArrowLeft, Save, MapPin, Phone, Loader2, Navigation } from 'lucide-react';

export function RestaurantDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { latitude, longitude } = useGeolocation();
    const [restaurant, setRestaurant] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
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

    // Form State
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [lat, setLat] = useState<number | undefined>(undefined);
    const [long, setLong] = useState<number | undefined>(undefined);

    useEffect(() => {
        if (id) fetchRestaurant();
    }, [id]);

    async function fetchRestaurant() {
        try {
            const { data, error } = await supabase
                .from('restaurants')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            setRestaurant(data);
            setAddress(data.address || '');
            setPhone(data.phone || '');
            setLat(data.lat);
            setLong(data.long);
        } catch (err) {
            console.error('Error fetching restaurant:', err);
            alert('Không tìm thấy quán ăn!');
            navigate('/');
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        try {
            setSaving(true);
            const { error } = await supabase
                .from('restaurants')
                .update({
                    address,
                    phone,
                    lat,
                    long
                })
                .eq('id', id);

            if (error) throw error;
            alert('Đã cập nhật thông tin!');
        } catch (err) {
            console.error('Error updating:', err);
            alert('Lỗi khi lưu thông tin.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin" /></div>;

    return (
        <Layout>
            <div className="mb-6">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4"
                >
                    <ArrowLeft className="w-4 h-4" /> Quay lại
                </button>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{restaurant.name}</h1>
                            <p className="text-slate-500 text-sm mt-1">Cập nhật thông tin chi tiết</p>
                        </div>
                        <div className="flex gap-2">
                            {isMobile && lat && long && (
                                <button
                                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${long}`, '_blank')}
                                    className="bg-blue-600 text-white p-3 rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center"
                                    title="Chỉ đường"
                                >
                                    <Navigation className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-slate-900 text-white p-3 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
                                title="Lưu thay đổi"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-8">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                    <MapPin className="w-4 h-4" /> Địa chỉ
                                </label>
                                <input
                                    type="text"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Nhập địa chỉ quán..."
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                    <Phone className="w-4 h-4" /> Số điện thoại
                                </label>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Nhập số điện thoại..."
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                                />
                            </div>


                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Vị trí trên bản đồ</label>
                            <MapPicker
                                initialLat={lat}
                                initialLong={long}
                                userLat={latitude}
                                userLong={longitude}
                                onLocationSelect={(l, lg) => {
                                    setLat(l);
                                    setLong(lg);
                                }}
                            />
                            <div className="mt-2 text-xs text-slate-500 text-right">
                                {lat && long ? `${lat.toFixed(6)}, ${long.toFixed(6)}` : 'Chưa chọn vị trí'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
