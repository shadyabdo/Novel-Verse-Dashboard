/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  User as UserIcon,
  FileQuestion,
  Plus, 
  Book, 
  BookOpen,
  Home,
  Library,
  FileText, 
  Trash2, 
  Edit, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  LogOut, 
  LogIn,
  Save,
  ArrowLeft,
  Loader2,
  Image as ImageIcon,
  Search,
  Clock,
  SlidersHorizontal,
  LayoutDashboard,
  Settings,
  Settings2,
  Type,
  Hash,
  Calendar,
  FolderPlus,
  Check,
  Star,
  ExternalLink,
  MoreVertical,
  Layers,
  Sun,
  Moon,
  X,
  Eye,
  Upload,
  Link,
  CheckSquare,
  Square,
  XCircle,
  Minus,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import QuickPinchZoom, { make3dTransformValue } from 'react-quick-pinch-zoom';
import Swal from 'sweetalert2';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Types ---

interface Volume {
  id: string;
  name: string;
  order: number;
}

interface Novel {
  id: string;
  name: string;
  description: string;
  author: string;
  coverImages?: string[];
  categories?: string[];
  status?: string;
  rating?: number;
  isAdult?: boolean;
  isDraft?: boolean;
  volumes?: Volume[];
  createdAt?: any;
  updatedAt?: any;
}

