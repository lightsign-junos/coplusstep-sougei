import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, MapPin, Phone, ChevronDown, ChevronUp, ArrowRight, ArrowLeft, Map } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { Modal } from '../components/common/Modal';
import { MapPicker } from '../components/common/MapPicker';
import { DayBadge } from '../components/common/Badge';
import type { Member, MemberLocation, Direction } from '../types';

const ALL_DAYS = ['月', '火', '水', '木', '金', '土'];

const DIRECTION_OPTIONS: { value: Direction; label: string; sub: string }[] = [
  { value: 'go',     label: '乗せる場所（行き）',       sub: '朝、迎えに行く場所' },
  { value: 'return', label: '降ろす場所（帰り）',       sub: '夕方、送り届ける場所' },
  { value: 'both',   label: '行き・帰り同じ場所',       sub: '迎えも送りも同じ場所' },
];

export function MemberMaster() {
  const { members, memberLocations, addMember, updateMember, deleteMember,
    addMemberLocation, updateMemberLocation, deleteMemberLocation } = useDataStore();

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState<{ memberId: string; defaultDir?: Direction } | null>(null);
  // 'location' = 場所編集モーダル用, 'inline-go' / 'inline-return' = 新規登録インライン用
  const [mapPickerTarget, setMapPickerTarget] = useState<'location' | 'inline-go' | 'inline-return' | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingLocation, setEditingLocation] = useState<MemberLocation | null>(null);

  type LocDraft = { name: string; address: string; lat?: number; lng?: number };
  const emptyLoc = (): LocDraft => ({ name: '', address: '', lat: undefined, lng: undefined });
  const [goLoc, setGoLoc] = useState<LocDraft>(emptyLoc());
  const [returnLoc, setReturnLoc] = useState<LocDraft>(emptyLoc());
  const [sameLocation, setSameLocation] = useState(false);

  const [mForm, setMForm] = useState({
    name: '', nameKana: '', phone: '', defaultDays: [] as string[],
    sendFlag: true, returnFlag: true, notes: '',
  });

  const [lForm, setLForm] = useState({
    name: '', address: '', direction: 'both' as Direction, notes: '',
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
  });

  const filtered = members
    .filter(m => m.name.includes(search) || (m.nameKana ?? '').includes(search) || m.phone.includes(search))
    .sort((a, b) => (a.nameKana ?? a.name).localeCompare(b.nameKana ?? b.name, 'ja'));

  const getLocations = (memberId: string) =>
    memberLocations.filter(l => l.memberId === memberId);

  const getLocsByDir = (memberId: string, dir: 'go' | 'return') =>
    memberLocations.filter(l => l.memberId === memberId && (l.direction === dir || l.direction === 'both'));

  const openCreateMember = () => {
    setEditingMember(null);
    setMForm({ name: '', nameKana: '', phone: '', defaultDays: [], sendFlag: true, returnFlag: true, notes: '' });
    setGoLoc(emptyLoc());
    setReturnLoc(emptyLoc());
    setSameLocation(false);
    setShowMemberModal(true);
  };

  const openEditMember = (m: Member) => {
    setEditingMember(m);
    setMForm({ name: m.name, nameKana: m.nameKana ?? '', phone: m.phone, defaultDays: m.defaultDays, sendFlag: m.sendFlag, returnFlag: m.returnFlag, notes: m.notes });
    setShowMemberModal(true);
  };

  // 住所から座標を自動取得（地図ピンなしでもOK）
  // 国土地理院APIは日本の番地（1-1-1形式）まで解決できる。失敗時はNominatimにフォールバック
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    if (!address.trim()) return null;
    try {
      const res = await fetch(
        `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`
      );
      const data: { geometry: { coordinates: [number, number] } }[] = await res.json();
      if (data.length > 0) {
        const [lng, lat] = data[0].geometry.coordinates;
        return { lat, lng };
      }
    } catch { /* fallthrough */ }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=jp&accept-language=ja`,
        { headers: { 'User-Agent': 'coplus-step-sougei/1.0' } }
      );
      const data: { lat: string; lon: string }[] = await res.json();
      if (data.length === 0) return null;
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch {
      return null;
    }
  };

  // 座標がなければ住所から補完して返す
  const withCoords = async (loc: LocDraft): Promise<LocDraft> => {
    if (loc.lat != null && loc.lng != null) return loc;
    const geo = await geocodeAddress(loc.address);
    return geo ? { ...loc, lat: geo.lat, lng: geo.lng } : loc;
  };

  const [saving, setSaving] = useState(false);

  const handleSaveMember = async () => {
    if (!mForm.name || saving) return;
    setSaving(true);
    try {
      if (editingMember) {
        updateMember({ ...editingMember, ...mForm });
      } else {
        const memberId = `m-${Date.now()}`;
        addMember({ id: memberId, createdAt: new Date().toISOString(), ...mForm });
        if (goLoc.name || goLoc.address) {
          const g = await withCoords(goLoc);
          const gName = g.name || g.address;
          if (sameLocation) {
            addMemberLocation({ id: `l-${Date.now()}`, memberId, name: gName, address: g.address, direction: 'both', notes: '', lat: g.lat, lng: g.lng });
          } else {
            addMemberLocation({ id: `l-${Date.now()}`, memberId, name: gName, address: g.address, direction: 'go', notes: '', lat: g.lat, lng: g.lng });
            if (returnLoc.name || returnLoc.address) {
              const r = await withCoords(returnLoc);
              addMemberLocation({ id: `l-${Date.now() + 1}`, memberId, name: r.name || r.address, address: r.address, direction: 'return', notes: '', lat: r.lat, lng: r.lng });
            }
          }
        }
      }
      setShowMemberModal(false);
    } finally {
      setSaving(false);
    }
  };

  const openCreateLocation = (memberId: string, defaultDir?: Direction) => {
    setEditingLocation(null);
    setLForm({ name: '', address: '', direction: defaultDir ?? 'both', notes: '', lat: undefined, lng: undefined });
    setShowLocationModal({ memberId, defaultDir });
  };

  const openEditLocation = (loc: MemberLocation) => {
    setEditingLocation(loc);
    setLForm({ name: loc.name, address: loc.address, direction: loc.direction, notes: loc.notes, lat: loc.lat, lng: loc.lng });
    setShowLocationModal({ memberId: loc.memberId });
  };

  const handleMapConfirm = (lat: number, lng: number, address: string) => {
    if (mapPickerTarget === 'location') {
      setLForm(f => ({ ...f, lat, lng, address, name: f.name || address }));
    } else if (mapPickerTarget === 'inline-go') {
      setGoLoc(f => ({ ...f, lat, lng, address, name: f.name || address }));
    } else if (mapPickerTarget === 'inline-return') {
      setReturnLoc(f => ({ ...f, lat, lng, address, name: f.name || address }));
    }
    setMapPickerTarget(null);
  };

  const handleSaveLocation = async () => {
    if (!lForm.name || !showLocationModal || saving) return;
    setSaving(true);
    try {
      // 座標がなければ住所から自動取得
      let form = lForm;
      if ((form.lat == null || form.lng == null) && form.address.trim()) {
        const geo = await geocodeAddress(form.address);
        if (geo) form = { ...form, lat: geo.lat, lng: geo.lng };
      }
      if (editingLocation) {
        updateMemberLocation({ ...editingLocation, ...form });
      } else {
        addMemberLocation({ id: `l-${Date.now()}`, memberId: showLocationModal.memberId, ...form });
      }
      setShowLocationModal(null);
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    setMForm(f => ({
      ...f,
      defaultDays: f.defaultDays.includes(day)
        ? f.defaultDays.filter(d => d !== day)
        : [...f.defaultDays, day],
    }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">利用者マスタ</h1>
        <button onClick={openCreateMember} className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-medium hover:bg-pink-600 cursor-pointer transition-colors">
          <Plus size={16} /> 利用者追加
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="氏名・読み仮名・電話番号で検索"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white"
        />
      </div>

      {/* Member list */}
      <div className="space-y-2">
        {filtered.map(member => {
          const locs = getLocations(member.id);
          const goLocs = getLocsByDir(member.id, 'go');
          const returnLocs = getLocsByDir(member.id, 'return');
          const expanded = expandedId === member.id;

          return (
            <div key={member.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-200 to-blue-200 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                  {member.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{member.name}</span>
                    {member.nameKana && <span className="text-xs text-gray-400">{member.nameKana}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {member.phone && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Phone size={11} /> {member.phone}
                      </span>
                    )}
                    <div className="flex gap-0.5">
                      {ALL_DAYS.map(d => (
                        <DayBadge key={d} day={d} active={member.defaultDays.includes(d)} />
                      ))}
                    </div>
                  </div>
                  {/* 場所サマリー（折りたたみ時に表示） */}
                  {!expanded && locs.length > 0 && (
                    <div className="flex gap-3 mt-1.5">
                      {goLocs.length > 0 && (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <ArrowRight size={11} /> 乗せる:{goLocs[0].name}
                        </span>
                      )}
                      {returnLocs.length > 0 && (
                        <span className="text-xs text-orange-600 flex items-center gap-1">
                          <ArrowLeft size={11} /> 降ろす:{returnLocs[0].name}
                        </span>
                      )}
                    </div>
                  )}
                  {!expanded && locs.length === 0 && (
                    <span className="text-xs text-gray-300 mt-1 flex items-center gap-1">
                      <MapPin size={11} /> 場所未登録
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEditMember(member)} className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer hover:bg-gray-100 rounded">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => deleteMember(member.id)} className="p-1.5 text-gray-400 hover:text-red-500 cursor-pointer hover:bg-red-50 rounded">
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => setExpandedId(expanded ? null : member.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer hover:bg-gray-100 rounded flex items-center gap-1"
                  >
                    <MapPin size={14} />
                    {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
              </div>

              {/* Expanded: location sections */}
              {expanded && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 grid grid-cols-2 gap-4">
                  {/* 行き（乗せる場所） */}
                  <LocationSection
                    title="乗せる場所（行き）"
                    icon={<ArrowRight size={14} className="text-blue-500" />}
                    color="blue"
                    locs={goLocs}
                    onAdd={() => openCreateLocation(member.id, 'go')}
                    onEdit={openEditLocation}
                    onDelete={deleteMemberLocation}
                  />

                  {/* 帰り（降ろす場所） */}
                  <LocationSection
                    title="降ろす場所（帰り）"
                    icon={<ArrowLeft size={14} className="text-orange-500" />}
                    color="orange"
                    locs={returnLocs}
                    onAdd={() => openCreateLocation(member.id, 'return')}
                    onEdit={openEditLocation}
                    onDelete={deleteMemberLocation}
                  />
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
            {search ? '検索結果がありません' : '利用者が登録されていません'}
          </div>
        )}
      </div>

      {/* Member modal */}
      {showMemberModal && (
        <Modal title={editingMember ? '利用者を編集' : '利用者を追加'} onClose={() => setShowMemberModal(false)} size="lg">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">氏名 *</label>
              <input value={mForm.name} onChange={e => setMForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="例：田中 太郎" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">読み仮名</label>
              <input value={mForm.nameKana} onChange={e => setMForm(f => ({ ...f, nameKana: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="例：たなか たろう" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">電話番号</label>
              <input value={mForm.phone} onChange={e => setMForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="090-0000-0000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">利用曜日</label>
              <div className="flex gap-2">
                {ALL_DAYS.map(d => (
                  <button key={d} onClick={() => toggleDay(d)}
                    className={`w-9 h-9 rounded-full text-sm font-semibold cursor-pointer transition-colors ${mForm.defaultDays.includes(d) ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={mForm.sendFlag} onChange={e => setMForm(f => ({ ...f, sendFlag: e.target.checked }))} className="w-4 h-4 accent-pink-500" />
                <span className="text-sm text-gray-700">行き送迎あり</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={mForm.returnFlag} onChange={e => setMForm(f => ({ ...f, returnFlag: e.target.checked }))} className="w-4 h-4 accent-pink-500" />
                <span className="text-sm text-gray-700">帰り送迎あり</span>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">備考</label>
              <textarea value={mForm.notes} onChange={e => setMForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none" />
            </div>

            {/* 新規登録時のみインライン場所入力 */}
            {!editingMember && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">乗降場所（任意・後から追加も可）</p>

                {/* 乗せる場所（行き） */}
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                  <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                    <ArrowRight size={12} /> 乗せる場所（行き）
                  </p>
                  <input
                    value={goLoc.name}
                    onChange={e => setGoLoc(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    placeholder="場所の名前（例：自宅、〇〇駅）"
                  />
                  <div className="flex gap-2">
                    <input
                      value={goLoc.address}
                      onChange={e => setGoLoc(f => ({ ...f, address: e.target.value }))}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                      placeholder="住所（任意）"
                    />
                    <button
                      type="button"
                      onClick={() => setMapPickerTarget('inline-go')}
                      className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-pink-600 bg-pink-50 hover:bg-pink-100 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <Map size={12} /> 地図
                    </button>
                  </div>
                  {goLoc.lat && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <MapPin size={11} /> 地図上の位置が保存されます
                    </p>
                  )}
                </div>

                {/* 帰りも同じ場所チェック */}
                <label className="flex items-center gap-2 cursor-pointer px-1">
                  <input
                    type="checkbox"
                    checked={sameLocation}
                    onChange={e => setSameLocation(e.target.checked)}
                    className="w-4 h-4 accent-pink-500"
                  />
                  <span className="text-sm text-gray-700">帰りの降ろす場所も同じ</span>
                </label>

                {/* 降ろす場所（帰り） */}
                {!sameLocation && (
                  <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 space-y-2">
                    <p className="text-xs font-semibold text-orange-700 flex items-center gap-1">
                      <ArrowLeft size={12} /> 降ろす場所（帰り）
                    </p>
                    <input
                      value={returnLoc.name}
                      onChange={e => setReturnLoc(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                      placeholder="場所の名前（例：自宅、〇〇駅）"
                    />
                    <div className="flex gap-2">
                      <input
                        value={returnLoc.address}
                        onChange={e => setReturnLoc(f => ({ ...f, address: e.target.value }))}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                        placeholder="住所（任意）"
                      />
                      <button
                        type="button"
                        onClick={() => setMapPickerTarget('inline-return')}
                        className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-pink-600 bg-pink-50 hover:bg-pink-100 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <Map size={12} /> 地図
                      </button>
                    </div>
                    {returnLoc.lat && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <MapPin size={11} /> 地図上の位置が保存されます
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button onClick={() => setShowMemberModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">キャンセル</button>
              <button onClick={handleSaveMember} disabled={!mForm.name || saving} className="px-4 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Location modal */}
      {showLocationModal && (
        <Modal title={editingLocation ? '場所を編集' : '場所を追加'} onClose={() => setShowLocationModal(null)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">場所の名前 *</label>
              <input
                value={lForm.name}
                onChange={e => setLForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                placeholder="例：自宅、〇〇駅北口、セブンイレブン前"
                autoFocus
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">住所・場所の詳細</label>
                <button
                  type="button"
                  onClick={() => setMapPickerTarget('location')}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-pink-600 bg-pink-50 hover:bg-pink-100 rounded-lg cursor-pointer transition-colors"
                >
                  <Map size={12} /> 地図で指定
                </button>
              </div>
              <input
                value={lForm.address}
                onChange={e => setLForm(f => ({ ...f, address: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                placeholder="例：東京都大田区昭和島1-1-1"
              />
              {lForm.lat && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <MapPin size={11} /> 地図上の位置が保存されます
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">区分</label>
              <div className="space-y-2">
                {DIRECTION_OPTIONS.map(opt => (
                  <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${lForm.direction === opt.value ? 'border-pink-300 bg-pink-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input
                      type="radio"
                      name="direction"
                      value={opt.value}
                      checked={lForm.direction === opt.value}
                      onChange={() => setLForm(f => ({ ...f, direction: opt.value }))}
                      className="accent-pink-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                      <p className="text-xs text-gray-400">{opt.sub}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">メモ</label>
              <textarea
                value={lForm.notes}
                onChange={e => setLForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
                placeholder="例：改札前で待機、建物の裏口から"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button onClick={() => setShowLocationModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">キャンセル</button>
              <button onClick={handleSaveLocation} disabled={!lForm.name || saving} className="px-4 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Map picker modal */}
      {mapPickerTarget && (
        <Modal title="地図で場所を指定" onClose={() => setMapPickerTarget(null)} size="xl">
          <MapPicker
            initialLat={mapPickerTarget === 'location' ? lForm.lat : mapPickerTarget === 'inline-go' ? goLoc.lat : returnLoc.lat}
            initialLng={mapPickerTarget === 'location' ? lForm.lng : mapPickerTarget === 'inline-go' ? goLoc.lng : returnLoc.lng}
            onConfirm={handleMapConfirm}
            onClose={() => setMapPickerTarget(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ── 場所セクションコンポーネント ────────────────────────────────

type LocSectionProps = {
  title: string;
  icon: React.ReactNode;
  color: 'blue' | 'orange';
  locs: MemberLocation[];
  onAdd: () => void;
  onEdit: (loc: MemberLocation) => void;
  onDelete: (id: string) => void;
};

function LocationSection({ title, icon, color, locs, onAdd, onEdit, onDelete }: LocSectionProps) {
  const borderColor = color === 'blue' ? 'border-blue-200' : 'border-orange-200';
  const bgColor = color === 'blue' ? 'bg-blue-50' : 'bg-orange-50';
  const textColor = color === 'blue' ? 'text-blue-700' : 'text-orange-700';
  const addBtnColor = color === 'blue' ? 'text-blue-600 hover:text-blue-700' : 'text-orange-600 hover:text-orange-700';

  return (
    <div className={`rounded-xl border-2 ${borderColor} ${bgColor} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${textColor}`}>
          {icon}
          {title}
        </div>
        <button
          onClick={onAdd}
          className={`flex items-center gap-1 text-xs font-medium cursor-pointer ${addBtnColor}`}
        >
          <Plus size={12} /> 追加
        </button>
      </div>

      {locs.length === 0 ? (
        <button
          onClick={onAdd}
          className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-500 cursor-pointer transition-colors"
        >
          場所を登録する
        </button>
      ) : (
        <div className="space-y-1.5">
          {locs.map(loc => (
            <div key={loc.id} className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 border border-white shadow-sm group">
              <MapPin size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 leading-tight">{loc.name}</p>
                {loc.address && <p className="text-xs text-gray-400 truncate mt-0.5">{loc.address}</p>}
                {loc.notes && <p className="text-xs text-gray-400 truncate italic">{loc.notes}</p>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => onEdit(loc)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer rounded">
                  <Edit2 size={12} />
                </button>
                <button onClick={() => onDelete(loc.id)} className="p-1 text-gray-400 hover:text-red-500 cursor-pointer rounded">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
