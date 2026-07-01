import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Check } from 'lucide-react';

// カスタムSVGピン（Leafletデフォルトの画像パス問題を回避）
const pinIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
    <path d="M14 1C7.4 1 2 6.4 2 13c0 9.8 12 24 12 24S26 22.8 26 13C26 6.4 20.6 1 14 1z" fill="#ec4899" stroke="#be185d" stroke-width="1.5"/>
    <circle cx="14" cy="13" r="5.5" fill="white"/>
  </svg>`,
  className: '',
  iconSize: [28, 38],
  iconAnchor: [14, 38],
  popupAnchor: [0, -38],
});

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type Props = {
  initialLat?: number;
  initialLng?: number;
  onConfirm: (lat: number, lng: number, address: string) => void;
  onClose: () => void;
};

export function MapPicker({ initialLat, initialLng, onConfirm, onClose }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [showResults, setShowResults] = useState(false);

  // 昭和島教室の近く（大田区）をデフォルト中心に
  const DEFAULT_LAT = 35.565;
  const DEFAULT_LNG = 139.784;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const lat = initialLat ?? DEFAULT_LAT;
    const lng = initialLng ?? DEFAULT_LNG;
    const zoom = initialLat ? 17 : 13;

    const map = L.map(containerRef.current, { zoomControl: true }).setView([lat, lng], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // 初期ピン
    if (initialLat && initialLng) {
      const marker = L.marker([initialLat, initialLng], { icon: pinIcon, draggable: true }).addTo(map);
      markerRef.current = marker;
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        doReverseGeocode(pos.lat, pos.lng);
      });
      setSelected({ lat: initialLat, lng: initialLng, address: '' });
    }

    // クリックでピンを立てる
    map.on('click', (e) => {
      placePin(map, e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  const placePin = (map: L.Map, lat: number, lng: number) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);
      markerRef.current = marker;
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        doReverseGeocode(pos.lat, pos.lng);
      });
    }
    doReverseGeocode(lat, lng);
  };

  const doReverseGeocode = async (lat: number, lng: number) => {
    setSelected({ lat, lng, address: '住所を取得中...' });
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`,
        { headers: { 'User-Agent': 'coplus-step-sougei/1.0' } }
      );
      const data = await res.json();
      const addr = data.display_name ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setSelected({ lat, lng, address: addr });
    } catch {
      setSelected({ lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setShowResults(false);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=jp&accept-language=ja`,
        { headers: { 'User-Agent': 'coplus-step-sougei/1.0' } }
      );
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setShowResults(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleResultClick = (r: NominatimResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setResults([]);
    setShowResults(false);
    setQuery('');
    const map = mapRef.current;
    if (map) {
      map.flyTo([lat, lng], 17);
      placePin(map, lat, lng);
    }
    setSelected({ lat, lng, address: r.display_name });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 検索バー */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="住所・施設名で検索（例：大田区昭和島）"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {searching ? '検索中...' : '検索'}
          </button>
        </div>

        {/* 検索結果ドロップダウン */}
        {showResults && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
            {results.map(r => (
              <button
                key={r.place_id}
                onClick={() => handleResultClick(r)}
                className="w-full text-left px-4 py-3 hover:bg-pink-50 border-b border-gray-100 last:border-0 cursor-pointer transition-colors"
              >
                <p className="text-sm text-gray-800 line-clamp-2 leading-snug">{r.display_name}</p>
              </button>
            ))}
            {results.length === 0 && (
              <p className="px-4 py-3 text-sm text-gray-400">見つかりませんでした</p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 -mt-1">
        地図をクリックしてピンを立てる・ピンをドラッグして微調整できます
      </p>

      {/* 地図 */}
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm"
        style={{ height: 340 }}
      />

      {/* 選択済み場所 */}
      {selected && (
        <div className="flex items-start gap-2 p-3 bg-pink-50 border border-pink-200 rounded-xl">
          <MapPin size={15} className="text-pink-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-700 leading-snug">{selected.address}</p>
        </div>
      )}

      {!selected && (
        <p className="text-sm text-gray-400 text-center py-1">地図上をクリックして場所を選んでください</p>
      )}

      {/* ボタン */}
      <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
        >
          キャンセル
        </button>
        <button
          onClick={() => selected && selected.address !== '住所を取得中...' && onConfirm(selected.lat, selected.lng, selected.address)}
          disabled={!selected || selected.address === '住所を取得中...'}
          className="flex items-center gap-2 px-5 py-2 bg-pink-500 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-pink-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Check size={14} /> この場所に決める
        </button>
      </div>
    </div>
  );
}