interface Chapter {
  id: string;
  novelId: string;
  volumeId?: string;
  title: string;
  content: string;
  order: number;
  date?: string;
  isDraft?: boolean;
  isEndOfVolume?: boolean;
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

const CoverSlider = ({ images }: { images: string[] }) => {
  const validImages = images.filter(img => img && img.trim() !== '');

  if (validImages.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#121212] rounded-[2.5rem] border border-white/5">
        <ImageIcon className="w-10 h-10 text-white/5" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full group overflow-hidden rounded-[2.5rem] flex items-center justify-center">
      <img 
        src={validImages[0]} 
        alt="Novel Main Cover" 
        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl p-2"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

const ChapterRow = ({ 
  chapter, 
  index, 
  onEdit, 
  onDelete,
  onRead
}: { 
  chapter: Chapter, 
  index: number, 
  onEdit: (c: Chapter) => void, 
  onDelete: (id: string) => void,
  onRead: (c: Chapter) => void
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => onRead(chapter)}
      className="bg-[#121212] p-6 rounded-[1.8rem] border border-white/5 flex items-center justify-between hover:border-[#F87171]/20 transition-all group shadow-sm hover:shadow-xl hover:shadow-black/20 cursor-pointer"
    >
      <div className="flex items-center gap-6 flex-1">
        <div className="w-14 h-14 bg-[#0a0a0a] rounded-2xl flex items-center justify-center text-white/20 font-black text-lg group-hover:bg-[#F87171] group-hover:text-[#121212] transition-all duration-300 border border-white/5 shadow-inner">
          {chapter.order}
        </div>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-extrabold text-white text-lg group-hover:text-[#F87171] transition-colors">{chapter.title}</h4>
            {chapter.isDraft ? (
              <span className="px-3 py-1 rounded-lg bg-yellow-500/10 text-yellow-500 text-[8px] font-black uppercase tracking-[0.2em] border border-yellow-500/20">
                مسودة
              </span>
            ) : (
               <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase tracking-[0.2em] border border-blue-500/20">
                منشور
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[10px] text-white/20 font-black uppercase tracking-[0.2em]">
            <span className="flex items-center gap-2 group-hover:text-white/40 transition-colors">
              <Calendar className="w-3 h-3" /> 
              {chapter.date}
            </span>
            <div className="w-1 h-1 bg-white/5 rounded-full" />
            <span className="flex items-center gap-2 group-hover:text-white/40 transition-colors">
              <Hash className="w-3 h-3" />
              {chapter.content.length.toLocaleString()} حرف
            </span>
            {chapter.isEndOfVolume && (
              <>
                <div className="w-1 h-1 bg-white/5 rounded-full" />
                <span className="text-[#F87171] flex items-center gap-2">
                  <Check className="w-3 h-3" />
                  نهاية المجلد
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button 
          onClick={() => onEdit(chapter)}
          className="w-12 h-12 flex items-center justify-center text-white/30 bg-white/5 hover:bg-[#F87171] hover:text-[#121212] rounded-2xl border border-white/5 transition-all active:scale-90 group/btn"
          title="تعديل الفصل"
        >
          <Edit className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
        </button>
        <button 
          onClick={() => onDelete(chapter.id)}
          className="w-12 h-12 flex items-center justify-center text-white/30 bg-white/5 hover:bg-red-500 hover:text-white rounded-2xl border border-white/5 transition-all active:scale-90 group/btn"
          title="حذف الفصل"
        >
          <Trash2 className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
};

const CustomSelect = ({ 
  value, 
  onChange, 
  options, 
  placeholder = "اختر...", 
  className = "" 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  options: { value: string, label: string }[], 
  placeholder?: string,
  className?: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white flex items-center justify-between focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all"
      >
        <span className={selectedOption ? "text-white" : "text-white/40"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-white/40" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[120]" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute top-full left-0 right-0 mt-2 z-[130] bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
            >
              <div className="max-h-60 overflow-y-auto scrollbar-hide p-2 space-y-1">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-3 rounded-xl text-right text-sm font-bold transition-all flex items-center justify-between group ${
                      value === opt.value 
                        ? 'bg-[#F87171] text-[#121212]' 
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {opt.label}
                    {value === opt.value && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  
  // UI State
  const [view, setView] = useState<'novels' | 'chapters' | 'edit-novel' | 'edit-chapter' | 'reader'>('novels');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [editingNovel, setEditingNovel] = useState<Partial<Novel> | null>(null);
  const [editingChapter, setEditingChapter] = useState<Partial<Chapter> | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  
  // Volume Management State
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [newVolumeName, setNewVolumeName] = useState('');
  const [expandedVolumes, setExpandedVolumes] = useState<string[]>([]);

  // Image Insertion State
  const [showImagePopup, setShowImagePopup] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [visibleNovelsCount, setVisibleNovelsCount] = useState(8);
  const [visibleChaptersCount, setVisibleChaptersCount] = useState(20);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [readingChapter, setReadingChapter] = useState<Chapter | null>(null);
  const [readerSettings, setReaderSettings] = useState({
    fontSize: 18,
    lineHeight: 1.8,
    fontWeight: '400'
  });
  const [showReaderSettings, setShowReaderSettings] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const { ref: novelsEndRef, inView: novelsEndInView } = useInView();
  const { ref: chaptersEndRef, inView: chaptersEndInView } = useInView();

  useEffect(() => {
    if (novelsEndInView) {
      setVisibleNovelsCount(prev => prev + 8);
    }
  }, [novelsEndInView]);

  useEffect(() => {
    if (chaptersEndInView) {
      setVisibleChaptersCount(prev => prev + 20);
    }
  }, [chaptersEndInView]);

  const getNextChapter = (current: Chapter) => {
    const sorted = [...chapters]
      .filter(c => isAdmin || !c.isDraft)
      .sort((a, b) => a.order - b.order);
    const index = sorted.findIndex(c => c.id === current.id);
    return index < sorted.length - 1 ? sorted[index + 1] : null;
  };

  const getPrevChapter = (current: Chapter) => {
    const sorted = [...chapters]
      .filter(c => isAdmin || !c.isDraft)
      .sort((a, b) => a.order - b.order);
    const index = sorted.findIndex(c => c.id === current.id);
    return index > 0 ? sorted[index - 1] : null;
  };

  const isAdmin = user?.email === "shadyabdowd2020@gmail.com";

  useEffect(() => {
    setVisibleNovelsCount(8);
  }, [selectedCategory, searchTerm]);

  useEffect(() => {
    setVisibleChaptersCount(20);
  }, [selectedNovel]);

  const insertImage = (url: string) => {
    if (!editingChapter || !textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editingChapter.content || '';
    // Use the format [url] as requested by the user for database compatibility
    const imageTag = `\n[${url.trim()}]\n`;
    
    const newContent = text.substring(0, start) + imageTag + text.substring(end);
    
    setEditingChapter({ ...editingChapter, content: newContent });
    setShowImagePopup(false);
    setImageUrl('');
    
    // Focus back and set cursor after image
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + imageTag.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u && u.email !== "shadyabdowd2020@gmail.com") {
        await signOut(auth);
        setUser(null);
        Swal.fire({
          title: 'دخول غير مصرح!',
          text: 'عذراً، هذا التطبيق مخصص للإدارة فقط.',
          icon: 'error',
          background: '#1e1e1e',
          color: '#fff',
        });
      } else {
        setUser(u);
      }
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
      
      // Update selectedNovel if it's currently selected
      if (selectedNovel) {
        const updatedSelected = novelData.find(n => n.id === selectedNovel.id);
        if (updatedSelected) setSelectedNovel(updatedSelected);
      }
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

  const isRecent = (timestamp: any) => {
    if (!timestamp) return false;
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return diff < 24 * 60 * 60 * 1000; // 24 hours
  };

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

  // --- Actions ---

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Strict email check right after login
      if (user.email !== "shadyabdowd2020@gmail.com") {
        await signOut(auth);
        Swal.fire({
          title: 'دخول غير مصرح!',
          text: 'عذراً، هذا التطبيق مخصص للإدارة فقط.',
          icon: 'error',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#F87171'
        });
        return;
      }

      Swal.fire({
        title: 'تم تسجيل الدخول!',
        text: 'مرحباً بك في كوم روايات',
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#F87171'
      });
    } catch (error) {
      console.error("Login failed", error);
      Swal.fire({
        title: 'فشل الدخول',
        text: 'حدث خطأ أثناء تسجيل الدخول',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#F87171'
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
      confirmButtonColor: '#F87171',
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
      confirmButtonColor: '#F87171',
      inputValidator: (value) => {
        if (!value) {
          return 'يرجى إدخال اسم التصنيف';
        }
        const exists = categories.some(cat => cat.name.toLowerCase() === value.trim().toLowerCase());
        if (exists) {
          return 'هذا التصنيف موجود بالفعل';
        }
        return null;
      }
    });

    if (name) {
      try {
        const trimmedName = name.trim();
        const slug = trimmedName.toLowerCase().replace(/\s+/g, '-');
        await addDoc(collection(db, 'categories'), { name: trimmedName, slug });
        Swal.fire({
          title: 'تم!',
          text: 'تم إضافة التصنيف بنجاح',
          icon: 'success',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#F87171'
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
          confirmButtonColor: '#F87171'
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
          confirmButtonColor: '#F87171',
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
          confirmButtonColor: '#F87171'
        });
      } catch (err) {
        console.error("Import failed", err);
        Swal.fire({
          title: 'فشل الاستيراد',
          text: 'تأكد من صيغة الملف.',
          icon: 'error',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#F87171'
        });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const filteredNovels = novels.filter(n => {
    const name = n.name || '';
    const author = n.author || '';
    const search = searchTerm || '';
    
    // Hide drafts from non-admins
    if (!isAdmin && n.isDraft) return false;

    const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || 
                         author.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'الكل' || (n.categories && n.categories.includes(selectedCategory));
    return matchesSearch && matchesCategory;
  });

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
        isAdult: editingNovel.isAdult || false,
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
        confirmButtonColor: '#F87171'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'novels');
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حفظ الرواية',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#F87171'
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
      cancelButtonColor: '#F87171',
      confirmButtonText: 'نعم، احذفها',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff'
    });

    if (!result.isConfirmed) return;

    try {
      await deleteDoc(doc(db, 'novels', id));
      setView('novels');
      setSelectedNovel(null);
      Swal.fire({
        title: 'تم الحذف!',
        text: 'تم حذف الرواية بنجاح',
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#F87171'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${id}`);
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حذف الرواية',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#F87171'
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
        confirmButtonColor: '#F87171'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `novels/${selectedNovel?.id}/chapters`);
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حفظ الفصل',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#F87171'
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
      cancelButtonColor: '#F87171',
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
        confirmButtonColor: '#F87171'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${selectedNovel.id}/chapters/${id}`);
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حذف الفصل',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#F87171'
      });
    }
  };

  const addVolume = async () => {
    if (!selectedNovel || !newVolumeName.trim()) return;

    try {
      const newVolume: Volume = {
        id: Math.random().toString(36).substr(2, 9),
        name: newVolumeName.trim(),
        order: (selectedNovel.volumes?.length || 0) + 1
      };

      const updatedVolumes = [...(selectedNovel.volumes || []), newVolume];
      await updateDoc(doc(db, 'novels', selectedNovel.id), {
        volumes: updatedVolumes,
        updatedAt: serverTimestamp()
      });

      setNewVolumeName('');
      setShowVolumePopup(false);
      Swal.fire({
        title: 'تم!',
        text: 'تم إضافة المجلد بنجاح',
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#F87171'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `novels/${selectedNovel.id}`);
    }
  };

  const editVolume = async (volumeId: string, currentName: string) => {
    if (!selectedNovel) return;

    const { value: newName } = await Swal.fire({
      title: 'تعديل اسم المجلد',
      input: 'text',
      inputValue: currentName,
      inputPlaceholder: 'أدخل الاسم الجديد...',
      showCancelButton: true,
      confirmButtonColor: '#F87171',
      cancelButtonColor: '#1e1e1e',
      confirmButtonText: 'حفظ',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff',
      inputValidator: (value) => {
        if (!value) {
          return 'يجب إدخال اسم للمجلد!';
        }
        return null;
      }
    });

    if (newName) {
      try {
        const updatedVolumes = selectedNovel.volumes?.map(v => 
          v.id === volumeId ? { ...v, name: newName } : v
        );
        await updateDoc(doc(db, 'novels', selectedNovel.id), {
          volumes: updatedVolumes,
          updatedAt: serverTimestamp()
        });
        Swal.fire({
          title: 'تم التعديل!',
          text: 'تم تحديث اسم المجلد بنجاح',
          icon: 'success',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#F87171'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `novels/${selectedNovel.id}`);
      }
    }
  };

  const deleteVolume = async (volumeId: string) => {
    if (!selectedNovel) return;

    const result = await Swal.fire({
      title: 'هل أنت متأكد؟',
      text: "سيتم حذف المجلد، وستصبح الفصول التابعة له غير مصنفة.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#F87171',
      confirmButtonText: 'نعم، احذف',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff'
    });

    if (result.isConfirmed) {
      try {
        // 1. Update novel volumes
        const updatedVolumes = selectedNovel.volumes?.filter(v => v.id !== volumeId);
        await updateDoc(doc(db, 'novels', selectedNovel.id), {
          volumes: updatedVolumes,
          updatedAt: serverTimestamp()
        });

        // 2. Update chapters to remove volumeId
        const volumeChapters = chapters.filter(c => c.volumeId === volumeId);
        for (const chapter of volumeChapters) {
          await updateDoc(doc(db, `novels/${selectedNovel.id}/chapters`, chapter.id), {
            volumeId: null
          });
        }

        Swal.fire({
          title: 'تم الحذف!',
          text: 'تم حذف المجلد بنجاح',
          icon: 'success',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#F87171'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `novels/${selectedNovel.id}`);
      }
    }
  };

  // --- UI Helpers ---

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#F87171]/20 border-t-[#F87171] rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Book className="w-6 h-6 text-white" />
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
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#F87171]/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#F87171]/10 rounded-full blur-3xl" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1e1e1e] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl max-w-md w-full text-center relative z-10"
        >
          <div className="w-20 h-20 bg-[#F87171] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#F87171]/30">
            <Book className="w-10 h-10 text-[#121212]" />
          </div>
          <h1 className="text-3xl font-normal text-white mb-3 tracking-wide" style={{ fontFamily: "'New Rocker', system-ui" }}>كوم روايات</h1>
          <p className="text-white/60 mb-8 leading-relaxed">لوحة التحكم الاحترافية لإدارة رواياتك وفصولك بكل سهولة وأناقة.</p>
          <button 
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-[#F87171] hover:bg-[#EF4444] text-[#121212] font-bold py-4 rounded-2xl transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            <LogIn className="w-5 h-5" />
            تسجيل الدخول باستخدام جوجل
          </button>
          <p className="mt-6 text-xs text-white/50">بواسطة فريق كوم روايات</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col font-sans relative overflow-hidden" dir="rtl">
      {/* Offcanvas Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-80 bg-[#1e1e1e] border-r border-white/5 z-50 flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <button 
                  onClick={() => setShowSidebar(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg">التصنيفات</h3>
                  <div className="w-8 h-8 bg-[#F87171]/10 rounded-lg flex items-center justify-center">
                    <SlidersHorizontal className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-2">
                <button 
                  onClick={() => {
                    setSelectedCategory('الكل');
                    setShowSidebar(false);
                  }}
                  className={`w-full text-right px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-between ${
                    selectedCategory === 'الكل' 
                      ? 'bg-[#F87171] text-[#121212]' 
                      : 'text-white/60 hover:bg-white/5'
                  }`}
                >
                  <span>الكل</span>
                  {selectedCategory === 'الكل' && <ChevronRight className="w-4 h-4" />}
                </button>
                {categories.map(cat => (
                  <div key={cat.id} className="group relative">
                    <button 
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        setShowSidebar(false);
                      }}
                      className={`w-full text-right px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-between ${
                        selectedCategory === cat.name 
                          ? 'bg-[#F87171] text-[#121212]' 
                          : 'text-white/60 hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{cat.name}</span>
                      {selectedCategory === cat.name && <ChevronRight className="w-4 h-4" />}
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id, cat.name); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {isAdmin && (
                <div className="p-6 border-t border-white/5">
                  <button 
                    onClick={addCategory}
                    className="w-full flex items-center justify-center gap-2 bg-[#F87171]/10 hover:bg-[#F87171]/20 text-white py-4 rounded-2xl font-bold transition-all border border-[#F87171]/20"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة تصنيف جديد
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modern Dark Header */}
      <header className="sticky top-0 z-40 bg-[#1e1e1e]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F87171] rounded-xl flex items-center justify-center shadow-md shadow-[#F87171]/20">
              <Book className="w-6 h-6 text-[#121212]" />
            </div>
            <div>
              <h1 className="text-xl font-normal text-white tracking-wide" style={{ fontFamily: "'New Rocker', system-ui" }}>كوم روايات</h1>
              <p className="text-[10px] text-[#F87171] font-bold uppercase tracking-widest">لوحة التحكم</p>
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
              className="p-2.5 text-white/60 hover:text-[#FF2E63] hover:bg-[#FF2E63]/10 rounded-xl transition-all"
              title="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <AnimatePresence>
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
                  <p className="text-white/60 text-sm">إدارة وتعديل جميع الروايات الموجودة في مشروعك.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-[300px]">
                    <div className="relative flex-1">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 w-5 h-5" />
                      <input 
                        type="text"
                        placeholder="ابحث عن رواية، كاتب..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pr-12 pl-4 py-3.5 rounded-2xl border border-white/5 bg-[#1e1e1e] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all font-medium"
                      />
                    </div>
                    <button 
                      onClick={() => setShowSidebar(true)}
                      className={`p-3.5 rounded-2xl border border-white/5 bg-[#1e1e1e] hover:bg-white/5 transition-all relative ${selectedCategory !== 'الكل' ? 'text-[#F87171]' : 'text-white/60'}`}
                      title="تصفية حسب التصنيف"
                    >
                      <SlidersHorizontal className="w-6 h-6" />
                      {selectedCategory !== 'الكل' && (
                        <span className="absolute -top-1 -left-1 w-3 h-3 bg-[#F87171] rounded-full border-2 border-[#121212]" />
                      )}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 bg-[#1e1e1e] border border-white/5 hover:bg-white/5 text-slate-300 px-6 py-3.5 rounded-2xl font-bold transition-all cursor-pointer">
                      <FileText className="w-4 h-4 text-white" />
                      استيراد
                      <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                    </label>
                    
                    <button 
                      onClick={() => {
                        setEditingNovel({ 
                          name: '', 
                          description: '', 
                          author: user.displayName || '', 
                          coverImages: [''], 
                          categories: [],
                          status: 'مستمرة',
                          rating: 0,
                          isAdult: false,
                          isDraft: false
                        });
                        setView('edit-novel');
                      }}
                      className="flex items-center gap-2 bg-[#F87171] hover:bg-[#EF4444] text-[#121212] px-8 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-[#F87171]/20"
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
                  <p className="text-white/50">لم نجد أي روايات تطابق بحثك أو المجموعة فارغة.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {filteredNovels.slice(0, visibleNovelsCount).map(novel => (
                    <motion.div 
                      layoutId={novel.id}
                      key={novel.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        setSelectedNovel(novel);
                        setView('chapters');
                      }}
                      className={`group bg-[#1e1e1e] rounded-[17px] border-2 ${novel.status === 'مستمرة' ? 'border-[#F87171] animate-border-glow' : 'border-[#C0C0C0]/20'} transition-all duration-500 flex flex-col h-full cursor-pointer relative hover:z-50`}
                    >
                      {/* Card Image Section */}
                      <div className="aspect-[2/3] relative overflow-hidden rounded-t-[17px]">
                        {novel.coverImages && novel.coverImages.length > 0 ? (
                          <img 
                            src={novel.coverImages[0]} 
                            alt={novel.name} 
                            className="w-full h-full object-cover group-hover:scale-110 group-hover:grayscale transition-all duration-700 ease-out"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#121212] text-slate-800">
                            <ImageIcon className="w-16 h-16 opacity-20" />
                          </div>
                        )}
                        
                        {/* Dark Overlay on Hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500 z-10 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-500 transform lg:hidden">
                            <div className="w-16 h-16 bg-[#F87171] rounded-2xl flex items-center justify-center shadow-2xl shadow-[#F87171]/40 rotate-12 group-hover:rotate-0 transition-transform duration-500">
                              <BookOpen className="w-8 h-8 text-[#121212]" />
                            </div>
                          </div>
                        </div>
                        
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] via-transparent to-transparent opacity-60 z-20" />

                        {/* Status Badge (Top Right) */}
                        {novel.status && (
                          <div className="absolute top-5 right-5 z-30 flex items-center px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/5 shadow-2xl">
                            <span className={`text-base font-black uppercase tracking-widest ${
                              novel.status === 'مستمرة' ? 'text-blue-400' : 
                              novel.status === 'مكتملة' ? 'text-emerald-400' : 
                              'text-white/70'
                            }`}>
                              {novel.status}
                            </span>
                          </div>
                        )}

                        {/* Rating Badge (Top Left) */}
                        <div className="absolute top-5 left-5 flex flex-col gap-2 z-30">
                          <div className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/5 shadow-2xl">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="text-base font-black text-white">{novel.rating || '0.0'}</span>
                          </div>
                          
                          {novel.isAdult && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-full shadow-lg shadow-red-600/40 border border-red-500/30">
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">+16</span>
                            </div>
                          )}

                          {(isRecent(novel.createdAt) || isRecent(novel.updatedAt)) && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F87171] rounded-full shadow-lg shadow-[#F87171]/20 self-start animate-pulse">
                              <Clock className="w-3 h-3 text-[#121212]" />
                              <span className="text-[10px] font-black text-[#121212] uppercase tracking-widest">جديد</span>
                            </div>
                          )}
                        </div>

                        {/* Draft Badge (Bottom Right of Image) */}
                        {novel.isDraft && isAdmin && (
                          <div className="absolute bottom-5 right-5 z-30 flex items-center px-4 py-2 bg-yellow-500/80 backdrop-blur-md rounded-full border border-yellow-500/20 shadow-2xl">
                            <span className="text-xs font-black text-[#121212] uppercase tracking-widest">
                              مسودة
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-8 flex-1 flex flex-col relative">
                        {/* Floating Tooltip (Positioned right above the title area) */}
                        <div className="absolute bottom-[80%] left-1/2 -translate-x-1/2 w-80 p-6 bg-[#121212]/95 backdrop-blur-3xl border border-red-500/20 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 translate-y-10 group-hover:-translate-y-4 transition-all duration-500 pointer-events-none z-[100] hidden lg:block">
                          <div className="relative text-center">
                            {novel.isAdult && (
                              <div className="inline-block px-3 py-1 bg-red-600 text-white text-[9px] font-black rounded-full mb-3 shadow-lg shadow-red-600/20">
                                محتوى للبالغين +16
                              </div>
                            )}
                            <h4 className="font-black text-white text-base mb-1 leading-tight">{novel.name}</h4>
                            <p className="text-[10px] font-bold text-white/30 mb-3 uppercase tracking-widest">{novel.author}</p>
                            <div className="h-px w-20 mx-auto bg-gradient-to-r from-transparent via-[#F87171]/40 to-transparent mb-3" />
                            <p className="text-[11px] text-white/60 leading-relaxed line-clamp-4 text-center font-medium" dir="rtl">
                              {novel.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-4">
                          <h3 className="text-xl font-black text-white line-clamp-1 group-hover:text-[#F87171] transition-colors duration-300 text-center" dir="ltr">
                            {novel.name || 'Untitled'}
                          </h3>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {filteredNovels.length > visibleNovelsCount && (
                <div ref={novelsEndRef} className="mt-16 flex justify-center py-10">
                  <div className="flex items-center gap-3 text-white/20">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm font-bold">جاري تحميل المزيد...</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Chapters View (Novel Details) */}
          {view === 'chapters' && selectedNovel && (
            <motion.div 
              key="chapters"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setView('novels')}
                  className="flex items-center gap-3 px-6 py-3 bg-[#1e1e1e] hover:bg-[#252525] text-white/70 hover:text-white rounded-2xl border border-white/5 transition-all group shadow-xl"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-sm font-bold">العودة للروايات</span>
                </button>
              </div>

              {/* Compact Novel Details Header */}
              <div className="bg-[#1e1e1e] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-xl relative mb-10">
                <div className="flex flex-col md:flex-row relative z-10">
                  {/* Left: Compact Cover Area */}
                  <div className="md:w-[240px] aspect-[2/3] md:aspect-auto flex items-center justify-center p-6 bg-[#121212]/50">
                    <CoverSlider images={selectedNovel.coverImages || []} />
                  </div>

                  {/* Right: Refined Info Area */}
                  <div className="flex-1 p-8 md:p-10 flex flex-col justify-center">
                    <div className="mb-6">
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border ${
                            selectedNovel.status === 'مستمرة' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : 
                            selectedNovel.status === 'مكتملة' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 
                            'bg-white/5 border-white/10 text-white/40'
                        }`}>
                          {selectedNovel.status || 'غير محدد'}
                        </span>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121212] rounded-xl border border-white/5">
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                          <span className="text-xs font-black text-white">{selectedNovel.rating || '0.0'}</span>
                        </div>
                        {selectedNovel.isAdult && (
                          <span className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-xl">
                            +16
                          </span>
                        )}
                      </div>

                      <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight mb-4">
                        {selectedNovel.name}
                      </h2>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                          <UserIcon className="w-4 h-4 text-[#F87171]" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">المؤلف</p>
                          <h4 className="text-lg font-black text-white tracking-wide">{selectedNovel.author}</h4>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end pt-6 border-t border-white/5">
                      <div>
                        <h4 className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">التصنيفات</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedNovel.categories?.slice(0, 4).map((cat, i) => (
                            <span key={`selected-cat-${i}`} className="px-4 py-1.5 rounded-xl bg-[#121212] text-white/50 text-[10px] font-black border border-white/5">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-8 justify-end">
                        <div className="text-right">
                          <span className="text-2xl font-black text-white block -mb-1">{chapters.length}</span>
                          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">فصل</span>
                        </div>
                        <div className="w-px h-8 bg-white/5" />
                        <div className="text-right">
                          <span className="text-2xl font-black text-white block -mb-1">{selectedNovel.volumes?.length || 0}</span>
                          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">مجلد</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Story Section - Simple & Compact */}
              <div className="mb-10 bg-[#1e1e1e]/40 p-8 rounded-[2rem] border border-white/5">
                <h4 className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  القصة
                </h4>
                <p className="text-white/40 leading-[1.8] text-sm font-medium italic">
                  {selectedNovel.description || 'لا يوجد وصف متاح لهذه الرواية حالياً.'}
                </p>
              </div>

              {/* Cover Gallery Section */}
              {selectedNovel.coverImages && selectedNovel.coverImages.filter(img => img && img.trim() !== '').length > 0 && (
                <div className="mb-12 bg-[#1e1e1e] p-10 rounded-[3rem] border border-white/5 shadow-xl">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                      <ImageIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-black text-white">صور الرواية</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {selectedNovel.coverImages.filter(img => img && img.trim() !== '').map((img, idx) => (
                      <motion.div 
                        key={`gallery-img-${idx}`}
                        whileHover={{ y: -10 }}
                        onClick={() => setLightboxImage(img)}
                        className="aspect-[2/3] flex items-center justify-center group relative cursor-zoom-in"
                      >
                        <img 
                          src={img} 
                          alt={`Cover ${idx + 1}`} 
                          className="max-w-full max-h-full object-contain rounded-xl shadow-xl transition-transform duration-700"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                          <span className="text-[8px] font-black text-white uppercase tracking-widest">غلاف #{idx + 1}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2: Volumes & Chapters Accordion */}
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black text-white flex items-center gap-3">
                    <Book className="w-6 h-6 text-[#F87171]" />
                    قائمة الفصول والمجلدات
                  </h3>
                </div>

                {chapters.length === 0 ? (
                  <div className="bg-[#1e1e1e] rounded-[3rem] border-2 border-dashed border-white/5 p-24 text-center">
                    <FileText className="w-16 h-16 text-white/10 mx-auto mb-6" />
                    <h4 className="text-xl font-bold text-white/40">لا توجد فصول بعد</h4>
                    <p className="text-white/20 text-sm mt-2">ابدأ بإضافة أول فصل لهذه الرواية.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Explicit Volumes */}
                    {(selectedNovel.volumes || []).sort((a, b) => a.order - b.order).map(volume => {
                      const volumeChapters = chapters
                        .filter(c => c.volumeId === volume.id)
                        .filter(c => isAdmin || !c.isDraft)
                        .slice(0, visibleChaptersCount);
                      const isExpanded = expandedVolumes.includes(volume.id);
                      
                      return (
                        <div key={volume.id} className="bg-[#1e1e1e] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-xl transition-all">
                          <div 
                            onClick={() => {
                              setExpandedVolumes(prev => 
                                prev.includes(volume.id) ? prev.filter(id => id !== volume.id) : [...prev, volume.id]
                              );
                            }}
                            className="w-full px-10 py-8 flex items-center justify-between hover:bg-white/[0.02] transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-6">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border shadow-lg ${
                                isExpanded ? 'bg-[#F87171] border-[#F87171] text-[#121212]' : 'bg-[#121212] border-white/5 text-white/20'
                              }`}>
                                <Layers className="w-6 h-6" />
                              </div>
                              <div className="text-right">
                                <h4 className="font-black text-xl text-white group-hover:text-[#F87171] transition-colors mb-1">{volume.name}</h4>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{volumeChapters.length} فصلاً متاحاً</span>
                                  {isAdmin && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          editVolume(volume.id, volume.name);
                                        }}
                                        className="p-1 text-white/20 hover:text-white"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteVolume(volume.id);
                                        }}
                                        className="p-1 text-white/20 hover:text-red-400"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-colors ${
                                isExpanded ? 'border-[#F87171]/20 text-[#F87171]' : 'border-white/5 text-white/20'
                              }`}
                            >
                              <ChevronDown className="w-6 h-6" />
                            </motion.div>
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="bg-[#1a1a1a]/50"
                              >
                                <div className="px-10 pb-10 space-y-3">
                                  <div className="h-px bg-white/5 w-full mb-6" />
                                  {volumeChapters.length === 0 ? (
                                    <div className="py-20 text-center bg-[#121212]/40 rounded-[2rem] border border-dashed border-white/5">
                                      <FileQuestion className="w-12 h-12 text-white/5 mx-auto mb-4" />
                                      <p className="text-white/20 text-xs font-black uppercase tracking-widest">لا توجد فصول في هذا المجلد حالياً</p>
                                    </div>
                                  ) : (
                                    volumeChapters.map((chapter, idx) => (
                                      <ChapterRow 
                                        key={chapter.id} 
                                        chapter={chapter} 
                                        index={idx} 
                                        onEdit={(c) => {
                                          setEditingChapter(c);
                                          setView('edit-chapter');
                                        }}
                                        onDelete={deleteChapter}
                                        onRead={(c) => {
                                          setReadingChapter(c);
                                          setView('reader');
                                        }}
                                      />
                                    ))
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}

                    {/* Uncategorized Chapters Header */}
                    {(() => {
                      const uncategorized = chapters
                        .filter(c => !c.volumeId)
                        .filter(c => isAdmin || !c.isDraft)
                        .slice(0, visibleChaptersCount);
                      if (uncategorized.length === 0) return null;

                      const isExpanded = expandedVolumes.includes('uncategorized');
                      return (
                        <div className="bg-[#1e1e1e] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-xl transition-all">
                          <button 
                            onClick={() => {
                              setExpandedVolumes(prev => 
                                prev.includes('uncategorized') ? prev.filter(id => id !== 'uncategorized') : [...prev, 'uncategorized']
                              );
                            }}
                            className="w-full px-10 py-8 flex items-center justify-between hover:bg-white/[0.02] transition-all group"
                          >
                            <div className="flex items-center gap-6">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border shadow-lg ${
                                isExpanded ? 'bg-[#F87171] border-[#F87171] text-[#121212]' : 'bg-[#121212] border-white/5 text-white/20'
                              }`}>
                                <Book className="w-6 h-6" />
                              </div>
                              <div className="text-right">
                                <h4 className="font-black text-xl text-white group-hover:text-[#F87171] transition-colors mb-1">الفصول العامة</h4>
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{uncategorized.length} فصلاً مستقلاً</p>
                              </div>
                            </div>
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-colors ${
                                isExpanded ? 'border-[#F87171]/20 text-[#F87171]' : 'border-white/5 text-white/20'
                              }`}
                            >
                              <ChevronDown className="w-6 h-6" />
                            </motion.div>
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="bg-[#1a1a1a]/50"
                              >
                                <div className="px-10 pb-10 space-y-3">
                                  <div className="h-px bg-white/5 w-full mb-6" />
                                  {uncategorized.map((chapter, idx) => (
                                    <ChapterRow 
                                      key={chapter.id} 
                                      chapter={chapter} 
                                      index={idx} 
                                      onEdit={(c) => {
                                        setEditingChapter(c);
                                        setView('edit-chapter');
                                      }}
                                      onDelete={deleteChapter}
                                      onRead={(c) => {
                                        setReadingChapter(c);
                                        setView('reader');
                                      }}
                                    />
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })()}
                    
                    {chapters.length > visibleChaptersCount && (
                      <div ref={chaptersEndRef} className="mt-8 flex justify-center py-6">
                        <div className="flex items-center gap-3 text-white/20">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-xs font-bold">جاري تحميل المزيد من الفصول...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Management Controls - Administrative Section at Bottom */}
              {isAdmin && (
                <div className="mt-16 pt-16 border-t border-white/5">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-[#F87171]/10 rounded-xl flex items-center justify-center border border-[#F87171]/20">
                      <Settings2 className="w-5 h-5 text-[#F87171]" />
                    </div>
                    <h3 className="text-xl font-black text-white">إدارة الرواية</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-20">
                    <button 
                      onClick={() => {
                        setEditingChapter({ novelId: selectedNovel.id, title: '', content: '', order: chapters.length + 1, date: new Date().toLocaleDateString('ar-EG') });
                        setView('edit-chapter');
                      }}
                      className="flex items-center justify-center gap-3 bg-[#F87171] hover:bg-[#EF4444] text-[#121212] px-8 py-5 rounded-[1.8rem] font-black transition-all shadow-xl shadow-[#F87171]/20 active:scale-95 group"
                    >
                      <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                      إضافة فصل
                    </button>

                    <button 
                      onClick={() => setShowVolumePopup(true)}
                      className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white px-8 py-5 rounded-[1.8rem] font-black border border-white/10 transition-all active:scale-95 group"
                    >
                      <Layers className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
                      إضافة مجلد
                    </button>

                    <button 
                      onClick={() => {
                        const currentCovers = selectedNovel.coverImages || [];
                        setEditingNovel({ ...selectedNovel, coverImages: currentCovers.length > 0 ? currentCovers : [''] });
                        setView('edit-novel');
                      }}
                      className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white px-8 py-5 rounded-[1.8rem] font-black border border-white/10 transition-all active:scale-95 group"
                    >
                      <Edit className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
                      تعديل البيانات
                    </button>

                    <button 
                      onClick={() => deleteNovel(selectedNovel.id)}
                      className="flex items-center justify-center gap-3 bg-red-500/10 hover:bg-red-500 text-red-500 px-8 py-5 rounded-[1.8rem] font-black border border-red-500/10 transition-all active:scale-95"
                    >
                      <Trash2 className="w-5 h-5" />
                      حذف الرواية
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Reader View */}
          {view === 'reader' && readingChapter && (
            <motion.div
              key="reader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] bg-[#1e1e1e] overflow-y-auto"
            >
              {/* Reader Header */}
              <div className="sticky top-0 z-30 bg-[#1e1e1e]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setView('chapters')}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all"
                  >
                    <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                  </button>
                  <div className="text-right">
                    <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">{selectedNovel?.name}</h3>
                    <h2 className="text-lg font-black text-white line-clamp-1">{readingChapter.title}</h2>
                  </div>
                </div>

                <button 
                  onClick={() => setShowReaderSettings(true)}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-[#F87171] hover:text-[#121212] transition-all border border-white/5"
                >
                  <Settings className="w-6 h-6" />
                </button>
              </div>

              {/* Reader Content */}
              <div className="max-w-4xl mx-auto px-6 py-20">
                <div 
                  className="text-white/90 transition-all duration-300 text-right"
                  style={{ 
                    fontSize: `${readerSettings.fontSize}px`,
                    lineHeight: readerSettings.lineHeight,
                    fontWeight: readerSettings.fontWeight
                  }}
                >
                  {readingChapter.content.split(/(\[https?:\/\/[^\]]+\])/g).map((part, i) => {
                    const match = part.match(/\[(https?:\/\/[^\]]+)\]/);
                    if (match) {
                      const url = match[1];
                      return (
                        <div key={i} className="my-8 flex justify-center">
                          <img 
                            src={url} 
                            alt="Chapter visual" 
                            className="max-w-full rounded-2xl shadow-2xl border border-white/10"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      );
                    }
                    return <p key={i} className="mb-4 whitespace-pre-wrap">{part}</p>;
                  })}
                </div>

                {/* Reader Footer Navigation */}
                <div className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 pb-20">
                  <button 
                    disabled={!getPrevChapter(readingChapter)}
                    onClick={() => {
                      const prev = getPrevChapter(readingChapter);
                      if (prev) {
                        setReadingChapter(prev);
                        window.scrollTo(0, 0);
                      }
                    }}
                    className="w-full md:w-auto px-10 py-5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black flex items-center justify-center gap-3 transition-all disabled:opacity-20"
                  >
                    <ChevronRight className="w-5 h-5" />
                    الفصل السابق
                  </button>
                  
                  <div className="text-white/20 font-black text-sm uppercase tracking-widest">
                    الفصل {readingChapter.order}
                  </div>

                  <button 
                    disabled={!getNextChapter(readingChapter)}
                    onClick={() => {
                      const next = getNextChapter(readingChapter);
                      if (next) {
                        setReadingChapter(next);
                        window.scrollTo(0, 0);
                      }
                    }}
                    className="w-full md:w-auto px-10 py-5 rounded-2xl bg-[#F87171] hover:bg-[#EF4444] text-[#121212] font-black flex items-center justify-center gap-3 transition-all shadow-xl shadow-[#F87171]/20 disabled:opacity-20"
                  >
                    الفصل التالي
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Reader Settings Modal */}
          <AnimatePresence>
            {showReaderSettings && (
              <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-[#1e1e1e] w-full max-w-md rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <button 
                      onClick={() => setShowReaderSettings(false)}
                      className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-xl transition-all"
                    >
                      <X className="w-5 h-5 text-white/40" />
                    </button>
                    <div className="flex items-center gap-3">
                      <h3 className="font-black text-white uppercase">إعدادات القراءة</h3>
                      <div className="w-10 h-10 bg-[#F87171]/20 rounded-xl flex items-center justify-center">
                        <Type className="w-5 h-5 text-[#F87171]" />
                      </div>
                    </div>
                  </div>

                  <div className="p-10 space-y-10">
                    {/* Font Size */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-black text-xs">{readerSettings.fontSize}px</span>
                        <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">حجم الخط</label>
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setReaderSettings(p => ({ ...p, fontSize: Math.max(12, p.fontSize - 1) }))}
                          className="w-12 h-12 rounded-xl bg-[#121212] border border-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        <input 
                          type="range"
                          min="12"
                          max="60"
                          value={readerSettings.fontSize}
                          onChange={e => setReaderSettings(p => ({ ...p, fontSize: parseInt(e.target.value) }))}
                          className="flex-1 accent-[#F87171] h-1 bg-white/5 rounded-full appearance-none cursor-pointer"
                        />
                         <button 
                          onClick={() => setReaderSettings(p => ({ ...p, fontSize: Math.min(60, p.fontSize + 1) }))}
                          className="w-12 h-12 rounded-xl bg-[#121212] border border-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Line Height */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-black text-xs">{readerSettings.lineHeight}</span>
                        <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">تباعد السطور</label>
                      </div>
                      <input 
                        type="range"
                        min="1"
                        max="3"
                        step="0.1"
                        value={readerSettings.lineHeight}
                        onChange={e => setReaderSettings(p => ({ ...p, lineHeight: parseFloat(e.target.value) }))}
                        className="w-full accent-[#F87171] h-1 bg-white/5 rounded-full appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Font Weight */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">ثقل الخط</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['400', '600', '900'].map(weight => (
                          <button
                            key={weight}
                            onClick={() => setReaderSettings(p => ({ ...p, fontWeight: weight }))}
                            className={`py-3 rounded-xl border font-black text-xs transition-all ${
                              readerSettings.fontWeight === weight 
                                ? 'bg-[#F87171] border-[#F87171] text-[#121212]' 
                                : 'bg-[#121212] border-white/5 text-white/40 hover:text-white'
                            }`}
                          >
                            {weight === '400' ? 'نحيف' : weight === '600' ? 'متوسط' : 'عريض'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Edit Novel View */}
          {view === 'edit-novel' && editingNovel && (
            <motion.div 
              key="edit-novel"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-7xl mx-auto"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setView(editingNovel.id ? 'chapters' : 'novels')}
                    className="w-12 h-12 flex items-center justify-center bg-[#1e1e1e] border border-white/5 rounded-2xl hover:bg-white/5 transition-all shadow-sm group"
                  >
                    <ArrowLeft className="w-6 h-6 text-white/40 group-hover:text-white transition-colors" />
                  </button>
                  <div>
                    <h2 className="text-3xl font-black text-white">{editingNovel.id ? 'تعديل الرواية' : 'إضافة رواية جديدة'}</h2>
                    <p className="text-white/30 text-xs font-bold uppercase tracking-widest mt-1">لوحة التحكم / الروايات</p>
                  </div>
                </div>
              </div>

              <form onSubmit={saveNovel} className="space-y-10 pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  {/* Right Column (Start): Main Form Fields */}
                  <div className="lg:col-span-8 space-y-8">
                    {/* Basic Information Section */}
                    <div className="bg-[#1e1e1e] p-10 rounded-[2.5rem] border border-white/5 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-[#F87171]/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
                      
                      <div className="flex items-center gap-3 mb-8 relative z-10">
                        <div className="w-10 h-10 bg-[#F87171]/10 rounded-xl flex items-center justify-center border border-[#F87171]/20">
                          <Book className="w-5 h-5 text-[#F87171]" />
                        </div>
                        <h3 className="text-lg font-black text-white">المعلومات الأساسية</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-3">اسم الرواية</label>
                          <input 
                            type="text"
                            required
                            value={editingNovel.name}
                            onChange={e => setEditingNovel({...editingNovel, name: e.target.value})}
                            className="w-full px-6 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all font-bold placeholder:text-white/10"
                            placeholder="أدخل اسم الرواية بالكامل..."
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-3">اسم الكاتب</label>
                          <input 
                            type="text"
                            required
                            value={editingNovel.author}
                            onChange={e => setEditingNovel({...editingNovel, author: e.target.value})}
                            className="w-full px-6 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all font-bold"
                            placeholder="اسم المؤلف..."
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-3">التقييم (من 5)</label>
                          <div className="relative">
                            <input 
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={editingNovel.rating || 0}
                              onChange={e => setEditingNovel({...editingNovel, rating: parseFloat(e.target.value)})}
                              className="w-full px-6 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all font-bold"
                            />
                            <Star className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-yellow-500 fill-current opacity-20" />
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-3">وصف الرواية</label>
                          <textarea 
                            required
                            rows={8}
                            value={editingNovel.description}
                            onChange={e => setEditingNovel({...editingNovel, description: e.target.value})}
                            className="w-full px-6 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all leading-relaxed resize-none font-medium text-sm scrollbar-hide"
                            placeholder="اكتب ملخصاً مشوقاً للرواية..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cover Images Section */}
                    <div className="bg-[#1e1e1e] p-10 rounded-[2.5rem] border border-white/5 shadow-xl">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                            <ImageIcon className="w-5 h-5 text-blue-400" />
                          </div>
                          <h3 className="text-lg font-black text-white">صور الغلاف</h3>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <AnimatePresence mode="popLayout">
                          {(editingNovel.coverImages || ['']).map((url, idx) => (
                            <motion.div 
                              key={idx}
                              layout
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className="flex gap-4 group"
                            >
                              <div className="relative flex-1">
                                <input 
                                  type="url"
                                  value={url}
                                  onChange={e => {
                                    const newCovers = [...(editingNovel.coverImages || [''])];
                                    newCovers[idx] = e.target.value;
                                    setEditingNovel({...editingNovel, coverImages: newCovers});
                                  }}
                                  className="w-full pl-6 pr-14 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all font-mono text-xs overflow-hidden text-ellipsis"
                                  placeholder={`رابط الصورة ${idx + 1}...`}
                                />
                                <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none text-white/20 group-focus-within:text-[#F87171] transition-colors">
                                  <Link className="w-4 h-4" />
                                </div>
                              </div>
                              {(editingNovel.coverImages || ['']).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newCovers = [...(editingNovel.coverImages || [''])];
                                    newCovers.splice(idx, 1);
                                    setEditingNovel({...editingNovel, coverImages: newCovers});
                                  }}
                                  className="w-16 h-16 flex items-center justify-center bg-red-500/10 text-red-500 rounded-2xl border border-red-500/10 hover:bg-red-500 hover:text-white transition-all active:scale-90"
                                >
                                  <Minus className="w-5 h-5" />
                                </button>
                              )}
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const newCovers = [...(editingNovel.coverImages || ['']), ''];
                            setEditingNovel({...editingNovel, coverImages: newCovers});
                          }}
                          className="w-full py-5 flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/5 text-white/20 hover:border-[#F87171]/40 hover:text-[#F87171] hover:bg-[#F87171]/5 transition-all group mt-2"
                        >
                          <Plus className="w-5 h-5 group-hover:scale-125 transition-transform" />
                          <span className="text-sm font-black uppercase tracking-widest">غلاف إضافي</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Left Column (End): Sidebar & Preview */}
                  <div className="lg:col-span-4 space-y-8">
                    {/* Status & Options Section */}
                    <div className="bg-[#1e1e1e] p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
                          <Settings className="w-5 h-5 text-purple-400" />
                        </div>
                        <h3 className="text-lg font-black text-white">الإعدادات</h3>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-3">حالة الرواية</label>
                          <CustomSelect 
                            value={editingNovel.status || 'مستمرة'}
                            onChange={val => setEditingNovel({...editingNovel, status: val})}
                            options={[
                              { value: 'مستمرة', label: 'مستمرة' },
                              { value: 'متوقفة', label: 'متوقفة' },
                              { value: 'مكتملة', label: 'مكتملة' }
                            ]}
                          />
                        </div>

                        <div className="flex flex-col gap-3">
                          <button
                            type="button"
                            onClick={() => setEditingNovel({...editingNovel, isAdult: !editingNovel.isAdult})}
                            className={`flex items-center justify-between px-6 py-5 rounded-2xl border transition-all group ${
                              editingNovel.isAdult 
                                ? 'bg-red-500/10 border-red-500/40 text-red-500' 
                                : 'bg-[#121212] border-white/5 text-white/40 hover:border-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {editingNovel.isAdult ? <XCircle className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                              <span className="font-bold text-sm">محتوى للكبار (+18)</span>
                            </div>
                            {editingNovel.isAdult && <Check className="w-4 h-4 animate-in fade-in zoom-in" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingNovel({...editingNovel, isDraft: !editingNovel.isDraft})}
                            className={`flex items-center justify-between px-6 py-5 rounded-2xl border transition-all group ${
                              editingNovel.isDraft 
                                ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500' 
                                : 'bg-[#121212] border-white/5 text-white/40 hover:border-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {editingNovel.isDraft ? <FileText className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                              <span className="font-bold text-sm">حفظ كمسودة</span>
                            </div>
                            {editingNovel.isDraft && <Check className="w-4 h-4" />}
                          </button>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-4">التصنيفات</label>
                          <div className="flex flex-wrap gap-2 p-1">
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
                                  className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all border shadow-sm ${
                                    isSelected 
                                      ? 'bg-[#F87171] text-[#121212] border-[#F87171] scale-110' 
                                      : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'
                                  }`}
                                >
                                  {cat.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Preview Section - Sidebar Version */}
                    <div className="p-8 bg-[#121212] rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-[#F87171]/5 rounded-full blur-[80px] -mr-24 -mt-24 pointer-events-none" />
                      
                      <div className="flex items-center gap-3 mb-8 relative z-10">
                        <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20">
                          <Eye className="w-5 h-5 text-green-400" />
                        </div>
                        <h3 className="text-lg font-black text-white">معاينة مباشرة</h3>
                      </div>
                      
                      <div className="space-y-8 relative z-10">
                        <div className="w-full aspect-[2/3] flex items-center justify-center rounded-3xl overflow-hidden group-hover:scale-[1.02] transition-transform duration-700">
                          <CoverSlider images={editingNovel.coverImages || []} />
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-3">
                            <h3 className="font-black text-2xl text-white leading-tight group-hover:text-[#F87171] transition-colors">
                              {editingNovel.name || 'عنوان الرواية'}
                            </h3>
                            <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                              بواسطة: {editingNovel.author || 'اسم الكاتب'}
                            </p>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5 text-yellow-500 bg-yellow-500/10 px-3 py-1.5 rounded-xl border border-yellow-500/20 shadow-sm">
                              <Star className="w-3.5 h-3.5 fill-current" />
                              <span className="text-sm font-black">{editingNovel.rating || '0.0'}</span>
                            </div>
                            <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                              editingNovel.status === 'مكتملة' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                              editingNovel.status === 'متوقفة' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                              'bg-[#F87171]/10 border-[#F87171]/20 text-[#F87171]'
                            }`}>
                              {editingNovel.status || 'مستمرة'}
                            </div>
                          </div>

                          <div className="pt-6 border-t border-white/5">
                            <h4 className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5" />
                              الملخص
                            </h4>
                            <div className="text-xs text-white/40 leading-relaxed line-clamp-6 bg-[#0a0a0a]/40 p-5 rounded-[1.5rem] border border-white/5 italic font-medium">
                              {editingNovel.description || 'اكتب وصفاً للرواية لتظهر المعاينة هنا...'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fixed Action Bar */}
                <div className="fixed bottom-0 left-0 right-0 z-[100] p-6 flex justify-center pointer-events-none">
                  <motion.div 
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    className="max-w-4xl w-full bg-[#1e1e1e]/80 backdrop-blur-2xl border border-white/10 p-4 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] flex items-center gap-4 pointer-events-auto"
                  >
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-3 bg-[#F87171] hover:bg-[#EF4444] text-[#121212] font-black py-5 rounded-[1.8rem] transition-all shadow-xl shadow-[#F87171]/20 disabled:opacity-50 group active:scale-95"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                      حفظ التغييرات
                    </button>
                    
                    {editingNovel.id && (
                      <button 
                        type="button"
                        onClick={() => deleteNovel(editingNovel.id!)}
                        className="w-16 h-16 flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-[1.8rem] transition-all border border-red-500/10 active:scale-90"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                    )}

                    <button 
                      type="button"
                      onClick={() => setView('novels')}
                      className="px-8 py-5 font-black text-white/40 hover:text-white hover:bg-white/5 rounded-[1.8rem] transition-all"
                    >
                      إلغاء
                    </button>
                  </motion.div>
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
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setView('chapters')}
                    className="w-12 h-12 flex items-center justify-center bg-[#1e1e1e] border border-white/5 rounded-2xl hover:bg-white/5 transition-all shadow-sm group"
                  >
                    <ArrowLeft className="w-6 h-6 text-white/40 group-hover:text-white transition-colors" />
                  </button>
                  <div>
                    <h2 className="text-3xl font-black text-white">{editingChapter.id ? 'تعديل الفصل' : 'إضافة فصل جديد'}</h2>
                    <p className="text-white/30 text-xs font-bold uppercase tracking-widest mt-1">لوحة التحكم / الفصول / {selectedNovel?.name}</p>
                  </div>
                </div>
              </div>

              <form onSubmit={saveChapter} className="space-y-10 pb-20">
                {/* Chapter Settings Card */}
                <div className="bg-[#1e1e1e] p-10 rounded-[2.5rem] border border-white/5 shadow-xl relative">
                  <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px] -ml-32 -mt-32 pointer-events-none" />
                  
                  <div className="flex items-center gap-3 mb-10 relative z-10">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                      <Settings2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-black text-white">إعدادات الفصل</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 relative z-10">
                    <div className="md:col-span-5">
                      <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-3">عنوان الفصل</label>
                      <div className="relative group">
                        <input 
                          type="text"
                          required
                          value={editingChapter.title}
                          onChange={e => setEditingChapter({...editingChapter, title: e.target.value})}
                          className="w-full pl-6 pr-14 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all font-bold"
                          placeholder="أدخل عنوان الفصل..."
                        />
                        <Type className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#F87171] transition-colors" />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-3">الترتيب</label>
                      <div className="relative group">
                        <input 
                          type="number"
                          required
                          value={editingChapter.order}
                          onChange={e => setEditingChapter({...editingChapter, order: parseInt(e.target.value)})}
                          className="w-full pl-6 pr-14 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all font-bold"
                        />
                        <Hash className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#F87171] transition-colors" />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-3">التاريخ</label>
                      <div className="relative group">
                        <input 
                          type="text"
                          value={editingChapter.date || ''}
                          onChange={e => setEditingChapter({...editingChapter, date: e.target.value})}
                          className="w-full pl-6 pr-14 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all font-bold"
                          placeholder="13/3/2026"
                        />
                        <Calendar className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#F87171] transition-colors" />
                      </div>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-3">المجلد</label>
                      <CustomSelect 
                        value={editingChapter.volumeId || ''}
                        onChange={val => setEditingChapter({...editingChapter, volumeId: val})}
                        placeholder="فصل عام (بدون مجلد)"
                        options={[
                          { value: '', label: 'فصل عام (بدون مجلد)' },
                          ...(selectedNovel?.volumes?.map(vol => ({ value: vol.id, label: vol.name })) || [])
                        ]}
                      />
                    </div>

                    <div className="md:col-span-12 flex flex-wrap gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => setEditingChapter({...editingChapter, isEndOfVolume: !editingChapter.isEndOfVolume})}
                        className={`flex items-center gap-3 px-8 py-4 rounded-2xl border transition-all font-black text-[10px] uppercase tracking-widest ${
                          editingChapter.isEndOfVolume 
                            ? 'bg-[#F87171]/10 border-[#F87171]/40 text-[#F87171]' 
                            : 'bg-[#121212] border-white/5 text-white/20 hover:border-white/10 hover:text-white'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded shadow-inner flex items-center justify-center border ${editingChapter.isEndOfVolume ? 'bg-[#F87171] border-transparent' : 'bg-transparent border-white/10 text-transparent'}`}>
                          <Check className="w-3 h-3 text-[#121212]" />
                        </div>
                        نهاية المجلد
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingChapter({...editingChapter, isDraft: !editingChapter.isDraft})}
                        className={`flex items-center gap-3 px-8 py-4 rounded-2xl border transition-all font-black text-[10px] uppercase tracking-widest ${
                          editingChapter.isDraft 
                            ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500' 
                            : 'bg-[#121212] border-white/5 text-white/20 hover:border-white/10 hover:text-white'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded shadow-inner flex items-center justify-center border ${editingChapter.isDraft ? 'bg-yellow-500 border-transparent' : 'bg-transparent border-white/10 text-transparent'}`}>
                          <Check className="w-3 h-3 text-[#121212]" />
                        </div>
                        مسودة
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content Area Section */}
                <div className="bg-[#1e1e1e] p-10 rounded-[2.5rem] border border-white/5 shadow-xl relative overflow-hidden">
                  <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#F87171]/5 rounded-full blur-[100px] -mr-32 -mb-32 pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F87171]/10 rounded-xl flex items-center justify-center border border-[#F87171]/20">
                        <FileText className="w-5 h-5 text-[#F87171]" />
                      </div>
                      <h3 className="text-lg font-black text-white">محتوى الفصل</h3>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-[10px] text-white/20 font-black uppercase tracking-[0.2em] hidden sm:block">يدعم تنسيق Markdown لجمال أكبر</span>
                      <button
                        type="button"
                        onClick={() => setShowImagePopup(true)}
                        className="flex items-center gap-3 px-6 py-4 bg-[#F87171] hover:bg-[#EF4444] text-[#121212] rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[#F87171]/20 group active:scale-95"
                      >
                        <ImageIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        إدراج صورة
                      </button>
                    </div>
                  </div>
                  
                  <div className="relative group z-10">
                    <div className="absolute inset-0 bg-[#0a0a0a]/50 rounded-[2rem] blur-2xl -z-10 group-focus-within:bg-[#F87171]/5 transition-colors" />
                    <textarea 
                      ref={textareaRef}
                      required
                      rows={25}
                      value={editingChapter.content}
                      onChange={e => setEditingChapter({...editingChapter, content: e.target.value})}
                      className="w-full px-10 py-10 rounded-[2.5rem] border border-white/5 bg-[#121212]/90 text-white/90 focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all leading-[2] resize-none font-medium text-lg scrollbar-hide shadow-inner"
                      placeholder="ابدأ بكتابة إبداعك هنا مستخدماً Markdown..."
                    />
                    <div className="absolute bottom-10 left-10 text-[10px] font-black text-white/10 uppercase tracking-widest pointer-events-none">
                      {editingChapter.content.length} حرف تقريباً
                    </div>
                  </div>
                </div>

                {/* Fixed Action Bar */}
                <div className="fixed bottom-0 left-0 right-0 z-[100] p-6 flex justify-center pointer-events-none">
                  <motion.div 
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    className="max-w-4xl w-full bg-[#1e1e1e]/80 backdrop-blur-2xl border border-white/10 p-4 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] flex items-center gap-4 pointer-events-auto"
                  >
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-3 bg-[#F87171] hover:bg-[#EF4444] text-[#121212] font-black py-5 rounded-[1.8rem] transition-all shadow-xl shadow-[#F87171]/20 disabled:opacity-50 group active:scale-95"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                      حفظ الفصل
                    </button>
                    
                    {editingChapter.id && (
                      <button 
                        type="button"
                        onClick={() => deleteChapter(editingChapter.id!)}
                        className="w-16 h-16 flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-[1.8rem] transition-all border border-red-500/10 active:scale-90"
                        title="حذف الفصل نهائياً"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                    )}

                    <button 
                      type="button"
                      onClick={() => setView('chapters')}
                      className="px-8 py-5 font-black text-white/40 hover:text-white hover:bg-white/5 rounded-[1.8rem] transition-all"
                    >
                      إلغاء
                    </button>
                  </motion.div>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modern Dark Footer */}
      <footer className="py-8 border-t border-white/5 mt-20 bg-[#1e1e1e]">
        <div className="max-w-7xl mx-auto px-6 flex justify-center">
          <p className="text-white/40 text-sm font-bold tracking-widest uppercase">صنع بواسطة شادي أبودنيا</p>
        </div>
      </footer>

      {/* Volume Creation Popup */}
      <AnimatePresence>
        {showVolumePopup && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#1e1e1e] w-full max-w-md rounded-[2.5rem] border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                    <FolderPlus className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="font-black text-white uppercase tracking-tight">إضافة مجلد جديد</h3>
                </div>
                <button 
                  onClick={() => setShowVolumePopup(false)} 
                  className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-xl transition-all"
                >
                  <X className="w-5 h-5 text-white/40" />
                </button>
              </div>
              
              <div className="p-10 space-y-8">
                <div>
                  <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">اسم المجلد</label>
                  <div className="relative group">
                    <input 
                      type="text"
                      placeholder="مثال: المجلد الأول: البداية..."
                      value={newVolumeName}
                      onChange={e => setNewVolumeName(e.target.value)}
                      className="w-full px-6 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-bold group-hover:border-white/10"
                      autoFocus
                    />
                  </div>
                </div>
                <button 
                  onClick={addVolume}
                  disabled={!newVolumeName.trim()}
                  className="w-full py-5 bg-blue-500 hover:bg-blue-600 text-[#121212] font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50 active:scale-95"
                >
                  تأكيد الإضافة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Insertion Popup */}
      <AnimatePresence>
        {showImagePopup && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#1e1e1e] w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-[#F87171]/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#F87171]/20 rounded-xl flex items-center justify-center border border-[#F87171]/30">
                    <ImageIcon className="w-5 h-5 text-[#F87171]" />
                  </div>
                  <h3 className="font-black text-white uppercase tracking-tight">إدراج صورة للفصل</h3>
                </div>
                <button 
                  onClick={() => setShowImagePopup(false)} 
                  className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-xl transition-all"
                >
                  <X className="w-5 h-5 text-white/40" />
                </button>
              </div>
              
              <div className="p-10 space-y-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">رابط الصورة (URL)</label>
                    <div className="relative group">
                      <input 
                        type="url"
                        placeholder="الصق رابط الصورة هنا..."
                        value={imageUrl}
                        onChange={e => setImageUrl(e.target.value)}
                        className="w-full pl-6 pr-14 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all font-mono text-xs group-hover:border-white/10"
                        autoFocus
                      />
                      <Link className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#F87171] transition-colors w-4 h-4" />
                    </div>
                  </div>

                  {imageUrl && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="aspect-video bg-[#0a0a0a] rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center"
                    >
                      <img 
                        src={imageUrl} 
                        alt="Preview" 
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/400x225?text=Invalid+Image+URL')}
                      />
                    </motion.div>
                  )}

                  <button 
                    onClick={() => imageUrl && insertImage(imageUrl)}
                    disabled={!imageUrl}
                    className="w-full py-5 bg-[#F87171] hover:bg-[#EF4444] text-[#121212] font-black rounded-2xl transition-all shadow-xl shadow-[#F87171]/20 disabled:opacity-50 active:scale-95"
                  >
                    إدراج في المحتوى
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-10 cursor-zoom-out"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={lightboxImage} 
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                alt="Enlarged view"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setLightboxImage(null)}
                className="absolute top-0 right-0 -translate-y-full md:translate-y-0 md:translate-x-full mb-4 md:mb-0 md:ml-4 p-4 text-white/40 hover:text-white transition-colors"
                title="إغلاق"
              >
                <X className="w-8 h-8" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
