import { useState } from 'react';
import { Plus, Edit2, Trash2, Car, UserCog } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { Modal } from '../components/common/Modal';
import { VehicleBadge } from '../components/common/Badge';
import type { Staff, Vehicle, StaffRole, VehicleColor } from '../types';

const ROLE_LABELS: Record<StaffRole, string> = {
  driver: '運転手', attendant: '添乗員', both: '兼務（両方可）',
};

const COLOR_OPTIONS: { value: VehicleColor; label: string; bg: string }[] = [
  { value: 'pink', label: 'ピンク', bg: 'bg-pink-500' },
  { value: 'blue', label: '青', bg: 'bg-blue-500' },
  { value: 'vel', label: 'ヴェル（紫）', bg: 'bg-purple-500' },
];

export function StaffVehicleMaster() {
  const { staff, vehicles, addStaff, updateStaff, deleteStaff, addVehicle, updateVehicle, deleteVehicle } = useDataStore();

  const [activeTab, setActiveTab] = useState<'staff' | 'vehicle'>('staff');
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const [sForm, setSForm] = useState({ name: '', role: 'both' as StaffRole, phone: '', notes: '', active: true });
  const [vForm, setVForm] = useState({ name: '', color: 'pink' as VehicleColor, capacity: 8, number: '', active: true });

  const openCreateStaff = () => {
    setEditingStaff(null);
    setSForm({ name: '', role: 'both', phone: '', notes: '', active: true });
    setShowStaffModal(true);
  };

  const openEditStaff = (s: Staff) => {
    setEditingStaff(s);
    setSForm({ name: s.name, role: s.role, phone: s.phone, notes: s.notes, active: s.active });
    setShowStaffModal(true);
  };

  const handleSaveStaff = () => {
    if (!sForm.name) return;
    if (editingStaff) {
      updateStaff({ ...editingStaff, ...sForm });
    } else {
      addStaff({ id: `s-${Date.now()}`, ...sForm });
    }
    setShowStaffModal(false);
  };

  const openCreateVehicle = () => {
    setEditingVehicle(null);
    setVForm({ name: '', color: 'pink', capacity: 8, number: '', active: true });
    setShowVehicleModal(true);
  };

  const openEditVehicle = (v: Vehicle) => {
    setEditingVehicle(v);
    setVForm({ name: v.name, color: v.color, capacity: v.capacity, number: v.number, active: v.active });
    setShowVehicleModal(true);
  };

  const handleSaveVehicle = () => {
    if (!vForm.name) return;
    if (editingVehicle) {
      updateVehicle({ ...editingVehicle, ...vForm });
    } else {
      addVehicle({ id: `v-${Date.now()}`, ...vForm });
    }
    setShowVehicleModal(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">スタッフ・車両マスタ</h1>
        <button
          onClick={activeTab === 'staff' ? openCreateStaff : openCreateVehicle}
          className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-medium hover:bg-pink-600 cursor-pointer transition-colors"
        >
          <Plus size={16} /> {activeTab === 'staff' ? 'スタッフ追加' : '車両追加'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['staff', 'vehicle'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${activeTab === tab ? 'bg-pink-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {tab === 'staff' ? <UserCog size={16} /> : <Car size={16} />}
            {tab === 'staff' ? `スタッフ一覧（${staff.length}名）` : `車両一覧（${vehicles.length}台）`}
          </button>
        ))}
      </div>

      {/* Staff tab */}
      {activeTab === 'staff' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                    {s.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{ROLE_LABELS[s.role]}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditStaff(s)} className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer hover:bg-gray-100 rounded">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => deleteStaff(s.id)} className="p-1.5 text-gray-400 hover:text-red-500 cursor-pointer hover:bg-red-50 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {s.phone && (
                <p className="text-xs text-gray-400 mt-2">{s.phone}</p>
              )}
              {!s.active && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full mt-2 inline-block">非アクティブ</span>
              )}
            </div>
          ))}

          {staff.length === 0 && (
            <div className="col-span-3 bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
              <UserCog size={40} className="mx-auto mb-3 opacity-30" />
              <p>スタッフが登録されていません</p>
            </div>
          )}
        </div>
      )}

      {/* Vehicle tab */}
      {activeTab === 'vehicle' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map(v => (
            <div key={v.id} className={`rounded-xl border shadow-sm overflow-hidden ${
              v.color === 'pink' ? 'border-pink-200' : v.color === 'blue' ? 'border-blue-200' : 'border-purple-200'
            }`}>
              <div className={`px-4 py-3 ${
                v.color === 'pink' ? 'bg-pink-500 text-white' : v.color === 'blue' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Car size={18} />
                    <span className="font-bold">{v.name}</span>
                    <VehicleBadge color={v.color} name={`定員${v.capacity}名`} />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditVehicle(v)} className="p-1 text-white/70 hover:text-white cursor-pointer rounded">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteVehicle(v.id)} className="p-1 text-white/70 hover:text-white cursor-pointer rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="bg-white px-4 py-3">
                {v.number && <p className="text-sm text-gray-600">ナンバー：{v.number}</p>}
                <div className="mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${v.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {v.active ? '稼働中' : '非稼働'}
                  </span>
                  {v.color === 'vel' && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">補助稼働</span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {vehicles.length === 0 && (
            <div className="col-span-3 bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
              <Car size={40} className="mx-auto mb-3 opacity-30" />
              <p>車両が登録されていません</p>
            </div>
          )}
        </div>
      )}

      {/* Staff Modal */}
      {showStaffModal && (
        <Modal title={editingStaff ? 'スタッフを編集' : 'スタッフを追加'} onClose={() => setShowStaffModal(false)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">氏名 *</label>
              <input value={sForm.name} onChange={e => setSForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="例：山本 一郎" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">役割</label>
              <select value={sForm.role} onChange={e => setSForm(f => ({ ...f, role: e.target.value as StaffRole }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                <option value="driver">運転手</option>
                <option value="attendant">添乗員</option>
                <option value="both">兼務（両方可）</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">電話番号</label>
              <input value={sForm.phone} onChange={e => setSForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="090-0000-0000" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={sForm.active} onChange={e => setSForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 accent-pink-500" />
              <span className="text-sm text-gray-700">アクティブ</span>
            </label>
            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button onClick={() => setShowStaffModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">キャンセル</button>
              <button onClick={handleSaveStaff} disabled={!sForm.name} className="px-4 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50">保存</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Vehicle Modal */}
      {showVehicleModal && (
        <Modal title={editingVehicle ? '車両を編集' : '車両を追加'} onClose={() => setShowVehicleModal(false)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">車両名 *</label>
              <input value={vForm.name} onChange={e => setVForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="例：ピンク" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">識別カラー</label>
              <div className="flex gap-3">
                {COLOR_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setVForm(f => ({ ...f, color: opt.value }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm cursor-pointer transition-colors ${vForm.color === opt.value ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <span className={`w-4 h-4 rounded-full ${opt.bg}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">定員</label>
                <input type="number" min="1" max="20" value={vForm.capacity} onChange={e => setVForm(f => ({ ...f, capacity: parseInt(e.target.value) || 8 }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ナンバープレート</label>
                <input value={vForm.number} onChange={e => setVForm(f => ({ ...f, number: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="品川 11 あ 1111" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={vForm.active} onChange={e => setVForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 accent-pink-500" />
              <span className="text-sm text-gray-700">稼働中</span>
            </label>
            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button onClick={() => setShowVehicleModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">キャンセル</button>
              <button onClick={handleSaveVehicle} disabled={!vForm.name} className="px-4 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50">保存</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
