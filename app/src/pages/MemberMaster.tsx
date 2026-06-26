import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, MapPin, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { Modal } from '../components/common/Modal';
import { DayBadge } from '../components/common/Badge';
import type { Member, MemberLocation, Direction } from '../types';

const ALL_DAYS = ['月', '火', '水', '木', '金', '土'];
const DIRECTION_LABELS: Record<Direction, string> = { go: '行き', return: '帰り', both: '両方' };

export function MemberMaster() {
  const { members, memberLocations, addMember, updateMember, deleteMember,
    addMemberLocation, updateMemberLocation, deleteMemberLocation } = useDataStore();

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingLocation, setEditingLocation] = useState<MemberLocation | null>(null);

  const [mForm, setMForm] = useState({
    name: '', nameKana: '', phone: '', defaultDays: [] as string[],
    sendFlag: true, returnFlag: true, notes: '',
  });

  const [lForm, setLForm] = useState({
    name: '', address: '', direction: 'both' as Direction, notes: '',
  });

  const filtered = members.filter(m =>
    m.name.includes(search) || m.phone.includes(search)
  );

  const getLocations = (memberId: string) =>
    memberLocations.filter(l => l.memberId === memberId);

  const openCreateMember = () => {
    setEditingMember(null);
    setMForm({ name: '', nameKana: '', phone: '', defaultDays: [], sendFlag: true, returnFlag: true, notes: '' });
    setShowMemberModal(true);
  };

  const openEditMember = (m: Member) => {
    setEditingMember(m);
    setMForm({ name: m.name, nameKana: m.nameKana ?? '', phone: m.phone, defaultDays: m.defaultDays, sendFlag: m.sendFlag, returnFlag: m.returnFlag, notes: m.notes });
    setShowMemberModal(true);
  };

  const handleSaveMember = () => {
    if (!mForm.name) return;
    if (editingMember) {
      updateMember({ ...editingMember, ...mForm });
    } else {
      addMember({ id: `m-${Date.now()}`, createdAt: new Date().toISOString(), ...mForm });
    }
    setShowMemberModal(false);
  };

  const openCreateLocation = (memberId: string) => {
    setEditingLocation(null);
    setLForm({ name: '', address: '', direction: 'both', notes: '' });
    setShowLocationModal(memberId);
  };

  const openEditLocation = (loc: MemberLocation) => {
    setEditingLocation(loc);
    setLForm({ name: loc.name, address: loc.address, direction: loc.direction, notes: loc.notes });
    setShowLocationModal(loc.memberId);
  };

  const handleSaveLocation = () => {
    if (!lForm.name || !showLocationModal) return;
    if (editingLocation) {
      updateMemberLocation({ ...editingLocation, ...lForm });
    } else {
      addMemberLocation({ id: `l-${Date.now()}`, memberId: showLocationModal, ...lForm });
    }
    setShowLocationModal(null);
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
          placeholder="氏名・電話番号で検索"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white"
        />
      </div>

      {/* Member list */}
      <div className="space-y-2">
        {filtered.map(member => {
          const locs = getLocations(member.id);
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
                    {member.sendFlag && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">行き</span>}
                    {member.returnFlag && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">帰り</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {member.phone && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Phone size={11} /> {member.phone}
                      </span>
                    )}
                    <div className="flex gap-1">
                      {ALL_DAYS.map(d => (
                        <DayBadge key={d} day={d} active={member.defaultDays.includes(d)} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <MapPin size={11} /> {locs.length}件
                  </span>
                  <button onClick={() => openEditMember(member)} className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer hover:bg-gray-100 rounded">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => deleteMember(member.id)} className="p-1.5 text-gray-400 hover:text-red-500 cursor-pointer hover:bg-red-50 rounded">
                    <Trash2 size={14} />
                  </button>
                  <button onClick={() => setExpandedId(expanded ? null : member.id)} className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer hover:bg-gray-100 rounded">
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Expanded: locations */}
              {expanded && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600">乗降場所</p>
                    <button onClick={() => openCreateLocation(member.id)} className="flex items-center gap-1 text-xs text-pink-600 hover:text-pink-700 cursor-pointer">
                      <Plus size={12} /> 追加
                    </button>
                  </div>
                  {locs.length === 0 ? (
                    <p className="text-xs text-gray-400">乗降場所が登録されていません</p>
                  ) : (
                    <div className="space-y-1.5">
                      {locs.map(loc => (
                        <div key={loc.id} className="flex items-start gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
                          <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800">{loc.name}</span>
                              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{DIRECTION_LABELS[loc.direction]}</span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{loc.address}</p>
                            {loc.notes && <p className="text-xs text-gray-400 truncate">{loc.notes}</p>}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => openEditLocation(loc)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer rounded">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => deleteMemberLocation(loc.id)} className="p-1 text-gray-400 hover:text-red-500 cursor-pointer rounded">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
            <p>利用者が登録されていません</p>
          </div>
        )}
      </div>

      {/* Member modal */}
      {showMemberModal && (
        <Modal title={editingMember ? '利用者を編集' : '利用者を追加'} onClose={() => setShowMemberModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">氏名 *</label>
                <input value={mForm.name} onChange={e => setMForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="例：田中 太郎" />
                <label className="block text-xs font-medium text-gray-700 mb-1 mt-3">読み仮名</label>
                <input value={mForm.nameKana} onChange={e => setMForm(f => ({ ...f, nameKana: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="例：たなか たろう" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">電話番号</label>
                <input value={mForm.phone} onChange={e => setMForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="090-0000-0000" />
              </div>
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
            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button onClick={() => setShowMemberModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">キャンセル</button>
              <button onClick={handleSaveMember} disabled={!mForm.name} className="px-4 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50">保存</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Location modal */}
      {showLocationModal && (
        <Modal title={editingLocation ? '乗降場所を編集' : '乗降場所を追加'} onClose={() => setShowLocationModal(null)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">場所名 *</label>
              <input value={lForm.name} onChange={e => setLForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="例：自宅、〇〇駅北口" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">住所</label>
              <input value={lForm.address} onChange={e => setLForm(f => ({ ...f, address: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="例：東京都大田区昭和島1-1-1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">区分</label>
              <select value={lForm.direction} onChange={e => setLForm(f => ({ ...f, direction: e.target.value as Direction }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                <option value="both">行き・帰り両方</option>
                <option value="go">行きのみ</option>
                <option value="return">帰りのみ</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">メモ</label>
              <textarea value={lForm.notes} onChange={e => setLForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none" placeholder="例：改札前で待機" />
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button onClick={() => setShowLocationModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">キャンセル</button>
              <button onClick={handleSaveLocation} disabled={!lForm.name} className="px-4 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50">保存</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
