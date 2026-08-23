/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  collectionGroup,
  onSnapshot,
  limit, 
  where,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  setDoc,
  query, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
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
  Zap,
  Sparkles,
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
  AlertTriangle,
  Minus,
  Copy,
  List,
  Activity,
  CheckCircle2,
  PauseCircle,
  Tags,
  Lock,
  Key,
  ShieldCheck,
  Unlock,
  EyeOff
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
      className="bg-[#232323] p-6 rounded-[1.2rem] border border-white/5 flex items-center justify-between hover:bg-[#2d2e2e] transition-all group shadow-sm hover:shadow-xl hover:shadow-black/20 cursor-pointer"
    >
      <div className="flex items-center gap-6 flex-1">
        <div className="w-14 h-14 bg-[#222222] rounded-2xl flex items-center justify-center text-white/20 font-black text-lg group-hover:bg-[#c8a460] group-hover:text-[#121212] transition-all duration-300 border border-white/5 shadow-inner">
          {chapter.order}
        </div>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-extrabold text-white text-lg group-hover:text-[#c8a460] transition-colors">{chapter.title}</h4>
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
                <span className="text-[#c8a460] flex items-center gap-2">
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
          className="w-12 h-12 flex items-center justify-center text-white/30 bg-white/5 hover:bg-[#c8a460] hover:text-[#121212] rounded-2xl border border-white/5 transition-all active:scale-90 group/btn"
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
        className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#121212] text-white flex items-center justify-between focus:ring-2 focus:ring-[#c8a460]/50 outline-none transition-all"
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
                        ? 'bg-[#c8a460] text-[#121212]' 
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

const GridPattern = () => (
  <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [latestGlobalChapters, setLatestGlobalChapters] = useState<Chapter[]>([]);
  
  // UI State
  const [view, setView] = useState<'home' | 'library' | 'chapters' | 'edit-novel' | 'edit-chapter' | 'reader'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [selectedStatus, setSelectedStatus] = useState<string>('الكل');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [editingNovel, setEditingNovel] = useState<Partial<Novel> | null>(null);
  const [editingChapter, setEditingChapter] = useState<Partial<Chapter> | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  
  // Volume Management State
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [newVolumeName, setNewVolumeName] = useState('');
  const [expandedVolumes, setExpandedVolumes] = useState<string[]>([]);
  const [selectingVolumeForChapters, setSelectingVolumeForChapters] = useState<Volume | null>(null);
  const [selectedChapterIdsForVolume, setSelectedChapterIdsForVolume] = useState<string[]>([]);
  const [volumeChapterSearch, setVolumeChapterSearch] = useState('');
  const [savingVolumeChapters, setSavingVolumeChapters] = useState(false);

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
  const [showReaderSidebar, setShowReaderSidebar] = useState(false);
  const [showAdultWarning, setShowAdultWarning] = useState(true);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // --- Passcode Security State ---
  const DEFAULT_PASSCODE_HASH = 'e90fe5fafe855c26a1b99ab80eccca2fa7b8ef26e79c42ea9ddff00945050bdb';
  const [isPasscodeUnlocked, setIsPasscodeUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('dashboard_unlocked') === 'true';
  });
  const [passcodeInput, setPasscodeInput] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState('');
  const [isCheckingPasscode, setIsCheckingPasscode] = useState(false);
  const [dbPasscodeHash, setDbPasscodeHash] = useState<string>(DEFAULT_PASSCODE_HASH);

  // Helper to convert Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to standard ASCII numbers
  const normalizeNumerals = (str: string) => {
    return str
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .trim();
  };

  // Sync Passcode Settings with Firestore
  useEffect(() => {
    if (!isAuthReady) return;

    const accessDocRef = doc(db, 'settings', 'access');
    const unsub = onSnapshot(accessDocRef, async (snap) => {
      if (snap.exists() && snap.data().passcodeHash) {
        const currentHash = snap.data().passcodeHash;
        if (currentHash === 'd3e0db966efaa36bb337a7b8e1f0e4b2d5a3746c19f1873132e4d0d2ff86ef56') {
          // Update stale/incorrect hash in Firestore to correct hash for 1422002
          try {
            await setDoc(accessDocRef, {
              passcodeHash: DEFAULT_PASSCODE_HASH,
              updatedAt: serverTimestamp()
            }, { merge: true });
            setDbPasscodeHash(DEFAULT_PASSCODE_HASH);
          } catch (e) {
            setDbPasscodeHash(DEFAULT_PASSCODE_HASH);
          }
        } else {
          setDbPasscodeHash(currentHash);
        }
      } else {
        try {
          await setDoc(accessDocRef, {
            passcodeHash: DEFAULT_PASSCODE_HASH,
            description: "تأمين لوحة التحكم برمز أمان شاشة الدخول",
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.warn("Could not auto-initialize settings/access document in Firestore:", err);
        }
      }
    }, (error) => {
      console.warn("Firestore settings/access listener warning:", error);
    });

    return () => unsub();
  }, [isAuthReady]);

  const verifyPasscode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanedInput = normalizeNumerals(passcodeInput);
    if (!cleanedInput) {
      setPasscodeError('يرجى إدخال رمز المرور');
      return;
    }

    setIsCheckingPasscode(true);
    setPasscodeError('');

    try {
      // Compute SHA-256 hash of the cleaned input
      const encoder = new TextEncoder();
      const data = encoder.encode(cleanedInput);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      let targetHash = dbPasscodeHash;
      try {
        const snap = await getDoc(doc(db, 'settings', 'access'));
        if (snap.exists() && snap.data().passcodeHash) {
          targetHash = snap.data().passcodeHash;
          if (targetHash === 'd3e0db966efaa36bb337a7b8e1f0e4b2d5a3746c19f1873132e4d0d2ff86ef56') {
            targetHash = DEFAULT_PASSCODE_HASH;
          }
          setDbPasscodeHash(targetHash);
        }
      } catch (err) {
        // Fallback to local state hash if offline
      }

      const isPasscodeCorrect = 
        cleanedInput === '1422002' ||
        inputHash === targetHash ||
        inputHash === DEFAULT_PASSCODE_HASH;

      if (isPasscodeCorrect) {
        sessionStorage.setItem('dashboard_unlocked', 'true');
        setIsPasscodeUnlocked(true);
        setPasscodeInput('');
        setPasscodeError('');
        Swal.fire({
          title: 'تم التحقق بنجاح!',
          text: 'تم إلغاء قفل الأمان. يمكنك الآن تسجيل الدخول باستخدام حساب جوجل المسموح له.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          background: '#1e1e1e',
          color: '#fff'
        });
      } else {
        setPasscodeError('رمز المرور غير صحيح!');
        Swal.fire({
          title: 'رمز غير صحيح',
          text: 'رمز المرور الذي أدخلته غير صحيح. يرجى المحاولة مرة أخرى.',
          icon: 'error',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#c8a460'
        });
      }
    } catch (err) {
      setPasscodeError('حدث خطأ أثناء التحقق من رمز المرور');
    } finally {
      setIsCheckingPasscode(false);
    }
  };

  const lockDashboard = () => {
    sessionStorage.removeItem('dashboard_unlocked');
    setIsPasscodeUnlocked(false);
    setPasscodeInput('');
    setPasscodeError('');
  };

  const { ref: novelsEndRef, inView: novelsEndInView } = useInView();
  const { ref: chaptersEndRef, inView: chaptersEndInView } = useInView();

  useEffect(() => {
    if (novelsEndInView) {
      setVisibleNovelsCount(prev => prev + 8);
    }
  }, [novelsEndInView]);

  // Debounced Search Handler
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

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

  // Highlight Text Utility
  const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight.trim()) return <>{text}</>;
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <span key={i} className="text-[#c8a460] underline decoration-wavy decoration-[#c8a460]/30 underline-offset-4">{part}</span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Chapters Listener
  // Selected Novel Chapters Listener
  useEffect(() => {
    const activeId = selectedNovel?.id;
    if (!activeId) {
      setChapters([]);
      return;
    }

    const q = query(collection(db, `novels/${activeId}/chapters`));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chapterData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chapter));
      // Memory sort by order ascending safely (even if order field is missing in Firestore)
      chapterData.sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : parseInt(String(a.order || 0), 10) || 0;
        const orderB = typeof b.order === 'number' ? b.order : parseInt(String(b.order || 0), 10) || 0;
        return orderA - orderB;
      });
      setChapters(chapterData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `novels/${activeId}/chapters`));

    return () => unsubscribe();
  }, [selectedNovel?.id]);

  // Global Chapters Listener for Home View
  useEffect(() => {
    if (!isAuthReady) return;
    
    // Using collectionGroup to catch chapters across all novels
    // We fetch ALL and sort in memory to avoid the COLLECTION_GROUP_DESC index requirement
    // In a massive app this would be bad, but for this use case it's the only way to avoid manual index creation
    const q = query(collectionGroup(db, 'chapters'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chapterData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Chapter));
      
      // Memory sort by createdAt descending
      const sorted = chapterData.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      }).slice(0, 10);

      setLatestGlobalChapters(sorted);
    }, (error) => {
      console.warn("Global chapter feed query failed:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady]);

  // --- Actions ---

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      let result;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupErr: any) {
        if (popupErr?.code === 'auth/popup-blocked' || popupErr?.message?.includes('popup-blocked') || popupErr?.code === 'auth/popup-closed-by-user') {
          console.warn("Popup blocked or closed, falling back to redirect auth...", popupErr);
          try {
            await signInWithRedirect(auth, provider);
            return;
          } catch (redirectErr) {
            console.error("Redirect auth also failed", redirectErr);
            Swal.fire({
              title: 'تم حظر النافذة المنبثقة',
              text: 'يرجى فتح التطبيق في تبويب جديد أو السماح بالنوافذ المنبثقة لتسجيل الدخول.',
              icon: 'warning',
              background: '#1e1e1e',
              color: '#fff',
              confirmButtonColor: '#c8a460'
            });
            return;
          }
        }
        throw popupErr;
      }

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
          confirmButtonColor: '#c8a460'
        });
        return;
      }

      Swal.fire({
        title: 'تم تسجيل الدخول!',
        text: 'مرحباً بك في كوم روايات',
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#c8a460'
      });
    } catch (error: any) {
      console.error("Login failed", error);
      if (
        error?.code === 'auth/popup-closed-by-user' || 
        error?.code === 'auth/cancelled-popup-request'
      ) {
        // User closed or cancelled popup window, silent handle
        return;
      }
      if (error?.code === 'auth/unauthorized-domain' || error?.message?.includes('unauthorized-domain')) {
        Swal.fire({
          title: 'نطاق غير مصرح به',
          icon: 'error',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#c8a460',
          confirmButtonText: 'حسناً'
        });
      } else {
        Swal.fire({
          title: 'فشل الدخول',
          text: error?.code === 'auth/popup-blocked' 
            ? 'تم حظر النافذة المنبثقة. يرجى السماح بالفوافذ المنبثقة أو فتح التطبيق في نافذة جديدة.'
            : (error?.message || 'حدث خطأ أثناء تسجيل الدخول'),
          icon: 'error',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#c8a460'
        });
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
    sessionStorage.removeItem('dashboard_unlocked');
    setIsPasscodeUnlocked(false);
    setPasscodeInput('');
    setPasscodeError('');
    Swal.fire({
      title: 'تم تسجيل الخروج',
      icon: 'info',
      background: '#1e1e1e',
      color: '#fff',
      confirmButtonColor: '#c8a460',
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
      cancelButtonColor: '#675b5b',
      background: '#1e1e1e',
      color: '#fff',
      confirmButtonColor: '#c8a460',
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
          confirmButtonColor: '#c8a460'
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
      cancelButtonColor: '#675b5b',
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
          confirmButtonColor: '#c8a460'
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
          confirmButtonColor: '#c8a460',
          cancelButtonColor: '#675b5b',
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
          confirmButtonColor: '#c8a460'
        });
      } catch (err) {
        console.error("Import failed", err);
        Swal.fire({
          title: 'فشل الاستيراد',
          text: 'تأكد من صيغة الملف.',
          icon: 'error',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#c8a460'
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
    const search = debouncedSearchTerm.toLowerCase();
    
    // Hide drafts from non-admins
    if (!isAdmin && n.isDraft) return false;

    const matchesSearch = name.toLowerCase().includes(search) || 
                         author.toLowerCase().includes(search);
    const matchesCategory = selectedCategory === 'الكل' || (n.categories && n.categories.includes(selectedCategory));
    const matchesStatus = selectedStatus === 'الكل' || n.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Live active novel reference synced with Firestore state
  const currentNovel = selectedNovel ? (novels.find(n => n.id === selectedNovel.id) || selectedNovel) : null;

  // Auto-expand all volumes and uncategorized when opening a novel or when volumes load
  useEffect(() => {
    if (currentNovel) {
      const volIds = (currentNovel.volumes || []).map(v => v.id);
      setExpandedVolumes(prev => Array.from(new Set([...volIds, 'uncategorized', ...prev])));
    }
  }, [currentNovel?.id, currentNovel?.volumes?.length]);

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
      setView('library');
      setEditingNovel(null);
      Swal.fire({
        title: 'تم الحفظ!',
        text: 'تم حفظ بيانات الرواية بنجاح',
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#c8a460'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'novels');
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حفظ الرواية',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#c8a460'
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
      cancelButtonColor: '#675b5b',
      confirmButtonText: 'نعم، احذفها',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff'
    });

    if (!result.isConfirmed) return;

    try {
      await deleteDoc(doc(db, 'novels', id));
      setView('library');
      setSelectedNovel(null);
      Swal.fire({
        title: 'تم الحذف!',
        text: 'تم حذف الرواية بنجاح',
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#c8a460'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${id}`);
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حذف الرواية',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#c8a460'
      });
    }
  };

  const saveChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeNovel = currentNovel || selectedNovel;
    if (!activeNovel || !editingChapter?.title || !editingChapter?.content) return;

    setLoading(true);
    const path = `novels/${activeNovel.id}/chapters`;
    try {
      const { id, ...dataToSave } = editingChapter;
      const data = {
        ...dataToSave,
        novelId: activeNovel.id,
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
        confirmButtonColor: '#c8a460'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حفظ الفصل',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#c8a460'
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteChapter = async (id: string) => {
    const activeNovel = currentNovel || selectedNovel;
    if (!activeNovel) return;
    
    const result = await Swal.fire({
      title: 'هل أنت متأكد؟',
      text: "سيتم حذف هذا الفصل نهائياً!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#675b5b',
      confirmButtonText: 'نعم، احذف',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff'
    });

    if (!result.isConfirmed) return;

    try {
      await deleteDoc(doc(db, `novels/${activeNovel.id}/chapters`, id));
      Swal.fire({
        title: 'تم الحذف!',
        text: 'تم حذف الفصل بنجاح',
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#c8a460'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${activeNovel.id}/chapters/${id}`);
      Swal.fire({
        title: 'خطأ',
        text: 'فشل حذف الفصل',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#c8a460'
      });
    }
  };

  const addVolume = async () => {
    const activeNovel = currentNovel || selectedNovel;
    if (!activeNovel || !newVolumeName.trim()) return;

    try {
      const newVolume: Volume = {
        id: Math.random().toString(36).substr(2, 9),
        name: newVolumeName.trim(),
        order: (activeNovel.volumes?.length || 0) + 1
      };

      const updatedVolumes = [...(activeNovel.volumes || []), newVolume];
      await updateDoc(doc(db, 'novels', activeNovel.id), {
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
        confirmButtonColor: '#c8a460'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `novels/${activeNovel.id}`);
    }
  };

  const editVolume = async (volumeId: string, currentName: string) => {
    const activeNovel = currentNovel || selectedNovel;
    if (!activeNovel) return;

    const { value: newName } = await Swal.fire({
      title: 'تعديل اسم المجلد',
      input: 'text',
      inputValue: currentName,
      inputPlaceholder: 'أدخل الاسم الجديد...',
      showCancelButton: true,
      confirmButtonColor: '#c8a460',
      cancelButtonColor: '#675b5b',
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
        const updatedVolumes = activeNovel.volumes?.map(v => 
          v.id === volumeId ? { ...v, name: newName } : v
        );
        await updateDoc(doc(db, 'novels', activeNovel.id), {
          volumes: updatedVolumes,
          updatedAt: serverTimestamp()
        });
        Swal.fire({
          title: 'تم التعديل!',
          text: 'تم تحديث اسم المجلد بنجاح',
          icon: 'success',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#c8a460'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `novels/${activeNovel.id}`);
      }
    }
  };

  const deleteVolume = async (volumeId: string) => {
    const activeNovel = currentNovel || selectedNovel;
    if (!activeNovel) return;

    const result = await Swal.fire({
      title: 'هل أنت متأكد؟',
      text: "سيتم حذف المجلد، وستصبح الفصول التابعة له غير مصنفة.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#675b5b',
      confirmButtonText: 'نعم، احذف',
      cancelButtonText: 'إلغاء',
      background: '#1e1e1e',
      color: '#fff'
    });

    if (result.isConfirmed) {
      try {
        // 1. Update novel volumes
        const updatedVolumes = activeNovel.volumes?.filter(v => v.id !== volumeId);
        await updateDoc(doc(db, 'novels', activeNovel.id), {
          volumes: updatedVolumes,
          updatedAt: serverTimestamp()
        });

        // 2. Update chapters to remove volumeId
        const volumeChapters = chapters.filter(c => c.volumeId === volumeId);
        for (const chapter of volumeChapters) {
          await updateDoc(doc(db, `novels/${activeNovel.id}/chapters`, chapter.id), {
            volumeId: null
          });
        }

        Swal.fire({
          title: 'تم الحذف!',
          text: 'تم حذف المجلد بنجاح',
          icon: 'success',
          background: '#1e1e1e',
          color: '#fff',
          confirmButtonColor: '#c8a460'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `novels/${activeNovel.id}`);
      }
    }
  };

  const saveVolumeChapters = async () => {
    const activeNovel = currentNovel || selectedNovel;
    if (!activeNovel || !selectingVolumeForChapters) return;

    setSavingVolumeChapters(true);
    try {
      const volumeId = selectingVolumeForChapters.id;
      const updates: Promise<void>[] = [];

      for (const chapter of chapters) {
        const isSelected = selectedChapterIdsForVolume.includes(chapter.id);
        const currentBelongsToThisVol = chapter.volumeId === volumeId || chapter.volumeId === selectingVolumeForChapters.name;

        if (isSelected && !currentBelongsToThisVol) {
          updates.push(
            updateDoc(doc(db, `novels/${activeNovel.id}/chapters`, chapter.id), {
              volumeId: volumeId,
              updatedAt: serverTimestamp()
            })
          );
        } else if (!isSelected && currentBelongsToThisVol) {
          updates.push(
            updateDoc(doc(db, `novels/${activeNovel.id}/chapters`, chapter.id), {
              volumeId: null,
              updatedAt: serverTimestamp()
            })
          );
        }
      }

      await Promise.all(updates);

      setExpandedVolumes(prev => Array.from(new Set([...prev, volumeId])));

      Swal.fire({
        title: 'تم التحديث!',
        text: `تم تحديث الفصول الملحقة بمجلد "${selectingVolumeForChapters.name}" بنجاح`,
        icon: 'success',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#c8a460'
      });

      setSelectingVolumeForChapters(null);
      setSelectedChapterIdsForVolume([]);
      setVolumeChapterSearch('');
    } catch (error) {
      console.error("Failed to save volume chapters", error);
      handleFirestoreError(error, OperationType.UPDATE, `novels/${activeNovel.id}/chapters`);
      Swal.fire({
        title: 'خطأ',
        text: 'فشل ربط الفصول بالمجلد',
        icon: 'error',
        background: '#1e1e1e',
        color: '#fff',
        confirmButtonColor: '#c8a460'
      });
    } finally {
      setSavingVolumeChapters(false);
    }
  };

  // --- UI Helpers ---

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#c8a460]/20 border-t-[#c8a460] rounded-full animate-spin" />
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
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#c8a460]/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#c8a460]/10 rounded-full blur-3xl" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1e1e1e] p-8 md:p-10 rounded-[2.5rem] border border-white/5 shadow-2xl max-w-md w-full text-center relative z-10"
        >
          {/* Header Icon with Lock Badge */}
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 bg-[#c8a460] rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-[#c8a460]/30">
              <Book className="w-10 h-10 text-[#121212]" />
            </div>
            <div className={`absolute -bottom-1 -left-1 w-7 h-7 rounded-full flex items-center justify-center border-2 border-[#1e1e1e] shadow-md transition-colors ${
              isPasscodeUnlocked ? 'bg-emerald-500 text-[#121212]' : 'bg-[#121212] text-[#c8a460] border-white/10'
            }`}>
              {isPasscodeUnlocked ? <Unlock className="w-3.5 h-3.5 stroke-[3]" /> : <Lock className="w-3.5 h-3.5" />}
            </div>
          </div>

          <h1 className="text-3xl font-normal text-white mb-2 tracking-wide" style={{ fontFamily: "'New Rocker', system-ui" }}>كوم روايات</h1>
          <p className="text-white/60 text-sm mb-8 leading-relaxed">لوحة التحكم الاحترافية لإدارة رواياتك وفصولك بكل سهولة وأناقة.</p>

          {!isPasscodeUnlocked ? (
            /* STEP 1: Passcode Entry Screen */
            <form onSubmit={verifyPasscode} className="space-y-5 text-right">
              <div className="bg-[#121212]/80 p-4 rounded-2xl border border-white/5 text-center">
                <div className="flex items-center justify-center gap-2 text-[#c8a460] text-xs font-black uppercase tracking-wider mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>دخول محمي برمز أمان</span>
                </div>
                <p className="text-white/40 text-[11px]">أدخل رمز المرور الخاص بالداشبورد للمتابعة</p>
              </div>

              <div>
                <label className="block text-xs font-black text-white/50 uppercase tracking-widest mb-2 text-right">
                  رمز المرور المطلوب
                </label>
                <div className="relative">
                  <input 
                    type={showPasscode ? "text" : "password"}
                    required
                    value={passcodeInput}
                    onChange={(e) => {
                      setPasscodeInput(e.target.value);
                      if (passcodeError) setPasscodeError('');
                    }}
                    placeholder="••••••••"
                    className={`w-full bg-[#121212] border ${passcodeError ? 'border-red-500' : 'border-white/10 focus:border-[#c8a460]'} rounded-2xl px-5 py-4 pl-12 text-white font-mono text-center tracking-widest text-lg outline-none transition-all placeholder:text-white/20`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors p-1"
                  >
                    {showPasscode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passcodeError && (
                  <p className="text-red-400 text-xs font-bold mt-2 text-center">
                    {passcodeError}
                  </p>
                )}
              </div>

              <button 
                type="submit"
                disabled={isCheckingPasscode}
                className="w-full flex items-center justify-center gap-3 bg-[#c8a460] hover:bg-[#b89552] text-[#121212] font-black py-4 rounded-2xl transition-all shadow-xl shadow-[#c8a460]/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isCheckingPasscode ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Key className="w-5 h-5" />
                    <span>تأكيد رمز الأمان</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: Unlocked Google Sign-In */
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center justify-between text-right">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-emerald-400 font-black text-xs">تم التحقق من الأمان بنجاح</p>
                    <p className="text-white/40 text-[10px]">يمكنك الآن الدخول بحساب جوجل المسموح له</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={lockDashboard}
                  className="text-[10px] font-bold text-white/40 hover:text-red-400 transition-colors underline"
                >
                  قفل
                </button>
              </div>

              <button 
                onClick={login}
                className="w-full flex items-center justify-center gap-3 bg-[#c8a460] hover:bg-[#b89552] text-[#121212] font-black py-4 rounded-2xl transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <LogIn className="w-5 h-5" />
                تسجيل الدخول باستخدام جوجل
              </button>
            </div>
          )}

          <p className="mt-8 text-xs text-white/30 font-medium">بواسطة فريق كوم روايات</p>
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-80 bg-[#1e1e1e] border-r border-white/5 z-50 flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <button onClick={() => setShowSidebar(false)} className="p-2 hover:bg-white/5 rounded-lg transition-all">
                  <X className="w-5 h-5 text-white/60" />
                </button>
                <h3 className="font-bold text-lg text-[#c8a460] uppercase tracking-widest">القائمة</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <button onClick={() => { setView('home'); setShowSidebar(false); }}
                  className={`w-full text-right px-6 py-4 rounded-2xl font-bold transition-all flex items-center gap-4 ${view === 'home' ? 'bg-[#c8a460] text-[#121212]' : 'text-white/60 hover:bg-white/5'}`}>
                  <Home className="w-5 h-5" /> <span>الرئيسية</span>
                </button>
                <button onClick={() => { setView('library'); setShowSidebar(false); }}
                  className={`w-full text-right px-6 py-4 rounded-2xl font-bold transition-all flex items-center gap-4 ${view === 'library' ? 'bg-[#c8a460] text-[#121212]' : 'text-white/60 hover:bg-white/5'}`}>
                  <Library className="w-5 h-5" /> <span>المكتبة</span>
                </button>
                <button onClick={() => { setView('chapters'); setShowSidebar(false); }}
                  className={`w-full text-right px-6 py-4 rounded-2xl font-bold transition-all flex items-center gap-4 ${view === 'chapters' ? 'bg-[#c8a460] text-[#121212]' : 'text-white/60 hover:bg-white/5'}`}>
                  <BookOpen className="w-5 h-5" /> <span>الفصول</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modern Dark Header */}
      <header className="sticky top-0 z-40 bg-[#1e1e1e]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div 
            onClick={() => {
              setView('home');
              setSearchTerm('');
              setSelectedCategory('الكل');
              setSelectedStatus('الكل');
            }}             className="flex items-center gap-3 cursor-pointer group relative z-50"
          >
            <div className="w-10 h-10 bg-[#c8a460] rounded-xl flex items-center justify-center shadow-md shadow-[#c8a460]/20 group-hover:scale-110 transition-transform">
              <Book className="w-6 h-6 text-[#121212]" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-normal text-white tracking-wide group-hover:text-[#c8a460] transition-colors" style={{ fontFamily: "'New Rocker', system-ui" }}>كوم روايات</h1>
              <p className="text-[10px] text-[#c8a460] font-bold uppercase tracking-widest">الموقع الرسمي</p>
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
              className="p-2.5 text-white/60 hover:text-[#c8a460] hover:bg-[#c8a460]/10 rounded-xl transition-all"
              title="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Home View */}
          {view === 'home' && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-16">
              {/* Featured Section */}
              <section>
                <div className="flex items-center justify-between mb-8 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#c8a460]/10 rounded-xl flex items-center justify-center border border-[#c8a460]/20 shadow-lg shadow-[#c8a460]/5">
                      <Sparkles className="w-5 h-5 text-[#c8a460]" />
                    </div>
                    <h2 className="text-2xl font-black text-white">أحدث الروايات المضافة</h2>
                  </div>
                <div className="flex items-center gap-4">
                  {isAdmin && (
                    <button 
                      onClick={() => { 
                        setEditingNovel({ name: '', description: '', author: user?.displayName || '', coverImages: [''], categories: [], status: 'مستمرة', rating: 0, isAdult: false, isDraft: false }); 
                        setView('edit-novel'); 
                      }}
                      className="group flex items-center gap-2 px-6 py-3 bg-[#c8a460] hover:bg-[#b89552] text-[#121212] rounded-2xl transition-all duration-300 shadow-lg shadow-[#c8a460]/10"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">رواية جديدة</span>
                    </button>
                  )}
                  <button onClick={() => setView('library')} className="group flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-[#c8a460] rounded-2xl transition-all duration-500">
                    <span className="text-[10px] font-black text-white/40 group-hover:text-[#121212] uppercase tracking-widest transition-colors">مشاهدة الكل</span>
                    <ChevronLeft className="w-4 h-4 text-white/20 group-hover:text-[#121212] transition-colors" />
                  </button>
                </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                  {[...novels].reverse().slice(0, 5).map((novel, idx) => (
                    <motion.div 
                      key={novel.id} 
                      initial={{ opacity: 0, y: 20 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      transition={{ delay: idx * 0.1, duration: 0.5, ease: "easeOut" }}
                      onClick={() => { setSelectedNovel(novel); setView('chapters'); }}
                      className="group relative bg-[#1e1e1e] rounded-[2rem] transition-all duration-500 cursor-pointer overflow-hidden border border-white/5 hover:border-[#c8a460]/30 hover:shadow-2xl hover:shadow-[#c8a460]/10"
                    >
                      <div className="aspect-[3/4] relative overflow-hidden">
                        {novel.coverImages?.[0] ? (
                          <img 
                            src={novel.coverImages[0]} 
                            alt={novel.name} 
                            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 group-hover:rotate-1" 
                          />
                        ) : (
                          <div className="w-full h-full bg-[#121212] flex items-center justify-center">
                            <Book className="w-12 h-12 text-white/5" />
                          </div>
                        )}
                        
                        {/* Status Badge */}
                        <div className="absolute top-4 right-4 z-20">
                          <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest backdrop-blur-xl border shadow-2xl transition-colors duration-300 ${
                            novel.status === 'مكتملة' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                            novel.status === 'متوقفة' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                            'bg-white/10 border-white/20 text-white'
                          }`}>
                            {novel.status || 'مستمرة'}
                          </div>
                        </div>

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-500" />
                        
                        {/* Card Content */}
                        <div className="absolute inset-0 p-5 flex flex-col justify-end transform transition-transform duration-500">
                          <div className="space-y-2">
                             <div className="flex items-center gap-2 mb-1">
                               {novel.categories?.filter(c => categories.some(ac => ac.name === c)).slice(0, 1).map(cat => (
                                 <span key={cat} className="text-[8px] font-bold text-amber-400 uppercase tracking-[0.2em]">{cat}</span>
                               ))}
                             </div>
                             <h3 className="text-lg font-black text-white leading-tight group-hover:text-white transition-colors line-clamp-2 text-right [direction:ltr]">
                                {novel.name}
                             </h3>
                             <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest line-clamp-1 truncate text-right [direction:ltr]">{novel.author || 'مؤلف غير معروف'}</p>
                             
                             {/* Stats on Hover */}
                             <div className="pt-2 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                               <div className="flex items-center gap-1.5">
                                 <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                 <span className="text-[10px] font-bold text-white">{novel.rating || '0.0'}</span>
                               </div>
                               <div className="h-1 w-1 rounded-full bg-white/20" />
                               <button className="text-[10px] font-black text-[#c8a460] uppercase tracking-widest hover:underline">اقرأ الآن</button>
                             </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* Latest Chapters Section */}
              <section>
                <div className="flex items-center gap-3 mb-8 px-4">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/5">
                    <Zap className="w-5 h-5 text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-black text-white">آخر الفصول المنشورة</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {latestGlobalChapters.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-[#1e1e1e] rounded-2xl border border-white/5">
                      <p className="text-white/30 text-sm font-bold">لا توجد فصول منشورة حالياً.</p>
                    </div>
                  ) : (
                    latestGlobalChapters.map((chapter, idx) => {
                      const novel = novels.find(n => n.id === chapter.novelId);
                      return (
                        <motion.div key={chapter.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                          onClick={() => { setSelectedNovel(novel || null); setReadingChapter(chapter); setView('reader'); }}
                          className="bg-[#1e1e1e] p-6 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-[#232323] transition-all cursor-pointer group shadow-xl"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#121212] rounded-xl flex items-center justify-center text-[#c8a460] font-black group-hover:bg-[#c8a460] group-hover:text-[#121212] transition-all">{chapter.order}</div>
                            <div>
                              <h4 className="text-sm font-bold text-white group-hover:text-[#c8a460] transition-colors">{chapter.title}</h4>
                              <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">{novel?.name || 'رواية غير معروفة'}</p>
                            </div>
                          </div>
                          <div className="text-[10px] text-white/20 font-bold">{formatDate(chapter.createdAt)}</div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </section>
            </motion.div>
          )}

          {/* Library View */}
          {view === 'library' && (
            <motion.div key="library" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
              <div className="bg-[#1e1e1e] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden relative">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"><GridPattern /></div>
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                  <div>
                    <h2 className="text-4xl font-black text-white mb-2">المكتبة</h2>
                    <p className="text-white/40 text-sm font-medium">استعرض مكتبة الروايات الكاملة.</p>
                  </div>
                  <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-96 group">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#c8a460] transition-colors w-5 h-5" />
                      <input type="text" placeholder="ابحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#121212] pr-12 pl-12 py-4 rounded-2xl border border-white/5 text-white outline-none focus:border-[#c8a460]/50 font-bold transition-all" />
                      {(searchTerm !== debouncedSearchTerm) && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 text-[#c8a460] animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => setIsFilterModalOpen(true)}
                      className={`relative flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                        selectedCategory !== 'الكل' || selectedStatus !== 'الكل'
                        ? 'bg-[#c8a460] text-[#121212] border-[#c8a460] shadow-lg shadow-[#c8a460]/20'
                        : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      تصفية
                      {(selectedCategory !== 'الكل' || selectedStatus !== 'الكل') && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-[#121212] rounded-full flex items-center justify-center text-[8px] font-black border-2 border-[#1e1e1e]">
                          !
                        </span>
                      )}
                    </button>

                    {isAdmin && (
                      <button onClick={() => { setEditingNovel({ name: '', description: '', author: user?.displayName || '', coverImages: [''], categories: [], status: 'مستمرة', rating: 0, isAdult: false, isDraft: false }); setView('edit-novel'); }}
                        className="bg-[#c8a460] text-[#121212] px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-[#c8a460]/10">إضافة</button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {isFilterModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsFilterModalOpen(false)}
                        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                      />
                      
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-2xl bg-[#1e1e1e] rounded-[2.5rem] border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.5)] overflow-hidden"
                      >
                        {/* Header */}
                        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#c8a460]/10 rounded-2xl flex items-center justify-center border border-[#c8a460]/20">
                              <SlidersHorizontal className="w-6 h-6 text-[#c8a460]" />
                            </div>
                            <div>
                              <h3 className="text-xl font-black text-white">خيارات التصفية</h3>
                              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-0.5">تخصيص نتائج البحث</p>
                            </div>
                          </div>
                          <button onClick={() => setIsFilterModalOpen(false)} className="p-3 bg-white/5 hover:bg-red-500/20 text-white/20 hover:text-red-500 rounded-xl transition-all">
                            <X className="w-6 h-6" />
                          </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 space-y-10 max-h-[60vh] overflow-y-auto scrollbar-hide">
                          {/* Status Section */}
                          <section>
                            <div className="flex items-center gap-3 mb-6">
                              <Activity className="w-4 h-4 text-[#c8a460]" />
                              <h4 className="text-sm font-black text-white/50 uppercase tracking-[0.2em]">حالة الرواية</h4>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-right" dir="rtl">
                              {[
                                { id: 'الكل', label: 'الكل', icon: SlidersHorizontal, color: 'text-white' },
                                { id: 'مستمرة', label: 'مستمرة', icon: Loader2, color: 'text-white' },
                                { id: 'مكتملة', label: 'مكتملة', icon: CheckCircle2, color: 'text-green-400' },
                                { id: 'متوقفة', label: 'متوقفة', icon: PauseCircle, color: 'text-red-400' }
                              ].map((status) => (
                                <button
                                  key={status.id}
                                  onClick={() => setSelectedStatus(status.id)}
                                  className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${
                                    selectedStatus === status.id 
                                    ? 'bg-[#c8a460]/10 border-[#c8a460] shadow-lg shadow-[#c8a460]/5' 
                                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                                  }`}
                                >
                                  <status.icon className={`w-5 h-5 ${selectedStatus === status.id ? 'text-[#c8a460]' : status.color}`} />
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${selectedStatus === status.id ? 'text-white' : 'text-white/40'}`}>
                                    {status.label}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </section>

                          {/* Categories Section */}
                          <section>
                            <div className="flex items-center gap-3 mb-6">
                              <Tags className="w-4 h-4 text-[#c8a460]" />
                              <h4 className="text-sm font-black text-white/50 uppercase tracking-[0.2em]">التصنيف / النوع</h4>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-right" dir="rtl">
                              <button
                                onClick={() => setSelectedCategory('الكل')}
                                className={`flex items-center justify-center p-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                                  selectedCategory === 'الكل' 
                                  ? 'bg-[#c8a460] text-[#121212] border-[#c8a460]' 
                                  : 'bg-white/5 border-white/5 text-white/30 hover:text-white'
                                }`}
                              >
                                الكل
                              </button>
                              {categories.map((cat) => (
                                <button
                                  key={cat.id}
                                  onClick={() => setSelectedCategory(cat.name)}
                                  className={`flex items-center justify-center p-4 rounded-xl border text-[10px] font-black transition-all ${
                                    selectedCategory === cat.name 
                                    ? 'bg-[#c8a460] text-[#121212] border-[#c8a460]' 
                                    : 'bg-white/5 border-white/5 text-white/30 hover:text-white'
                                  }`}
                                >
                                  {cat.name}
                                </button>
                              ))}
                            </div>
                          </section>
                        </div>

                        {/* Footer */}
                        <div className="p-8 border-t border-white/5 flex gap-4 bg-white/[0.01]">
                          <button 
                            onClick={() => {
                              setSelectedCategory('الكل');
                              setSelectedStatus('الكل');
                              setIsFilterModalOpen(false);
                            }}
                            className="flex-1 px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all"
                          >
                            تفريغ
                          </button>
                          <button 
                            onClick={() => setIsFilterModalOpen(false)}
                            className="flex-1 px-8 py-4 bg-[#c8a460] hover:bg-[#b89552] text-[#121212] font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-[#c8a460]/20"
                          >
                            تطبيق
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {filteredNovels.map((novel) => (
                  <motion.div 
                    key={novel.id} 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    whileHover={{ y: -5 }}
                    onClick={() => { setSelectedNovel(novel); setView('chapters'); }}
                    className="group relative bg-[#1e1e1e] rounded-3xl transition-all duration-500 cursor-pointer overflow-hidden border border-white/5 hover:border-[#c8a460]/20 hover:shadow-2xl shadow-black/50"
                  >
                    <div className="aspect-[3/4] relative overflow-hidden">
                      {novel.coverImages?.[0] ? (
                        <img 
                          src={novel.coverImages[0]} 
                          alt={novel.name} 
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" 
                        />
                      ) : (
                        <div className="w-full h-full bg-[#121212] flex items-center justify-center">
                          <Book className="w-10 h-10 text-white/5" />
                        </div>
                      )}
                      
                      {/* Status Badge */}
                      <div className="absolute top-3 left-3 z-20">
                        <div className={`px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest backdrop-blur-md border shadow-lg ${
                          novel.status === 'مكتملة' ? 'bg-green-500/20 border-green-500/20 text-green-400' :
                          novel.status === 'متوقفة' ? 'bg-red-500/20 border-red-500/20 text-red-400' :
                          'bg-white/10 border-white/20 text-white'
                        }`}>
                          {novel.status || 'مستمرة'}
                        </div>
                      </div>

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                      
                      {/* Content */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="text-white text-xs font-bold leading-tight line-clamp-1 group-hover:text-white transition-colors mb-1 text-right [direction:ltr]">
                          <HighlightText text={novel.name} highlight={debouncedSearchTerm} />
                        </h3>
                        <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                          <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest line-clamp-1 truncate text-right [direction:ltr]">{novel.author || 'مؤلف غير معروف'}</p>
                          <div className="flex items-center gap-1">
                            <Star className="w-2 h-2 text-yellow-500 fill-yellow-500" />
                            <span className="text-[8px] font-bold text-white">{novel.rating || '0.0'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Legacy Novels View Removed */}
          {false && (
            <div />
          )}
          {/* Fixing damaged block */}
          {false && (
            <div 
              title="تصفية حسب التصنيف"
            >
              <SlidersHorizontal className="w-6 h-6" />
              {selectedCategory !== 'الكل' && (
                <span className="absolute -top-1 -left-1 w-3 h-3 bg-[#c8a460] rounded-full border-2 border-[#121212]" />
              )}
            </div>
          )}
          {/* Continuing cleanup */}
          {false && (
            <div>
              <div className="flex items-center gap-3">
                <div />
              </div>
            </div>
          )}
          {/* Final Cleanup Complete */}
          {false && (
            <div />
          )}

          {/* Chapters View (Novel Details) */}
          {view === 'chapters' && currentNovel && (
            <motion.div 
              key="chapters"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setView('library')}
                  className="flex items-center gap-3 px-6 py-3 bg-[#1e1e1e] hover:bg-[#252525] text-white/70 hover:text-white rounded-2xl border border-white/5 transition-all group shadow-xl"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-sm font-bold">العودة للمكتبة</span>
                </button>
              </div>

              {/* Compact Novel Details Header */}
              <div className="bg-[#1e1e1e] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-xl relative mb-10">
                <div className="flex flex-col md:flex-row relative z-10">
                  {/* Left: Compact Cover Area */}
                  <div className="md:w-[240px] aspect-[2/3] md:aspect-auto flex items-center justify-center p-6 bg-[#121212]/50">
                    <CoverSlider images={currentNovel.coverImages || []} />
                  </div>

                  {/* Right: Refined Info Area */}
                  <div className="flex-1 p-8 md:p-10 flex flex-col justify-center">
                    <div className="mb-6">
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border ${
                            currentNovel.status === 'مستمرة' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : 
                            currentNovel.status === 'مكتملة' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 
                            'bg-white/5 border-white/10 text-white/40'
                        }`}>
                          {currentNovel.status || 'غير محدد'}
                        </span>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121212] rounded-xl border border-white/5">
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                          <span className="text-xs font-black text-white">{currentNovel.rating || '0.0'}</span>
                        </div>
                        {currentNovel.isAdult && (
                          <span className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-xl">
                            +16
                          </span>
                        )}
                      </div>

                      <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight mb-4">
                        {currentNovel.name}
                      </h2>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                          <UserIcon className="w-4 h-4 text-[#c8a460]" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">المؤلف</p>
                          <h4 className="text-lg font-black text-white tracking-wide">{currentNovel.author}</h4>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end pt-6 border-t border-white/5">
                      <div>
                        <h4 className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">التصنيفات</h4>
                        <div className="flex flex-wrap gap-2">
                          {currentNovel.categories?.filter(c => categories.some(ac => ac.name === c)).map((cat, i) => (
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
                          <span className="text-2xl font-black text-white block -mb-1">{currentNovel.volumes?.length || 0}</span>
                          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">مجلد</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Adult Content Warning */}
              <AnimatePresence>
                {showAdultWarning && (currentNovel.isAdult || currentNovel.categories?.includes('إيتشي')) && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mb-8 p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-center justify-between gap-6"
                  >
                    <div className="flex items-center gap-4 text-right">
                      <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white mb-1">تنبيه المحتوى</h4>
                        <p className="text-xs font-medium text-white/50 leading-relaxed">
                          هذه الرواية مخصصة للبالغين وقد تحتوي على مشاهد عنيفة، إيحاءات، أو محتوى غير مناسب للجمهور العام. يرجى المتابعة بمسؤولية.
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowAdultWarning(false)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 text-white/20 hover:text-white transition-all shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Story Section - Simple & Compact */}
              <div className="mb-10 bg-[#1e1e1e]/40 p-8 rounded-[2rem] border border-white/5">
                <h4 className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  القصة
                </h4>
                <p className="text-white/40 leading-[1.8] text-sm font-medium italic">
                  {currentNovel.description || 'لا يوجد وصف متاح لهذه الرواية حالياً.'}
                </p>
              </div>

              {/* Cover Gallery Section */}
              {currentNovel.coverImages && currentNovel.coverImages.filter(img => img && img.trim() !== '').length > 0 && (
                <div className="mb-12 bg-[#1e1e1e] p-10 rounded-[3rem] border border-white/5 shadow-xl">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                      <ImageIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-black text-white">صور الرواية</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {currentNovel.coverImages.filter(img => img && img.trim() !== '').map((img, idx) => (
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
                    <Book className="w-6 h-6 text-[#c8a460]" />
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
                    {(currentNovel.volumes || []).sort((a, b) => a.order - b.order).map(volume => {
                      const volumeChapters = chapters
                        .filter(c => c.volumeId === volume.id || c.volumeId === volume.name)
                        .filter(c => isAdmin || !c.isDraft)
                        .slice(0, visibleChaptersCount);
                      const isExpanded = expandedVolumes.includes(volume.id);
                      
                      return (
                        <div key={volume.id} className="bg-[#1e1e1e] rounded-[1.5rem] border border-white/5 overflow-hidden shadow-xl transition-all">
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
                                isExpanded ? 'bg-[#c8a460] border-[#c8a460] text-[#121212]' : 'bg-[#121212] border-white/5 text-white/20'
                              }`}>
                                <Layers className="w-6 h-6" />
                              </div>
                              <div className="text-right">
                                <h4 className="font-black text-xl text-white group-hover:text-[#c8a460] transition-colors mb-1">{volume.name}</h4>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{volumeChapters.length} فصلاً متاحاً</span>
                                  {isAdmin && (
                                    <div className="flex items-center gap-1.5 mr-3">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const initialSelected = chapters
                                            .filter(c => c.volumeId === volume.id || c.volumeId === volume.name)
                                            .map(c => c.id);
                                          setSelectedChapterIdsForVolume(initialSelected);
                                          setSelectingVolumeForChapters(volume);
                                          setVolumeChapterSearch('');
                                        }}
                                        className="flex items-center gap-1 px-3 py-1 bg-[#c8a460]/10 hover:bg-[#c8a460] text-[#c8a460] hover:text-[#121212] rounded-xl text-xs font-black transition-all border border-[#c8a460]/20 shadow-sm active:scale-95"
                                        title="إضافة وتحديد فصول هذا المجلد"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>تحديد الفصول</span>
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          editVolume(volume.id, volume.name);
                                        }}
                                        className="p-1.5 text-white/30 hover:text-white bg-[#121212] hover:bg-white/10 rounded-xl border border-white/5 transition-all"
                                        title="تعديل اسم المجلد"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteVolume(volume.id);
                                        }}
                                        className="p-1.5 text-white/30 hover:text-red-400 bg-[#121212] hover:bg-red-500/10 rounded-xl border border-white/5 transition-all"
                                        title="حذف المجلد"
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
                                isExpanded ? 'border-[#c8a460]/20 text-[#c8a460]' : 'border-white/5 text-white/20'
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
                                className="bg-[#232323]/30"
                              >
                                <div className="px-10 pb-10 space-y-3">
                                  <div className="h-px bg-white/5 w-full mb-6" />
                                  {volumeChapters.length === 0 ? (
                                    <div className="py-12 text-center bg-[#121212]/40 rounded-[2rem] border border-dashed border-white/5">
                                      <FileQuestion className="w-12 h-12 text-white/5 mx-auto mb-4" />
                                      <p className="text-white/20 text-xs font-black uppercase tracking-widest mb-4">لا توجد فصول في هذا المجلد حالياً</p>
                                      {isAdmin && (
                                        <button
                                          onClick={() => {
                                            const initialSelected = chapters
                                              .filter(c => c.volumeId === volume.id || c.volumeId === volume.name)
                                              .map(c => c.id);
                                            setSelectedChapterIdsForVolume(initialSelected);
                                            setSelectingVolumeForChapters(volume);
                                            setVolumeChapterSearch('');
                                          }}
                                          className="inline-flex items-center gap-2 bg-[#c8a460] hover:bg-[#b89552] text-[#121212] px-6 py-3 rounded-xl font-black text-xs transition-all shadow-lg shadow-[#c8a460]/10 active:scale-95 cursor-pointer"
                                        >
                                          <Plus className="w-4 h-4" />
                                          اختر الفصول التابعة لهذا المجلد
                                        </button>
                                      )}
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
                        .filter(c => !c.volumeId || !(currentNovel.volumes || []).some(v => v.id === c.volumeId || v.name === c.volumeId))
                        .filter(c => isAdmin || !c.isDraft)
                        .slice(0, visibleChaptersCount);
                      if (uncategorized.length === 0) return null;

                      const isExpanded = expandedVolumes.includes('uncategorized');
                      return (
                        <div className="bg-[#1e1e1e] rounded-[1.5rem] border border-white/5 overflow-hidden shadow-xl transition-all">
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
                                isExpanded ? 'bg-[#c8a460] border-[#c8a460] text-[#121212]' : 'bg-[#121212] border-white/5 text-white/20'
                              }`}>
                                <Book className="w-6 h-6" />
                              </div>
                              <div className="text-right">
                                <h4 className="font-black text-xl text-white group-hover:text-[#c8a460] transition-colors mb-1">الفصول العامة</h4>
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{uncategorized.length} فصلاً مستقلاً</p>
                              </div>
                            </div>
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-colors ${
                                isExpanded ? 'border-[#c8a460]/20 text-[#c8a460]' : 'border-white/5 text-white/20'
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
                                className="bg-[#232323]/30"
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
                    <div className="w-10 h-10 bg-[#c8a460]/10 rounded-xl flex items-center justify-center border border-[#c8a460]/20">
                      <Settings2 className="w-5 h-5 text-[#c8a460]" />
                    </div>
                    <h3 className="text-xl font-black text-white">إدارة الرواية</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-20">
                    <button 
                      onClick={() => {
                        setEditingChapter({ novelId: currentNovel.id, title: '', content: '', order: chapters.length + 1, date: new Date().toLocaleDateString('ar-EG') });
                        setView('edit-chapter');
                      }}
                      className="flex items-center justify-center gap-3 bg-[#c8a460] hover:bg-[#b89552] text-[#121212] px-8 py-5 rounded-[1.8rem] font-black transition-all shadow-xl shadow-[#c8a460]/20 active:scale-95 group"
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
                        const currentCovers = currentNovel.coverImages || [];
                        setEditingNovel({ ...currentNovel, coverImages: currentCovers.length > 0 ? currentCovers : [''] });
                        setView('edit-novel');
                      }}
                      className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white px-8 py-5 rounded-[1.8rem] font-black border border-white/10 transition-all active:scale-95 group"
                    >
                      <Edit className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
                      تعديل البيانات
                    </button>

                    <button 
                      onClick={() => deleteNovel(currentNovel.id)}
                      className="flex items-center justify-center gap-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-8 py-5 rounded-[1.8rem] font-black border border-red-500/10 transition-all active:scale-95 group"
                    >
                      <Trash2 className="w-5 h-5 transition-colors" />
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

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowReaderSidebar(true)}
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all border border-white/5"
                    title="قائمة الفصول"
                  >
                    <List className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => setShowReaderSettings(true)}
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-[#c8a460] hover:text-[#121212] transition-all border border-white/5"
                    title="إعدادات القراءة"
                  >
                    <Settings className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Reader UI Sidebar */}
              <AnimatePresence>
                {showReaderSidebar && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowReaderSidebar(false)}
                      className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div 
                      initial={{ x: '-100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '-100%' }}
                      className="fixed top-0 left-0 bottom-0 w-80 z-[170] bg-[#1a1a1a] border-r border-white/5 flex flex-col shadow-2xl"
                    >
                      <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="font-black text-white uppercase tracking-widest text-sm">الفصول</h3>
                        <button 
                          onClick={() => setShowReaderSidebar(false)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-white/40"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-1">
                        {[...chapters].sort((a, b) => a.order - b.order).map((chapter) => (
                          <button
                            key={chapter.id}
                            onClick={() => {
                              setReadingChapter(chapter);
                              setShowReaderSidebar(false);
                              window.scrollTo(0, 0);
                            }}
                            className={`w-full text-right px-4 py-3 rounded-xl transition-all flex items-center justify-between group ${
                              readingChapter.id === chapter.id 
                                ? 'bg-[#c8a460] text-[#121212]' 
                                : 'text-white/40 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] font-black w-6 h-6 rounded-md flex items-center justify-center border ${
                                readingChapter.id === chapter.id ? 'border-[#121212]/20 bg-[#121212]/10' : 'border-white/5 bg-white/5'
                              }`}>
                                {chapter.order}
                              </span>
                              <span className="font-bold text-sm truncate max-w-[180px]">{chapter.title}</span>
                            </div>
                            {readingChapter.id === chapter.id && <div className="w-1.5 h-1.5 rounded-full bg-[#121212]" />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

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
                            onClick={() => setLightboxImage(url)}
                            className="max-w-[70%] rounded-2xl shadow-2xl border border-white/10 cursor-zoom-in hover:scale-[1.02] transition-transform"
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
                    className="w-full md:w-auto px-10 py-5 rounded-2xl bg-[#c8a460] hover:bg-[#b89552] text-[#121212] font-black flex items-center justify-center gap-3 transition-all shadow-xl shadow-[#c8a460]/20 disabled:opacity-20"
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
                      <div className="w-10 h-10 bg-[#c8a460]/20 rounded-xl flex items-center justify-center">
                        <Type className="w-5 h-5 text-[#c8a460]" />
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
                          className="flex-1 accent-[#c8a460] h-1 bg-white/5 rounded-full appearance-none cursor-pointer"
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
                        className="w-full accent-[#c8a460] h-1 bg-white/5 rounded-full appearance-none cursor-pointer"
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
                                ? 'bg-[#c8a460] border-[#c8a460] text-[#121212]' 
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
                    onClick={() => setView(editingNovel.id ? 'chapters' : 'home')}
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
                      <div className="absolute top-0 right-0 w-64 h-64 bg-[#c8a460]/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
                      
                      <div className="flex items-center gap-3 mb-8 relative z-10">
                        <div className="w-10 h-10 bg-[#c8a460]/10 rounded-xl flex items-center justify-center border border-[#c8a460]/20">
                          <Book className="w-5 h-5 text-[#c8a460]" />
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
                            className="w-full px-6 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#c8a460]/50 outline-none transition-all font-bold placeholder:text-white/10"
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
                            className="w-full px-6 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#c8a460]/50 outline-none transition-all font-bold"
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
                              className="w-full px-6 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#c8a460]/50 outline-none transition-all font-bold"
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
                            className="w-full px-6 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#c8a460]/50 outline-none transition-all leading-relaxed resize-none font-medium text-sm scrollbar-hide"
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
                                  className="w-full pl-6 pr-14 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#c8a460]/50 outline-none transition-all font-mono text-xs overflow-hidden text-ellipsis"
                                  placeholder={`رابط الصورة ${idx + 1}...`}
                                />
                                <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none text-white/20 group-focus-within:text-[#c8a460] transition-colors">
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
                          className="w-full py-5 flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/5 text-white/20 hover:border-[#c8a460]/40 hover:text-[#c8a460] hover:bg-[#c8a460]/5 transition-all group mt-2"
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
                          <div className="flex items-center justify-between mb-4">
                            <label className="block text-xs font-black text-white/40 uppercase tracking-widest">التصنيفات</label>
                            {isAdmin && (
                              <button 
                                type="button"
                                onClick={addCategory}
                                className="w-8 h-8 bg-[#c8a460]/10 text-[#c8a460] hover:bg-[#c8a460] hover:text-[#121212] rounded-lg flex items-center justify-center transition-all border border-[#c8a460]/20 shadow-sm"
                                title="إضافة تصنيف جديد"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 p-1">
                            {categories.map(cat => {
                              const isSelected = editingNovel.categories?.includes(cat.name);
                              return (
                                <div key={cat.id} className="relative group/cat">
                                  <button
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
                                        ? 'bg-[#c8a460] text-[#121212] border-[#c8a460] scale-110' 
                                        : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'
                                    }`}
                                  >
                                    {cat.name}
                                  </button>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const result = await Swal.fire({
                                          title: 'هل أنت متأكد؟',
                                          text: `سيتم حذف تصنيف "${cat.name}" نهائياً!`,
                                          icon: 'warning',
                                          showCancelButton: true,
                                          confirmButtonColor: '#ef4444',
                                          cancelButtonColor: '#675b5b',
                                          confirmButtonText: 'نعم، احذف',
                                          cancelButtonText: 'إلغاء',
                                          background: '#1e1e1e',
                                          color: '#fff'
                                        });

                                        if (result.isConfirmed) {
                                          try {
                                            // 1. Delete the category from the categories collection
                                            await deleteDoc(doc(db, 'categories', cat.id));
                                            
                                            // Reset selected category if it was the deleted one
                                            if (selectedCategory === cat.name) {
                                              setSelectedCategory('الكل');
                                            }
                                            
                                            // 2. Dynamic cleanup: Remove this category name from all novels' categories array
                                            const novelsWithCat = novels.filter(n => n.categories?.includes(cat.name));
                                            for (const novel of novelsWithCat) {
                                              const updatedCategories = novel.categories?.filter(c => c !== cat.name) || [];
                                              await updateDoc(doc(db, 'novels', novel.id), {
                                                categories: updatedCategories
                                              });
                                            }

                                            Swal.fire({
                                              title: 'تم الحذف والتحديث بنجاح',
                                              icon: 'success',
                                              toast: true,
                                              position: 'top-end',
                                              showConfirmButton: false,
                                              timer: 3000,
                                              background: '#1e1e1e',
                                              color: '#fff'
                                            });
                                          } catch (error) {
                                            console.error("Error deleting category:", error);
                                            Swal.fire({
                                              title: 'خطأ',
                                              text: 'فشل حذف التصنيف',
                                              icon: 'error',
                                              background: '#1e1e1e',
                                              color: '#fff'
                                            });
                                          }
                                        }
                                      }}
                                      className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-[#121212] border border-white/10 text-white/20 hover:text-red-500 hover:border-red-500/50 rounded-full flex items-center justify-center opacity-0 group-hover/cat:opacity-100 transition-all shadow-xl hover:scale-110 z-10"
                                      title="حذف التصنيف"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Preview Section - Sidebar Version */}
                    <div className="p-8 bg-[#121212] rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-[#c8a460]/5 rounded-full blur-[80px] -mr-24 -mt-24 pointer-events-none" />
                      
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
                            <h3 className="font-black text-2xl text-white leading-tight group-hover:text-[#c8a460] transition-colors">
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
                              'bg-[#c8a460]/10 border-[#c8a460]/20 text-[#c8a460]'
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
                      className="flex-1 flex items-center justify-center gap-3 bg-[#c8a460] hover:bg-[#b89552] text-[#121212] font-black py-5 rounded-[1.8rem] transition-all shadow-xl shadow-[#c8a460]/20 disabled:opacity-50 group active:scale-95"
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
                      onClick={() => setView('library')}
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
                          className="w-full pl-6 pr-14 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#c8a460]/50 outline-none transition-all font-bold"
                          placeholder="أدخل عنوان الفصل..."
                        />
                        <Type className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#c8a460] transition-colors" />
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
                          className="w-full pl-6 pr-14 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#c8a460]/50 outline-none transition-all font-bold"
                        />
                        <Hash className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#c8a460] transition-colors" />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-3">التاريخ</label>
                      <div className="relative group">
                        <input 
                          type="text"
                          value={editingChapter.date || ''}
                          onChange={e => setEditingChapter({...editingChapter, date: e.target.value})}
                          className="w-full pl-6 pr-14 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#c8a460]/50 outline-none transition-all font-bold"
                          placeholder="13/3/2026"
                        />
                        <Calendar className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#c8a460] transition-colors" />
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
                          ...(currentNovel?.volumes?.map(vol => ({ value: vol.id, label: vol.name })) || [])
                        ]}
                      />
                    </div>

                    <div className="md:col-span-12 flex flex-wrap gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => setEditingChapter({...editingChapter, isEndOfVolume: !editingChapter.isEndOfVolume})}
                        className={`flex items-center gap-3 px-8 py-4 rounded-2xl border transition-all font-black text-[10px] uppercase tracking-widest ${
                          editingChapter.isEndOfVolume 
                            ? 'bg-[#c8a460]/10 border-[#c8a460]/40 text-[#c8a460]' 
                            : 'bg-[#121212] border-white/5 text-white/20 hover:border-white/10 hover:text-white'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded shadow-inner flex items-center justify-center border ${editingChapter.isEndOfVolume ? 'bg-[#c8a460] border-transparent' : 'bg-transparent border-white/10 text-transparent'}`}>
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
                  <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#c8a460]/5 rounded-full blur-[100px] -mr-32 -mb-32 pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#c8a460]/10 rounded-xl flex items-center justify-center border border-[#c8a460]/20">
                        <FileText className="w-5 h-5 text-[#c8a460]" />
                      </div>
                      <h3 className="text-lg font-black text-white">محتوى الفصل</h3>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-[10px] text-white/20 font-black uppercase tracking-[0.2em] hidden sm:block">يدعم تنسيق Markdown لجمال أكبر</span>
                      <button
                        type="button"
                        onClick={() => setShowImagePopup(true)}
                        className="flex items-center gap-3 px-6 py-4 bg-[#c8a460] hover:bg-[#b89552] text-[#121212] rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[#c8a460]/20 group active:scale-95"
                      >
                        <ImageIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        إدراج صورة
                      </button>
                    </div>
                  </div>
                  
                  <div className="relative group z-10">
                    <div className="absolute inset-0 bg-[#0a0a0a]/50 rounded-[2rem] blur-2xl -z-10 group-focus-within:bg-[#c8a460]/5 transition-colors" />
                    <textarea 
                      ref={textareaRef}
                      required
                      rows={25}
                      value={editingChapter.content}
                      onChange={e => setEditingChapter({...editingChapter, content: e.target.value})}
                      className="w-full px-10 py-10 rounded-[2.5rem] border border-white/5 bg-[#121212]/90 text-white/90 focus:ring-2 focus:ring-[#c8a460]/50 outline-none transition-all leading-[2] resize-none font-medium text-lg scrollbar-hide shadow-inner"
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
                      className="flex-1 flex items-center justify-center gap-3 bg-[#c8a460] hover:bg-[#b89552] text-[#121212] font-black py-5 rounded-[1.8rem] transition-all shadow-xl shadow-[#c8a460]/20 disabled:opacity-50 group active:scale-95"
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
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-[#c8a460]/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#c8a460]/20 rounded-xl flex items-center justify-center border border-[#c8a460]/30">
                    <ImageIcon className="w-5 h-5 text-[#c8a460]" />
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
                        className="w-full pl-6 pr-14 py-5 rounded-2xl border border-white/5 bg-[#121212] text-white focus:ring-2 focus:ring-[#c8a460]/50 outline-none transition-all font-mono text-xs group-hover:border-white/10"
                        autoFocus
                      />
                      <Link className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#c8a460] transition-colors w-4 h-4" />
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
                    className="w-full py-5 bg-[#c8a460] hover:bg-[#b89552] text-[#121212] font-black rounded-2xl transition-all shadow-xl shadow-[#c8a460]/20 disabled:opacity-50 active:scale-95"
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

      {/* Select Chapters for Volume Modal */}
      <AnimatePresence>
        {selectingVolumeForChapters && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#1e1e1e] w-full max-w-2xl rounded-[2.5rem] border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-[#c8a460]/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#c8a460]/20 rounded-xl flex items-center justify-center border border-[#c8a460]/30">
                    <Layers className="w-5 h-5 text-[#c8a460]" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-lg tracking-tight">
                      تحديد فصول المجلد: {selectingVolumeForChapters.name}
                    </h3>
                    <p className="text-white/40 text-xs mt-0.5">
                      اختر الفصول المراد ربطها بهذا المجلد
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectingVolumeForChapters(null);
                    setSelectedChapterIdsForVolume([]);
                    setVolumeChapterSearch('');
                  }} 
                  className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-xl transition-all"
                >
                  <X className="w-5 h-5 text-white/40" />
                </button>
              </div>
              
              {/* Search & Actions Bar */}
              <div className="p-6 border-b border-white/5 bg-[#121212]/50 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full sm:w-auto flex-1">
                    <input 
                      type="text"
                      placeholder="ابحث برقم أو عنوان الفصل..."
                      value={volumeChapterSearch}
                      onChange={e => setVolumeChapterSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/5 bg-[#121212] text-white text-xs focus:ring-2 focus:ring-[#c8a460]/50 outline-none transition-all"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const filteredIds = chapters
                          .filter(c => {
                            if (!volumeChapterSearch.trim()) return true;
                            const term = volumeChapterSearch.toLowerCase();
                            return (c.title || '').toLowerCase().includes(term) || String(c.order).includes(term);
                          })
                          .map(c => c.id);
                        setSelectedChapterIdsForVolume(prev => Array.from(new Set([...prev, ...filteredIds])));
                      }}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 text-xs font-black rounded-xl border border-white/5 transition-all"
                    >
                      تحديد الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChapterIdsForVolume([])}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 text-xs font-black rounded-xl border border-white/5 transition-all"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-white/40 font-bold px-1">
                  <span>إجمالي فصول الرواية: {chapters.length}</span>
                  <span className="text-[#c8a460]">
                    تم تحديد: {selectedChapterIdsForVolume.length} فصل
                  </span>
                </div>
              </div>

              {/* Chapters List */}
              <div className="p-6 overflow-y-auto space-y-2 flex-1">
                {chapters.length === 0 ? (
                  <div className="py-12 text-center text-white/30 text-xs font-bold">
                    لا توجد فصول متاحة لهذه الرواية بعد.
                  </div>
                ) : (
                  chapters
                    .filter(c => {
                      if (!volumeChapterSearch.trim()) return true;
                      const term = volumeChapterSearch.toLowerCase();
                      return (c.title || '').toLowerCase().includes(term) || String(c.order).includes(term);
                    })
                    .map(chapter => {
                      const isSelected = selectedChapterIdsForVolume.includes(chapter.id);
                      const currentVol = (currentNovel?.volumes || []).find(v => v.id === chapter.volumeId || v.name === chapter.volumeId);
                      const isAssignedToOther = currentVol && currentVol.id !== selectingVolumeForChapters.id;

                      return (
                        <div
                          key={chapter.id}
                          onClick={() => {
                            setSelectedChapterIdsForVolume(prev => 
                              prev.includes(chapter.id) 
                                ? prev.filter(id => id !== chapter.id)
                                : [...prev, chapter.id]
                            );
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected 
                              ? 'bg-[#c8a460]/10 border-[#c8a460]/40 text-white' 
                              : 'bg-[#121212]/60 border-white/5 text-white/60 hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-[#c8a460] border-[#c8a460] text-[#121212]' 
                                : 'border-white/20 bg-transparent'
                            }`}>
                              {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                            </div>

                            <div>
                              <h4 className="font-black text-sm text-white flex items-center gap-2">
                                <span>الفصل {chapter.order}:</span>
                                <span>{chapter.title}</span>
                              </h4>
                              {isAssignedToOther && (
                                <span className="text-[10px] font-black text-yellow-500/80 bg-yellow-500/10 px-2 py-0.5 rounded-md mt-1 inline-block">
                                  موجود حالياً في: {currentVol.name}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right text-[10px] text-white/30 font-mono">
                            {formatDate(chapter.updatedAt || chapter.createdAt || chapter.date)}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-white/5 bg-[#121212]/80 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectingVolumeForChapters(null);
                    setSelectedChapterIdsForVolume([]);
                    setVolumeChapterSearch('');
                  }}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-black text-xs rounded-xl transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={saveVolumeChapters}
                  disabled={savingVolumeChapters}
                  className="px-8 py-3 bg-[#c8a460] hover:bg-[#b89552] text-[#121212] font-black text-xs rounded-xl transition-all shadow-lg shadow-[#c8a460]/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {savingVolumeChapters ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>حفظ الفصول المحددة</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
