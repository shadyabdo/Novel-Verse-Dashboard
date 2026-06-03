/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  getDocFromServer,
  collectionGroup,
  limit
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { 
  Plus, 
  Book, 
  FileText, 
  Trash2, 
  Edit, 
  ChevronRight, 
  ChevronLeft,
  LogOut, 
  LogIn,
  Save,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Loader2,
  Image as ImageIcon,
  Search,
  Compass,
  SlidersHorizontal,
  Folder,
  FolderPlus,
  FolderOpen,
  LayoutDashboard,
  Settings,
  Star,
  Clock,
  ExternalLink,
  MoreVertical,
  Layers,
  Sun,
  Moon,
  X,
  Eye,
  Maximize2,
  ChevronUp,
  ChevronDown,
  Bold,
  Italic,
  Link,
  Heading,
  Quote,
  Sparkles,
  BookOpen,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import { AddVolumeModal } from './components/AddVolumeModal';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Types ---

interface Novel {
  id: string;
  name: string;
  description: string;
  author: string;
  coverImages?: string[];
  categories?: string[];
  status?: string;
  rating?: number;
  createdAt?: any;
  updatedAt?: any;
}

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
  createdAt?: any;
  updatedAt?: any;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

// --- Helpers ---

const processChapterContent = (content: string) => {
  if (!content) return '';
  // Convert [https://...] to ![image](https://...)
  let processed = content.replace(/\[(https?:\/\/[^\]]+)\]/g, '![image]($1)');
  
  // Handle plain URLs that look like images but aren't in markdown format
  // This regex looks for URLs ending in image extensions that are not already in () or []
  processed = processed.replace(/(?<![([])(https?:\/\/[^\s[\]()]+\.(?:png|jpg|jpeg|gif|webp|svg))(?![\])])/gi, '![image]($1)');
  
  return processed;
};

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app, we'd show a toast here
}

// --- Components ---

