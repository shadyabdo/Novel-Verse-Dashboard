import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, FolderPlus, Search, Check, FileText } from 'lucide-react';

interface Volume {
  id: string;
  novelId: string;
  name: string;
  order: number;
}

interface Chapter {
  id: string;
  novelId: string;
  volumeId?: string;
  title: string;
  content: string;
  order: number;
  date?: string;
}

interface AddVolumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: Chapter[];
  volumes: Volume[];
  onAddVolume: (volumeName: string, selectedChapterIds: string[]) => Promise<void>;
}

export const AddVolumeModal: React.FC<AddVolumeModalProps> = ({
  isOpen,
  onClose,
  chapters,
  volumes,
  onAddVolume,
}) => {
  const [volumeName, setVolumeName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map volume id to name for easy lookup
  const volumeMap = useMemo(() => {
    const map: { [key: string]: string } = {};
    volumes.forEach(v => {
      map[v.id] = v.name;
    });
    return map;
  }, [volumes]);

  // Filter chapters based on search term and unassigned preference
  const filteredChapters = useMemo(() => {
    return chapters.filter(ch => {
      const matchesSearch = ch.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            `الفصل ${ch.order}`.includes(searchTerm);
      const matchesUnassigned = !onlyUnassigned || !ch.volumeId;
      return matchesSearch && matchesUnassigned;
    });
  }, [chapters, searchTerm, onlyUnassigned]);

  if (!isOpen) return null;

  // Toggle single selection
  const toggleSelect = (id: string) => {
    setSelectedChapterIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Select all filtered chapters
  const selectAll = () => {
    const toAdd = filteredChapters.map(ch => ch.id);
    setSelectedChapterIds(prev => {
      const merged = new Set([...prev, ...toAdd]);
      return Array.from(merged);
    });
  };

  // Deselect all filtered chapters
  const deselectAll = () => {
    const toRemove = filteredChapters.map(ch => ch.id);
    setSelectedChapterIds(prev => prev.filter(id => !toRemove.includes(id)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volumeName.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddVolume(volumeName.trim(), selectedChapterIds);
      setVolumeName('');
      setSelectedChapterIds([]);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-6" dir="rtl">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-40"
      />

      {/* Modal Container */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="relative w-full max-w-3xl bg-[#1e1e1e] border border-[#383636] rounded-[2.5rem] flex flex-col shadow-3xl overflow-hidden max-h-[90vh] z-50 text-white"
      >
        {/* Header */}
        <div className="p-8 border-b border-[#383636] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#f86e7e]/10 rounded-2xl flex items-center justify-center border border-[#f86e7e]/20">
              <FolderPlus className="w-6 h-6 text-[#f86e7e]" />
            </div>
            <div>
              <h3 className="font-extrabold text-xl text-white">إضافة مجلد جديد وتعيين الفصول</h3>
              <p className="text-xs text-slate-400 mt-1 font-medium">أنشئ المجلد وحدد الفصول التي ترغب بإدراجها فيه مباشرة</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-[#383636] text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="p-8 space-y-6 overflow-y-auto flex-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            
            {/* Input Name */}
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">اسم المجلد</label>
              <input 
                type="text" 
                required
                placeholder="أدخل اسم المجلد، مثال: المجلد الأول" 
                value={volumeName}
                onChange={e => setVolumeName(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl border border-[#383636] bg-[#121212] text-white focus:ring-2 focus:ring-[#f86e7e]/50 outline-none transition-all font-semibold text-sm placeholder:text-slate-600"
              />
            </div>

            {/* Chapters Assignment Panel */}
            <div className="border border-[#383636] bg-[#121212]/50 rounded-[2rem] p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-300">اختر فصول الرواية ({selectedChapterIds.length} فصول محددة)</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">يمكنك تصفية الفصول وتحديدها دفعة واحدة</p>
                </div>

                {/* Filtering Checks */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl border border-white/5 transition-all text-xs font-semibold select-none">
                    <input 
                      type="checkbox" 
                      className="accent-[#f86e7e]"
                      checked={onlyUnassigned}
                      onChange={e => setOnlyUnassigned(e.target.checked)}
                    />
                    <span>الفصول غير المجلدة فقط</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons & Search */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute right-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="ابحث برقم أو اسم الفصل..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pr-11 pl-4 py-3 rounded-xl border border-[#383636] bg-[#121212] text-xs font-medium focus:ring-1 focus:ring-[#f86e7e]/50 outline-none transition-all placeholder:text-slate-600"
                  />
                </div>
                <button 
                  type="button"
                  onClick={selectAll}
                  className="px-4 py-3 bg-[#f86e7e]/10 text-[#f86e7e] hover:bg-[#f86e7e]/20 border border-[#f86e7e]/20 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
                >
                  تحديد الكل ({filteredChapters.length})
                </button>
                <button 
                  type="button"
                  onClick={deselectAll}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-transparent hover:border-[#383636] rounded-xl text-xs font-bold transition-all whitespace-nowrap"
                >
                  إلغاء التحديد
                </button>
              </div>

              {/* Chapters Scroll Area */}
              <div className="h-60 overflow-y-auto border border-[#383636] bg-[#121212] rounded-2xl p-4 divide-y divide-[#1e1e1e]" style={{ scrollbarWidth: 'thin' }}>
                {filteredChapters.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                    <FileText className="w-8 h-8 opacity-40" />
                    <span className="text-xs font-bold">لا توجد فصول متطابقة للبحث</span>
                  </div>
                ) : (
                  filteredChapters.map(ch => {
                    const isChecked = selectedChapterIds.includes(ch.id);
                    return (
                      <div 
                        key={ch.id} 
                        onClick={() => toggleSelect(ch.id)}
                        className={`flex items-center justify-between py-3 px-2.5 hover:bg-white/5 transition-all cursor-pointer rounded-xl ${isChecked ? 'bg-[#f86e7e]/5' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Beautiful Custom Checkbox */}
                          <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                            isChecked 
                              ? 'bg-[#f86e7e] border-[#f86e7e] text-[#121212]' 
                              : 'border-[#383636] bg-black/20 group-hover:border-slate-500'
                          }`}>
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[4]" />}
                          </div>

                          <div>
                            <span className="text-xs font-extrabold text-white">
                              {ch.title}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold mr-2">
                              (ترتيب: {ch.order})
                            </span>
                          </div>
                        </div>

                        {/* Status Label (Assigned vs Unassigned) */}
                        <div>
                          {ch.volumeId ? (
                            <span className="text-[9px] font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-md">
                              ضمن: {volumeMap[ch.volumeId] || 'مجلد آخر'}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-500 bg-white/5 py-0.5 px-2 rounded-md border border-white/5">
                              غير مجلد
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Footer Action Bar */}
          <div className="p-8 border-t border-[#383636] bg-[#1a1a1c] flex items-center justify-end gap-3.5">
            <button 
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-4 rounded-xl text-slate-400 hover:text-white font-bold text-xs transition-all border border-transparent hover:border-[#383636] disabled:opacity-50"
            >
              إلغاء
            </button>
            <button 
              type="submit"
              disabled={isSubmitting || !volumeName.trim()}
              className="px-8 py-4 bg-[#f86e7e] hover:bg-[#e05d6b] text-[#121212] font-black rounded-xl text-xs transition-all shadow-lg shadow-[#f86e7e]/10 disabled:opacity-50 disabled:hover:scale-100 transform hover:scale-[1.02] active:scale-95"
            >
              {isSubmitting ? 'جاري الإضافة...' : 'إنشاء المجلد وتعيين الفصول'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
