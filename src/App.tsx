/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Check,
  Maximize2,
  Minimize2,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const validImages = images.filter(img => img && img.trim() !== '');

  useEffect(() => {
    if (validImages.length <= 1) return;
    
    setProgress(0);
    const duration = 10000; // 10 seconds
    const interval = 100; // update every 100ms
    
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setCurrentIndex(curr => (curr + 1) % validImages.length);
          return 0;
        }
        return prev + (interval / duration) * 100;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [validImages.length, currentIndex]);

  if (validImages.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a] text-slate-800">
        <ImageIcon className="w-12 h-12 opacity-20" />
      </div>
    );
  }

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % validImages.length);
    setProgress(0);
  };

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
    setProgress(0);
  };

  return (
    <div className="relative w-full h-full group overflow-hidden rounded-[2.5rem] bg-[#0a0a0a] shadow-2xl border border-white/5">
      {/* Dynamic Background Layer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${currentIndex}`}
          initial={{ opacity: 0, scale: 1.2 }}
          animate={{ opacity: 0.4, scale: 1.1 }}
          exit={{ opacity: 0, scale: 1.2 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0 z-0"
        >
          <img 
            src={validImages[currentIndex]} 
            className="w-full h-full object-cover blur-[60px] saturate-150"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/40 to-[#0a0a0a]" />
        </motion.div>
      </AnimatePresence>

      {/* Main Image Stage */}
      <div className="relative w-full h-full flex items-center justify-center p-6 z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1, y: -20 }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className="relative w-full h-full flex items-center justify-center"
          >
            {/* Subtle Glow behind image */}
            <div className="absolute inset-0 bg-white/5 blur-[100px] rounded-full scale-75" />
            
            <motion.img 
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              src={validImages[currentIndex]} 
              alt={`Cover ${currentIndex + 1}`} 
              className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] border border-white/10"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Premium Controls */}
      {validImages.length > 1 && (
        <>
          <div className="absolute inset-y-0 left-0 w-24 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <button 
              onClick={prev}
              className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all hover:scale-110 active:scale-95"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
          
          <div className="absolute inset-y-0 right-0 w-24 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <button 
              onClick={next}
              className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all hover:scale-110 active:scale-95"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Progress & Pagination */}
          <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-4 z-20">
            <div className="flex gap-2">
              {validImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                    setProgress(0);
                  }}
                  className="group relative py-2"
                >
                  <div className={`h-1 rounded-full transition-all duration-500 ${
                    idx === currentIndex ? 'bg-[#F87171] w-8' : 'bg-white/20 w-2 hover:bg-white/40'
                  }`} />
                </button>
              ))}
            </div>
            
            {/* Auto-play Progress Bar */}
            <div className="w-32 h-[2px] bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-[#F87171]/40"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1, ease: "linear" }}
              />
            </div>
          </div>
        </>
      )}
      
      {/* Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-10" />
    </div>
  );
};

const ChapterRow = ({ 
  chapter, 
  index, 
  onPreview, 
  onEdit, 
  onDelete 
}: { 
  chapter: Chapter, 
  index: number, 
  onPreview: (c: Chapter) => void, 
  onEdit: (c: Chapter) => void, 
  onDelete: (id: string) => void 
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-[#1e1e1e] p-5 rounded-2xl border border-white/5 flex items-center justify-between hover:border-[#F87171]/30 transition-all group shadow-sm"
    >
      <div className="flex items-center gap-5 cursor-pointer flex-1" onClick={() => onPreview(chapter)}>
        <div className="w-12 h-12 bg-[#121212] rounded-xl flex items-center justify-center text-white/50 font-bold group-hover:bg-[#F87171]/10 group-hover:text-white transition-colors">
          {chapter.order}
        </div>
        <div>
          <h4 className="font-bold text-white mb-1 group-hover:text-white transition-colors">{chapter.title}</h4>
          <div className="flex items-center gap-3 text-[10px] text-white/50 font-bold uppercase tracking-widest">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {chapter.date}</span>
            <span className="w-1 h-1 bg-slate-700 rounded-full" />
            <span>{chapter.content.length} حرف</span>
            {chapter.isEndOfVolume && (
              <>
                <span className="w-1 h-1 bg-slate-700 rounded-full" />
                <span className="text-[#F87171]">نهاية المجلد</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <button 
          onClick={() => onPreview(chapter)}
          className="w-9 h-9 flex items-center justify-center text-white bg-white/5 hover:bg-[#F87171] hover:text-[#121212] hover:scale-110 rounded-[0.8rem] border border-white/5 transition-all shadow-sm"
          title="معاينة"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button 
          onClick={() => onEdit(chapter)}
          className="w-9 h-9 flex items-center justify-center text-white bg-white/5 hover:bg-[#F87171] hover:text-[#121212] hover:scale-110 rounded-[0.8rem] border border-white/5 transition-all shadow-sm"
          title="تعديل"
        >
          <Edit className="w-4 h-4" />
        </button>
        <button 
          onClick={() => onDelete(chapter.id)}
          className="w-9 h-9 flex items-center justify-center text-white bg-white/5 hover:bg-red-500 hover:text-[#121212] hover:border-red-500 hover:scale-110 rounded-[0.8rem] border border-white/5 transition-all shadow-sm"
          title="حذف"
        >
          <Trash2 className="w-4 h-4" />
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
            <p className="text-white/50 text-xs font-bold uppercase tracking-widest">الفصل {chapter.order}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl hover:bg-white/10 transition-all text-white/60 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 md:p-16 scrollbar-hide bg-[#121212]/30">
          <div className="max-w-3xl mx-auto">
            <div className="novel-reader-content text-white/70 leading-[2.4] text-sm md:text-base font-sans text-justify">
              <Markdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  img: ({ src, alt }) => (
                    <div className="my-12 flex flex-col items-center">
                      <img 
                        src={src} 
                        alt={alt || 'Chapter Image'} 
                        className="rounded-[2rem] shadow-2xl max-w-full border border-white/5 hover:scale-[1.01] transition-transform duration-700" 
                        referrerPolicy="no-referrer"
                      />
                      {alt && alt !== 'image' && <span className="mt-5 text-[10px] text-white/20 font-black uppercase tracking-[0.3em]">{alt}</span>}
                    </div>
                  ),
                  p: ({ children }) => <div className="mb-10 last:mb-0">{children}</div>,
                  h1: ({ children }) => <h1 className="text-3xl font-black text-white mb-8 mt-16 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-2xl font-black text-white mb-6 mt-12 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-xl font-black text-white mb-4 mt-10 first:mt-0">{children}</h3>,
                  hr: () => <hr className="my-16 border-white/5" />,
                  blockquote: ({ children }) => (
                    <blockquote className="border-r-4 border-[#F87171] pr-6 my-10 italic text-white/50">
                      {children}
                    </blockquote>
                  ),
                  ul: ({ children }) => <ul className="list-disc pr-6 mb-10 space-y-3">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pr-6 mb-10 space-y-3">{children}</ol>,
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

// --- Mobile Reader Components ---

const MobileReader = ({ 
  novels, 
  categories, 
  onNovelSelect,
  user,
  onLogin,
  isAdmin,
  onSwitchToDashboard
}: { 
  novels: Novel[], 
  categories: Category[],
  onNovelSelect: (novel: Novel) => void,
  user: User | null,
  onLogin: () => void,
  isAdmin: boolean,
  onSwitchToDashboard: () => void
}) => {
  const [readerView, setReaderView] = useState<'home' | 'novel-details' | 'reading'>('home');
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [fontSize, setFontSize] = useState(18);
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>('dark');
  const [isFocusMode, setIsFocusMode] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      Swal.fire({
        title: 'تم النسخ!',
        text: 'تم نسخ محتوى الفصل إلى الحافظة بنجاح.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        background: theme === 'dark' ? '#1e1e1e' : '#fff',
        color: theme === 'dark' ? '#fff' : '#000',
      });
    } catch (err) {
      console.error('Failed to copy: ', err);
      Swal.fire({
        title: 'خطأ!',
        text: 'فشل نسخ المحتوى. يرجى المحاولة مرة أخرى.',
        icon: 'error',
        background: theme === 'dark' ? '#1e1e1e' : '#fff',
        color: theme === 'dark' ? '#fff' : '#000',
      });
    }
  };

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Fetch chapters when novel is selected
  useEffect(() => {
    if (selectedNovel) {
      setLoadingChapters(true);
      const q = query(collection(db, 'chapters'), orderBy('order', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allChapters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chapter));
        const novelChapters = allChapters.filter(c => c.novelId === selectedNovel.id);
        setChapters(novelChapters);
        setLoadingChapters(false);
      });
      return () => unsubscribe();
    }
  }, [selectedNovel]);

  const filteredNovels = novels.filter(novel => {
    const matchesSearch = novel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         novel.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'الكل' || novel.categories?.includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const getWordCount = (content: string) => {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleNovelClick = (novel: Novel) => {
    setSelectedNovel(novel);
    setReaderView('novel-details');
    window.scrollTo(0, 0);
  };

  const handleChapterClick = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    setReaderView('reading');
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    if (readerView === 'reading') setReaderView('novel-details');
    else if (readerView === 'novel-details') setReaderView('home');
    window.scrollTo(0, 0);
  };

  const nextChapter = () => {
    if (!selectedChapter) return;
    const currentIndex = chapters.findIndex(c => c.id === selectedChapter.id);
    if (currentIndex < chapters.length - 1) {
      setSelectedChapter(chapters[currentIndex + 1]);
      window.scrollTo(0, 0);
    }
  };

  const prevChapter = () => {
    if (!selectedChapter) return;
    const currentIndex = chapters.findIndex(c => c.id === selectedChapter.id);
    if (currentIndex > 0) {
      setSelectedChapter(chapters[currentIndex - 1]);
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${
      theme === 'dark' ? 'bg-[#0a0a0a] text-white' : 
      theme === 'sepia' ? 'bg-[#f4ecd8] text-[#5b4636]' : 
      'bg-white text-gray-900'
    }`}>
      {/* Vignette Effect for Reading Mode */}
      {readerView === 'reading' && (
        <div className={`fixed inset-0 pointer-events-none z-[45] transition-opacity duration-1000 ${
          isFocusMode ? 'opacity-100' : 'opacity-60'
        } ${
          theme === 'dark' 
            ? 'bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]' 
            : 'bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.15)_100%)]'
        }`} />
      )}

      {/* Mobile Top Bar */}
      <AnimatePresence>
        {!isFocusMode && (
          <motion.header 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-xl border-b flex items-center justify-between ${
              theme === 'dark' ? 'bg-[#0a0a0a]/80 border-white/5' : 
              theme === 'sepia' ? 'bg-[#f4ecd8]/80 border-[#5b4636]/10' : 
              'bg-white/80 border-gray-100'
            }`}
          >
            {readerView === 'reading' && (
              <motion.div 
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F87171] origin-left"
                style={{ scaleX }}
              />
            )}
            <div className="flex items-center gap-3">
              {readerView !== 'home' && (
                <button onClick={goBack} className="p-2 -mr-2">
                  <ArrowLeft className="w-6 h-6" />
                </button>
              )}
              <span className="font-black text-xl tracking-tight" style={{ fontFamily: "'New Rocker', system-ui" }}>
                {readerView === 'reading' ? selectedChapter?.title : 'NovelVerse'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {readerView === 'reading' && (
                <>
                  <button 
                    onClick={() => selectedChapter && copyToClipboard(selectedChapter.content)}
                    className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
                    title="نسخ المحتوى"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setIsFocusMode(true)}
                    className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
                    title="وضع التركيز"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                </>
              )}
              {isAdmin && (
                <button 
                  onClick={onSwitchToDashboard}
                  className="p-2 bg-[#F87171]/10 text-[#F87171] rounded-xl border border-[#F87171]/20"
                >
                  <LayoutDashboard className="w-5 h-5" />
                </button>
              )}
              {!user ? (
                <button onClick={onLogin} className="p-2">
                  <LogIn className="w-6 h-6" />
                </button>
              ) : (
                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10">
                  <img src={user.photoURL || ''} alt={user.displayName || ''} />
                </div>
              )}
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Exit Focus Mode & Copy Button */}
      <AnimatePresence>
        {isFocusMode && (
          <div className="fixed top-6 right-6 z-[60] flex flex-col gap-4">
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              onClick={() => setIsFocusMode(false)}
              className="w-12 h-12 bg-[#F87171] text-[#0a0a0a] rounded-full flex items-center justify-center shadow-2xl shadow-[#F87171]/40"
              title="خروج من وضع التركيز"
            >
              <Minimize2 className="w-6 h-6" />
            </motion.button>
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              onClick={() => selectedChapter && copyToClipboard(selectedChapter.content)}
              className="w-12 h-12 bg-white/10 backdrop-blur-md text-white rounded-full flex items-center justify-center border border-white/20 shadow-2xl"
              title="نسخ المحتوى"
            >
              <Copy className="w-5 h-5" />
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      <main className={`transition-all duration-500 ${isFocusMode ? 'pt-10' : 'pt-24'} pb-32 px-6 max-w-2xl mx-auto`}>
        <AnimatePresence mode="wait">
          {readerView === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Search & Categories */}
              <div className="space-y-6">
                <div className="relative group">
                  <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#F87171] transition-colors" />
                  <input 
                    type="text"
                    placeholder="ابحث عن روايتك المفضلة..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pr-14 pl-6 py-5 bg-white/5 border border-white/5 rounded-3xl focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all text-sm font-bold"
                  />
                </div>
                
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {['الكل', ...categories.map(c => c.name)].map((cat, idx) => (
                    <button
                      key={`${cat}-${idx}`}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-6 py-3 rounded-2xl text-xs font-black whitespace-nowrap transition-all border ${
                        selectedCategory === cat 
                          ? 'bg-[#F87171] border-[#F87171] text-[#0a0a0a]' 
                          : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Novel Grid */}
              <div className="grid grid-cols-2 gap-6">
                {filteredNovels.map(novel => (
                  <motion.div
                    key={novel.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleNovelClick(novel)}
                    className="space-y-3 group"
                  >
                    <div className="aspect-[2/3] rounded-3xl overflow-hidden border border-white/5 relative shadow-2xl">
                      <img 
                        src={novel.coverImages?.[0] || ''} 
                        alt={novel.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
                        <Star className="w-3 h-3 text-yellow-500 fill-current" />
                        <span className="text-[10px] font-black">{novel.rating || '0.0'}</span>
                      </div>
                    </div>
                    <h3 className="font-bold text-sm line-clamp-1 px-1">{novel.name}</h3>
                    <p className="text-[10px] text-white/40 px-1">{novel.author}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {readerView === 'novel-details' && selectedNovel && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-10"
            >
              {/* Hero Section */}
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-48 aspect-[2/3] rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10">
                  <img 
                    src={selectedNovel.coverImages?.[0] || ''} 
                    alt={selectedNovel.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black">{selectedNovel.name}</h2>
                  <p className="text-sm text-[#F87171] font-bold">{selectedNovel.author}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-black">{selectedNovel.rating || '0.0'}</span>
                    <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">التقييم</span>
                  </div>
                  <div className="w-px h-8 bg-white/5" />
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-black">{chapters.length}</span>
                    <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">فصل</span>
                  </div>
                  <div className="w-px h-8 bg-white/5" />
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-black">{selectedNovel.status}</span>
                    <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">الحالة</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/30">القصة</h3>
                <p className="text-sm leading-relaxed text-white/60 text-justify">
                  {selectedNovel.description}
                </p>
              </div>

              {/* Chapters List */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white/30">الفصول</h3>
                  <span className="text-[10px] font-bold text-[#F87171]">{chapters.length} فصل متوفر</span>
                </div>
                
                <div className="space-y-3">
                  {loadingChapters ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="w-8 h-8 animate-spin text-[#F87171]" />
                    </div>
                  ) : (
                    chapters.map(chapter => (
                      <button
                        key={chapter.id}
                        onClick={() => handleChapterClick(chapter)}
                        className="w-full flex items-center justify-between p-5 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-black text-white/20 group-hover:text-[#F87171] transition-colors">
                            {String(chapter.order).padStart(2, '0')}
                          </span>
                          <span className="text-sm font-bold">{chapter.title}</span>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {readerView === 'reading' && selectedChapter && (
            <motion.div
              key="reading"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onPanEnd={(_, info) => {
                const threshold = 100;
                if (info.offset.x > threshold) {
                  prevChapter();
                } else if (info.offset.x < -threshold) {
                  nextChapter();
                }
              }}
              className="space-y-10"
            >
              {/* Chapter Stats */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
                  <Clock className="w-3 h-3" />
                  <span>{Math.ceil(getWordCount(selectedChapter.content) / 200)} دقيقة قراءة</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-[#F87171] uppercase tracking-[0.2em]">
                  <FileText className="w-3 h-3" />
                  <span>{getWordCount(selectedChapter.content)} كلمة</span>
                </div>
              </div>

              {/* Reader Content */}
              <div 
                className="novel-reader-content"
                style={{ fontSize: `${fontSize}px` }}
              >
                <Markdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    img: ({ src, alt }) => (
                      <div className="my-10 flex flex-col items-center">
                        <img 
                          src={src} 
                          alt={alt || 'Chapter Image'} 
                          className="rounded-3xl shadow-2xl max-w-full border border-white/5" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ),
                    p: ({ children }) => <div className="mb-8 leading-relaxed text-justify">{children}</div>,
                    h1: ({ children }) => <h1 className="text-2xl font-black mb-6 mt-12">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl font-black mb-4 mt-10">{children}</h2>,
                  }}
                >
                  {processChapterContent(selectedChapter.content)}
                </Markdown>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-10 border-t border-white/5">
                <button 
                  onClick={prevChapter}
                  disabled={chapters.findIndex(c => c.id === selectedChapter.id) === 0}
                  className="flex items-center gap-2 px-6 py-4 bg-white/5 rounded-2xl font-bold text-sm disabled:opacity-20"
                >
                  <ChevronRight className="w-5 h-5" />
                  السابق
                </button>
                <button 
                  onClick={nextChapter}
                  disabled={chapters.findIndex(c => c.id === selectedChapter.id) === chapters.length - 1}
                  className="flex items-center gap-2 px-6 py-4 bg-[#F87171] text-[#0a0a0a] rounded-2xl font-bold text-sm disabled:opacity-20"
                >
                  التالي
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Reader Controls (Only in reading view) */}
      <AnimatePresence>
        {readerView === 'reading' && !isFocusMode && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className={`fixed bottom-0 left-0 right-0 z-50 p-6 border-t backdrop-blur-xl flex items-center justify-around ${
              theme === 'dark' ? 'bg-[#0a0a0a]/80 border-white/5' : 
              theme === 'sepia' ? 'bg-[#f4ecd8]/80 border-[#5b4636]/10' : 
              'bg-white/80 border-gray-100'
            }`}
          >
            <button onClick={() => setFontSize(f => Math.max(12, f - 2))} className="p-3 bg-white/5 rounded-xl">
              <span className="text-xs font-bold">A-</span>
            </button>
            <button onClick={() => setFontSize(f => Math.min(32, f + 2))} className="p-3 bg-white/5 rounded-xl">
              <span className="text-lg font-bold">A+</span>
            </button>
            <div className="flex gap-2">
              <button onClick={() => setTheme('dark')} className="w-8 h-8 rounded-full bg-[#0a0a0a] border border-white/20" />
              <button onClick={() => setTheme('sepia')} className="w-8 h-8 rounded-full bg-[#f4ecd8] border border-black/10" />
              <button onClick={() => setTheme('light')} className="w-8 h-8 rounded-full bg-white border border-black/10" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation (Only in home and details) */}
      <AnimatePresence>
        {readerView !== 'reading' && !isFocusMode && (
          <motion.nav 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className={`fixed bottom-0 left-0 right-0 z-50 px-8 py-6 border-t backdrop-blur-xl flex items-center justify-around ${
              theme === 'dark' ? 'bg-[#0a0a0a]/80 border-white/5' : 
              theme === 'sepia' ? 'bg-[#f4ecd8]/80 border-[#5b4636]/10' : 
              'bg-white/80 border-gray-100'
            }`}
          >
            <button onClick={() => setReaderView('home')} className={`flex flex-col items-center gap-1 ${readerView === 'home' ? 'text-[#F87171]' : 'text-white/30'}`}>
              <Home className="w-6 h-6" />
              <span className="text-[10px] font-bold">الرئيسية</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-white/30">
              <Library className="w-6 h-6" />
              <span className="text-[10px] font-bold">المكتبة</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-white/30">
              <BookOpen className="w-6 h-6" />
              <span className="text-[10px] font-bold">اكتشف</span>
            </button>
          </motion.nav>
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
  const [mode, setMode] = useState<'dashboard' | 'reader'>('reader');
  const [view, setView] = useState<'novels' | 'chapters' | 'edit-novel' | 'edit-chapter'>('novels');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [editingNovel, setEditingNovel] = useState<Partial<Novel> | null>(null);
  const [editingChapter, setEditingChapter] = useState<Partial<Chapter> | null>(null);
  const [previewChapter, setPreviewChapter] = useState<Chapter | null>(null);
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
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const isAdmin = user?.email === "shadyabdowd2020@gmail.com";

  useEffect(() => {
    if (isAdmin) {
      setMode('dashboard');
    } else {
      setMode('reader');
    }
  }, [isAdmin]);

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
      await signInWithPopup(auth, provider);
      Swal.fire({
        title: 'تم تسجيل الدخول!',
        text: 'مرحباً بك في NovelVerse',
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
          <h1 className="text-3xl font-normal text-white mb-3 tracking-wide" style={{ fontFamily: "'New Rocker', system-ui" }}>NovelVerse</h1>
          <p className="text-white/60 mb-8 leading-relaxed">لوحة التحكم الاحترافية لإدارة رواياتك وفصولك بكل سهولة وأناقة.</p>
          <button 
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-[#F87171] hover:bg-[#EF4444] text-[#121212] font-bold py-4 rounded-2xl transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            <LogIn className="w-5 h-5" />
            تسجيل الدخول باستخدام جوجل
          </button>
          <p className="mt-6 text-xs text-white/50">بواسطة NovelVerse Team</p>
        </motion.div>
      </div>
    );
  }

  if (mode === 'reader') {
    return (
      <MobileReader 
        novels={novels}
        categories={categories}
        onNovelSelect={(n) => {
          setSelectedNovel(n);
          setView('chapters');
        }}
        user={user}
        onLogin={login}
        isAdmin={isAdmin}
        onSwitchToDashboard={() => setMode('dashboard')}
      />
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
              <h1 className="text-xl font-normal text-white tracking-wide" style={{ fontFamily: "'New Rocker', system-ui" }}>NovelVerse</h1>
              <p className="text-[10px] text-[#F87171] font-bold uppercase tracking-widest">Dashboard Pro</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isAdmin && (
              <button 
                onClick={() => setMode('reader')}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl border border-white/5 transition-all text-xs font-bold"
              >
                <BookOpen className="w-4 h-4" />
                عرض كقارئ
              </button>
            )}
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
                        setEditingNovel({ name: '', description: '', author: user.displayName || '', coverImages: ['', '', '', ''], categories: [] });
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
                  {filteredNovels.map(novel => (
                    <motion.div 
                      layoutId={novel.id}
                      key={novel.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -8 }}
                      onClick={() => {
                        setSelectedNovel(novel);
                        setView('chapters');
                      }}
                      className="group bg-[#1e1e1e] rounded-[2.5rem] border border-white/5 overflow-hidden hover:shadow-[0_20px_50px_rgba(248,113,113,0.1)] transition-all duration-500 flex flex-col h-full cursor-pointer relative"
                    >
                      {/* Card Image Section */}
                      <div className="aspect-[2/3] relative overflow-hidden">
                        {novel.coverImages && novel.coverImages.length > 0 ? (
                          <img 
                            src={novel.coverImages[0]} 
                            alt={novel.name} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#121212] text-slate-800">
                            <ImageIcon className="w-16 h-16 opacity-20" />
                          </div>
                        )}
                        
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />

                        {/* Status Badge */}
                        {novel.status && (
                          <div className="absolute top-5 right-5">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl backdrop-blur-md border border-white/10 ${
                              novel.status === 'مستمرة' ? 'bg-yellow-500/80 text-white' : 
                              novel.status === 'مكتملة' ? 'bg-emerald-500/80 text-white' : 
                              'bg-slate-800/80 text-white'
                            }`}>
                              {novel.status}
                            </span>
                          </div>
                        )}

                        {/* Rating Badge */}
                        <div className="absolute bottom-5 right-5 flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/5 shadow-xl">
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                          <span className="text-xs font-black text-white">{novel.rating || '0.0'}</span>
                        </div>
                      </div>
                      
                      {/* Card Content Section */}
                      <div className="p-8 flex-1 flex flex-col relative">
                        <div className="mb-4">
                          <h3 className="text-xl font-black text-white mb-2 line-clamp-1 group-hover:text-[#F87171] transition-colors duration-300">
                            {novel.name || 'Untitled'}
                          </h3>
                          <p className="text-xs text-white/40 mb-4 line-clamp-2 leading-relaxed font-medium">
                            {novel.description || 'No description available.'}
                          </p>
                        </div>
                        
                        {/* Categories */}
                        {novel.categories && novel.categories.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-6">
                            {novel.categories.slice(0, 2).map((cat, i) => (
                              <span key={`${novel.id}-cat-${i}`} className="px-3 py-1 rounded-lg bg-white/5 text-white/40 text-[10px] font-bold border border-white/5 uppercase tracking-wider">
                                {cat}
                              </span>
                            ))}
                            {novel.categories.length > 2 && (
                              <span className="text-[10px] text-white/20 font-bold self-center">+{novel.categories.length - 2}</span>
                            )}
                          </div>
                        )}
                        
                        {/* Footer */}
                        <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-[#F87171] uppercase tracking-[0.2em] mb-0.5">الكاتب</span>
                            <span className="text-sm font-bold text-white/70 truncate max-w-[120px]">{novel.author}</span>
                          </div>
                          
                          {isAdmin && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNovel(novel.id);
                              }}
                              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 border border-white/5 text-white/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all duration-300 group/btn"
                              title="حذف الرواية"
                            >
                              <Trash2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
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

              {/* Section 1: Novel Header Info */}
              <div className="bg-[#1e1e1e] rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl">
                <div className="flex flex-col lg:flex-row">
                  {/* Left: Cover Image */}
                  <div className="lg:w-1/3 xl:w-1/4 aspect-[2/3] relative">
                    <CoverSlider images={selectedNovel.coverImages || []} />
                  </div>

                  {/* Right: Novel Details */}
                  <div className="lg:w-2/3 xl:w-3/4 p-10 lg:p-16 flex flex-col">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-10">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 ${
                            selectedNovel.status === 'مستمرة' ? 'bg-yellow-500/20 text-yellow-500' : 
                            selectedNovel.status === 'مكتملة' ? 'bg-emerald-500/20 text-emerald-500' : 
                            'bg-white/5 text-white/40'
                          }`}>
                            {selectedNovel.status || 'غير محدد'}
                          </span>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/5">
                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                            <span className="text-xs font-black text-white">{selectedNovel.rating || '0.0'}</span>
                          </div>
                        </div>
                        <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight">{selectedNovel.name}</h2>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-[#F87171] uppercase tracking-widest">المؤلف:</span>
                          <span className="text-lg font-bold text-white/80">{selectedNovel.author}</span>
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="flex flex-wrap items-center gap-3">
                          <button 
                            onClick={() => {
                              setEditingChapter({ novelId: selectedNovel.id, title: '', content: '', order: chapters.length + 1, date: new Date().toLocaleDateString('ar-EG') });
                              setView('edit-chapter');
                            }}
                            className="flex items-center gap-2 bg-[#F87171] hover:bg-[#EF4444] text-[#121212] px-6 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-[#F87171]/20"
                          >
                            <Plus className="w-4 h-4" />
                            إضافة فصل
                          </button>
                          <button 
                            onClick={() => setShowVolumePopup(true)}
                            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-6 py-3.5 rounded-2xl font-bold transition-all border border-white/5"
                          >
                            <Layers className="w-4 h-4" />
                            إضافة مجلد
                          </button>
                          <button 
                            onClick={() => {
                              const currentCovers = selectedNovel.coverImages || [];
                              const paddedCovers = [...currentCovers];
                              while (paddedCovers.length < 4) paddedCovers.push('');
                              setEditingNovel({ ...selectedNovel, coverImages: paddedCovers });
                              setView('edit-novel');
                            }}
                            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-6 py-3.5 rounded-2xl font-bold transition-all border border-white/5"
                          >
                            <Edit className="w-4 h-4" />
                            تعديل
                          </button>
                          <button 
                            onClick={() => deleteNovel(selectedNovel.id)}
                            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-6 py-3.5 rounded-2xl font-bold transition-all border border-red-500/20"
                          >
                            <Trash2 className="w-4 h-4" />
                            حذف
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-10">
                      <div>
                        <h4 className="text-xs font-black text-white/30 uppercase tracking-[0.2em] mb-4">التصنيفات</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedNovel.categories?.map((cat, i) => (
                            <span key={`selected-cat-${i}`} className="px-4 py-2 rounded-xl bg-white/5 text-white/60 text-xs font-bold border border-white/5">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white/30 uppercase tracking-[0.2em] mb-4">إحصائيات</h4>
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col">
                            <span className="text-2xl font-black text-white">{chapters.length}</span>
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">فصل</span>
                          </div>
                          <div className="w-px h-10 bg-white/5" />
                          <div className="flex flex-col">
                            <span className="text-2xl font-black text-white">{selectedNovel.volumes?.length || 0}</span>
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">مجلد</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-10 border-t border-white/5">
                      <h4 className="text-xs font-black text-white/30 uppercase tracking-[0.2em] mb-4">قصة الرواية</h4>
                      <p className="text-white/60 leading-relaxed text-sm lg:text-base line-clamp-4">
                        {selectedNovel.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

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
                      const volumeChapters = chapters.filter(c => c.volumeId === volume.id);
                      const isExpanded = expandedVolumes.includes(volume.id);
                      
                      return (
                        <div key={volume.id} className="bg-[#1e1e1e] rounded-[2rem] border border-white/5 overflow-hidden shadow-lg transition-all">
                          <div 
                            onClick={() => {
                              setExpandedVolumes(prev => 
                                prev.includes(volume.id) ? prev.filter(id => id !== volume.id) : [...prev, volume.id]
                              );
                            }}
                            className="w-full px-8 py-6 flex items-center justify-between hover:bg-white/5 transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-[#F87171] text-[#121212]' : 'bg-white/5 text-white/40'}`}>
                                <Layers className="w-5 h-5" />
                              </div>
                              <div className="text-right">
                                <h4 className="font-black text-lg text-white group-hover:text-[#F87171] transition-colors">{volume.name}</h4>
                                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{volumeChapters.length} فصل</p>
                              </div>
                              {isAdmin && (
                                <div className="flex items-center gap-1 mr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      editVolume(volume.id, volume.name);
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                                    title="تعديل الاسم"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteVolume(volume.id);
                                    }}
                                    className="p-2 hover:bg-red-500/10 rounded-lg text-white/40 hover:text-red-400 transition-all"
                                    title="حذف المجلد"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              className="text-white/20"
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
                                className="border-t border-white/5 bg-[#121212]/30"
                              >
                                <div className="p-4 space-y-2">
                                  {volumeChapters.length === 0 ? (
                                    <p className="text-center py-8 text-white/20 text-sm font-bold">لا توجد فصول في هذا المجلد بعد</p>
                                  ) : (
                                    volumeChapters.map((chapter, idx) => (
                                      <ChapterRow 
                                        key={chapter.id} 
                                        chapter={chapter} 
                                        index={idx} 
                                        onPreview={setPreviewChapter}
                                        onEdit={(c) => {
                                          setEditingChapter(c);
                                          setView('edit-chapter');
                                        }}
                                        onDelete={deleteChapter}
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

                    {/* Uncategorized Chapters (Fallback or General) */}
                    {(() => {
                      const uncategorized = chapters.filter(c => !c.volumeId);
                      if (uncategorized.length === 0) return null;

                      const isExpanded = expandedVolumes.includes('uncategorized');
                      return (
                        <div className="bg-[#1e1e1e] rounded-[2rem] border border-white/5 overflow-hidden shadow-lg transition-all">
                          <button 
                            onClick={() => {
                              setExpandedVolumes(prev => 
                                prev.includes('uncategorized') ? prev.filter(id => id !== 'uncategorized') : [...prev, 'uncategorized']
                              );
                            }}
                            className="w-full px-8 py-6 flex items-center justify-between hover:bg-white/5 transition-all group"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-[#F87171] text-[#121212]' : 'bg-white/5 text-white/40'}`}>
                                <Book className="w-5 h-5" />
                              </div>
                              <div className="text-right">
                                <h4 className="font-black text-lg text-white group-hover:text-[#F87171] transition-colors">فصول عامة</h4>
                                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{uncategorized.length} فصل</p>
                              </div>
                            </div>
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              className="text-white/20"
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
                                className="border-t border-white/5 bg-[#121212]/30"
                              >
                                <div className="p-4 space-y-2">
                                  {uncategorized.map((chapter, idx) => (
                                    <ChapterRow 
                                      key={chapter.id} 
                                      chapter={chapter} 
                                      index={idx} 
                                      onPreview={setPreviewChapter}
                                      onEdit={(c) => {
                                        setEditingChapter(c);
                                        setView('edit-chapter');
                                      }}
                                      onDelete={deleteChapter}
                                    />
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })()}
                  </div>
                )}
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
                  <ArrowLeft className="w-6 h-6 text-white/60" />
                </button>
                <h2 className="text-2xl font-extrabold text-white">{editingNovel.id ? 'تعديل الرواية' : 'إضافة رواية جديدة'}</h2>
              </div>

              <form onSubmit={saveNovel} className="bg-[#1e1e1e] p-10 rounded-[2.5rem] border border-white/5 shadow-xl space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-white/60 mb-2">اسم الرواية</label>
                      <input 
                        type="text"
                        required
                        value={editingNovel.name}
                        onChange={e => setEditingNovel({...editingNovel, name: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all"
                        placeholder="أدخل اسم الرواية..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-white/60 mb-2">اسم الكاتب</label>
                      <input 
                        type="text"
                        required
                        value={editingNovel.author}
                        onChange={e => setEditingNovel({...editingNovel, author: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-white/60 mb-2">روابط صور الغلاف (حتى 4 صور)</label>
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
                            className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all text-sm"
                            placeholder={`رابط الصورة ${idx + 1}...`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-white/60 mb-2">الحالة</label>
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
                      <div>
                        <label className="block text-sm font-bold text-white/60 mb-2">التقييم</label>
                        <input 
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          value={editingNovel.rating || 0}
                          onChange={e => setEditingNovel({...editingNovel, rating: parseFloat(e.target.value)})}
                          className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-white/60 mb-2">التصنيفات</label>
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
                                  ? 'bg-[#F87171] text-[#121212] border-[#F87171]' 
                                  : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10'
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
                      <label className="block text-sm font-bold text-white/60 mb-2">وصف الرواية</label>
                      <textarea 
                        required
                        rows={12}
                        value={editingNovel.description}
                        onChange={e => setEditingNovel({...editingNovel, description: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all leading-relaxed resize-none"
                        placeholder="اكتب ملخصاً للرواية..."
                      />
                    </div>
                    
                    <div className="p-8 bg-[#121212] rounded-[2rem] border border-white/5">
                      <div className="flex items-center gap-2 text-white/50 mb-6">
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-xs font-bold">معاينة الرواية</span>
                      </div>
                      
                      <div className="aspect-[2/3] bg-[#1e1e1e] rounded-2xl border border-white/5 overflow-hidden mb-6">
                        <CoverSlider images={editingNovel.coverImages || []} />
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-bold text-lg text-white line-clamp-1">{editingNovel.name || 'اسم الرواية'}</h3>
                        
                        <div className="flex items-center gap-2 text-yellow-500">
                          <Star className="w-4 h-4 fill-current" />
                          <span className="text-sm font-bold">{editingNovel.rating || '0.0'}</span>
                          <span className="text-white/50 text-xs font-normal">/ 5.0</span>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                          <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">معاينة الوصف</h4>
                          <p className="text-xs text-white/60 leading-relaxed line-clamp-4">
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
                    className="flex-1 flex items-center justify-center gap-3 bg-[#F87171] hover:bg-[#EF4444] text-[#121212] font-extrabold py-5 rounded-2xl transition-all shadow-xl shadow-[#F87171]/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                    حفظ الرواية
                  </button>
                  <button 
                    type="button"
                    onClick={() => setView('novels')}
                    className="px-10 py-5 font-bold text-white/50 hover:bg-white/5 rounded-2xl transition-all"
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
                  <ArrowLeft className="w-6 h-6 text-white/60" />
                </button>
                <h2 className="text-2xl font-extrabold text-white">{editingChapter.id ? 'تعديل الفصل' : 'إضافة فصل جديد'}</h2>
              </div>

              <div className="w-full">
                {/* Main Column: Chapter Form */}
                <div className="w-full">
                  <form onSubmit={saveChapter} className="bg-[#1e1e1e] p-10 rounded-[2.5rem] border border-white/5 shadow-xl space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-white/60 mb-2">عنوان الفصل</label>
                        <input 
                          type="text"
                          required
                          value={editingChapter.title}
                          onChange={e => setEditingChapter({...editingChapter, title: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all"
                          placeholder="أدخل عنوان الفصل..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-white/60 mb-2">الترتيب</label>
                        <input 
                          type="number"
                          required
                          value={editingChapter.order}
                          onChange={e => setEditingChapter({...editingChapter, order: parseInt(e.target.value)})}
                          className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-white/60 mb-2">التاريخ</label>
                        <input 
                          type="text"
                          value={editingChapter.date || ''}
                          onChange={e => setEditingChapter({...editingChapter, date: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all"
                          placeholder="مثال: 13/3/2026"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-white/60 mb-2">المجلد</label>
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
                      <div className="flex flex-col justify-end pb-1">
                        <button
                          type="button"
                          onClick={() => setEditingChapter({...editingChapter, isEndOfVolume: !editingChapter.isEndOfVolume})}
                          className={`flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all font-bold text-sm ${
                            editingChapter.isEndOfVolume 
                              ? 'bg-[#F87171]/10 border-[#F87171] text-[#F87171]' 
                              : 'bg-[#121212] border-white/5 text-white/40 hover:border-white/10'
                          }`}
                        >
                          {editingChapter.isEndOfVolume ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                          نهاية المجلد
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-bold text-white/60 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#F87171]" />
                          محتوى الفصل
                        </label>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => setShowImagePopup(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#F87171]/10 hover:bg-[#F87171]/20 text-[#F87171] rounded-xl border border-[#F87171]/20 transition-all text-xs font-bold"
                          >
                            <ImageIcon className="w-4 h-4" />
                            إضافة صورة
                          </button>
                          <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">يدعم التنسيق البسيط (Markdown)</span>
                        </div>
                      </div>
                      
                      <div className="relative group">
                        <textarea 
                          ref={textareaRef}
                          required
                          rows={22}
                          value={editingChapter.content}
                          onChange={e => setEditingChapter({...editingChapter, content: e.target.value})}
                          className="w-full px-8 py-8 rounded-[2rem] border border-white/5 bg-[#121212] text-white/70 focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all font-sans text-base leading-relaxed resize-none scrollbar-hide"
                          placeholder="ابدأ بكتابة أحداث الفصل هنا..."
                        />
                      </div>
                    </div>

                    <div className="flex gap-4 pt-6">
                      <button 
                        type="submit"
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-3 bg-[#F87171] hover:bg-[#EF4444] text-[#121212] font-extrabold py-5 rounded-2xl transition-all shadow-xl shadow-[#F87171]/20 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                        حفظ الفصل
                      </button>
                      <button 
                        type="button"
                        onClick={() => setView('chapters')}
                        className="px-10 py-5 font-bold text-white/50 hover:bg-white/5 rounded-2xl transition-all"
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
            <div className="w-8 h-8 bg-[#F87171] rounded-lg flex items-center justify-center">
              <Book className="w-4 h-4 text-[#121212]" />
            </div>
            <span className="font-normal text-white tracking-wide text-xl" style={{ fontFamily: "'New Rocker', system-ui" }}>NovelVerse</span>
          </div>
          <p className="text-white/50 text-xs">© 2026 لوحة تحكم الروايات الاحترافية. جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-6 text-xs font-bold text-white/60">
            <a href="#" className="hover:text-white transition-colors">الدعم الفني</a>
            <a href="#" className="hover:text-white transition-colors">سياسة الخصوصية</a>
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

      {/* Volume Creation Popup */}
      <AnimatePresence>
        {showVolumePopup && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#1e1e1e] w-full max-w-md rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-bold text-lg">إضافة مجلد جديد</h3>
                <button onClick={() => setShowVolumePopup(false)} className="p-2 hover:bg-white/5 rounded-lg transition-all">
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-white/60 mb-2">اسم المجلد</label>
                  <input 
                    type="text"
                    placeholder="مثال: المجلد الأول: البداية..."
                    value={newVolumeName}
                    onChange={e => setNewVolumeName(e.target.value)}
                    className="w-full px-5 py-4 rounded-xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all text-sm"
                    autoFocus
                  />
                </div>
                <button 
                  onClick={addVolume}
                  disabled={!newVolumeName.trim()}
                  className="w-full py-4 bg-[#F87171] hover:bg-[#EF4444] text-[#121212] font-bold rounded-xl transition-all shadow-lg shadow-[#F87171]/20 disabled:opacity-50"
                >
                  إضافة المجلد
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Insertion Popup */}
      <AnimatePresence>
        {showImagePopup && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#1e1e1e] w-full max-w-md rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-bold text-lg">إضافة صورة</h3>
                <button onClick={() => setShowImagePopup(false)} className="p-2 hover:bg-white/5 rounded-lg transition-all">
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="relative">
                    <Link className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                    <input 
                      type="url"
                      placeholder="أدخل رابط الصورة هنا..."
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      className="w-full pr-11 pl-4 py-4 rounded-xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#F87171]/50 outline-none transition-all text-sm"
                    />
                  </div>
                  <button 
                    onClick={() => imageUrl && insertImage(imageUrl)}
                    disabled={!imageUrl}
                    className="w-full py-4 bg-[#F87171] hover:bg-[#EF4444] text-[#121212] font-bold rounded-xl transition-all shadow-lg shadow-[#F87171]/20 disabled:opacity-50"
                  >
                    إدراج الصورة
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