const CoverSlider = React.memo(({ images }: { images: string[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const validImages = images.filter(img => img && img.trim() !== '');

  useEffect(() => {
    if (validImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % validImages.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [validImages.length]);

  if (validImages.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#121212] text-slate-700">
        <ImageIcon className="w-12 h-12" />
      </div>
    );
  }

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((prev) => (prev + 1) % validImages.length);
  };

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
  };

  return (
    <div className="relative w-full h-full group overflow-hidden rounded-xl">
      <AnimatePresence mode="wait">
        <motion.img 
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          src={validImages[currentIndex]} 
          alt={`Cover ${currentIndex + 1}`} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </AnimatePresence>
      {validImages.length > 1 && (
        <>
          <button 
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {validImages.map((_, idx) => (
              <div 
                key={idx} 
                className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentIndex ? 'bg-[#f86e7e] w-4' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
});

const ChapterPreviewModal = ({ chapter, onClose }: { chapter: Chapter, onClose: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-[#121212]/95 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-[#1e1e1e] w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-[#1e1e1e] sticky top-0 z-10">
          <div>
            <h3 className="text-xl md:text-2xl font-black text-white mb-1">{chapter.title}</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">الفصل {chapter.order}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl hover:bg-white/10 transition-all text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 md:p-12 scrollbar-hide">
          <div className="max-w-2xl mx-auto prose prose-invert prose-slate">
            <div className="markdown-body text-slate-300 leading-[2] text-lg md:text-xl font-sans">
              <Markdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  img: ({ src, alt }) => (
                    <div className="my-8 flex flex-col items-center">
                      <img 
                        src={src} 
                        alt={alt || 'Chapter Image'} 
                        className="rounded-2xl shadow-2xl max-w-full border border-white/5 hover:scale-[1.02] transition-transform duration-500" 
                        referrerPolicy="no-referrer"
                      />
                      {alt && alt !== 'image' && <span className="mt-3 text-xs text-slate-500 font-bold uppercase tracking-widest">{alt}</span>}
                    </div>
                  )
                }}
              >
                {processChapterContent(chapter.content)}
              </Markdown>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-white/5 bg-[#121212]/50 flex justify-center">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">NovelVerse Reader Preview</p>
        </div>
      </motion.div>
    </motion.div>
  );
};

const LightboxSlider = ({ images, initialIndex, onClose }: { images: string[], initialIndex: number, onClose: () => void }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const validImages = useMemo(() => images.filter(img => img && img.trim() !== ''), [images]);

  if (validImages.length === 0) return null;

  const next = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setCurrentIndex((prev) => (prev + 1) % validImages.length);
  };

  const prev = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#121212]/98 backdrop-blur-2xl p-4 md:p-10 select-none"
    >
      <div className="absolute top-6 left-6 flex items-center gap-3 z-30">
        <span className="text-xs font-bold text-slate-400 bg-white/5 py-2 px-4 rounded-xl border border-white/5">
          {currentIndex + 1} / {validImages.length}
        </span>
        <button 
          onClick={onClose}
          className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg"
          title="إغلاق المعرض"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative w-full max-w-5xl flex-1 flex items-center justify-center px-4 md:px-12">
        {validImages.length > 1 && (
          <button 
            onClick={prev}
            className="absolute left-2 md:left-4 z-20 p-4 bg-[#1e1e1e] hover:bg-[#252528] text-[#f86e7e] hover:text-white rounded-2xl transition-all border border-[#383636] shadow-2xl"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <div className="w-full h-full max-h-[75vh] flex items-center justify-center relative overflow-hidden rounded-3xl">
          <AnimatePresence mode="wait">
            <motion.img 
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              src={validImages[currentIndex]} 
              alt={`Cover Large ${currentIndex + 1}`} 
              className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl border border-white/5"
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
        </div>

        {validImages.length > 1 && (
          <button 
            onClick={next}
            className="absolute right-2 md:right-4 z-20 p-4 bg-[#1e1e1e] hover:bg-[#252528] text-[#f86e7e] hover:text-white rounded-2xl transition-all border border-[#383636] shadow-2xl"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="w-full max-w-md mt-6 flex justify-center gap-2 overflow-x-auto py-2 px-4 whitespace-nowrap scrollbar-hide">
        {validImages.map((img, idx) => (
          <button 
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`relative w-12 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
              idx === currentIndex 
                ? 'border-[#f86e7e] scale-110 shadow-lg shadow-[#f86e7e]/20' 
                : 'border-white/5 opacity-40 hover:opacity-100 hover:border-white/20'
            }`}
          >
            <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </button>
        ))}
      </div>
    </motion.div>
  );
};

// --- Components ---

const ChapterItem = ({ chapter, index, onPreview, onEdit, onDelete }: { 
  chapter: Chapter, 
  index: number, 
  onPreview: (c: Chapter) => void, 
  onEdit: (c: Chapter) => void, 
  onDelete: (id: string) => void 
}) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
    onClick={() => onPreview(chapter)}
    className="bg-[#1c1c1e] p-5 rounded-2xl border border-white/5 flex items-center justify-between hover:border-[#f86e7e]/40 hover:bg-[#222224] transition-all duration-300 group shadow-lg cursor-pointer transform hover:-translate-y-0.5"
  >
    <div className="flex items-center gap-5 flex-1">
      <div className="w-12 h-12 bg-black/30 group-hover:bg-[#f86e7e] group-hover:text-[#121212] rounded-xl flex items-center justify-center text-slate-400 font-extrabold transition-all duration-300 shadow-inner">
        {chapter.order}
      </div>
      <div>
        <h4 className="font-bold text-white mb-1.5 group-hover:text-[#f86e7e] transition-colors">{chapter.title}</h4>
        <div className="flex items-center flex-wrap gap-3 text-[10px] text-slate-400 font-medium">
          <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md border border-white/5"><Clock className="w-3 h-3 text-[#f86e7e]" /> {chapter.date}</span>
          <span className="w-1 h-1 bg-slate-700 rounded-full" />
          <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md border border-white/5"><FileText className="w-3 h-3 text-slate-500" /> {chapter.content.length} حرف</span>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <button 
        onClick={() => onPreview(chapter)}
        className="p-2.5 text-slate-400 hover:text-[#f86e7e] hover:bg-[#f86e7e]/10 rounded-xl transition-all"
        title="معاينة"
      >
        <Eye className="w-5 h-5" />
      </button>
      <button 
        onClick={() => onEdit(chapter)}
        className="p-2.5 text-slate-400 hover:text-[#f86e7e] hover:bg-[#f86e7e]/10 rounded-xl transition-all"
        title="تعديل الفصول"
      >
        <Edit className="w-5 h-5" />
      </button>
      <button 
        onClick={() => onDelete(chapter.id)}
        className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
        title="حذف الفصل"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  </motion.div>
);

const NovelCard = React.memo(({ 
  novel, 
  onViewChapters, 
  onEditNovel, 
  onDeleteNovel 
}: { 
  novel: Novel, 
  onViewChapters: (n: Novel) => void, 
  onEditNovel: (n: Novel) => void, 
  onDeleteNovel: (id: string) => void 
}) => {
  return (
    <motion.div 
      layoutId={novel.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => onViewChapters(novel)}
      className="group bg-[#1c1c1e] rounded-[2rem] border border-[#2f2e30] overflow-hidden hover:border-[#f86e7e]/40 hover:shadow-[0_20px_40px_-15px_rgba(248,110,126,0.18)] transition-all duration-300 flex flex-col h-full relative cursor-pointer"
    >
      {/* Background soft color glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#f86e7e]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="p-4 flex-1 flex flex-col">
        {/* Cover Aspect Ratio Wrap */}
        <div className="aspect-[3/4] relative overflow-hidden rounded-[1.5rem] border border-[#2f2e30] bg-[#121212]">
          {novel.coverImages && novel.coverImages.length > 0 ? (
            <img 
              src={novel.coverImages[0]} 
              alt={novel.name} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 gap-2">
              <ImageIcon className="w-12 h-12 stroke-[1.5]" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">بدون غلاف</span>
            </div>
          )}

          {/* Quick Info Cover Overlay on Hover */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5 z-10">
            <span className="inline-flex items-center justify-center gap-1.5 bg-[#f86e7e] text-[#121212] py-2.5 px-4 rounded-xl font-bold text-[11px] w-full transition-transform translate-y-2 group-hover:translate-y-0 duration-300">
              <Eye className="w-3.5 h-3.5" />
              تصفح الفصول والأغلفة
            </span>
          </div>
          
          {/* Top Left Status Pill */}
          {novel.status && (
            <div className="absolute top-3 left-3 z-20">
              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide shadow-lg border backdrop-blur-md ${
                novel.status === 'مستمرة' 
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {novel.status}
              </span>
            </div>
          )}

          {/* Floating Rating Badge (moved to top right) */}
          <div className="absolute top-3 right-3 z-20 bg-black/75 backdrop-blur-md border border-[#2f2e30] py-1 px-2.5 rounded-lg text-yellow-500 flex items-center gap-1 text-[10px] font-black shadow-md">
            <Star className="w-3 h-3 text-yellow-500 fill-current" />
            <span>{novel.rating || '0.0'}</span>
          </div>
        </div>

        {/* Info Area */}
        <div className="mt-4 flex-1 flex flex-col px-1">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f86e7e]" />
            <h3 className="text-sm font-black text-white line-clamp-1 group-hover:text-[#f86e7e] transition-colors duration-300">
              {novel.name || 'Untitled'}
            </h3>
          </div>

          <p className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed font-medium">
            {novel.description || 'لا يوجد وصف متاح لهذه الرواية حالياً.'}
          </p>
          
          {novel.categories && novel.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4 mt-auto">
              {novel.categories.slice(0, 3).map((cat, i) => (
                <span 
                  key={i} 
                  className="px-2 py-0.5 rounded-md bg-white/5 text-slate-300 text-[9px] font-bold border border-white/5"
                >
                  {cat}
                </span>
              ))}
              {novel.categories.length > 3 && (
                <span className="text-[9px] text-[#f86e7e] font-extrabold self-center">
                  +{novel.categories.length - 3}
                </span>
              )}
            </div>
          )}
          
          <div className="pt-3.5 border-t border-white/5 flex items-center justify-between mt-auto">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#f86e7e]/10 border border-[#f86e7e]/20 flex items-center justify-center text-[#f86e7e] font-bold text-[8px]">
                {novel.author ? novel.author.trim().substring(0, 1).toUpperCase() : 'A'}
              </div>
              <span className="text-[10px] font-bold text-slate-300 truncate max-w-[120px]">
                {novel.author}
              </span>
            </div>
            
            <span className="text-[9px] font-bold text-[#f86e7e] flex items-center gap-1">
              اقرأ الآن &larr;
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [globalLatestChapters, setGlobalLatestChapters] = useState<(Chapter & { novel?: Novel })[]>([]);
  const [selectedVolumeId, setSelectedVolumeId] = useState<string | null>(null);
  
  // UI State
  const [view, setView] = useState<'novels' | 'chapters' | 'edit-novel' | 'edit-chapter'>('novels');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [editingNovel, setEditingNovel] = useState<Partial<Novel> | null>(null);
  const [editingChapter, setEditingChapter] = useState<Partial<Chapter> | null>(null);
  const [previewChapter, setPreviewChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('الكل');
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showAddVolumeModal, setShowAddVolumeModal] = useState(false);
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [editorFontSize, setEditorFontSize] = useState<number>(20);
  const [distractionFree, setDistractionFree] = useState<boolean>(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<boolean>(false);
  const [volumeDropdownOpen, setVolumeDropdownOpen] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const groupedChapters = useMemo(() => {
    const groups: { [key: string]: Chapter[] } = { 'none': [] };
    
    // Initialize group lists for known/real volumes
    volumes.forEach(v => {
      groups[v.id] = [];
    });
    
    // Map chapters to their appropriate volume groups
    chapters.forEach(c => {
      // Check standard and possible legacy fields (volumeId, volume_id, volume, volId)
      const rawVolId = c.volumeId || (c as any).volume_id || (c as any).volume || (c as any).volId;
      
      if (rawVolId && typeof rawVolId === 'string' && rawVolId.trim() !== '') {
        const cleanedVolId = rawVolId.trim();
        if (!groups[cleanedVolId]) {
          groups[cleanedVolId] = [];
        }
        groups[cleanedVolId].push(c);
      } else {
        groups['none'].push(c);
      }
    });
    
    return groups;
  }, [chapters, volumes]);

  const virtualVolumes = useMemo(() => {
    const realVolIds = new Set(volumes.map(v => v.id));
    return Object.keys(groupedChapters).filter(key => key !== 'none' && !realVolIds.has(key));
  }, [groupedChapters, volumes]);

  const latestChapters = useMemo(() => {
    return [...chapters]
      .sort((a, b) => (b.order || 0) - (a.order || 0))
      .slice(0, 5);
  }, [chapters]);

  const isAdmin = user?.email === "shadyabdowd2020@gmail.com";

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // UI Helpers for dates
  const formatDate = (date: any) => {
    if (!date) return 'غير متوفر';
    if (date instanceof Timestamp) return date.toDate().toLocaleDateString('ar-EG');
    if (date?.toDate && typeof date.toDate === 'function') return date.toDate().toLocaleDateString('ar-EG');
    if (typeof date === 'string' || typeof date === 'number') return new Date(date).toLocaleDateString('ar-EG');
    return 'تاريخ غير معروف';
  };

  // Novels Listener
  useEffect(() => {
    if (!isAuthReady) return;
    
    // Removed orderBy to ensure data shows up even if 'createdAt' field is missing
    const q = query(collection(db, 'novels'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        console.warn("تنبيه: مجموعة 'novels' فارغة أو غير موجودة بهذا الاسم.");
      }
      const novelData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Novel));
      setNovels(novelData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'novels');
    });

    return () => unsubscribe();
  }, [isAuthReady]);

  // Categories Listener
  useEffect(() => {
    if (!isAuthReady) return;
    
    const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const categoryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(categoryData);
      
      // If no categories exist, add some defaults for first-time setup
      if (snapshot.empty && isAdmin) {
        const defaults = [
          { name: 'خيال', slug: 'fantasy' },
          { name: 'خيال علمي', slug: 'sci-fi' },
          { name: 'رومانسية', slug: 'romance' },
          { name: 'أكشن', slug: 'action' },
          { name: 'غموض', slug: 'mystery' },
          { name: 'رعب', slug: 'horror' }
        ];
        defaults.forEach(cat => addDoc(collection(db, 'categories'), cat));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    return () => unsubscribe();
  }, [isAuthReady, user, isAdmin]);

  // Chapters Listener
  useEffect(() => {
    if (!selectedNovel) {
      setChapters([]);
      return;
    }

    const q = query(collection(db, `novels/${selectedNovel.id}/chapters`), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chapterData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chapter));
      setChapters(chapterData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `novels/${selectedNovel.id}/chapters`));

    return () => unsubscribe();
  }, [selectedNovel]);

  // Volumes Listener
  useEffect(() => {
    if (!selectedNovel) {
      setVolumes([]);
      setSelectedVolumeId(null);
      return;
    }

    const q = query(collection(db, `novels/${selectedNovel.id}/volumes`), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const volumeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Volume));
      setVolumes(volumeData);
      if (volumeData.length > 0) {
        setSelectedVolumeId(prev => {
          if (prev && volumeData.some(v => v.id === prev)) {
            return prev;
          }
          return volumeData[0].id;
        });
      } else {
        setSelectedVolumeId(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, `novels/${selectedNovel.id}/volumes`));

    return () => unsubscribe();
  }, [selectedNovel]);

  // Global chapters Listener (Latest 16 across all novels)
  useEffect(() => {
    if (!isAuthReady) return;

    let unsubscribe: (() => void) | undefined;

    // Try with server-side orderBy first
    try {
      const q = query(collectionGroup(db, 'chapters'), orderBy('createdAt', 'desc'), limit(16));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const chapterData = snapshot.docs.map(doc => {
          const data = doc.data() as Chapter;
          const novelId = data.novelId || doc.ref.parent?.parent?.id;
          const novel = novels.find(n => n.id === novelId);
          return { id: doc.id, ...data, novel };
        });
        setGlobalLatestChapters(chapterData);
      }, (error) => {
        console.warn("Index may be missing for collection group, falling back to client-side sorting:", error);
        fallbackListen();
      });
    } catch (e) {
      console.warn("Error creating query, falling back to client-side sorting:", e);
      fallbackListen();
    }

    function fallbackListen() {
      if (unsubscribe) {
        unsubscribe();
      }
      const qFallback = query(collectionGroup(db, 'chapters'));
      unsubscribe = onSnapshot(qFallback, (snapshot) => {
        const chapterData = snapshot.docs.map(doc => {
          const data = doc.data() as Chapter;
          const novelId = data.novelId || doc.ref.parent?.parent?.id;
          const novel = novels.find(n => n.id === novelId);
          return { id: doc.id, ...data, novel };
        });
        
        // Sort by createdAt desc in client
        const sorted = [...chapterData].sort((a, b) => {
          const d1 = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const d2 = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return d2 - d1;
        }).slice(0, 16);

        setGlobalLatestChapters(sorted);
      }, (error) => {
        console.error("Critical error loading global chapters:", error);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthReady, novels]);

  // Reset chapter editor tab to 'write' on view changes
  useEffect(() => {
    setEditorTab('write');
  }, [view]);

  // --- Actions ---

  const addVolume = async () => {
    setShowAddVolumeModal(true);
  };

  const handleAddVolume = async (name: string, selectedChapterIds: string[]) => {
    if (!selectedNovel) return;
    try {
      const volumeRef = await addDoc(collection(db, `novels/${selectedNovel.id}/volumes`), { 
        name, 
        novelId: selectedNovel.id,
        order: volumes.length + 1,
        createdAt: serverTimestamp() 
      });

      const newVolumeId = volumeRef.id;

      if (selectedChapterIds.length > 0) {
        const updatePromises = selectedChapterIds.map(chapterId => 
          updateDoc(doc(db, `novels/${selectedNovel.id}/chapters`, chapterId), {
            volumeId: newVolumeId,
            updatedAt: serverTimestamp()
          })
        );
        await Promise.all(updatePromises);
      }

      Swal.fire({
        title: 'تم بنجاح!',
        text: `تم إضافة المجلد "${name}" وتعيين ${selectedChapterIds.length} فصول إليه.`,
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#f86e7e'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `novels/${selectedNovel.id}/volumes`);
      throw error;
    }
  };

  const deleteVolume = async (id: string, name: string) => {
    if (!selectedNovel) return;
    const result = await Swal.fire({
      title: 'هل أنت متأكد؟',
      text: `سيتم حذف المجلد "${name}". ملاحظة: الفصول التابعة له لن تحذف لكنها لن تكون مرتبطة بمجلد.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، احذف',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff',
      confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, `novels/${selectedNovel.id}/volumes`, id));
        Swal.fire({
          title: 'تم!',
          text: 'تم حذف المجلد',
          icon: 'success',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#f86e7e'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `novels/${selectedNovel.id}/volumes/${id}`);
      }
    }
  };

  const editVolume = async (id: string, currentName: string) => {
    if (!selectedNovel) return;
    const { value: newName } = await Swal.fire({
      title: 'تعديل اسم المجلد',
      input: 'text',
      inputLabel: 'الاسم الجديد للمجلد',
      inputValue: currentName,
      inputPlaceholder: 'أدخل الاسم الجديد للمجلد...',
      showCancelButton: true,
      confirmButtonText: 'حفظ التعديل',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff',
      confirmButtonColor: '#f86e7e',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'يجب كتابة اسم للمجلد!';
        }
        return null;
      }
    });

    if (newName && newName.trim() !== currentName) {
      try {
        await updateDoc(doc(db, `novels/${selectedNovel.id}/volumes`, id), {
          name: newName.trim(),
          updatedAt: serverTimestamp()
        });
        Swal.fire({
          title: 'تم التعديل!',
          text: 'تم تعديل اسم المجلد بنجاح',
          icon: 'success',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#f86e7e'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `novels/${selectedNovel.id}/volumes/${id}`);
      }
    }
  };

  const handleEditSelectedNovel = () => {
    if (!selectedNovel) return;
    const currentCovers = selectedNovel.coverImages || [];
    const paddedCovers = [...currentCovers];
    while (paddedCovers.length < 4) paddedCovers.push('');
    setEditingNovel({ ...selectedNovel, coverImages: paddedCovers });
    setView('edit-novel');
  };

  const handleDeleteSelectedNovel = async () => {
    if (!selectedNovel) return;
    const result = await Swal.fire({
      title: 'هل أنت متأكد؟',
      text: "سيتم حذف الرواية وجميع فصولها نهائياً!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#f86e7e',
      confirmButtonText: 'نعم، احذفها',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff'
    });

    if (!result.isConfirmed) return;

    try {
      await deleteDoc(doc(db, 'novels', selectedNovel.id));
      Swal.fire({
        title: 'تم الحذف!',
        text: 'تم حذف الرواية بنجاح',
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#f86e7e'
      });
      setSelectedNovel(null);
      setView('novels');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${selectedNovel.id}`);
    }
  };

  const addImageToContent = async () => {
    const { value: url } = await Swal.fire({
      title: 'إضافة صورة',
      input: 'url',
      inputLabel: 'رابط الصورة',
      inputPlaceholder: 'أدخل رابط الصورة هنا...',
      showCancelButton: true,
      confirmButtonText: 'إضافة',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff',
      confirmButtonColor: '#f86e7e'
    });

    if (url) {
      const imageMarkdown = `![صورة](${url})`;
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = editingChapter?.content || '';
        const newText = text.substring(0, start) + imageMarkdown + text.substring(end);
        setEditingChapter({ ...editingChapter, content: newText });
        
        // Focus back to textarea after state update
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + imageMarkdown.length, start + imageMarkdown.length);
        }, 0);
      } else {
        // Fallback if ref is not ready
        setEditingChapter({ 
          ...editingChapter, 
          content: (editingChapter?.content || '') + '\n' + imageMarkdown 
        });
      }
    }
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      Swal.fire({
        title: 'تم تسجيل الدخول!',
        text: 'مرحباً بك في NovelVerse',
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#f86e7e'
      });
    } catch (error) {
      console.error("Login failed", error);
      Swal.fire({
        title: 'فشل الدخول',
        text: 'حدث خطأ أثناء تسجيل الدخول',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#f86e7e'
      });
    }
  };

  const logout = async () => {
    await signOut(auth);
    Swal.fire({
      title: 'تم تسجيل الخروج',
      icon: 'info',
      background: '#1e1e1e',
      color: '#fff',
      confirmButtonColor: '#f86e7e',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const addCategory = async () => {
    const { value: name } = await Swal.fire({
      title: 'إضافة تصنيف جديد',
      input: 'text',
      inputLabel: 'اسم التصنيف',
      inputPlaceholder: 'مثال: أكشن، دراما...',
      showCancelButton: true,
      confirmButtonText: 'إضافة',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff',
      confirmButtonColor: '#f86e7e'
    });

    if (name) {
      try {
        const slug = name.toLowerCase().replace(/\s+/g, '-');
        await addDoc(collection(db, 'categories'), { name, slug });
        Swal.fire({
          title: 'تم!',
          text: 'تم إضافة التصنيف بنجاح',
          icon: 'success',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#f86e7e'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'categories');
      }
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    const result = await Swal.fire({
      title: 'هل أنت متأكد؟',
      text: `سيتم حذف تصنيف "${name}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، احذف',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff',
      confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'categories', id));
        Swal.fire({
          title: 'تم!',
          text: 'تم حذف التصنيف',
          icon: 'success',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#f86e7e'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
      }
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        const result = await Swal.fire({
          title: 'هل أنت متأكد؟',
          text: "هل أنت متأكد من استيراد هذه البيانات؟ قد يؤدي ذلك لإضافة روايات مكررة.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#f86e7e',
          cancelButtonColor: '#d33',
          confirmButtonText: 'نعم، استيراد',
          cancelButtonText: 'إلغاء',
          background: '#1e1e1e',
          color: '#fff'
        });

        if (!result.isConfirmed) return;
        
        setLoading(true);
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          const novelRef = await addDoc(collection(db, 'novels'), {
            name: item.name || item.title || 'رواية مستوردة',
            description: item.description || '',
            author: item.author || user?.displayName || 'كاتب غير معروف',
            coverImages: item.coverImages || (item.coverUrl ? [item.coverUrl] : []),
            status: item.status || 'مستمرة',
            rating: item.rating || 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          if (item.chapters && Array.isArray(item.chapters)) {
            for (const ch of item.chapters) {
              await addDoc(collection(db, `novels/${novelRef.id}/chapters`), {
                novelId: novelRef.id,
                title: ch.title || 'فصل غير معنون',
                content: ch.content || '',
                order: ch.order || 1,
                date: ch.date || new Date().toLocaleDateString('ar-EG'),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          }
        }
        Swal.fire({
          title: 'تم الاستيراد!',
          text: 'تم استيراد البيانات بنجاح',
          icon: 'success',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#f86e7e'
        });
      } catch (err) {
        console.error("Import failed", err);
        Swal.fire({
          title: 'فشل الاستيراد',
          text: 'تأكد من صيغة الملف.',
          icon: 'error',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#f86e7e'
        });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const filteredNovels = React.useMemo(() => {
    return novels.filter(n => {
      const name = n.name || '';
      const author = n.author || '';
      const search = searchTerm || '';
      const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || 
                           author.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'الكل' || (n.categories && n.categories.includes(selectedCategory));
      const matchesStatus = selectedStatus === 'الكل' || n.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [novels, searchTerm, selectedCategory, selectedStatus]);

  const saveNovel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNovel?.name || !editingNovel?.author) return;

    setLoading(true);
    try {
      // Filter out empty strings from coverImages
      const cleanedCovers = (editingNovel.coverImages || []).filter(url => url.trim() !== '');
      
      const { id, ...dataToSave } = editingNovel;
      const data = {
        ...dataToSave,
        coverImages: cleanedCovers,
        categories: editingNovel.categories || [],
        updatedAt: serverTimestamp(),
      };

      if (id) {
        await updateDoc(doc(db, 'novels', id), data);
      } else {
        await addDoc(collection(db, 'novels'), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      setView('novels');
      setEditingNovel(null);
      Swal.fire({
        title: 'تم الحفظ!',
        text: 'تم حفظ بيانات الرواية بنجاح',
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#f86e7e'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'novels');
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حفظ الرواية',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#f86e7e'
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteNovel = async (id: string) => {
    const result = await Swal.fire({
      title: 'هل أنت متأكد؟',
      text: "سيتم حذف الرواية وجميع فصولها نهائياً!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#f86e7e',
      confirmButtonText: 'نعم، احذفها',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff'
    });

    if (!result.isConfirmed) return;

    try {
      await deleteDoc(doc(db, 'novels', id));
      Swal.fire({
        title: 'تم الحذف!',
        text: 'تم حذف الرواية بنجاح',
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#f86e7e'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${id}`);
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حذف الرواية',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#f86e7e'
      });
    }
  };

  const saveChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNovel || !editingChapter?.title || !editingChapter?.content) return;

    setLoading(true);
    try {
      const path = `novels/${selectedNovel.id}/chapters`;
      const { id, ...dataToSave } = editingChapter;
      const data = {
        ...dataToSave,
        novelId: selectedNovel.id,
        volumeId: editingChapter.volumeId || null,
        date: editingChapter.date || new Date().toLocaleDateString('ar-EG'),
        updatedAt: serverTimestamp(),
      };

      if (id) {
        await updateDoc(doc(db, path, id), data);
      } else {
        await addDoc(collection(db, path), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      setView('chapters');
      setEditingChapter(null);
      Swal.fire({
        title: 'تم الحفظ!',
        text: 'تم حفظ الفصل بنجاح',
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#f86e7e'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `novels/${selectedNovel?.id}/chapters`);
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حفظ الفصل',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#f86e7e'
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteChapter = async (id: string) => {
    if (!selectedNovel) return;
    
    const result = await Swal.fire({
      title: 'هل أنت متأكد؟',
      text: "سيتم حذف هذا الفصل نهائياً!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#f86e7e',
      confirmButtonText: 'نعم، احذف',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff'
    });

    if (!result.isConfirmed) return;

    try {
      await deleteDoc(doc(db, `novels/${selectedNovel.id}/chapters`, id));
      Swal.fire({
        title: 'تم الحذف!',
        text: 'تم حذف الفصل بنجاح',
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#f86e7e'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${selectedNovel.id}/chapters/${id}`);
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حذف الفصل',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#f86e7e'
      });
    }
  };

  // --- UI Helpers ---

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#f86e7e]/20 border-t-[#f86e7e] rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Book className="w-6 h-6 text-[#f86e7e]" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#f86e7e]/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#f86e7e]/10 rounded-full blur-3xl" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1e1e1e] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl max-w-md w-full text-center relative z-10"
        >
          <div className="w-20 h-20 bg-[#f86e7e] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#f86e7e]/30">
            <Book className="w-10 h-10 text-[#121212]" />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">كوم روايات</h1>
          <p className="text-slate-400 mb-8 leading-relaxed">منصتك المفضلة لإدارة وقراءة الروايات وفصولها بكل سهولة.</p>
          <button 
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-[#f86e7e] hover:bg-[#e05d6b] text-[#121212] font-bold py-4 rounded-2xl transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            <LogIn className="w-5 h-5" />
            تسجيل الدخول باستخدام جوجل
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col font-sans relative overflow-hidden" dir="rtl">
      {/* Lightbox Filter Dialog */}
      <AnimatePresence>
        {showSidebar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            {/* Centered Lightbox Card wrapper */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-2xl bg-[#1e1e1e] border border-[#383636] rounded-[2.5rem] flex flex-col shadow-3xl overflow-hidden max-h-[85vh] z-10"
            >
              <div className="p-8 border-b border-[#383636] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#f86e7e]/10 rounded-xl flex items-center justify-center">
                    <Compass className="w-5 h-5 text-[#f86e7e]" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xl text-white">تصفية الروايات</h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">اختر تصنيفًا لعرض الروايات الخاصة به</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSidebar(false)}
                  className="p-2.5 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-[#383636]"
                >
                  <X className="w-5 h-5 text-slate-400 hover:text-white" />
                </button>
              </div>

              {/* Lightbox Body with Grid of categories */}
              <div className="flex-1 overflow-y-auto p-8" style={{ scrollbarWidth: 'thin' }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <button 
                    onClick={() => {
                      setSelectedCategory('الكل');
                      setShowSidebar(false);
                    }}
                    className={`text-center px-5 py-4 rounded-2xl font-bold transition-all border text-sm flex items-center justify-center gap-2 ${
                      selectedCategory === 'الكل' 
                        ? 'bg-[#f86e7e] text-[#121212] border-[#f86e7e] shadow-xl shadow-[#f86e7e]/10 font-black' 
                        : 'bg-[#121212]/50 text-slate-300 border-[#383636] hover:bg-[#121212] hover:text-white hover:border-slate-500'
                    }`}
                  >
                    <span>الكل</span>
                    {selectedCategory === 'الكل' && <span className="w-2 h-2 rounded-full bg-[#121212]" />}
                  </button>

                  {categories.map(cat => (
                    <div key={cat.id} className="group relative">
                      <button 
                        onClick={() => {
                          setSelectedCategory(cat.name);
                          setShowSidebar(false);
                        }}
                        className={`w-full text-center px-5 py-4 rounded-2xl font-bold transition-all border text-sm flex items-center justify-center gap-2 ${
                          selectedCategory === cat.name 
                            ? 'bg-[#f86e7e] text-[#121212] border-[#f86e7e] shadow-xl shadow-[#f86e7e]/10 font-black' 
                            : 'bg-[#121212]/50 text-slate-300 border-[#383636] hover:bg-[#121212] hover:text-white hover:border-slate-500'
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        {selectedCategory === cat.name && <span className="w-2 h-2 rounded-full bg-[#121212]" />}
                      </button>
                      
                      {isAdmin && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id, cat.name); }}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 rounded-lg z-20 animate-pulse"
                          title="حذف تصنيف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {isAdmin && (
                <div className="p-8 border-t border-[#383636] bg-[#121212]/30">
                  <button 
                    onClick={addCategory}
                    className="w-full flex items-center justify-center gap-2 bg-[#f86e7e]/10 hover:bg-[#f86e7e]/20 text-[#f86e7e] py-4 rounded-2xl font-bold transition-all border border-[#f86e7e]/20"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة تصنيف جديد
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modern Dark Header */}
      <header className="sticky top-0 z-40 bg-[#1e1e1e]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#f86e7e] rounded-xl flex items-center justify-center shadow-md shadow-[#f86e7e]/20">
              <Book className="w-6 h-6 text-[#121212]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">كوم روايات</h1>
              <p className="text-[10px] text-[#f86e7e] font-bold uppercase tracking-widest">الرئيسية</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#121212] rounded-full border border-white/5">
              <img 
                src={user.photoURL || ''} 
                alt={user.displayName || ''} 
                className="w-6 h-6 rounded-full border border-white/10"
                referrerPolicy="no-referrer"
              />
              <span className="text-sm font-bold text-slate-200">{user.displayName}</span>
            </div>
            <button 
              onClick={logout}
              className="p-2.5 text-slate-400 hover:text-[#FF2E63] hover:bg-[#FF2E63]/10 rounded-xl transition-all"
              title="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Novels List View */}
          {view === 'novels' && (
            <motion.div 
              key="novels"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* قسم الإحصائيات وبانر الترحيب المطور */}
              <div className="mb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* بطاقة الترحيب التفاعلية */}
                <div className="sm:col-span-2 lg:col-span-4 bg-gradient-to-r from-[#1e1e1e] to-[#241c1d] p-8 rounded-[2rem] border border-[#383636] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-xl">
                  {/* خلفيات جمالية مرشحة */}
                  <div className="absolute -right-24 -bottom-24 w-72 h-72 rounded-full bg-[#f86e7e]/5 blur-3xl pointer-events-none" />
                  <div className="absolute -left-24 -top-24 w-72 h-72 rounded-full bg-[#f86e7e]/5 blur-3xl pointer-events-none" />
                  
                  <div className="flex items-center gap-5 z-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#f86e7e] to-[#ff8ca3] flex items-center justify-center shadow-lg shadow-[#f86e7e]/20">
                      <LayoutDashboard className="w-8 h-8 text-[#121212]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-extrabold text-white mb-2 flex items-center gap-2">
                        مرحباً بك مجدداً، <span className="text-[#f86e7e]">{user?.displayName?.split(' ')[0]}</span>
                        <span className="text-xl animate-bounce">👋</span>
                      </h2>
                      <p className="text-slate-400 text-sm font-medium">إليك نظرة سريعة على مؤشرات مكتبتك الأدبية وإحصائيات الروايات اليوم.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-[#121212]/50 border border-white/5 py-3 px-5 rounded-2xl md:ml-2 z-10">
                    <Clock className="w-5 h-5 text-[#f86e7e] animate-pulse" />
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">توقيت النظام</div>
                      <div className="text-xs font-extrabold text-slate-200" dir="ltr">
                        {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* كارت 1: إجمالي الروايات */}
                <motion.div 
                  whileHover={{ y: -4, scale: 1.02 }}
                  onClick={() => {
                    setSelectedStatus('الكل');
                    setSelectedCategory('الكل');
                    setSearchTerm('');
                  }}
                  className={`p-6 rounded-[2rem] border cursor-pointer transition-all duration-300 flex items-center justify-between shadow-lg ${
                    selectedStatus === 'الكل' && selectedCategory === 'الكل'
                      ? 'bg-gradient-to-b from-[#1e1e1e] to-[#251e20] border-[#f86e7e]/50 shadow-[#f86e7e]/5' 
                      : 'bg-[#1e1e1e] border-[#383636] hover:border-[#f86e7e]/30'
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-400">إجمالي الروايات</span>
                    <h3 className="text-3xl font-black text-white">{novels.length}</h3>
                    <p className="text-[10px] text-slate-500 font-bold">انقر لعرض جميع الأعمال</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#f86e7e]/10 flex items-center justify-center text-[#f86e7e]">
                    <Book className="w-6 h-6" />
                  </div>
                </motion.div>

                {/* كارت 2: روايات مستمرة */}
                <motion.div 
                  whileHover={{ y: -4, scale: 1.02 }}
                  onClick={() => setSelectedStatus(selectedStatus === 'مستمرة' ? 'الكل' : 'مستمرة')}
                  className={`p-6 rounded-[2rem] border cursor-pointer transition-all duration-300 flex items-center justify-between shadow-lg ${
                    selectedStatus === 'مستمرة'
                      ? 'bg-gradient-to-b from-[#1e1e1e] to-[#24231b] border-amber-500/50 shadow-amber-500/5' 
                      : 'bg-[#1e1e1e] border-[#383636] hover:border-amber-500/30'
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-400">روايات مستمرة</span>
                    <div className="flex items-center gap-2">
                      <h3 className="text-3xl font-black text-white">{novels.filter(n => n.status === 'مستمرة').length}</h3>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold">انقر لتصفية المستمرة فقط</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Clock className="w-6 h-6" />
                  </div>
                </motion.div>

                {/* كارت 3: روايات مكتملة */}
                <motion.div 
                  whileHover={{ y: -4, scale: 1.02 }}
                  onClick={() => setSelectedStatus(selectedStatus === 'مكتملة' ? 'الكل' : 'مكتملة')}
                  className={`p-6 rounded-[2rem] border cursor-pointer transition-all duration-300 flex items-center justify-between shadow-lg ${
                    selectedStatus === 'مكتملة'
                      ? 'bg-gradient-to-b from-[#1e1e1e] to-[#1a241f] border-emerald-500/50 shadow-emerald-500/5' 
                      : 'bg-[#1e1e1e] border-[#383636] hover:border-emerald-500/30'
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-400">روايات مكتملة</span>
                    <div className="flex items-center gap-2">
                      <h3 className="text-3xl font-black text-white">{novels.filter(n => n.status === 'مكتملة').length}</h3>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold">انقر لتصفية المكتملة فقط</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Layers className="w-6 h-6" />
                  </div>
                </motion.div>

                {/* كارت 4: عدد التصنيفات */}
                <motion.div 
                  whileHover={{ y: -4, scale: 1.02 }}
                  onClick={() => setShowSidebar(true)}
                  className="p-6 rounded-[2rem] border border-[#383636] bg-[#1e1e1e] cursor-pointer transition-all duration-300 flex items-center justify-between hover:border-[#f86e7e]/30 shadow-lg"
                >
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-400">تصنيفات متوفرة</span>
                    <h3 className="text-3xl font-black text-white">{categories.length}</h3>
                    <p className="text-[10px] text-slate-500 font-bold">انقر لإدارة وتصفح التصنيفات</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#f86e7e]/10 flex items-center justify-center text-[#f86e7e]">
                    <Compass className="w-6 h-6" />
                  </div>
                </motion.div>
              </div>

              {/* شريط التحكم والتصفية الذكي المستند إلى Lightbox */}
              <div className="mb-10 bg-[#1e1e1e] border border-[#383636] rounded-[2rem] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-4 z-10">
                  <div className="w-12 h-12 rounded-2xl bg-[#f86e7e]/10 flex items-center justify-center text-[#f86e7e]">
                    <SlidersHorizontal className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-400">تصفية حسب التصنيف</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-semibold text-slate-500">التصنيف النشط:</span>
                      <span className="px-3 py-1 text-xs font-extrabold rounded-lg bg-[#f86e7e]/10 text-[#f86e7e] border border-[#f86e7e]/20">
                        {selectedCategory}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 z-10">
                  <button
                    onClick={() => setShowSidebar(true)}
                    className="flex-grow sm:flex-initial flex items-center justify-center gap-2 bg-[#f86e7e] hover:bg-[#e05d6b] text-[#121212] px-6 py-3.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-[#f86e7e]/10 hover:scale-[1.02]"
                  >
                    <Compass className="w-4 h-4" />
                    تصفية بالتصنيفات
                  </button>
                  {selectedCategory !== 'الكل' && (
                    <button
                      onClick={() => setSelectedCategory('الكل')}
                      className="flex items-center justify-center gap-1 bg-[#121212] hover:bg-black/40 border border-[#383636] text-[#f86e7e] hover:text-white px-4 py-3.5 rounded-xl font-bold text-xs transition-all"
                      title="إعادة تعيين التصفية"
                    >
                      <X className="w-4 h-4" />
                      <span>إلغاء التصفية</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                <div>
                  <h2 className="text-3xl font-extrabold text-white mb-2">مكتبة الروايات</h2>
                  <p className="text-slate-400 text-sm font-medium">إدارة وتعديل جميع الروايات الموجودة في مشروعك.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-[300px]">
                    <div className="relative flex-1">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                      <input 
                        type="text"
                        placeholder="ابحث عن رواية، كاتب..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pr-12 pl-4 py-3.5 rounded-2xl border border-[#383636] bg-[#1e1e1e] text-white focus:ring-2 focus:ring-[#f86e7e]/50 outline-none transition-all font-medium"
                      />
                    </div>
                    <button 
                      onClick={() => setShowSidebar(true)}
                      className={`p-3.5 rounded-2xl border border-[#383636] bg-[#1e1e1e] hover:bg-white/5 transition-all relative ${selectedCategory !== 'الكل' ? 'text-[#f86e7e]' : 'text-slate-400'}`}
                      title="تصفية حسب التصنيف"
                    >
                      <Compass className="w-6 h-6" />
                      {selectedCategory !== 'الكل' && (
                        <span className="absolute -top-1 -left-1 w-3 h-3 bg-[#f86e7e] rounded-full border-2 border-[#121212]" />
                      )}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 bg-[#1e1e1e] border border-[#383636] hover:bg-white/5 text-slate-300 px-6 py-3.5 rounded-2xl font-bold transition-all cursor-pointer">
                      <FileText className="w-4 h-4 text-[#f86e7e]" />
                      استيراد
                      <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                    </label>
                    
                    <button 
                      onClick={() => {
                        setEditingNovel({ name: '', description: '', author: user.displayName || '', coverImages: ['', '', '', ''], categories: [] });
                        setView('edit-novel');
                      }}
                      className="flex items-center gap-2 bg-[#f86e7e] hover:bg-[#e05d6b] text-[#121212] px-8 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-[#f86e7e]/20"
                    >
                      <Plus className="w-4 h-4" />
                      رواية جديدة
                    </button>
                  </div>
                </div>
              </div>

              {filteredNovels.length === 0 ? (
                <div className="bg-[#1e1e1e] rounded-[2.5rem] border border-white/5 p-24 text-center">
                  <div className="w-20 h-20 bg-[#121212] rounded-3xl flex items-center justify-center mx-auto mb-8">
                    <Search className="w-10 h-10 text-slate-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">لا توجد نتائج</h3>
                  <p className="text-slate-500">لم نجد أي روايات تطابق بحثك أو المجموعة فارغة.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {filteredNovels.map(novel => (
                    <NovelCard 
                      key={novel.id} 
                      novel={novel}
                      onViewChapters={(n) => {
                        setSelectedNovel(n);
                        setView('chapters');
                      }}
                      onEditNovel={(n) => {
                        const currentCovers = n.coverImages || [];
                        const paddedCovers = [...currentCovers];
                        while (paddedCovers.length < 4) paddedCovers.push('');
                        setEditingNovel({ ...n, coverImages: paddedCovers });
                        setView('edit-novel');
                      }}
                      onDeleteNovel={(id) => deleteNovel(id)}
                    />
                  ))}
                </div>
              )}

              {/* قسم أحدث فصول مضافة في أسفل الرئيسية */}
              {globalLatestChapters.length > 0 && (
                <div className="mt-20 pt-10 border-t border-[#383636] space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black text-white flex items-center gap-3">
                      <span className="w-3.5 h-3.5 rounded-full bg-[#f86e7e] animate-pulse"></span>
                      أحدث الفصول المضافة
                    </h3>
                  </div>
                  
                  <div className="card-group grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {globalLatestChapters.map((chapter, idx) => {
                      const novelCover = chapter.novel?.coverImages?.[0] || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e';
                      const novelName = chapter.novel?.name || 'رواية غير معروفة';
                      return (
                        <div 
                          key={chapter.id || idx} 
                          className="card bg-[#1c1c1e] border border-white/5 rounded-3xl overflow-hidden hover:border-[#f86e7e]/30 hover:scale-[1.02] transition-all duration-300 flex flex-col h-full relative cursor-pointer group shadow-lg" 
                          onClick={() => {
                            if (chapter.novel) {
                              setSelectedNovel(chapter.novel);
                              setPreviewChapter(chapter);
                              setView('chapters');
                            }
                          }}
                        >
                          <div className="relative h-48 overflow-hidden">
                            <img 
                              src={novelCover} 
                              className="card-img-top w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                              alt={novelName}
                              referrerPolicy="no-referrer"
                            />
                            
                            {/* Novel name floating badge */}
                            <div className="absolute top-4 left-4 right-16 z-10">
                              <span className="bg-black/85 backdrop-blur-md text-white text-[10px] font-black py-1.5 px-3 rounded-xl border border-white/10 block truncate shadow-md">
                                {novelName}
                              </span>
                            </div>

                            {/* Badge showing Chapter number with the requested position-absolute style */}
                            <div className="absolute top-4 right-4 z-10">
                              <button type="button" className="btn btn-primary position-relative bg-[#f86e7e] text-[#121212] border-none font-black px-4 py-2 rounded-xl text-xs flex items-center justify-center select-none shadow-lg">
                                {chapter.order}
                                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-[#ef4444] text-white rounded-full text-[10px] w-6 h-6 flex items-center justify-center font-black border-2 border-[#1c1c1e] absolute -top-2.5 -left-2.5">
                                  {chapter.order}
                                </span>
                              </button>
                            </div>
                            
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-40 animate-fade-in" />
                          </div>
                          
                          <div className="card-body p-5 flex-1 flex flex-col justify-between">
                            <div>
                              <h5 className="card-title font-bold text-white mb-2 line-clamp-1 group-hover:text-[#f86e7e] transition-colors">
                                {chapter.title}
                              </h5>
                              <p className="card-text text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4">
                                {chapter.content ? chapter.content.replace(/[#*`]/g, '').substring(0, 100) : 'تصفح محتوى ودراسة الفصل بالكامل...'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="card-footer bg-black/25 p-4 border-t border-white/5 flex items-center justify-between">
                            <small className="text-body-secondary text-[11px] text-slate-500 font-bold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#f86e7e]" />
                              مضاف في {chapter.date}
                            </small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Chapters View */}
          {view === 'chapters' && selectedNovel && (
            <motion.div 
              key="chapters"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="flex items-center gap-6 mb-10">
                <button 
                  onClick={() => setView('novels')}
                  className="w-12 h-12 flex items-center justify-center bg-[#1e1e1e] border border-white/5 rounded-2xl hover:bg-white/5 transition-all shadow-sm"
                >
                  <ArrowLeft className="w-6 h-6 text-slate-400" />
                </button>
                <div>
                  <h2 className="text-2xl font-extrabold text-white">إدارة الفصول</h2>
                  <p className="text-slate-500 text-sm">{selectedNovel.name}</p>
                </div>
              </div>

              {/* قسم أحدث فصول مضافة لهذه الرواية في الأعلى */}
              {latestChapters.length > 0 && (
                <div className="space-y-4 mb-10 pb-8 border-b border-white/5">
                  <h3 className="text-xl font-black text-white flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#f86e7e] animate-pulse"></span>
                    أحدث فصول مضافة للرواية
                  </h3>
                  <div className="card-group grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {latestChapters.map((chapter, idx) => (
                      <div 
                        key={chapter.id || idx} 
                        className="card bg-[#1c1c1e] border border-white/5 rounded-2xl overflow-hidden hover:border-[#f86e7e]/30 hover:scale-[1.02] transition-all duration-300 flex flex-col h-full relative cursor-pointer group shadow-md" 
                        onClick={() => setPreviewChapter(chapter)}
                      >
                        <div className="relative h-32 overflow-hidden">
                          <img 
                            src={selectedNovel.coverImages?.[0] || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e'} 
                            className="card-img-top w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                            alt={selectedNovel.name}
                            referrerPolicy="no-referrer"
                          />
                          
                          {/* Badge showing Chapter number */}
                          <div className="absolute top-2.5 right-2.5 z-10">
                            <button type="button" className="btn btn-primary position-relative bg-[#f86e7e] text-[#121212] border-none font-black px-2.5 py-1 rounded-lg text-[10px] flex items-center justify-center select-none shadow-md">
                              {chapter.order}
                              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-[#ef4444] text-white rounded-full text-[8px] w-5 h-5 flex items-center justify-center font-black border-2 border-[#1c1c1e] absolute -top-2 -left-2">
                                {chapter.order}
                              </span>
                            </button>
                          </div>
                        </div>
                        <div className="card-body p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h5 className="card-title font-bold text-white text-xs mb-1.5 line-clamp-1 group-hover:text-[#f86e7e] transition-colors">
                              {chapter.title}
                            </h5>
                            <p className="card-text text-slate-400 text-[10px] line-clamp-1 leading-relaxed mb-2">
                              {chapter.content ? chapter.content.replace(/[#*`]/g, '').substring(0, 50) : 'عرض الفصل بالكامل...'}
                            </p>
                          </div>
                        </div>
                        <div className="card-footer bg-black/15 p-3 border-t border-white/5 flex items-center justify-between">
                          <small className="text-[9px] text-slate-500 font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#f86e7e]" />
                            {chapter.date}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* كارت الرواية العريض */}
              <div className="card mb-10 bg-[#1c1c1e] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                <div className="flex flex-col md:flex-row">
                  {/* اليمين: صورة الرواية الأولى */}
                  <div className="md:w-1/3 aspect-[3/4] md:aspect-auto md:self-stretch relative overflow-hidden shrink-0">
                    <img 
                      src={selectedNovel.coverImages?.[0] || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e'} 
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
                      alt={selectedNovel.name}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-l from-transparent via-black/30 to-[#1c1c1e] pointer-events-none" />
                  </div>
                  
                  {/* اليسار: تفاصيل الرواية */}
                  <div className="md:w-2/3 p-8 md:p-10 flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* اسم الرواية */}
                      <h4 className="text-3xl font-black text-white leading-tight">
                        {selectedNovel.name}
                      </h4>

                      {/* تصنيفات الرواية */}
                      {selectedNovel.categories && selectedNovel.categories.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {selectedNovel.categories.map((cat, idx) => (
                            <span 
                              key={idx}
                              className="text-xs font-black bg-[#f86e7e]/10 text-[#f86e7e] px-4 py-2 rounded-xl border border-[#f86e7e]/10"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* قصة الرواية */}
                      <div className="pt-4 border-t border-white/5">
                        <span className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">قصة الرواية</span>
                        <p className="text-sm text-slate-300 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                          {selectedNovel.description || 'لا يوجد وصف متاح لهذا العمل.'}
                        </p>
                      </div>
                    </div>

                    {/* التقييم الخاص بالرواية والمؤلف وعدد الفصول */}
                    <div className="grid grid-cols-3 gap-4 bg-black/20 p-5 rounded-2xl border border-white/5 mt-6">
                      <div className="text-center">
                        <span className="block text-[11px] text-slate-500 font-bold mb-1">المؤلف</span>
                        <span className="font-extrabold text-white text-xs md:text-sm truncate block" title={selectedNovel.author}>
                          {selectedNovel.author || 'كاتب غير معروف'}
                        </span>
                      </div>
                      
                      <div className="text-center border-x border-white/5">
                        <span className="block text-[11px] text-slate-500 font-bold mb-1">التقييم</span>
                        <span className="font-extrabold text-yellow-500 text-xs md:text-sm flex items-center justify-center gap-1">
                          <Star className="w-4 h-4 fill-current animate-pulse" />
                          {selectedNovel.rating || '0.0'}
                        </span>
                      </div>

                      <div className="text-center">
                        <span className="block text-[11px] text-slate-500 font-bold mb-1">عدد الفصول</span>
                        <span className="font-extrabold text-[#f86e7e] text-xs md:text-sm bg-[#f86e7e]/5 px-2.5 py-0.5 rounded-lg border border-[#f86e7e]/10 inline-block">
                          {chapters.length} فصول
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* قسم صور وأغلفة الرواية */}
              {selectedNovel.coverImages && selectedNovel.coverImages.filter(img => img && img.trim() !== '').length > 0 && (
                <div className="mb-10 animate-fade-in text-right">
                  <div className="flex items-center gap-2.5 mb-6 border-b border-white/5 pb-2">
                    <span className="w-3 h-3 rounded-full bg-[#f86e7e]"></span>
                    <h3 className="text-xl font-black text-white">صور وأغلفة الرواية</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {selectedNovel.coverImages.filter(img => img && img.trim() !== '').map((img, idx) => (
                      <button 
                        key={idx}
                        onClick={() => {
                          setLightboxImages(selectedNovel.coverImages || []);
                          setLightboxIndex(idx);
                        }}
                        className="group/thumb relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 hover:border-[#f86e7e]/40 hover:shadow-lg transition-all duration-300 hover:scale-[1.03] bg-[#1c1c1e]"
                        title="عرض الغلاف وتكبيره"
                      >
                        <img 
                          src={img} 
                          alt={`Novel Cover ${idx + 1}`} 
                          className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-all duration-300 backdrop-blur-[2px]">
                          <Maximize2 className="w-6 h-6 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* قسم المجلدات */}
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <h3 className="text-xl font-black text-white flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#f86e7e]"></span>
                    مجلدات الرواية وفصولها
                  </h3>
                </div>

                {chapters.length === 0 ? (
                  <div className="bg-[#1c1c1e] rounded-[2.5rem] border border-white/5 p-20 text-center">
                    <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold">لا توجد فصول لهذه الرواية بعد.</p>
                  </div>
                ) : (
                  <>
                    {/* Nav & Tabs for Volumes */}
                    {volumes.length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-8 border-b border-white/5 pb-4 overflow-x-auto custom-scrollbar" id="volumes-tabs">
                        {volumes.map(vol => {
                          const isActive = selectedVolumeId === vol.id;
                          const volChapters = groupedChapters[vol.id] || [];
                          return (
                            <button
                              type="button"
                              key={vol.id}
                              onClick={() => setSelectedVolumeId(vol.id)}
                              className={`px-6 py-3.5 rounded-2xl text-xs font-black transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap active:scale-95 border ${
                                isActive 
                                  ? 'bg-[#f86e7e] text-[#121212] border-transparent shadow-lg shadow-[#f86e7e]/10' 
                                  : 'bg-[#1c1c1e] text-slate-400 border-white/5 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <Folder className={`w-4 h-4 ${isActive ? 'fill-current' : ''}`} />
                              <span>{vol.name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-lg font-black ${
                                isActive ? 'bg-black/15 text-[#121212]' : 'bg-white/5 text-slate-500'
                              }`}>
                                {volChapters.length}
                              </span>
                            </button>
                          );
                        })}
                        
                        {/* If there are virtual volumes, render them too as tabs */}
                        {virtualVolumes.map(virtualVolId => {
                          const isActive = selectedVolumeId === virtualVolId;
                          const volChapters = groupedChapters[virtualVolId] || [];
                          return (
                            <button
                              type="button"
                              key={virtualVolId}
                              onClick={() => setSelectedVolumeId(virtualVolId)}
                              className={`px-6 py-3.5 rounded-2xl text-xs font-black transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap active:scale-95 border ${
                                isActive 
                                  ? 'bg-[#f86e7e] text-[#121212] border-transparent shadow-lg shadow-[#f86e7e]/10' 
                                  : 'bg-[#1c1c1e] text-slate-400 border-white/5 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <Folder className={`w-4 h-4 ${isActive ? 'fill-current' : ''}`} />
                              <span>{virtualVolId}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-lg font-black ${
                                isActive ? 'bg-black/15 text-[#121212]' : 'bg-white/5 text-slate-500'
                              }`}>
                                {volChapters.length}
                              </span>
                            </button>
                          );
                        })}

                        {/* If there are un-volumed chapters, render an additional tab for them */}
                        {groupedChapters['none'] && groupedChapters['none'].length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedVolumeId('none')}
                            className={`px-6 py-3.5 rounded-2xl text-xs font-black transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap active:scale-95 border ${
                              selectedVolumeId === 'none' 
                                ? 'bg-[#f86e7e] text-[#121212] border-transparent shadow-lg shadow-[#f86e7e]/10' 
                                : 'bg-[#1c1c1e] text-slate-400 border-white/5 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                            <span>فصول غير مجلدة</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-black ${
                              selectedVolumeId === 'none' ? 'bg-black/15 text-[#121212]' : 'bg-white/5 text-slate-500'
                            }`}>
                              {groupedChapters['none'].length}
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Fallback layout for totally unvolumed novels with zero volumes defined */}
                    {volumes.length === 0 && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-4 pr-12 relative">
                          <div className="absolute top-0 right-6 bottom-0 w-0.5 bg-white/5" />
                          {chapters.map((chapter, index) => (
                            <ChapterItem 
                              key={chapter.id} 
                              chapter={chapter} 
                              index={index} 
                              onPreview={setPreviewChapter}
                              onEdit={(c) => { setEditingChapter(c); setView('edit-chapter'); }}
                              onDelete={deleteChapter}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Render current selected volume chapters */}
                    {volumes.length > 0 && selectedVolumeId && selectedVolumeId !== 'none' && (
                      (() => {
                        const vol = volumes.find(v => v.id === selectedVolumeId);
                        const isVirtual = !vol && virtualVolumes.includes(selectedVolumeId);
                        const volName = vol ? vol.name : selectedVolumeId;
                        const volChapters = groupedChapters[selectedVolumeId] || [];
                        
                        return (
                          <div className="space-y-6 animate-fade-in text-right">
                            <div className="flex items-center gap-4 group">
                              <div className="flex items-center gap-3 bg-[#f86e7e] text-[#121212] px-5 py-2.5 rounded-2xl shadow-lg shadow-[#f86e7e]/20 transition-all hover:scale-[1.02]">
                                <Folder className="w-5 h-5 fill-current" />
                                <h3 className="text-lg font-black tracking-wide">
                                  {volName}
                                </h3>
                                <span className="text-[10px] bg-[#121212]/20 text-[#121212] px-2 py-0.5 rounded-md font-bold">
                                  {volChapters.length} فصول
                                </span>
                              </div>
                              <div className="h-px bg-white/5 flex-1" />
                              {isAdmin && vol && (
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                  <button 
                                    onClick={() => editVolume(vol.id, vol.name)}
                                    className="p-2 text-slate-500 hover:text-[#f86e7e] hover:bg-[#f86e7e]/10 rounded-xl transition-all"
                                    title="تعديل اسم المجلد"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => deleteVolume(vol.id, vol.name)}
                                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                    title="حذف المجلد"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            {volChapters.length === 0 ? (
                              <div className="py-6 px-10 border border-[#383636] border-dashed rounded-[2rem] bg-[#1a1a1a]/40 text-center flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-white/5 transition-all">
                                <FolderOpen className="w-6 h-6 text-slate-600 opacity-60" />
                                <p className="text-xs font-bold text-slate-500">لا توجد فصول في هذا المجلد حالياً.</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-4 pr-12 relative animate-fade-in">
                                <div className="absolute top-0 right-6 bottom-0 w-0.5 bg-white/5" />
                                {volChapters.map((chapter, index) => (
                                  <ChapterItem 
                                    key={chapter.id} 
                                    chapter={chapter} 
                                    index={index} 
                                    onPreview={setPreviewChapter}
                                    onEdit={(c) => { setEditingChapter(c); setView('edit-chapter'); }}
                                    onDelete={deleteChapter}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}

                    {/* Render un-volumed chapters if active */}
                    {volumes.length > 0 && selectedVolumeId === 'none' && groupedChapters['none'] && groupedChapters['none'].length > 0 && (
                      <div className="space-y-6 animate-fade-in text-right">
                        <div className="flex items-center gap-4">
                          <h3 className="text-lg font-bold text-slate-500 bg-white/5 px-4 py-1.5 rounded-xl border border-white/5">
                            فصول غير مجلدة
                          </h3>
                          <div className="h-px bg-white/5 flex-1" />
                        </div>
                        <div className="grid grid-cols-1 gap-4 pr-12 relative animate-fade-in">
                          <div className="absolute top-0 right-6 bottom-0 w-0.5 bg-white/5" />
                          {groupedChapters['none'].map((chapter, index) => (
                            <ChapterItem 
                              key={chapter.id} 
                              chapter={chapter} 
                              index={index} 
                              onPreview={setPreviewChapter}
                              onEdit={(c) => { setEditingChapter(c); setView('edit-chapter'); }}
                              onDelete={deleteChapter}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* أزرار الإدارة والتحكم بالرواية في النهاية */}
              {isAdmin && (
                <div className="mt-16 pt-10 border-t border-[#383636] space-y-6">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f86e7e] animate-pulse"></span>
                    <h4 className="text-base font-black text-white">إجراءات المدير والتحكم</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* تعديل الرواية */}
                    <button 
                      type="button"
                      onClick={handleEditSelectedNovel}
                      className="bg-[#f86e7e]/5 hover:bg-[#f86e7e] text-[#f86e7e] hover:text-[#121212] border border-[#f86e7e]/30 hover:border-transparent py-4 rounded-2xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2.5 active:scale-95 shadow-lg shadow-[#f86e7e]/5"
                      title="تعديل تفاصيل الرواية"
                    >
                      <Edit className="w-5 h-5" />
                      تعديل الرواية
                    </button>

                    {/* حذف الرواية */}
                    <button 
                      type="button"
                      onClick={handleDeleteSelectedNovel}
                      className="bg-red-500/5 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-transparent py-4 rounded-2xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2.5 active:scale-95 shadow-lg shadow-red-500/5"
                      title="حذف الرواية نهائياً"
                    >
                      <Trash2 className="w-5 h-5" />
                      حذف الرواية
                    </button>

                    {/* إضافة فصل جديد */}
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingChapter({ novelId: selectedNovel.id, title: '', content: '', order: chapters.length + 1, date: new Date().toLocaleDateString('ar-EG') });
                        setView('edit-chapter');
                      }}
                      className="bg-emerald-500/5 hover:bg-emerald-500 text-emerald-400 hover:text-[#121212] border border-emerald-500/20 hover:border-transparent py-4 rounded-2xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2.5 active:scale-95 shadow-lg shadow-emerald-500/5"
                      title="إضافة فصل جديد"
                    >
                      <Plus className="w-5 h-5" />
                      إضافة فصل جديد
                    </button>

                    {/* إضافة مجلد جديد */}
                    <button 
                      type="button"
                      onClick={addVolume}
                      className="bg-sky-500/5 hover:bg-sky-500 text-sky-400 hover:text-[#121212] border border-sky-500/20 hover:border-transparent py-4 rounded-2xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2.5 active:scale-95 shadow-lg shadow-sky-500/5"
                      title="إضافة مجلد جديد"
                    >
                      <FolderPlus className="w-5 h-5" />
                      إضافة مجلد جديد
                    </button>
                  </div>
                </div>
              )}

              {/* Floating scroll buttons connected together */}
              <div className="fixed bottom-8 left-8 z-[100] flex flex-col bg-[#1c1c1e]/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-1 gap-1">
                <button 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  type="button"
                  className="w-12 h-12 flex items-center justify-center rounded-xl bg-transparent text-[#f86e7e] hover:bg-[#f86e7e]/10 active:scale-95 transition-all cursor-pointer"
                  title="الانتقال إلى أعلى الصفحة"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
                <div className="h-px bg-white/10 mx-2" />
                <button 
                  type="button"
                  onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
                  className="w-12 h-12 flex items-center justify-center rounded-xl bg-transparent text-[#f86e7e] hover:bg-[#f86e7e]/10 active:scale-95 transition-all cursor-pointer"
                  title="الانتقال إلى أسفل الصفحة"
                >
                  <ArrowDown className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Edit Novel View */}
          {view === 'edit-novel' && editingNovel && (
            <motion.div 
              key="edit-novel"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex items-center gap-6 mb-10">
                <button 
                  onClick={() => setView('novels')}
                  className="w-12 h-12 flex items-center justify-center bg-[#1e1e1e] border border-white/5 rounded-2xl hover:bg-white/5 transition-all shadow-sm"
                >
                  <ArrowLeft className="w-6 h-6 text-slate-400" />
                </button>
                <h2 className="text-2xl font-extrabold text-white">{editingNovel.id ? 'تعديل الرواية' : 'إضافة رواية جديدة'}</h2>
              </div>

              <form onSubmit={saveNovel} className="bg-[#1e1e1e] p-10 rounded-[2.5rem] border border-white/5 shadow-xl space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">اسم الرواية</label>
                      <input 
                        type="text"
                        required
                        value={editingNovel.name}
                        onChange={e => setEditingNovel({...editingNovel, name: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#f86e7e]/50 outline-none transition-all"
                        placeholder="أدخل اسم الرواية..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">اسم الكاتب</label>
                      <input 
                        type="text"
                        required
                        value={editingNovel.author}
                        onChange={e => setEditingNovel({...editingNovel, author: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#f86e7e]/50 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">روابط صور الغلاف (حتى 4 صور)</label>
                      <div className="grid grid-cols-1 gap-3">
                        {[0, 1, 2, 3].map((idx) => (
                          <input 
                            key={idx}
                            type="url"
                            value={editingNovel.coverImages?.[idx] || ''}
                            onChange={e => {
                              const newCovers = [...(editingNovel.coverImages || ['', '', '', ''])];
                              newCovers[idx] = e.target.value;
                              setEditingNovel({...editingNovel, coverImages: newCovers});
                            }}
                            className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#f86e7e]/50 outline-none transition-all text-sm"
                            placeholder={`رابط الصورة ${idx + 1}...`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">الحالة</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#f86e7e]/50 outline-none transition-all text-right font-medium text-sm"
                          >
                            <span>{editingNovel?.status || 'مستمرة'}</span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                          
                          <AnimatePresence>
                            {statusDropdownOpen && editingNovel && (
                              <>
                                <div className="fixed inset-0 z-[60]" onClick={() => setStatusDropdownOpen(false)} />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                  transition={{ duration: 0.15, ease: 'easeOut' }}
                                  className="absolute z-[70] w-full mt-2 rounded-2xl border border-white/5 bg-[#1a1a1c] p-1.5 shadow-2xl backdrop-blur-md"
                                >
                                  {['مستمرة', 'متوقفة', 'مكتملة'].map((option) => (
                                    <button
                                      key={option}
                                      type="button"
                                      onClick={() => {
                                        setEditingNovel({...editingNovel, status: option});
                                        setStatusDropdownOpen(false);
                                      }}
                                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all text-right ${
                                        (editingNovel.status || 'مستمرة') === option
                                          ? 'bg-[#f86e7e]/15 text-[#f86e7e] font-bold'
                                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                      }`}
                                    >
                                      <span>{option}</span>
                                      {(editingNovel.status || 'مستمرة') === option && (
                                        <Check className="w-4 h-4 text-[#f86e7e]" />
                                      )}
                                    </button>
                                  ))}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">التقييم</label>
                        <input 
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          value={editingNovel.rating || 0}
                          onChange={e => setEditingNovel({...editingNovel, rating: parseFloat(e.target.value)})}
                          className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#f86e7e]/50 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">التصنيفات</label>
                      <div className="flex flex-wrap gap-2 p-4 rounded-2xl border border-white/5 bg-[#121212]">
                        {categories.map(cat => {
                          const isSelected = editingNovel.categories?.includes(cat.name);
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                const currentCats = editingNovel.categories || [];
                                const newCats = isSelected 
                                  ? currentCats.filter(c => c !== cat.name)
                                  : [...currentCats, cat.name];
                                setEditingNovel({...editingNovel, categories: newCats});
                              }}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                isSelected 
                                  ? 'bg-[#f86e7e] text-[#121212] border-[#f86e7e]' 
                                  : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                              }`}
                            >
                              {cat.name}
                            </button>
                          );
                        })}
                        {categories.length === 0 && (
                          <p className="text-xs text-slate-600 italic">جاري تحميل التصنيفات...</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">وصف الرواية</label>
                      <textarea 
                        required
                        rows={12}
                        value={editingNovel.description}
                        onChange={e => setEditingNovel({...editingNovel, description: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#f86e7e]/50 outline-none transition-all leading-relaxed resize-none font-sans"
                        placeholder="اكتب ملخصاً للرواية..."
                      />
                    </div>
                    
                    <div className="p-8 bg-[#121212] rounded-[2rem] border border-white/5">
                      <div className="flex items-center gap-2 text-slate-500 mb-6">
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-xs font-bold font-sans">معاينة الرواية</span>
                      </div>
                      
                      <div className="aspect-[3/4] bg-[#1e1e1e] rounded-2xl border border-white/5 overflow-hidden mb-6">
                        <CoverSlider images={editingNovel.coverImages || []} />
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-bold text-lg text-white line-clamp-1 font-sans">{editingNovel.name || 'اسم الرواية'}</h3>
                        
                        <div className="flex items-center gap-2 text-yellow-500 bg-[#121212]/30 px-3 py-1.5 rounded-xl border border-white/5 w-fit">
                          <Star className="w-4 h-4 fill-current text-amber-500 font-sans" />
                          <span className="text-sm font-black font-sans text-slate-200">{editingNovel.rating || '0.0'}</span>
                          <span className="text-slate-500 text-xs font-normal">/ 5.0</span>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 font-sans">معاينة الوصف</h4>
                          <p className="text-xs text-slate-400 leading-relaxed line-clamp-4 font-sans">
                            {editingNovel.description || 'لا يوجد وصف متاح حالياً...'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-3 bg-[#f86e7e] hover:bg-[#e05d6b] text-[#121212] font-black py-5 rounded-2xl transition-all shadow-xl shadow-[#f86e7e]/20 disabled:opacity-50 text-sm font-sans"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    حفظ الرواية
                  </button>
                  <button 
                    type="button"
                    onClick={() => setView('novels')}
                    className="px-10 py-5 font-bold text-slate-500 hover:bg-white/5 rounded-2xl transition-all font-sans text-sm"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Edit Chapter View */}
          {view === 'edit-chapter' && editingChapter && (
            <motion.div 
              key="edit-chapter"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-7xl mx-auto px-4 sm:px-6 relative"
            >
              {/* Back & Title Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-gradient-to-l from-[#1e1e1e] to-transparent p-6 rounded-3xl border-r-4 border-[#f86e7e]">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setView('chapters')}
                    className="w-12 h-12 flex items-center justify-center bg-[#1e1e1e] border border-white/5 rounded-2xl hover:bg-white/10 hover:border-[#f86e7e]/20 text-[#f86e7e] transition-all duration-300 shadow-md active:scale-95"
                    title="العودة للفصول"
                  >
                    <ArrowLeft className="w-6 h-6 rotate-180" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-black text-white">{editingChapter.id ? 'محرر ومصمم الفصول الاحترافي' : 'كتابة وصياغة فصل جديد'}</h2>
                    <p className="text-slate-400 text-xs mt-1 font-sans">تعديل وصياغة فصول رواية <span className="text-[#f86e7e] font-bold">{selectedNovel?.name}</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setDistractionFree(true)}
                    className="flex items-center gap-2 bg-[#f86e7e]/10 hover:bg-[#f86e7e]/20 text-[#f86e7e] px-4 py-3 rounded-xl border border-[#f86e7e]/20 text-xs font-black transition-all active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 animate-pulse animate-spin-slow text-[#f86e7e]" />
                    وضع التركيز (خالي من المشتتات)
                  </button>
                </div>
              </div>

              {/* Distraction-Free Fullscreen Mode Overlay */}
              {distractionFree && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="fixed inset-0 z-[110] bg-[#121212] flex flex-col p-4 sm:p-8"
                >
                  <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col gap-6">
                    {/* Header bar */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div>
                        <h3 className="text-lg font-black text-white mb-0.5">{editingChapter.title || 'فصل بدون عنوان'}</h3>
                        <p className="text-[10px] text-slate-500 font-bold font-sans">وضع التركيز الاحترافي للكتابة المريحة</p>
                      </div>
                      
                      <div className="flex items-center gap-4 font-sans">
                        {/* Font size adjust */}
                        <div className="flex items-center gap-1.5 bg-[#1a1a1b] p-1 rounded-lg border border-white/5">
                          <button 
                            type="button" 
                            onClick={() => setEditorFontSize(Math.max(14, editorFontSize - 1))}
                            className="w-8 h-8 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-slate-400 text-sm font-black transition-all"
                            title="تصغير الخط"
                          >
                            -
                          </button>
                          <span className="text-xs font-black text-slate-300 px-1 font-mono">{editorFontSize}px</span>
                          <button 
                            type="button" 
                            onClick={() => setEditorFontSize(Math.min(28, editorFontSize + 1))}
                            className="w-8 h-8 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-slate-400 text-sm font-black transition-all"
                            title="تكبير الخط"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setDistractionFree(false)}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 text-xs font-bold rounded-xl transition-all"
                        >
                          خروج من التركيز
                        </button>
                      </div>
                    </div>

                    {/* Stats Widget */}
                    <div className="flex items-center gap-4 text-xs font-sans text-slate-400">
                      <span>الكلمات: <strong className="text-[#f86e7e]">{(editingChapter.content || '').trim().split(/\s+/).filter(Boolean).length}</strong></span>
                      <span className="text-slate-700">|</span>
                      <span>الحروف: <strong className="text-white font-mono">{(editingChapter.content || '').length}</strong></span>
                      <span className="text-slate-700">|</span>
                      <span>وقت القراءة المقدر: <strong className="text-[#f86e7e]">{Math.max(1, Math.ceil(((editingChapter.content || '').trim().split(/\s+/).filter(Boolean).length) / 200))} دقيقة</strong></span>
                    </div>

                    {/* Editor Textarea in Screen */}
                    <div className="flex-1 flex flex-col">
                      <textarea
                        required
                        value={editingChapter.content}
                        onChange={e => setEditingChapter({...editingChapter, content: e.target.value})}
                        style={{ fontSize: `${editorFontSize}px` }}
                        className="w-full flex-1 p-6 sm:p-10 rounded-[2rem] border border-white/5 bg-[#161617] text-white focus:ring-2 focus:ring-[#f86e7e]/30 outline-none transition-all leading-relaxed resize-none custom-scrollbar font-sans font-normal"
                        placeholder="ابدأ في صياغة كلمات هذا الفصل بنقاء تام..."
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Side Column: Novel Info & Chapter Metadata Summary */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-[#1e1e1e] p-6 rounded-[2.5rem] border border-white/5 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-l from-[#f86e7e] to-[#ef4444]" />
                    <div className="aspect-[3/4] mb-6 rounded-2xl overflow-hidden shadow-lg border border-white/10 relative">
                      <CoverSlider images={selectedNovel?.coverImages || []} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute bottom-4 right-4 text-xs font-bold bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl text-slate-300 border border-white/5">
                        {selectedNovel?.author || 'الكاتب غير معروف'}
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="font-extrabold text-lg text-white line-clamp-2 leading-snug">{selectedNovel?.name}</h3>
                      <div className="flex items-center gap-2 text-yellow-500 bg-black/20 px-3.5 py-1.5 rounded-xl border border-white/5 w-fit">
                        <Star className="w-4 h-4 fill-current text-amber-400" />
                        <span className="text-sm font-black text-slate-200">{selectedNovel?.rating || '0.0'}</span>
                        <span className="text-slate-500 text-xs font-normal">/ 5.0</span>
                      </div>
                      
                      <div className="pt-4 border-t border-white/5">
                        <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">قصة العمل</span>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-6">
                          {selectedNovel?.description || 'لا يوجد وصف حالياً لهذه الرواية.'}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-white/5 space-y-2.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-bold">الفصل المحدد للحافة</span>
                          <span className="text-emerald-400 font-black">{editingChapter.id ? 'تعديل حالي' : 'فصل جديد بالكامل'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-bold">رقم الترتيب</span>
                          <span className="text-white font-black">{editingChapter.order || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Column: Advanced Chapter Form */}
                <div className="lg:col-span-3">
                  <form 
                    onSubmit={saveChapter} 
                    className="bg-[#1e1e1e] p-6 sm:p-10 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8 relative"
                  >
                    {/* Form Group: Row of Meta Options */}
                    <div className="bg-[#151516] p-6 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-400">عنوان وثيقة الفصل</label>
                        <div className="relative">
                          <input 
                            type="text"
                            required
                            value={editingChapter.title}
                            onChange={e => setEditingChapter({...editingChapter, title: e.target.value})}
                            className="w-full px-5 py-4 rounded-xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#f86e7e]/50 outline-none transition-all placeholder-slate-600 font-semibold text-sm"
                            placeholder="مثال: الفصل الأول: البداية الجديدة..."
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-400 flex items-center justify-between">
                          المجلد التابع
                          <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); addVolume(); }}
                            className="bg-[#f86e7e]/10 text-[#f86e7e] hover:bg-[#f86e7e] hover:text-[#121212] p-1 rounded-lg transition-all duration-300"
                            title="إضافة مجلد جديد"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setVolumeDropdownOpen(!volumeDropdownOpen)}
                            className="w-full flex items-center justify-between px-5 py-4 rounded-xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#f86e7e]/50 outline-none transition-all text-right font-medium text-xs duration-300"
                          >
                            <span className="truncate">
                              {editingChapter?.volumeId 
                                ? (volumes.find(v => v.id === editingChapter.volumeId)?.name || 'مجلد فرعي غير معروف') 
                                : 'بدون مجلد فرعي'}
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 shrink-0 ${volumeDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                          
                          <AnimatePresence>
                            {volumeDropdownOpen && editingChapter && (
                              <>
                                <div className="fixed inset-0 z-[60]" onClick={() => setVolumeDropdownOpen(false)} />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                  transition={{ duration: 0.15, ease: 'easeOut' }}
                                  className="absolute z-[70] w-full mt-2 rounded-xl border border-white/5 bg-[#1a1a1c] p-1.5 shadow-2xl backdrop-blur-md max-h-60 overflow-y-auto custom-scrollbar"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingChapter({...editingChapter, volumeId: ''});
                                      setVolumeDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs transition-all text-right ${
                                      !editingChapter.volumeId
                                        ? 'bg-[#f86e7e]/15 text-[#f86e7e] font-bold'
                                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                    }`}
                                  >
                                    <span>بدون مجلد فرعي</span>
                                    {!editingChapter.volumeId && (
                                      <Check className="w-3.5 h-3.5 text-[#f86e7e]" />
                                    )}
                                  </button>
                                  
                                  {volumes.map(v => (
                                    <button
                                      key={v.id}
                                      type="button"
                                      onClick={() => {
                                        setEditingChapter({...editingChapter, volumeId: v.id});
                                        setVolumeDropdownOpen(false);
                                      }}
                                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs transition-all text-right ${
                                        editingChapter.volumeId === v.id
                                          ? 'bg-[#f86e7e]/15 text-[#f86e7e] font-bold'
                                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                      }`}
                                    >
                                      <span className="truncate">{v.name}</span>
                                      {editingChapter.volumeId === v.id && (
                                        <Check className="w-3.5 h-3.5 text-[#f86e7e]" />
                                      )}
                                    </button>
                                  ))}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 md:col-span-1">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-400">ترتيب رقمي</label>
                          <input 
                            type="number"
                            required
                            value={editingChapter.order}
                            onChange={e => setEditingChapter({...editingChapter, order: parseInt(e.target.value) || 0})}
                            className="w-full px-4 py-4 rounded-xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#f86e7e]/50 outline-none transition-all text-center font-bold text-sm"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-400">تاريخ النشر</label>
                          <input 
                            type="text"
                            required
                            value={editingChapter.date || ''}
                            onChange={e => setEditingChapter({...editingChapter, date: e.target.value})}
                            className="w-full px-3 py-4 rounded-xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#f86e7e]/50 outline-none transition-all text-center font-bold text-xs"
                            placeholder="الأسبوع الحالي"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Integrated Rich Editor tab control & preview system */}
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                        {/* Tab buttons */}
                        <div className="flex bg-[#121212] p-1 rounded-2xl border border-white/5 self-start">
                          <button
                            type="button"
                            onClick={() => setEditorTab('write')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-2 ${
                              editorTab === 'write' 
                                ? 'bg-[#f86e7e] text-[#121212] shadow-lg shadow-[#f86e7e]/10' 
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Edit className="w-3.5 h-3.5" />
                            كتابة وتنسيق الكلمات
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditorTab('preview')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-2 ${
                              editorTab === 'preview' 
                                ? 'bg-[#f86e7e] text-[#121212] shadow-lg shadow-[#f86e7e]/10' 
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            معاينة الفصل الحية
                          </button>
                        </div>

                        {/* Editor Shortcuts & counters */}
                        {editorTab === 'write' ? (
                          <div className="flex flex-wrap items-center gap-2 self-end">
                            {/* Formatting helpers wrapper */}
                            <div className="flex items-center gap-1.5 bg-black/25 p-1 rounded-xl border border-white/5">
                              <button
                                type="button"
                                onClick={() => {
                                  // insert Bold **
                                  const textarea = textareaRef.current;
                                  if (textarea) {
                                    const start = textarea.selectionStart;
                                    const end = textarea.selectionEnd;
                                    const text = editingChapter.content || '';
                                    const sel = text.substring(start, end);
                                    const replacement = `**${sel || 'نص عريض'}**`;
                                    setEditingChapter({...editingChapter, content: text.substring(0, start) + replacement + text.substring(end)});
                                    setTimeout(() => textarea.focus(), 50);
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                                title="تنسيق عريض"
                              >
                                <b>B</b>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => {
                                  // insert Italic *
                                  const textarea = textareaRef.current;
                                  if (textarea) {
                                    const start = textarea.selectionStart;
                                    const end = textarea.selectionEnd;
                                    const text = editingChapter.content || '';
                                    const sel = text.substring(start, end);
                                    const replacement = `*${sel || 'نص مائل'}*`;
                                    setEditingChapter({...editingChapter, content: text.substring(0, start) + replacement + text.substring(end)});
                                    setTimeout(() => textarea.focus(), 50);
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold italic text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                                title="تنسيق مائل"
                              >
                                <i>I</i>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  // insert Blockquote
                                  const textarea = textareaRef.current;
                                  if (textarea) {
                                    const start = textarea.selectionStart;
                                    const text = editingChapter.content || '';
                                    const replacement = `\n> `;
                                    setEditingChapter({...editingChapter, content: text.substring(0, start) + replacement + text.substring(start)});
                                    setTimeout(() => textarea.focus(), 50);
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                                title="إضافة اقتباس"
                              >
                                &ldquo;
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  // insert H3
                                  const textarea = textareaRef.current;
                                  if (textarea) {
                                    const start = textarea.selectionStart;
                                    const text = editingChapter.content || '';
                                    const replacement = `\n### `;
                                    setEditingChapter({...editingChapter, content: text.substring(0, start) + replacement + text.substring(start)});
                                    setTimeout(() => textarea.focus(), 50);
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                                title="إضافة عنوان"
                              >
                                H
                              </button>
                            </div>

                            <button 
                              type="button"
                              onClick={addImageToContent}
                              className="flex items-center gap-1.5 bg-[#f86e7e]/5 hover:bg-[#f86e7e]/15 text-[#f86e7e] px-3.5 py-2 rounded-xl text-xs font-black transition-all border border-[#f86e7e]/15 shadow-sm"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              إدراج صورة
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-500 font-extrabold bg-[#121212] px-3.5 py-2 rounded-xl border border-white/5">يدعم كامل تنسيقات Markdown المعيارية</span>
                          </div>
                        )}
                      </div>

                      {/* Content panel switch */}
                      {editorTab === 'write' ? (
                        <div className="relative">
                          <textarea 
                            ref={textareaRef}
                            required
                            rows={20}
                            value={editingChapter.content}
                            onChange={e => setEditingChapter({...editingChapter, content: e.target.value})}
                            className="w-full px-6 py-6 sm:px-8 sm:py-8 rounded-[2rem] border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#f86e7e]/40 outline-none transition-all font-normal text-base leading-relaxed resize-none h-[480px] custom-scrollbar focus:border-[#f86e7e]/30"
                            placeholder="ابدأ بصياغة كلمات أحداث ومجريات هذا الفصل الشيق للرواية هنا..."
                          />
                          
                          {/* Live counters overlay at bottom */}
                          <div className="absolute bottom-4 left-6 flex items-center gap-3 pointer-events-none select-none bg-black/75 px-3.5 py-1.5 rounded-xl border border-white/5 backdrop-blur-md">
                            <span className="text-[10px] font-bold text-slate-300">
                              الكلمات: <b className="text-[#f86e7e]">{(editingChapter.content || '').trim().split(/\s+/).filter(Boolean).length}</b>
                            </span>
                            <span className="w-px h-3.5 bg-white/10" />
                            <span className="text-[10px] font-bold text-slate-300">
                              الحروف: <b className="text-white">{(editingChapter.content || '').length}</b>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#121212] rounded-[2rem] border border-[#f86e7e]/10 p-6 sm:p-10 h-[480px] overflow-y-auto custom-scrollbar shadow-inner text-right relative">
                          <div className="prose prose-invert max-w-none space-y-6 leading-relaxed custom-markdown select-text">
                            {editingChapter.content ? (
                              <Markdown remarkPlugins={[remarkGfm]}>
                                {editingChapter.content}
                              </Markdown>
                            ) : (
                              <div className="flex flex-col items-center justify-center text-center h-full text-slate-500 gap-3 py-10">
                                <FileText className="w-10 h-10 text-slate-700 animate-pulse" />
                                <p className="font-bold text-slate-600 text-sm">لا يتوفر أي محتوى لمعاينته، ابدأ بالكتابة في التبويب الآخر أولاً لتظهر النتيجة الحية هنا.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Submit Actions */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/5">
                      <button 
                        type="submit"
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-3 bg-[#f86e7e] hover:bg-[#e25667] active:scale-98 text-[#121212] font-extrabold py-5 rounded-2xl transition-all shadow-xl shadow-[#f86e7e]/10 disabled:opacity-50 text-sm"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {editingChapter.id ? 'حفظ وتحديث بيانات الفصل' : 'نشر وتثبيت الفصل الجديد'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setView('chapters')}
                        className="px-10 py-5 font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all duration-300 text-sm"
                      >
                        إلغاء العملية والعودة
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modern Dark Footer */}
      <footer className="py-12 border-t border-white/5 mt-20 bg-[#1e1e1e]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#f86e7e] rounded-lg flex items-center justify-center">
              <Book className="w-4 h-4 text-[#121212]" />
            </div>
            <span className="font-extrabold text-white tracking-tight">لوحة الروايات</span>
          </div>
          <p className="text-slate-500 text-xs">© 2026 جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-6 text-xs font-bold text-slate-400">
            <a href="#" className="hover:text-[#f86e7e] transition-colors">الدعم الفني</a>
            <a href="#" className="hover:text-[#f86e7e] transition-colors">سياسة الخصوصية</a>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {previewChapter && (
          <ChapterPreviewModal 
            chapter={previewChapter} 
            onClose={() => setPreviewChapter(null)} 
          />
        )}
        {lightboxIndex !== null && (
          <LightboxSlider 
            images={lightboxImages} 
            initialIndex={lightboxIndex} 
            onClose={() => setLightboxIndex(null)} 
          />
        )}
        {showAddVolumeModal && (
          <AddVolumeModal 
            isOpen={showAddVolumeModal} 
            onClose={() => setShowAddVolumeModal(false)}
            chapters={chapters}
            volumes={volumes}
            onAddVolume={handleAddVolume}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
