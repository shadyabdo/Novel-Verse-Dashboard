/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  getDocFromServer
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
  Loader2,
  Image as ImageIcon,
  Search,
  SlidersHorizontal,
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
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
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
                className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentIndex ? 'bg-[#3db5ad] w-4' : 'bg-white/30'}`}
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
            <div className="markdown-body text-slate-300 leading-[2] text-lg md:text-xl font-serif">
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
    className="bg-[#1e1e1e] p-5 rounded-2xl border border-white/5 flex items-center justify-between hover:border-[#3db5ad]/30 transition-all group shadow-sm"
  >
    <div className="flex items-center gap-5 cursor-pointer flex-1" onClick={() => onPreview(chapter)}>
      <div className="w-12 h-12 bg-[#121212] rounded-xl flex items-center justify-center text-slate-500 font-bold group-hover:bg-[#3db5ad]/10 group-hover:text-[#3db5ad] transition-colors">
        {chapter.order}
      </div>
      <div>
        <h4 className="font-bold text-white mb-1 group-hover:text-[#3db5ad] transition-colors">{chapter.title}</h4>
        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {chapter.date}</span>
          <span className="w-1 h-1 bg-slate-700 rounded-full" />
          <span>{chapter.content.length} حرف</span>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button 
        onClick={() => onPreview(chapter)}
        className="p-2.5 text-slate-500 hover:text-[#3db5ad] hover:bg-[#3db5ad]/10 rounded-xl transition-all"
        title="معاينة"
      >
        <Eye className="w-5 h-5" />
      </button>
      <button 
        onClick={() => onEdit(chapter)}
        className="p-2.5 text-slate-500 hover:text-[#3db5ad] hover:bg-[#3db5ad]/10 rounded-xl transition-all"
      >
        <Edit className="w-5 h-5" />
      </button>
      <button 
        onClick={() => onDelete(chapter.id)}
        className="p-2.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
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
      className="group bg-[#1e1e1e] rounded-[2rem] border border-white/5 overflow-hidden hover:shadow-2xl hover:shadow-[#3db5ad]/5 transition-all duration-300 flex flex-col h-full"
    >
      <div className="aspect-[3/4] relative overflow-hidden">
        {novel.coverImages && novel.coverImages.length > 0 ? (
          <img 
            src={novel.coverImages[0]} 
            alt={novel.name} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#121212] text-slate-700">
            <ImageIcon className="w-16 h-16" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 gap-3">
          <button 
            onClick={() => onViewChapters(novel)}
            className="w-full bg-[#3db5ad] text-[#121212] py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
          >
            عرض الفصول
          </button>
          <button 
            onClick={() => onEditNovel(novel)}
            className="w-full bg-white/10 backdrop-blur-md text-white py-3 rounded-xl font-bold text-sm transition-all hover:bg-white/20"
          >
            تعديل الرواية
          </button>
        </div>
        
        {novel.status && (
          <div className="absolute top-4 left-4">
            <span className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg ${
              novel.status === 'مستمرة' ? 'bg-yellow-500 text-white' : 
              novel.status === 'مكتملة' ? 'bg-green-500 text-white' : 
              'bg-slate-700 text-white'
            }`}>
              {novel.status}
            </span>
          </div>
        )}
      </div>
      
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center gap-1 text-yellow-500 mb-2">
          <Star className="w-4 h-4 fill-current" />
          <span className="text-xs font-bold">{novel.rating || '0.0'}</span>
        </div>
        <h3 className="text-lg font-bold text-white mb-2 line-clamp-1 group-hover:text-[#3db5ad] transition-colors">{novel.name || 'Untitled'}</h3>
        <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">{novel.description || 'No description available.'}</p>
        
        {novel.categories && novel.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {novel.categories.slice(0, 3).map((cat, i) => (
              <span key={i} className="px-2 py-0.5 rounded-md bg-white/5 text-slate-500 text-[9px] font-bold border border-white/5">
                {cat}
              </span>
            ))}
            {novel.categories.length > 3 && (
              <span className="text-[9px] text-slate-600 font-bold">+{novel.categories.length - 3}</span>
            )}
          </div>
        )}
        
        <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{novel.author}</span>
          <button 
            onClick={() => onDeleteNovel(novel.id)}
            className="p-2 text-slate-600 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
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
  
  // UI State
  const [view, setView] = useState<'novels' | 'chapters' | 'edit-novel' | 'edit-chapter'>('novels');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [editingNovel, setEditingNovel] = useState<Partial<Novel> | null>(null);
  const [editingChapter, setEditingChapter] = useState<Partial<Chapter> | null>(null);
  const [previewChapter, setPreviewChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const groupedChapters = useMemo(() => {
    const groups: { [key: string]: Chapter[] } = { 'none': [] };
    volumes.forEach(v => {
      groups[v.id] = [];
    });
    chapters.forEach(c => {
      const volId = c.volumeId && groups[c.volumeId] ? c.volumeId : 'none';
      groups[volId].push(c);
    });
    return groups;
  }, [chapters, volumes]);

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
      return;
    }

    const q = query(collection(db, `novels/${selectedNovel.id}/volumes`), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const volumeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Volume));
      setVolumes(volumeData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `novels/${selectedNovel.id}/volumes`));

    return () => unsubscribe();
  }, [selectedNovel]);

  // --- Actions ---

  const addVolume = async () => {
    if (!selectedNovel) return;
    const { value: name } = await Swal.fire({
      title: 'إضافة مجلد جديد',
      input: 'text',
      inputLabel: 'اسم المجلد',
      inputPlaceholder: 'مثال: المجلد الأول، الجزء الثاني...',
      showCancelButton: true,
      confirmButtonText: 'إضافة',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff',
      confirmButtonColor: '#3db5ad'
    });

    if (name) {
      try {
        await addDoc(collection(db, `novels/${selectedNovel.id}/volumes`), { 
          name, 
          novelId: selectedNovel.id,
          order: volumes.length + 1,
          createdAt: serverTimestamp() 
        });
        Swal.fire({
          title: 'تم!',
          text: 'تم إضافة المجلد بنجاح',
          icon: 'success',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#3db5ad'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `novels/${selectedNovel.id}/volumes`);
      }
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
          confirmButtonColor: '#3db5ad'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `novels/${selectedNovel.id}/volumes/${id}`);
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
        confirmButtonColor: '#3db5ad'
      });
    } catch (error) {
      console.error("Login failed", error);
      Swal.fire({
        title: 'فشل الدخول',
        text: 'حدث خطأ أثناء تسجيل الدخول',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#3db5ad'
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
      confirmButtonColor: '#3db5ad',
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
      confirmButtonColor: '#3db5ad'
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
          confirmButtonColor: '#3db5ad'
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
          confirmButtonColor: '#3db5ad'
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
          confirmButtonColor: '#3db5ad',
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
          confirmButtonColor: '#3db5ad'
        });
      } catch (err) {
        console.error("Import failed", err);
        Swal.fire({
          title: 'فشل الاستيراد',
          text: 'تأكد من صيغة الملف.',
          icon: 'error',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#3db5ad'
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
      return matchesSearch && matchesCategory;
    });
  }, [novels, searchTerm, selectedCategory]);

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
        confirmButtonColor: '#3db5ad'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'novels');
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حفظ الرواية',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#3db5ad'
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
      cancelButtonColor: '#3db5ad',
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
        confirmButtonColor: '#3db5ad'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${id}`);
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حذف الرواية',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#3db5ad'
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
        confirmButtonColor: '#3db5ad'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `novels/${selectedNovel?.id}/chapters`);
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حفظ الفصل',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#3db5ad'
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
      cancelButtonColor: '#3db5ad',
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
        confirmButtonColor: '#3db5ad'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${selectedNovel.id}/chapters/${id}`);
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حذف الفصل',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#3db5ad'
      });
    }
  };

  // --- UI Helpers ---

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#3db5ad]/20 border-t-[#3db5ad] rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Book className="w-6 h-6 text-[#3db5ad]" />
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
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#3db5ad]/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#3db5ad]/10 rounded-full blur-3xl" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1e1e1e] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl max-w-md w-full text-center relative z-10"
        >
          <div className="w-20 h-20 bg-[#3db5ad] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#3db5ad]/30">
            <Book className="w-10 h-10 text-[#121212]" />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">لوحة الروايات</h1>
          <p className="text-slate-400 mb-8 leading-relaxed">نظام إدارة الروايات وفصولها بكل سهولة.</p>
          <button 
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-[#3db5ad] hover:bg-[#34a098] text-[#121212] font-bold py-4 rounded-2xl transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]"
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
      {/* Modern Dark Header */}
      <header className="sticky top-0 z-40 bg-[#1e1e1e]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#3db5ad] rounded-xl flex items-center justify-center shadow-md shadow-[#3db5ad]/20">
              <Book className="w-6 h-6 text-[#121212]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">لوحة الروايات</h1>
              <p className="text-[10px] text-[#3db5ad] font-bold uppercase tracking-widest">الإدارة</p>
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
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                <div>
                  <h2 className="text-3xl font-extrabold text-white mb-2">مكتبة الروايات</h2>
                  <p className="text-slate-400 text-sm">إدارة وتعديل جميع الروايات الموجودة في مشروعك.</p>
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
                        className="w-full pr-12 pl-4 py-3.5 rounded-2xl border border-white/5 bg-[#1e1e1e] text-white focus:ring-2 focus:ring-[#3db5ad]/50 outline-none transition-all font-medium"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 bg-[#1e1e1e] border border-white/5 hover:bg-white/5 text-slate-300 px-6 py-3.5 rounded-2xl font-bold transition-all cursor-pointer">
                      <FileText className="w-4 h-4 text-[#3db5ad]" />
                      استيراد
                      <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                    </label>
                    
                    <button 
                      onClick={() => {
                        setEditingNovel({ name: '', description: '', author: user.displayName || '', coverImages: ['', '', '', ''], categories: [] });
                        setView('edit-novel');
                      }}
                      className="flex items-center gap-2 bg-[#3db5ad] hover:bg-[#34a098] text-[#121212] px-8 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-[#3db5ad]/20"
                    >
                      <Plus className="w-4 h-4" />
                      رواية جديدة
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide">
                <button 
                  onClick={() => setSelectedCategory('الكل')}
                  className={`px-6 py-2 rounded-xl font-bold whitespace-nowrap transition-all border ${
                    selectedCategory === 'الكل' 
                      ? 'bg-[#3db5ad] text-[#121212] border-[#3db5ad]' 
                      : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                  }`}
                >الكل</button>
                {categories.map(cat => (
                  <div key={cat.id} className="relative group">
                    <button 
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`px-6 py-2 rounded-xl font-bold whitespace-nowrap transition-all border ${
                        selectedCategory === cat.name 
                          ? 'bg-[#3db5ad] text-[#121212] border-[#3db5ad]' 
                          : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      {cat.name}
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id, cat.name); }}
                        className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {isAdmin && (
                  <button 
                    onClick={addCategory}
                    className="px-4 py-2 rounded-xl font-bold text-[#3db5ad] border border-[#3db5ad]/30 hover:bg-[#3db5ad]/10 transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة
                  </button>
                )}
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

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="bg-[#1e1e1e] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-sm sticky top-28">
                    <div className="aspect-[3/4] relative">
                      <CoverSlider images={selectedNovel.coverImages || []} />
                    </div>
                    <div className="p-8">
                      <h3 className="font-bold text-xl mb-4 text-white">{selectedNovel.name}</h3>
                      
                      <div className="flex items-center gap-2 text-yellow-500 mb-6">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-bold">{selectedNovel.rating || '0.0'}</span>
                        <span className="text-slate-500 text-xs font-normal">/ 5.0</span>
                      </div>

                      <div className="space-y-4 mb-8">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">عدد الفصول</span>
                          <span className="font-bold text-[#3db5ad] bg-[#3db5ad]/10 px-3 py-1 rounded-lg">{chapters.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">الحالة</span>
                          <span className={`font-bold px-3 py-1 rounded-lg ${
                            selectedNovel.status === 'مستمرة' ? 'text-yellow-500 bg-yellow-500/10' : 
                            selectedNovel.status === 'مكتملة' ? 'text-green-500 bg-green-500/10' : 
                            'text-slate-300 bg-white/5'
                          }`}>
                            {selectedNovel.status || 'N/A'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-white/5 mb-8">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">قصة الرواية</h4>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-6">
                          {selectedNovel.description}
                        </p>
                      </div>

                      <button 
                        onClick={() => {
                          setEditingChapter({ novelId: selectedNovel.id, title: '', content: '', order: chapters.length + 1, date: new Date().toLocaleDateString('ar-EG') });
                          setView('edit-chapter');
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-[#3db5ad] hover:bg-[#34a098] text-[#121212] py-4 rounded-2xl font-bold transition-all shadow-lg shadow-[#3db5ad]/10"
                      >
                        <Plus className="w-5 h-5" />
                        إضافة فصل جديد
                      </button>

                      {isAdmin && (
                        <div className="mt-8 pt-8 border-t border-white/5">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">المجلدات</h4>
                            <button 
                              onClick={addVolume}
                              className="w-8 h-8 flex items-center justify-center bg-[#3db5ad]/10 text-[#3db5ad] rounded-lg hover:bg-[#3db5ad]/20 transition-all"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-2">
                            {volumes.length === 0 ? (
                              <p className="text-[10px] text-slate-500 italic">لا توجد مجلدات بعد.</p>
                            ) : (
                              volumes.map(vol => (
                                <div key={vol.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group">
                                  <span className="text-sm font-bold text-slate-300">{vol.name}</span>
                                  <button 
                                    onClick={() => deleteVolume(vol.id, vol.name)}
                                    className="p-1 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-8">
                  {chapters.length === 0 ? (
                    <div className="bg-[#1e1e1e] rounded-[2.5rem] border-2 border-dashed border-white/5 p-20 text-center">
                      <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                      <p className="text-slate-500 font-bold">لا توجد فصول لهذه الرواية بعد.</p>
                    </div>
                  ) : (
                    <>
                      {/* Volumes with Chapters */}
                      {volumes.map(vol => groupedChapters[vol.id] && groupedChapters[vol.id].length > 0 && (
                        <div key={vol.id} className="space-y-4">
                          <div className="flex items-center gap-4">
                            <h3 className="text-lg font-bold text-[#3db5ad] bg-[#3db5ad]/10 px-4 py-1.5 rounded-xl border border-[#3db5ad]/20">
                              {vol.name}
                            </h3>
                            <div className="h-px bg-white/5 flex-1" />
                          </div>
                          <div className="space-y-4">
                            {groupedChapters[vol.id].map((chapter, index) => (
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
                      ))}

                      {/* Chapters without Volume */}
                      {groupedChapters['none'] && groupedChapters['none'].length > 0 && (
                        <div className="space-y-4">
                          {(volumes.length > 0) && (
                            <div className="flex items-center gap-4">
                              <h3 className="text-lg font-bold text-slate-500 bg-white/5 px-4 py-1.5 rounded-xl border border-white/5">
                                فصول غير مجلدة
                              </h3>
                              <div className="h-px bg-white/5 flex-1" />
                            </div>
                          )}
                          <div className="space-y-4">
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
                        className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#3db5ad]/50 outline-none transition-all"
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
                        className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#3db5ad]/50 outline-none transition-all"
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
                            className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#3db5ad]/50 outline-none transition-all text-sm"
                            placeholder={`رابط الصورة ${idx + 1}...`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">الحالة</label>
                        <select 
                          value={editingNovel.status || 'مستمرة'}
                          onChange={e => setEditingNovel({...editingNovel, status: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#3db5ad]/50 outline-none transition-all appearance-none"
                        >
                          <option value="مستمرة">مستمرة</option>
                          <option value="متوقفة">متوقفة</option>
                          <option value="مكتملة">مكتملة</option>
                        </select>
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
                          className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#3db5ad]/50 outline-none transition-all"
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
                                  ? 'bg-[#3db5ad] text-[#121212] border-[#3db5ad]' 
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
                        className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#3db5ad]/50 outline-none transition-all leading-relaxed resize-none"
                        placeholder="اكتب ملخصاً للرواية..."
                      />
                    </div>
                    
                    <div className="p-8 bg-[#121212] rounded-[2rem] border border-white/5">
                      <div className="flex items-center gap-2 text-slate-500 mb-6">
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-xs font-bold">معاينة الرواية</span>
                      </div>
                      
                      <div className="aspect-[3/4] bg-[#1e1e1e] rounded-2xl border border-white/5 overflow-hidden mb-6">
                        <CoverSlider images={editingNovel.coverImages || []} />
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-bold text-lg text-white line-clamp-1">{editingNovel.name || 'اسم الرواية'}</h3>
                        
                        <div className="flex items-center gap-2 text-yellow-500">
                          <Star className="w-4 h-4 fill-current" />
                          <span className="text-sm font-bold">{editingNovel.rating || '0.0'}</span>
                          <span className="text-slate-500 text-xs font-normal">/ 5.0</span>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">معاينة الوصف</h4>
                          <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">
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
                    className="flex-1 flex items-center justify-center gap-3 bg-[#3db5ad] hover:bg-[#34a098] text-[#121212] font-extrabold py-5 rounded-2xl transition-all shadow-xl shadow-[#3db5ad]/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                    حفظ الرواية
                  </button>
                  <button 
                    type="button"
                    onClick={() => setView('novels')}
                    className="px-10 py-5 font-bold text-slate-500 hover:bg-white/5 rounded-2xl transition-all"
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
              className="max-w-7xl mx-auto"
            >
              <div className="flex items-center gap-6 mb-10">
                <button 
                  onClick={() => setView('chapters')}
                  className="w-12 h-12 flex items-center justify-center bg-[#1e1e1e] border border-white/5 rounded-2xl hover:bg-white/5 transition-all shadow-sm"
                >
                  <ArrowLeft className="w-6 h-6 text-slate-400" />
                </button>
                <h2 className="text-2xl font-extrabold text-white">{editingChapter.id ? 'تعديل الفصل' : 'إضافة فصل جديد'}</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Side Column: Novel Info */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-[#1e1e1e] p-6 rounded-[2rem] border border-white/5 shadow-xl">
                    <div className="aspect-[3/4] mb-6">
                      <CoverSlider images={selectedNovel?.coverImages || []} />
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-bold text-lg text-white line-clamp-1">{selectedNovel?.name}</h3>
                      <div className="flex items-center gap-2 text-yellow-500">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-bold">{selectedNovel?.rating || '0.0'}</span>
                        <span className="text-slate-500 text-xs font-normal">/ 5.0</span>
                      </div>
                      <div className="pt-4 border-t border-white/5">
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-6">
                          {selectedNovel?.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Column: Chapter Form */}
                <div className="lg:col-span-3">
                  <form onSubmit={saveChapter} className="bg-[#1e1e1e] p-10 rounded-[2.5rem] border border-white/5 shadow-xl space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-400 mb-2">عنوان الفصل</label>
                        <input 
                          type="text"
                          required
                          value={editingChapter.title}
                          onChange={e => setEditingChapter({...editingChapter, title: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#3db5ad]/50 outline-none transition-all"
                          placeholder="أدخل عنوان الفصل..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">المجلد</label>
                        <select 
                          value={editingChapter.volumeId || ''}
                          onChange={e => setEditingChapter({...editingChapter, volumeId: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#3db5ad]/50 outline-none transition-all appearance-none"
                        >
                          <option value="">بدون مجلد</option>
                          {volumes.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">الترتيب</label>
                        <input 
                          type="number"
                          required
                          value={editingChapter.order}
                          onChange={e => setEditingChapter({...editingChapter, order: parseInt(e.target.value)})}
                          className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#3db5ad]/50 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">التاريخ</label>
                        <input 
                          type="text"
                          value={editingChapter.date || ''}
                          onChange={e => setEditingChapter({...editingChapter, date: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#3db5ad]/50 outline-none transition-all"
                          placeholder="مثال: 13/3/2026"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2 flex justify-between">
                        محتوى الفصل
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">يدعم التنسيق البسيط (Markdown)</span>
                      </label>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <textarea 
                          required
                          rows={22}
                          value={editingChapter.content}
                          onChange={e => setEditingChapter({...editingChapter, content: e.target.value})}
                          className="w-full px-8 py-8 rounded-[2rem] border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#3db5ad]/50 outline-none transition-all font-serif text-xl leading-relaxed resize-none"
                          placeholder="ابدأ بكتابة أحداث الفصل هنا..."
                        />
                        <div className="w-full px-8 py-8 rounded-[2rem] border border-white/5 bg-[#121212]/50 text-slate-300 overflow-y-auto max-h-[600px] scrollbar-hide">
                          <div className="markdown-body prose prose-invert prose-slate max-w-none font-serif text-lg leading-relaxed">
                            <Markdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                img: ({ src, alt }) => (
                                  <img 
                                    src={src} 
                                    alt={alt || 'Preview Image'} 
                                    className="rounded-xl shadow-lg max-w-full my-4 border border-white/5" 
                                    referrerPolicy="no-referrer"
                                  />
                                )
                              }}
                            >
                              {processChapterContent(editingChapter.content) || '*المعاينة المباشرة ستظهر هنا...*'}
                            </Markdown>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-6">
                      <button 
                        type="submit"
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-3 bg-[#3db5ad] hover:bg-[#34a098] text-[#121212] font-extrabold py-5 rounded-2xl transition-all shadow-xl shadow-[#3db5ad]/20 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                        حفظ الفصل
                      </button>
                      <button 
                        type="button"
                        onClick={() => setView('chapters')}
                        className="px-10 py-5 font-bold text-slate-500 hover:bg-white/5 rounded-2xl transition-all"
                      >
                        إلغاء
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
            <div className="w-8 h-8 bg-[#3db5ad] rounded-lg flex items-center justify-center">
              <Book className="w-4 h-4 text-[#121212]" />
            </div>
            <span className="font-extrabold text-white tracking-tight">لوحة الروايات</span>
          </div>
          <p className="text-slate-500 text-xs">© 2026 جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-6 text-xs font-bold text-slate-400">
            <a href="#" className="hover:text-[#3db5ad] transition-colors">الدعم الفني</a>
            <a href="#" className="hover:text-[#3db5ad] transition-colors">سياسة الخصوصية</a>
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
      </AnimatePresence>
    </div>
  );
}
