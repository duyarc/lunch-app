import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerProps {
    initialLat?: number;
    initialLong?: number;
    userLat?: number | null;
    userLong?: number | null;
    onLocationSelect: (lat: number, long: number) => void;
    readOnly?: boolean;
}

function LocationMarker({ onSelect, initialPos }: { onSelect?: (lat: number, long: number) => void, initialPos?: [number, number] }) {
    const [position, setPosition] = useState<[number, number] | null>(initialPos || null);

    useMapEvents({
        click(e) {
            if (onSelect) {
                setPosition([e.latlng.lat, e.latlng.lng]);
                onSelect(e.latlng.lat, e.latlng.lng);
            }
        },
    });

    return position === null ? null : (
        <Marker position={position}></Marker>
    );
}

export function MapPicker({ initialLat, initialLong, userLat, userLong, onLocationSelect, readOnly = false }: MapPickerProps) {
    // Default to Ho Chi Minh City if no location
    const defaultCenter: [number, number] = [10.7769, 106.7009];

    // Priority: 1. Saved Location -> 2. User Location -> 3. Default (HCMC)
    let center: [number, number] = defaultCenter;
    if (initialLat && initialLong) {
        center = [initialLat, initialLong];
    } else if (userLat && userLong) {
        center = [userLat, userLong];
    }

    return (
        <div className="h-[500px] w-full rounded-lg overflow-hidden border border-slate-300 z-0 relative">
            <MapContainer center={center} zoom={17} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationMarker
                    initialPos={initialLat && initialLong ? [initialLat, initialLong] : undefined}
                    onSelect={readOnly ? undefined : onLocationSelect}
                />
            </MapContainer>
        </div>
    );
}
