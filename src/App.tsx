import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
  Plus, History, Search, Printer, Download, 
  Shield, User, Phone, Briefcase, Award, 
  ChevronRight, Languages, Loader2, Camera,
  Eye, X, Check, Database as DbIcon, RefreshCw, HardDrive,
  ShieldAlert, Edit, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import { translateText } from './services/gemini';
import { db, auth } from './lib/firebase';
import { 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  signInAnonymously
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  setDoc,
  getDoc,
  limit,
  or
} from 'firebase/firestore';

// --- Types ---

interface IDRecord {
  id: string;
  id_number: string;
  full_name_am: string;
  full_name_en: string;
  rank_am: string;
  rank_en: string;
  responsibility_am: string;
  responsibility_en: string;
  phone: string;
  photo_url: string;
  blood_type: string;
  badge_number: string;
  gender: string;
  complexion: string;
  height: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  commissioner_signature: string;
  member_signature?: string;
  created_at: string;
  issued_at: string;
  expires_at: string;
  deleted?: boolean;
  status: 'pending' | 'approved' | 'rejected';
  created_by_email?: string;
}

interface User {
  id: string;
  email: string;
  role: 'Administrator' | 'Data Entry' | 'Viewer';
  active?: boolean;
}

interface Assets {
  bgr_flag?: string;
  eth_flag?: string;
  police_logo?: string;
  commissioner_signature?: string;
}

// --- Helper Functions ---

const resizeImage = (base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(base64Str);
  });
};

// --- Components ---

const IDCardFront = React.forwardRef<HTMLDivElement, { data: Partial<IDRecord>, assets: Assets }>(({ data, assets }, ref) => {
  return (
    <div 
      ref={ref}
      className="relative w-[85.6mm] h-[53.98mm] rounded-[3.18mm] overflow-hidden flex flex-col p-[1.5mm] select-none box-border"
      style={{ 
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
        background: 'linear-gradient(135deg, #fbbf24 0%, #fcd34d 40%, #ffedd5 60%, #fff7ed 100%)',
        border: 'none'
      }}
    >
      {/* Background Pattern / Security Element */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none flex items-center justify-center">
        <Shield size={200} style={{ color: '#1e3a8a' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex justify-between items-start h-12 px-2 pt-1 pb-1 border-b border-black/10">
        <img 
          src={assets.bgr_flag || "https://picsum.photos/seed/bgr/100/60"} 
          className="h-7 w-12 object-cover rounded-sm shadow-sm" 
          alt="BGR Flag" 
          crossOrigin="anonymous"
        />
        <div className="flex flex-col items-center -mt-1">
          <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-[#fbbf24] shadow-sm">
            <img 
              src={assets.police_logo || "https://picsum.photos/seed/logo/120/120"} 
              className="w-full h-full object-contain mix-blend-multiply" 
              alt="Police Logo" 
              crossOrigin="anonymous"
            />
          </div>
        </div>
        <img 
          src={assets.eth_flag || "https://picsum.photos/seed/eth/100/60"} 
          className="h-7 w-12 object-cover rounded-sm shadow-sm" 
          alt="ETH Flag" 
          crossOrigin="anonymous"
        />
      </div>

      {/* Commission Name */}
      <div className="relative z-10 text-center mb-0.5 mt-0.5">
        <h1 className="text-[7px] font-extrabold leading-none tracking-tight" style={{ color: '#000000' }}>የቤንሻንጉል ጉምዝ ክልል ፖሊስ ኮሚሽን</h1>
        <h2 className="text-[5.5px] font-bold uppercase tracking-tighter leading-none mt-0.5" style={{ color: '#111827' }}>Benishangul-Gumuz Region Police Commission</h2>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-1 gap-1 px-1 overflow-hidden">
        {/* Left Column: Details */}
        <div className="w-[56mm] flex flex-col justify-center py-0.5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm bg-black/5 border border-black/10">
              <span className="text-[4px] font-bold uppercase text-slate-600">መለያ ቁጥር / ID NO:</span>
              <span className="text-[8px] font-black text-black tracking-wider">{data.id_number || "BGR-POL-1600000"}</span>
            </div>
            
            <div className="p-1 rounded-sm border-l-2 bg-white/40" style={{ borderLeftColor: '#1e3a8a' }}>
              <div className="text-[4px] font-bold uppercase text-slate-500">ሙሉ ስም / FULL NAME</div>
              <div className="text-[8px] font-bold leading-tight truncate text-black">{data.full_name_am}</div>
              <div className="text-[6.5px] font-semibold uppercase leading-tight truncate text-slate-700">{data.full_name_en}</div>
            </div>

            <div className="grid grid-cols-2 gap-1">
              <div>
                <div className="text-[4px] font-bold uppercase text-slate-500">ማዕረግ / RANK</div>
                <div className="text-[6.5px] font-bold truncate text-black">{data.rank_am} / <span className="text-[5.5px] font-medium uppercase">{data.rank_en}</span></div>
              </div>
              <div>
                <div className="text-[4px] font-bold uppercase text-slate-500">ኃላፊነት / RESPONSIBILITY</div>
                <div className="text-[6.5px] font-bold truncate text-black">{data.responsibility_am} / <span className="text-[5.5px] font-medium uppercase">{data.responsibility_en}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 mt-1 pt-1 border-t border-black/5">
              <div>
                <div className="text-[4px] font-bold uppercase text-slate-500">የተሰጠበት ቀን / Issued Date</div>
                <div className="text-[6px] font-bold text-black">{data.issued_at || "N/A"}</div>
              </div>
              <div>
                <div className="text-[4px] font-bold uppercase text-slate-500">የሚያበቃበት ቀን / Expiry Date</div>
                <div className="text-[6px] font-bold text-red-600">{data.expires_at || "N/A"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Photo */}
        <div className="w-[21mm] flex flex-col items-center justify-center">
          <div className="w-[19mm] h-[24mm] bg-white border rounded-sm overflow-hidden shadow-sm relative border-slate-300">
            {data.photo_url ? (
              <img 
                src={data.photo_url} 
                className="w-full h-full object-cover" 
                alt="Member" 
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-200">
                <User size={30} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1 flex" style={{ backgroundColor: '#1e3a8a' }}>
        <div className="h-full w-1/3" style={{ backgroundColor: '#009a44' }}></div>
        <div className="h-full w-1/3" style={{ backgroundColor: '#fedd00' }}></div>
        <div className="h-full w-1/3" style={{ backgroundColor: '#ef3340' }}></div>
      </div>
    </div>
  );
});

const IDCardBack = React.forwardRef<HTMLDivElement, { data: Partial<IDRecord>, assets: Assets }>(({ data, assets }, ref) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div 
      ref={ref}
      className="relative w-[85.6mm] h-[53.98mm] rounded-[3.18mm] overflow-hidden flex flex-col p-[2mm] select-none box-border"
      style={{ 
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
        backgroundColor: '#ffffff',
        border: 'none'
      }}
    >
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] pointer-events-none">
        <img 
          src={assets.police_logo || "https://picsum.photos/seed/logo/200/200"} 
          className="w-64 h-64 object-contain" 
          alt="Watermark" 
          crossOrigin="anonymous"
        />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* Top: Notice Section */}
        <div className="flex-1 flex flex-col justify-start space-y-0.5 border-b pb-1" style={{ borderBottomColor: '#f1f5f9' }}>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="text-white text-[6px] font-black px-2 py-0.5 rounded-sm uppercase tracking-[0.1em] shadow-sm flex items-center gap-1" style={{ backgroundColor: '#dc2626' }}>
              <ShieldAlert size={7} />
              ማስታወቂያ / NOTICE
            </div>
            <div className="flex-1 h-[0.3mm] bg-gradient-to-r from-red-600/40 to-transparent"></div>
          </div>
          <p className="text-[7.5px] font-black leading-tight text-justify" style={{ color: '#000000' }}>
            ይህንን መታወቂያ የያዘ የፖሊስ አባል ስለሆነ ህግን የማስከበር ስልጣን ተሰጥቶታል ፣ መታወቂያዉንም የማሳየት ግዴታ አለበት፡፡ መታወቂያው ቢጠፋ ወይም በሌላ ግለሰብ እጅ ቢገኝ በአቅራቢያው ለሚገኝ ፖሊስ ጣቢያ እንዲያስረክቡ እናሳስባለን፡፡
          </p>
          <p className="text-[6.5px] font-extrabold italic leading-tight text-justify" style={{ color: '#1e293b' }}>
            The Bearer of this ID card member of Police and is authorized to enforce the Law. He is obliged to this ID card.  If found, please return it to the nearest police station.
          </p>
        </div>

        {/* Middle: Details in Two Lines */}
        <div className="py-1 flex flex-col gap-0.5 border-b" style={{ borderBottomColor: '#cbd5e1' }}>
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex items-center gap-1">
              <span className="text-[4px] font-black uppercase" style={{ color: '#475569' }}>ፆታ / GENDER:</span>
              <span className="text-[7px] font-black" style={{ color: '#000000' }}>{data.gender === 'M' ? 'ወ / M' : data.gender === 'F' ? 'ሴ / F' : (data.gender || "N/A")}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[4px] font-black uppercase" style={{ color: '#475569' }}>ቁመት / HEIGHT:</span>
              <span className="text-[7px] font-black" style={{ color: '#000000' }}>{data.height || "N/A"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[4px] font-black uppercase" style={{ color: '#475569' }}>መልክ / COMPLEXION:</span>
              <span className="text-[7px] font-black" style={{ color: '#000000' }}>{data.complexion || "N/A"}</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex items-center gap-1">
              <span className="text-[4px] font-black uppercase" style={{ color: '#475569' }}>ስልክ / PHONE:</span>
              <span className="text-[7px] font-black" style={{ color: '#1d4ed8' }}>{data.phone || "N/A"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[4px] font-black uppercase" style={{ color: '#475569' }}>የደም ዓይነት / BLOOD:</span>
              <span className="text-[7px] font-black" style={{ color: '#dc2626' }}>{data.blood_type || "N/A"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[4px] font-black uppercase" style={{ color: '#475569' }}>የመለያ ቁጥር / BADGE:</span>
              <span className="text-[7px] font-black" style={{ color: '#000000' }}>{data.badge_number || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Bottom: QR and Signatures */}
        <div className="h-[22mm] flex items-center justify-between gap-1 mt-auto">
          {/* QR Code */}
          <div className="flex flex-col items-center justify-center h-full min-w-[20mm]">
            <div className="p-1 bg-white border rounded shadow-sm flex items-center justify-center" style={{ borderColor: '#cbd5e1' }}>
              <QRCodeSVG 
                value={`${window.location.protocol}//${window.location.host}/verify/${data.id_number}`} 
                size={72} 
                level="H"
              />
            </div>
            <span className="text-[5px] font-black tracking-tighter mt-0.5" style={{ color: '#000000' }}>{data.id_number}</span>
          </div>

          {/* Signatures Container - Side by Side */}
          <div className="flex flex-1 items-end justify-around h-full pb-1">
            {/* Member Signature */}
            <div className="flex flex-col items-center w-[25mm]">
              <div className="h-9 w-full flex items-center justify-center relative border-b border-black/30">
                {data.member_signature ? (
                  <img 
                    src={data.member_signature} 
                    className="h-full w-full object-contain filter contrast-125 brightness-90" 
                    alt="Member Signature" 
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full mb-1"></div>
                )}
              </div>
              <div className="text-[4px] font-black uppercase text-center leading-none mt-1" style={{ color: '#000000' }}>
                የአባሉ ፊርማ / Member's Signature
              </div>
            </div>

            {/* Commissioner Signature */}
            <div className="flex flex-col items-center w-[25mm]">
              <div className="h-9 w-full flex items-center justify-center relative border-b border-black/30">
                {data.commissioner_signature ? (
                  <img 
                    src={data.commissioner_signature} 
                    className="h-full w-full object-contain filter contrast-125 brightness-90" 
                    alt="Commissioner Signature" 
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full mb-1"></div>
                )}
              </div>
              <div className="text-[4px] font-black uppercase text-center leading-none mt-1" style={{ color: '#000000' }}>
                የኮሚሽነሩ ፊርማ / Commissioner Signature
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Strip */}
      <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-yellow-400 via-green-600 to-blue-900 opacity-20"></div>
    </div>
  );
});

// --- Main App ---

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Keep original behavior but ensure the error log is detailed
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<'dashboard' | 'create' | 'history' | 'verify' | 'maintenance' | 'users'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<IDRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [assets, setAssets] = useState<Assets>({});
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<IDRecord | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [dbStatus, setDbStatus] = useState<{ isPersistent: boolean; dbType: string; warning: string | null } | null>(null);

  const [formData, setFormData] = useState<{
    id: number | null;
    full_name_am: string;
    full_name_en: string;
    rank_am: string;
    rank_en: string;
    responsibility_am: string;
    responsibility_en: string;
    phone: string;
    photo_url: string;
    blood_type: string;
    badge_number: string;
    gender: string;
    complexion: string;
    height: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    commissioner_signature: string;
    member_signature: string;
    issued_at: string;
    expires_at: string;
    id_number: string;
  }>({
    id: null,
    full_name_am: '',
    full_name_en: '',
    rank_am: '',
    rank_en: '',
    responsibility_am: '',
    responsibility_en: '',
    phone: '',
    photo_url: '',
    blood_type: '',
    badge_number: '',
    gender: '',
    complexion: '',
    height: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    commissioner_signature: '',
    member_signature: '',
    issued_at: new Date().toISOString().split('T')[0],
    expires_at: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
    id_number: ''
  });

  const [translationError, setTranslationError] = useState(false);

  const emptyForm = {
    id: null,
    full_name_am: '',
    full_name_en: '',
    rank_am: '',
    rank_en: '',
    responsibility_am: '',
    responsibility_en: '',
    phone: '',
    photo_url: '',
    blood_type: '',
    badge_number: '',
    gender: '',
    complexion: '',
    height: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    commissioner_signature: '',
    member_signature: '',
    issued_at: new Date().toISOString().split('T')[0],
    expires_at: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
    id_number: ''
  };

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // 1. Check for local session first to prevent race conditions during custom login
      const savedSession = localStorage.getItem('police_id_session');
      let sessionData: any = null;
      if (savedSession) {
        try {
          sessionData = JSON.parse(savedSession);
          // If we have a local session, prefer it initially to keep UI consistent
          if (!firebaseUser || (firebaseUser.uid === sessionData.firebaseUid || firebaseUser.isAnonymous)) {
            setUser({
              id: sessionData.id,
              email: sessionData.email,
              role: sessionData.role
            });
            setToken('firestore-session');
            if (!firebaseUser) {
              setIsAuthReady(true);
              return;
            }
          }
        } catch (e) {
          localStorage.removeItem('police_id_session');
        }
      }

      if (firebaseUser) {
        try {
          // 2. Fetch profile from Firestore to get authoritative role
          let profileDoc = null;
          try {
            profileDoc = await getDoc(doc(db, 'profiles', firebaseUser.uid));
          } catch (e) {
            console.warn("Profile fetch restricted or failed:", e);
          }
 
          const emailLower = firebaseUser.email?.toLowerCase() || sessionData?.email?.toLowerCase() || '';
          const isAdminEmail = emailLower === 'policeregion551@gmail.com' || 
                               emailLower === 'yirsawbiniyam@gmail.com';
          
          let role = isAdminEmail ? 'Administrator' : (sessionData?.role || 'Viewer');
          let email = firebaseUser.email || sessionData?.email || 'Unknown';
 
          if (!profileDoc?.exists()) {
            // Profile doesn't exist yet, try to find in 'users' or use defaults
            try {
              const q = query(collection(db, 'users'), where('email', '==', email));
              const userSnapshot = await getDocs(q);
              
              if (!userSnapshot.empty) {
                const userData = userSnapshot.docs[0].data();
                role = userData.role;
                email = userData.email;
              }
            } catch (e) {
              console.warn("Users lookup failed", e);
            }

            // Sync profile to Firestore for Security Rules
            try {
              await setDoc(doc(db, 'profiles', firebaseUser.uid), {
                email: email,
                role: role,
                active: true,
                last_login: new Date().toISOString()
              }, { merge: true });
            } catch (e) {
              console.error("Auth state profile creation failed:", e);
            }
          } else {
            const profileData = profileDoc.data();
            role = profileData.role;
            email = profileData.email;
          }
 
          setUser({
            id: firebaseUser.uid,
            email: email,
            role: role as any
          });
        } catch (err) {
          console.error("Auth sync error:", err);
        }
        setToken('firebase-token');
      } else if (!sessionData) {
        setUser(null);
        setToken(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchAssets();
      fetchRecords();
    }
  }, [user, statusFilter]);

  // Auto-save draft
  useEffect(() => {
    if (formData.full_name_am || formData.full_name_en || formData.phone || formData.photo_url) {
      localStorage.setItem('id_form_draft', JSON.stringify(formData));
    } else {
      localStorage.removeItem('id_form_draft');
    }
  }, [formData]);

  const [printSide, setPrintSide] = useState<'front' | 'back' | 'both' | 'combined'>('both');
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Police_ID_Card",
  });

  const handlePrintSide = (side: 'front' | 'back' | 'both' | 'combined') => {
    const isApproved = selectedRecord?.status === 'approved';
    const canPrint = user?.role === 'Administrator' || (user?.role === 'Data Entry' && isApproved);
    
    if (!canPrint) {
      alert("You do not have permission to print this record. Only Administrators or approved records can be printed.");
      return;
    }
    setLoading(true);
    setPrintSide(side);
    
    // Use a longer delay to ensure React has rendered the changes
    // and the print container is ready in the DOM
    setTimeout(() => {
      if (printRef.current) {
        try {
          handlePrint();
        } catch (error) {
          console.error("Print trigger failed:", error);
          alert("Printing failed. This often happens if the browser blocks the print window. Please check your browser settings or try a different browser.");
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
        alert("Print container not found. Please try again.");
      }
    }, 1500);
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('ይህንን መረጃ በእርግጠኝነት ማጥፋት ይፈልጋሉ? (Are you sure you want to delete this record?)')) return;
    try {
      // Soft delete: update the record with deleted: true instead of deleteDoc
      await updateDoc(doc(db, 'ids', id), {
        deleted: true,
        deleted_at: new Date().toISOString()
      });
      fetchRecords();
      alert('መረጃው በትክክል ጠፍቷል! (Record deleted successfully)');
    } catch (error: any) {
      console.error("Delete error:", error);
      alert('ስህተት ተፈጥሯል: ' + error.message);
    }
  };

  const [showScans, setShowScans] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);

  const handleLogin = async (credentials: any) => {
    let email = credentials.email.trim().toLowerCase();
    
    // Auto-correct common typo
    if (email.endsWith('@gamil.com')) {
      email = email.replace('@gamil.com', '@gmail.com');
    }
    
    console.log("Attempting login with:", email);
    setLoading(true);
    try {
      // 1. Try Firestore-backed login first (User's request)
      const q = query(collection(db, 'users'), where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      let userData: any = null;
      let userDocId: string | null = null;

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        userData = userDoc.data();
        userDocId = userDoc.id;
      } else if (email === 'policeregion551@gmail.com' && credentials.password === 'Po12345@') {
        // Emergency Super-Admin fallback if not in Firestore yet
        userData = {
          email: email,
          password: credentials.password,
          role: 'Administrator',
          active: true
        };
      }
      
      if (userData) {
        if (userData.active === false) {
          alert("Your account has been deactivated. Please contact the Administrator.");
          setLoading(false);
          return;
        }

        if (userData.password === credentials.password) {
          // Success! Sign in anonymously to get a UID for rules
          try {
            const userCredential = await signInAnonymously(auth);
            const uid = userCredential.user.uid;
            
            // Create/Update a session profile that the Security Rules can trust
            // We await this to ensure security rules are satisfied before fetching data
            await setDoc(doc(db, 'profiles', uid), {
              email: userData.email,
              role: userData.role,
              active: userData.active !== false,
              last_login: new Date().toISOString()
            });

            const sessionUser = {
              id: userDocId || 'superadmin-fallback',
              firebaseUid: uid,
              email: email,
              role: userData.role || 'Viewer'
            };
            
            setUser(sessionUser as any);
            setToken('firestore-session');
            localStorage.setItem('police_id_session', JSON.stringify(sessionUser));
            setLoading(false);
            return;
          } catch (anonErr: any) {
            console.error("Session profile creation failed:", anonErr);
            let errMsg = "Login session initialization failed.";
            if (anonErr.code === 'auth/network-request-failed' || anonErr.message?.includes('network-request-failed')) {
              errMsg += " Network error. This usually means the domain is not authorized in Firebase Console.";
            }
            alert(errMsg);
            setLoading(false);
            return;
          }
        }
      }

      // 2. Fallback to Firebase Auth
      await signInWithEmailAndPassword(auth, email, credentials.password);
    } catch (e: any) {
      console.error("Login error:", e);
      let msg = e.message;
      if (e.code === 'auth/network-request-failed') {
        msg = "Network error. Please ensure your domain is authorized in Firebase Console: " + window.location.hostname;
      } else if (e.code === 'auth/operation-not-allowed') {
        msg = "የመግቢያ ዘዴው አልበራም (Login method not enabled). እባክዎን በፋየርቤዝ ኮንሶል (Firebase Console) ውስጥ 'Email/Password' እና 'Anonymous' መግቢያዎችን ያብሩ።";
      } else if (e.code === 'auth/invalid-email') {
        msg = "የተሳሳተ ኢሜል ነው (Invalid email). እባክዎን ኢሜልዎን በትክክል መጻፍዎን ያረጋግጡ።";
      }
      alert('Login error: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('police_id_session');
      await signOut(auth);
      setView('dashboard');
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('online');

  const handleDownload = async (idNumber: string, side: 'front' | 'back' | 'both' | 'combined') => {
    const isApproved = selectedRecord?.status === 'approved';
    const canDownload = user?.role === 'Administrator' || (user?.role === 'Data Entry' && isApproved);
    
    if (!canDownload) {
      alert("ዳታውን ማውረድ የሚችለው አድሚን ብቻ ነው። (Only Administrators can download ID cards.)");
      return;
    }
    setLoading(true);
    let captureContainer: HTMLDivElement | null = null;
    
    // Safety timeout to prevent indefinite spinning
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        alert("ዝግጅቱ በጣም ዘግይቷል። እባክዎ በድጋሚ ይሞክሩ ወይም 'Print' የሚለውን አማራጭ ይጠቀሙ። (Preparation is taking too long. Please try again or use 'Print'.)");
      }
    }, 45000);

    try {
      // Small delay to ensure all images/fonts are fully rendered
      await new Promise(resolve => setTimeout(resolve, 2000));

      captureContainer = document.createElement('div');
      captureContainer.style.position = 'absolute';
      captureContainer.style.left = '-9999px';
      captureContainer.style.top = '0';
      captureContainer.style.display = 'flex';
      captureContainer.style.flexDirection = 'column';
      captureContainer.style.gap = '40px';
      captureContainer.style.padding = '40px';
      captureContainer.style.backgroundColor = '#ffffff';

      const sidesToCapture = (side === 'both' || side === 'combined') ? ['front', 'back'] : [side];
      let foundAny = false;
      
      for (const s of sidesToCapture) {
        const element = document.getElementById(`card-${s}-${idNumber}`);
        if (!element) {
          console.warn(`Element card-${s}-${idNumber} not found`);
          continue;
        }

        foundAny = true;
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.transform = 'none';
        clone.style.boxShadow = 'none';
        clone.style.margin = '0';
        clone.style.position = 'relative';
        clone.style.display = 'flex';
        clone.style.width = '85.6mm';
        clone.style.height = '53.98mm';
        
        // Remove mix-blend-multiply as it breaks html2canvas rendering
        const blended = clone.querySelectorAll('.mix-blend-multiply');
        blended.forEach(el => (el as HTMLElement).classList.remove('mix-blend-multiply'));
        
        // Ensure images have crossOrigin set
        const images = clone.querySelectorAll('img');
        images.forEach(img => {
          img.setAttribute('crossorigin', 'anonymous');
        });

        // Manually replace oklch/oklab colors in the clone
        // html2canvas fails to parse these strings in CSS
        const allElements = clone.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i] as HTMLElement;
          const style = window.getComputedStyle(el);
          
          const colorProps = ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'];
          colorProps.forEach(prop => {
            const cssProp = prop.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
            const value = style.getPropertyValue(cssProp);
            if (value && (value.includes('oklch') || value.includes('oklab'))) {
              // Fallback to safe colors
              if (prop === 'color') el.style.color = '#1e293b';
              if (prop === 'backgroundColor' && value !== 'rgba(0, 0, 0, 0)') {
                el.style.backgroundColor = '#ffffff';
              }
              if (prop === 'borderColor') el.style.borderColor = '#e2e8f0';
            }
          });
          
          // Also handle box-shadow which often contains oklch
          const shadow = style.getPropertyValue('box-shadow');
          if (shadow && (shadow.includes('oklch') || shadow.includes('oklab'))) {
            el.style.boxShadow = 'none';
          }
        }

        captureContainer.appendChild(clone);
      }
      
      if (!foundAny) throw new Error("No card elements found to capture");

      document.body.appendChild(captureContainer);

      // Explicitly wait for all images in the capture container to load with a timeout
      const imagesToLoad = Array.from(captureContainer.querySelectorAll('img'));
      const imageLoadPromises = imagesToLoad.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          const timeout = setTimeout(() => {
            console.warn("Image load timed out, replacing with placeholder:", img.src);
            // Replace with a safe placeholder if it fails to load or times out
            img.src = "https://picsum.photos/seed/error/200/300";
            resolve(null);
          }, 12000); 
          img.onload = () => { clearTimeout(timeout); resolve(null); };
          img.onerror = () => { 
            clearTimeout(timeout); 
            console.warn("Image failed to load, replacing with placeholder:", img.src);
            img.src = "https://picsum.photos/seed/error/200/300";
            resolve(null); 
          };
        });
      });
      
      await Promise.all(imageLoadPromises);

      const canvas = await html2canvas(captureContainer, {
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: '#ffffff',
        allowTaint: false, // MUST be false to allow toDataURL
        imageTimeout: 20000,
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * { 
              color-scheme: light !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .mix-blend-multiply { mix-blend-mode: normal !important; }
          `;
          clonedDoc.head.appendChild(style);
        }
      });

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const safeId = idNumber.replace(/[^a-z0-9]/gi, '_');
      const link = document.createElement('a');
      link.download = `BGR_Police_ID_${safeId}_${side}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Download error:', error);
      alert('ዳውንሎድ ማድረግ አልተቻለም። እባክዎ በድጋሚ ይሞክሩ ወይም "Print" የሚለውን አማራጭ ይጠቀሙ። (Download failed. Please try again or use the Print option.)');
    } finally {
      clearTimeout(safetyTimeout);
      if (captureContainer && captureContainer.parentNode) {
        document.body.removeChild(captureContainer);
      }
      setLoading(false);
    }
  };

  const fetchScans = async (idNumber: string) => {
    try {
      const q = query(collection(db, 'scans'), where('id_number', '==', idNumber), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => doc.data());
      setScanHistory(data);
      setShowScans(true);
    } catch (e) {
      console.error("Fetch scans error:", e);
    }
  };

  const fetchAssets = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'assets'));
      const data = querySnapshot.docs.reduce((acc: any, doc) => ({ ...acc, [doc.id]: doc.data().value }), {});
      setAssets(data);
    } catch (e) {
      console.error("Fetch assets error:", e);
    }
  };

  const fetchRecords = async (search = '') => {
    setLoading(true);
    try {
      const idsRef = collection(db, 'ids');
      let q;
      
      // Role-based filtering to satisfy Security Rules list requirements
      if (user?.role === 'Administrator') {
        q = query(idsRef);
      } else if (user?.role === 'Data Entry') {
        q = query(idsRef, or(
          where('created_by_email', '==', user.email),
          where('status', '==', 'approved')
        ));
      } else {
        q = query(idsRef, where('status', '==', 'approved'));
      }

      const querySnapshot = await getDocs(q);
      const s = search.toLowerCase();
      const data = querySnapshot.docs
        .map(doc => ({ ...(doc.data() as any), id: doc.id }))
        .filter(record => !record.deleted)
        .filter(record => {
          if (statusFilter !== 'all' && record.status !== statusFilter) return false;
          if (!search) return true;
          return (record.full_name_am || '').toLowerCase().includes(s) || 
                 (record.full_name_en || '').toLowerCase().includes(s) ||
                 (record.phone || '').includes(search) || 
                 (record.id_number || '').toLowerCase().includes(s);
        })
        .sort((a, b) => {
          const statusOrder = { 'pending': 0, 'approved': 1, 'rejected': 2 };
          if (a.status !== b.status) {
            return (statusOrder[a.status as keyof typeof statusOrder] || 0) - (statusOrder[b.status as keyof typeof statusOrder] || 0);
          }
          return (b.created_at || '').localeCompare(a.created_at || '');
        }) as any[];
      
      setRecords(data);
    } catch (error) {
      console.error("Fetch records error:", error);
      handleFirestoreError(error, OperationType.LIST, 'ids');
    } finally {
      setLoading(false);
    }
  };

  const handleAssetUpload = async (key: keyof Assets, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      let base64 = reader.result as string;
      if (base64.startsWith('data:image')) {
        base64 = await resizeImage(base64, 400, 400);
      }
      try {
        await setDoc(doc(db, 'assets', key), { value: base64 });
        fetchAssets();
      } catch (error) {
        console.error("Asset upload error:", error);
        alert("Asset upload failed");
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = await resizeImage(reader.result as string, 600, 800);
      setFormData({ ...formData, photo_url: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTranslating(true);
    
    try {
      const fields = ['full_name', 'rank', 'responsibility'];
      const finalData = { ...formData };
      
      const translateWithTimeout = async (text: string, target: 'en' | 'am') => {
        if (translationError) return '';
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Translation timed out')), 15000)
        );
        try {
          return await Promise.race([translateText(text, target), timeoutPromise]) as string;
        } catch (err: any) {
          console.warn("Translation failed or timed out:", err);
          if (err.message?.includes("timed out") || err.message?.includes("leaked") || err.message?.includes("invalid")) {
            setTranslationError(true);
          }
          return '';
        }
      };
      
      for (const field of fields) {
        const amKey = `${field}_am` as keyof typeof formData;
        const enKey = `${field}_en` as keyof typeof formData;
        
        if (formData[amKey] && !formData[enKey]) {
          finalData[enKey] = await translateWithTimeout(formData[amKey] as string, 'en');
        } else if (formData[enKey] && !formData[amKey]) {
          finalData[amKey] = await translateWithTimeout(formData[enKey] as string, 'am');
        }
      }

      let photo_url = finalData.photo_url;
      let commissioner_signature = finalData.commissioner_signature;
      let member_signature = finalData.member_signature;

      const isUpdate = !!finalData.id;

      if (isUpdate) {
        try {
          await updateDoc(doc(db, 'ids', finalData.id!), {
            ...finalData,
            photo_url,
            commissioner_signature,
            member_signature,
            updated_at: new Date().toISOString()
          });
          alert("መረጃው በትክክል ተሻሽሏል! (Record updated successfully)");
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `ids/${finalData.id}`);
        }
      } else {
        try {
          const q = query(collection(db, 'ids'), orderBy('id_number', 'desc'), limit(1));
          const querySnapshot = await getDocs(q);
          let nextNum = 1;
          if (!querySnapshot.empty) {
            const lastIdNum = querySnapshot.docs[0].data().id_number;
            const match = lastIdNum.match(/BGR-POL-16(\d+)/);
            if (match) {
              nextNum = parseInt(match[1]) + 1;
            }
          }
          const id_number = `BGR-POL-16${String(nextNum).padStart(5, '0')}`;
          const newRecordData = {
            ...finalData,
            id_number,
            photo_url,
            commissioner_signature,
            member_signature,
            status: user?.role === 'Administrator' ? 'approved' : 'pending',
            created_by_email: user?.email?.toLowerCase(),
            created_at: new Date().toISOString()
          };

          if (auth.currentUser) {
            await setDoc(doc(db, 'profiles', auth.currentUser.uid), {
              email: user?.email?.toLowerCase(),
              role: user?.role,
              active: true,
              last_login: new Date().toISOString()
            }, { merge: true });
          }

          const docRef = await addDoc(collection(db, 'ids'), newRecordData);
          alert("መታወቂያው በትክክል ተመዝግቧል! (ID registered successfully)");
          
          // Show preview immediately
          setSelectedRecord({ id: docRef.id, ...newRecordData } as IDRecord);
          setShowPreview(true);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'ids');
        }
      }

      setFormData(emptyForm);
      localStorage.removeItem('id_form_draft');
      setView('history');
      fetchRecords();
    } catch (error: any) {
      console.error("Submission error:", error);
      let errorMsg = error.message;
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMsg = "አዝናለሁ! ይህን ተግባር ለማከናወን የሚያስችል በቂ ፈቃድ የለዎትም። እባክዎ እንደገና ይግቡ ወይም አስተዳዳሪውን ያነጋግሩ። (Permission Denied)";
        }
      } catch (e) {
        if (error.message.includes("insufficient permissions") || error.message.includes("PERMISSION_DENIED")) {
           errorMsg = "አዝናለሁ! ይህን ተግባር ለማከናወን የሚያስችል በቂ ፈቃድ የለዎትም። እባክዎ እንደገና ይግቡ ወይም አስተዳዳሪውን ያነጋግሩ። (Permission Denied)";
        }
      }
      alert("ስህተት ተፈጥሯል! እባክዎ እንደገና ይሞክሩ። (Error: " + errorMsg + ")");
    } finally {
      setLoading(false);
      setTranslating(false);
    }
  };

  // Verification View Logic
  if (isMounted && window.location.pathname.startsWith('/verify/')) {
    const idNum = window.location.pathname.split('/')[2];
    return <VerificationView idNumber={idNum} assets={assets} />;
  }

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  if (!token) {
    return <Login onLogin={handleLogin} loading={loading} serverStatus={serverStatus} dbStatus={dbStatus} />;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
              <div className="relative">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-200">
                  <Shield size={24} />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-3 rounded-[1px] overflow-hidden border border-white shadow-sm flex">
                  <div className="flex-1 bg-[#009a44]" />
                  <div className="flex-1 bg-[#fedd00]" />
                  <div className="flex-1 bg-[#ef3340]" />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-bold leading-none text-blue-900">BGR Police</h1>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">ID Management System</p>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<Shield size={18} />} label="ዳሽቦርድ" />
              {(user?.role === 'Administrator' || user?.role === 'Data Entry') && (
                <NavButton 
                  active={view === 'create'} 
                  onClick={() => {
                    const hasData = formData.full_name_am || formData.full_name_en || formData.phone || formData.photo_url;
                    if (hasData && !formData.id && view !== 'create') {
                      if (confirm('ያልተቀመጠ መረጃ አለ። አዲስ መመዝገብ ይፈልጋሉ?')) {
                        setFormData(emptyForm);
                      }
                    }
                    setView('create');
                  }} 
                  icon={<Plus size={18} />} 
                  label="አዲስ መታወቂያ" 
                />
              )}
              <NavButton active={view === 'history'} onClick={() => setView('history')} icon={<History size={18} />} label="መዝገቦች" />
              {user?.role === 'Administrator' && (
                <>
                  <NavButton active={view === 'maintenance'} onClick={() => setView('maintenance')} icon={<DbIcon size={18} />} label="ጥገና" />
                  <NavButton active={view === 'users'} onClick={() => setView('users')} icon={<User size={18} />} label="ተጠቃሚዎች" />
                </>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="መረጃዎችን ፈልግ..." 
                  className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 w-64 transition-all"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    fetchRecords(e.target.value);
                  }}
                />
              </div>
              <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                  <DbIcon size={12} />
                  <span className="hidden lg:inline">Firebase</span>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-900">{user?.username}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{user?.role === 'Administrator' ? 'አስተዳዳሪ' : user?.role === 'Data Entry' ? 'መረጃ አስገቢ' : 'ተመልካች'}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="መውጣት"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Main Dashboard Header */}
              <div className="flex flex-col items-center justify-center text-center space-y-6 mb-16">
                <div className="relative group">
                  <div className="absolute -inset-4 bg-gradient-to-r from-[#009a44] via-[#fedd00] to-[#ef3340] rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                  <div className="relative w-24 h-24 md:w-32 md:h-32 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-[#D4AF37] overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-slate-50 to-white" />
                    <div className="absolute top-0 left-0 w-full h-1.5 flex">
                      <div className="flex-1 bg-[#009a44]" />
                      <div className="flex-1 bg-[#fedd00]" />
                      <div className="flex-1 bg-[#ef3340]" />
                    </div>
                    <Shield size={64} className="text-[#1e293b] relative z-10 drop-shadow-lg" />
                    <div className="absolute bottom-2 font-black text-[8px] text-[#D4AF37] tracking-widest uppercase z-10">
                      BGR POLICE
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-b from-[#FFD700] via-[#D4AF37] to-[#B8860B] bg-clip-text text-transparent drop-shadow-xl tracking-tighter leading-tight">
                    ቤንሻንጉል ጉሙዝ ክልል ፖሊስ ኮሚሽን <br />
                    የመታወቂያ ሲስተም
                  </h2>
                  <div className="flex items-center justify-center gap-4">
                    <div className="h-[1px] w-12 bg-slate-200" />
                    <h3 className="text-lg md:text-xl font-bold text-slate-800 tracking-wide uppercase">
                      BGR Police Commission ID System
                    </h3>
                    <div className="h-[1px] w-12 bg-slate-200" />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-8 h-1 bg-[#009a44] rounded-full" />
                  <div className="w-8 h-1 bg-[#fedd00] rounded-full" />
                  <div className="w-8 h-1 bg-[#ef3340] rounded-full" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="ጠቅላላ መታወቂያዎች" value={records.length} icon={<User className="text-blue-600" />} />
                <StatCard title="የቅርብ ጊዜ ፍተሻዎች" value="24" icon={<Eye className="text-emerald-600" />} />
                <StatCard title="የሲስተም ሁኔታ" value="ገባሪ" icon={<Check className="text-blue-600" />} />
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Camera size={24} className="text-blue-600" />
                  የሲስተም ፋይሎች ማስተካከያ (System Assets)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                  <AssetUpload 
                    label="የቢጂአር ሰንደቅ አላማ" 
                    image={assets.bgr_flag} 
                    onUpload={(e) => handleAssetUpload('bgr_flag', e)} 
                  />
                  <AssetUpload 
                    label="የፖሊስ ዓርማ" 
                    image={assets.police_logo} 
                    onUpload={(e) => handleAssetUpload('police_logo', e)} 
                  />
                  <AssetUpload 
                    label="የኢትዮጵያ ሰንደቅ አላማ" 
                    image={assets.eth_flag} 
                    onUpload={(e) => handleAssetUpload('eth_flag', e)} 
                  />
                </div>
              </div>
            </motion.div>
          )}

          {view === 'create' && (
            <motion.div 
              key="create"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
                <div className="p-8 bg-blue-600 text-white flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">{formData.id ? 'የአባል መረጃ አርትዕ' : 'አዲስ የአባል መታወቂያ መመዝገቢያ'}</h2>
                    <p className="text-blue-100 text-sm">{formData.id ? 'የአባሉን መረጃ እዚህ ያሻሽሉ' : 'መረጃዎችን በትክክል ያስገቡ። የተተዉ ትርጉሞች በራሳቸው ይሞላሉ።'}</p>
                    {localStorage.getItem('id_form_draft') && !formData.id && (
                      <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-blue-500/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        <DbIcon size={12} />
                        ረቂቅ መረጃ ተገኝቷል (Draft Loaded)
                      </div>
                    )}
                  </div>
                  {(!formData.id && (formData.full_name_am || formData.full_name_en || formData.phone || formData.photo_url)) && (
                    <button 
                      type="button"
                      onClick={() => {
                        if (confirm('ፎርሙን ማጽዳት ይፈልጋሉ?')) {
                          setFormData(emptyForm);
                          localStorage.removeItem('id_form_draft');
                        }
                      }}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      ፎርሙን አጽዳ (Clear)
                    </button>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <FormInput label="ሙሉ ስም (በአማርኛ)" value={formData.full_name_am} onChange={(v) => setFormData({...formData, full_name_am: v})} placeholder="ሙሉ ስም" icon={<User size={18}/>} />
                      <FormInput label="Full Name (English)" value={formData.full_name_en} onChange={(v) => setFormData({...formData, full_name_en: v})} placeholder="Full Name" icon={<User size={18}/>} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormInput label="ማዕረግ (በአማርኛ)" value={formData.rank_am} onChange={(v) => setFormData({...formData, rank_am: v})} placeholder="ማዕረግ" icon={<Award size={18}/>} />
                        <FormInput label="Rank (English)" value={formData.rank_en} onChange={(v) => setFormData({...formData, rank_en: v})} placeholder="Rank" icon={<Award size={18}/>} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormInput label="ኃላፊነት (በአማርኛ)" value={formData.responsibility_am} onChange={(v) => setFormData({...formData, responsibility_am: v})} placeholder="ኃላፊነት" icon={<Briefcase size={18}/>} />
                        <FormInput label="Responsibility (English)" value={formData.responsibility_en} onChange={(v) => setFormData({...formData, responsibility_en: v})} placeholder="Responsibility" icon={<Briefcase size={18}/>} />
                      </div>
                      <FormInput label="ስልክ ቁጥር" value={formData.phone} onChange={(v) => setFormData({...formData, phone: v})} placeholder="+251..." icon={<Phone size={18}/>} />
                      
                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4">የፊት ለፊት መረጃዎች እና ቀናት</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <FormInput label="የደም ዓይነት" value={formData.blood_type} onChange={(v) => setFormData({...formData, blood_type: v})} placeholder="A+, B-, ወዘተ" icon={<Check size={18}/>} />
                          <FormInput label="የጡረታ መለያ ቁጥር (Badge)" value={formData.badge_number} onChange={(v) => setFormData({...formData, badge_number: v})} placeholder="መለያ ቁጥር" icon={<Shield size={18}/>} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 ml-1">የተሰጠበት ቀን</label>
                            <input 
                              type="date" 
                              value={formData.issued_at}
                              onChange={(e) => setFormData({...formData, issued_at: e.target.value})}
                              className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 ml-1">የሚያበቃበት ቀን</label>
                            <input 
                              type="date" 
                              value={formData.expires_at}
                              onChange={(e) => setFormData({...formData, expires_at: e.target.value})}
                              className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4">የጀርባ ገጽ መረጃዎች</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <FormInput label="ጾታ" value={formData.gender} onChange={(v) => setFormData({...formData, gender: v})} placeholder="ወ/ሴ" icon={<User size={18}/>} />
                          <FormInput label="መልክ" value={formData.complexion} onChange={(v) => setFormData({...formData, complexion: v})} placeholder="ጠይም፣ ወዘተ" icon={<Eye size={18}/>} />
                          <FormInput label="ቁመት" value={formData.height} onChange={(v) => setFormData({...formData, height: v})} placeholder="1.75ሜ" icon={<Plus size={18}/>} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <FormInput label="የአደጋ ጊዜ ተጠሪ ስም" value={formData.emergency_contact_name} onChange={(v) => setFormData({...formData, emergency_contact_name: v})} placeholder="ስም" icon={<User size={18}/>} />
                          <FormInput label="የአደጋ ጊዜ ተጠሪ ስልክ" value={formData.emergency_contact_phone} onChange={(v) => setFormData({...formData, emergency_contact_phone: v})} placeholder="ስልክ" icon={<Phone size={18}/>} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <p className="text-xs font-bold text-slate-500 mb-3">Member Photo</p>
                        <div className="w-40 h-52 bg-white rounded-2xl shadow-lg overflow-hidden border-4 border-white relative group">
                          {formData.photo_url ? (
                            <img src={formData.photo_url} className="w-full h-full object-cover" alt="Preview" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                              <div className="flex gap-4">
                                <Plus size={32} />
                                <Camera size={32} />
                              </div>
                              <span className="text-[10px] font-medium">Upload or Take Photo / አፕሎድ ወይም ፎቶ</span>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                            onChange={handlePhotoUpload}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <p className="text-xs font-bold text-slate-500 mb-3">የአባሉ ፊርማ</p>
                        <div className="w-full h-24 bg-white rounded-2xl shadow-sm overflow-hidden border-2 border-white relative group flex items-center justify-center">
                          {formData.member_signature ? (
                            <img src={formData.member_signature} className="h-full object-contain" alt="Member Signature Preview" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                              <div className="flex gap-4">
                                <Plus size={24} />
                                <Camera size={24} />
                              </div>
                              <span className="text-[10px] font-medium">ፎቶ ይጫኑ ወይም ያንሱ</span>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onloadend = async () => {
                                const base64 = await resizeImage(reader.result as string, 400, 200);
                                setFormData({ ...formData, member_signature: base64 });
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <p className="text-xs font-bold text-slate-500 mb-3">የኮሚሽነሩ ፊርማ</p>
                        <div className="w-full h-24 bg-white rounded-2xl shadow-sm overflow-hidden border-2 border-white relative group flex items-center justify-center">
                          {formData.commissioner_signature ? (
                            <img src={formData.commissioner_signature} className="h-full object-contain" alt="Signature Preview" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                              <div className="flex gap-4">
                                <Plus size={24} />
                                <Camera size={24} />
                              </div>
                              <span className="text-[10px] font-medium">ፎቶ ይጫኑ ወይም ያንሱ</span>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onloadend = async () => {
                                const base64 = await resizeImage(reader.result as string, 400, 200);
                                setFormData({ ...formData, commissioner_signature: base64 });
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
                    <button 
                      type="button"
                      onClick={() => setView('dashboard')}
                      className="px-8 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
                    >
                      ይቅር (Cancel)
                    </button>
                    <button 
                      type="submit"
                      disabled={loading || translating}
                      className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {(loading || translating) && <Loader2 className="animate-spin" size={18} />}
                      {translating ? 'እየተተረጎመ...' : (formData.id ? 'መረጃ አሻሽል' : 'መታወቂያ አዘጋጅ')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'maintenance' && (
            <motion.div 
              key="maintenance"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold">የሲስተም ጥገና</h2>
                  <p className="text-slate-500">የሲስተም ፋይሎችን እና ደህንነትን ይቆጣጠሩ</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <DbIcon size={20} className="text-blue-600" />
                    <h3 className="font-bold">የመረጃ ማስቀመጫ</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500 font-medium">የመረጃ ቋት ዓይነት</span>
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                        Firebase Firestore
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500 font-medium">የመረጃ ቆይታ</span>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                        Permanent
                      </span>
                    </div>
                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                      <p className="text-xs text-blue-700 leading-relaxed">
                        ሲስተሙ በአሁኑ ጊዜ ፋየርቤዝን (Firebase) እየተጠቀመ ነው። የውሂብ አስተዳደርን በቀጥታ በፋየርቤዝ ኮንሶል በኩል ማከናወን ይቻላል።
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <Award size={20} className="text-blue-600" />
                    <h3 className="font-bold">የሲስተም ፋይሎች</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">የኮሚሽነሩ ፊርማ</label>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-24 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                          {assets.commissioner_signature ? (
                            <img src={assets.commissioner_signature} className="h-full object-contain" alt="Signature" />
                          ) : (
                            <span className="text-xs text-slate-400">ምንም ፊርማ አልተጫነም</span>
                          )}
                        </div>
                        <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-all">
                          ጫን (Upload)
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAssetUpload('commissioner_signature', e)} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {view === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-900">የአባላት መዝገብ</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          statusFilter === s 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {s === 'all' ? 'ሁሉም' : s === 'pending' ? 'በጥበቃ' : s === 'approved' ? 'የጸደቁ' : 'ውድቅ'}
                      </button>
                    ))}
                  </div>
                  {(user?.role === 'Administrator' || user?.role === 'Data Entry') && (
                    <button 
                      onClick={() => {
                        setFormData(emptyForm);
                        setView('create');
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                    >
                      <Plus size={20} />
                      አዲስ አባል
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">አባል</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">መታወቂያ ቁጥር</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ማዕረግ እና ኃላፊነት</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ሁኔታ</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">ተግባራት</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img src={record.photo_url} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" alt="" />
                            <div>
                              <p className="text-sm font-bold text-slate-900">{record.full_name_am}</p>
                              <p className="text-xs text-slate-500 uppercase">{record.full_name_en}</p>
                              {record.created_by_email && (
                                <p className="text-[9px] text-slate-400 font-medium">ተመዝጋቢ፡ {record.created_by_email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold font-mono">
                            {record.id_number}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-700">{record.rank_am}</p>
                          <p className="text-xs text-slate-400">{record.responsibility_en}</p>
                        </td>
                        <td className="px-6 py-4">
                          {record.status === 'approved' ? (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-fit">
                              <Check size={10} /> ጸድቋል
                            </span>
                          ) : record.status === 'rejected' ? (
                            <span className="px-2 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-fit">
                              <X size={10} /> ውድቅ ተደርጓል
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-fit">
                              <RefreshCw size={10} className="animate-spin-slow" /> በጥበቃ ላይ
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {user?.role === 'Administrator' && record.status === 'pending' && (
                              <>
                                <button 
                                  onClick={async () => {
                                    await updateDoc(doc(db, 'ids', record.id), { status: 'approved' });
                                    fetchRecords();
                                  }}
                                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                  title="አጽድቅ"
                                >
                                  <Check size={18} />
                                </button>
                                <button 
                                  onClick={async () => {
                                    await updateDoc(doc(db, 'ids', record.id), { status: 'rejected' });
                                    fetchRecords();
                                  }}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="ውድቅ አድርግ"
                                >
                                  <X size={18} />
                                </button>
                              </>
                            )}
                            {((user?.role === 'Administrator') || (user?.role === 'Data Entry' && record.status !== 'approved')) && (
                              <button 
                              onClick={() => {
                                setFormData({
                                  ...emptyForm,
                                  ...record,
                                  id: record.id,
                                  member_signature: record.member_signature || '',
                                  issued_at: record.issued_at || new Date().toISOString().split('T')[0],
                                  expires_at: record.expires_at || new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
                                  id_number: record.id_number || ''
                                });
                                setView('create');
                              }}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="መረጃ አርትዕ"
                              >
                                <Edit size={18} />
                              </button>
                            )}
                            <button 
                              onClick={() => fetchScans(record.id_number)}
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                              title="የፍተሻ ታሪክ"
                            >
                              <History size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedRecord(record);
                                setShowPreview(true);
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="እይታ"
                            >
                              <Eye size={18} />
                            </button>
                            {((user?.role === 'Administrator') || (user?.role === 'Data Entry' && record.status === 'approved')) ? (
                              <button 
                                onClick={() => {
                                  setSelectedRecord(record);
                                  handlePrintSide('both');
                                }}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                title="መታወቂያ አትም"
                              >
                                <Printer size={18} />
                              </button>
                            ) : user?.role === 'Data Entry' && (
                              <div className="p-2 text-slate-300 cursor-not-allowed" title="አስተዳዳሪው እስኪያጸድቀው ማተም አይቻልም (Cannot print until approved)">
                                <Printer size={18} />
                              </div>
                            )}
                            {user?.role === 'Administrator' && (
                              <button 
                                onClick={() => handleDeleteRecord(record.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="መረጃ አጥፋ"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
          {view === 'users' && user?.role === 'Administrator' && (
            <UserManagement />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showPreview && selectedRecord && (
          <PreviewModal 
            record={selectedRecord} 
            assets={assets} 
            onClose={() => setShowPreview(false)} 
            onPrint={(side) => handlePrintSide(side)} 
            onDownload={(side) => handleDownload(selectedRecord.id_number, side)}
            onEdit={() => {
              if (selectedRecord) {
                setFormData({
                  ...emptyForm,
                  ...selectedRecord,
                  id: selectedRecord.id,
                  member_signature: selectedRecord.member_signature || '',
                  issued_at: selectedRecord.issued_at || new Date().toISOString().split('T')[0],
                  expires_at: selectedRecord.expires_at || new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
                  id_number: selectedRecord.id_number || ''
                });
                setShowPreview(false);
                setView('create');
              }
            }}
            user={user}
          />
        )}
      </AnimatePresence>

      {/* Scan History Modal */}
      <AnimatePresence>
        {showScans && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowScans(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">የማረጋገጫ ታሪክ</h3>
                <button onClick={() => setShowScans(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {scanHistory.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">ምንም የተመዘገበ ፍተሻ የለም።</p>
                ) : (
                  <div className="space-y-4">
                    {scanHistory.map((scan) => (
                      <div key={scan.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-blue-600">{isMounted ? new Date(scan.scanned_at).toLocaleString() : ''}</span>
                          <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-600 font-mono">{scan.ip_address}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono break-all">{scan.user_agent}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Off-screen Print Content */}
      <div 
        style={{ position: 'fixed', left: '-9999px', top: '0', width: '85.6mm', height: 'auto', overflow: 'hidden', opacity: 0, pointerEvents: 'none', zIndex: -1000 }}
        className="no-print"
      >
        <div ref={printRef} key={`${selectedRecord?.id}-${printSide}`} className="print-container" style={{ margin: 0, padding: 0 }}>
          {selectedRecord && (
            <div style={{ margin: 0, padding: 0 }}>
              {printSide === 'combined' ? (
                <div style={{ display: 'flex', flexDirection: 'column', margin: 0, padding: 0 }}>
                  <div className="print-card">
                    <IDCardFront data={selectedRecord} assets={assets} />
                  </div>
                  <div className="print-card">
                    <IDCardBack data={selectedRecord} assets={assets} />
                  </div>
                </div>
              ) : (
                <div style={{ margin: 0, padding: 0 }}>
                  {(printSide === 'both' || printSide === 'front') && (
                    <div className="print-card">
                      <IDCardFront data={selectedRecord} assets={assets} />
                    </div>
                  )}
                  {(printSide === 'both' || printSide === 'back') && (
                    <div className="print-card">
                      <IDCardBack data={selectedRecord} assets={assets} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global Loading Overlay for Downloads */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <div className="relative">
              <div className="w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Download className="text-blue-600 animate-bounce" size={32} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mt-8">መታወቂያው እየተዘጋጀ ነው...</h3>
            <p className="text-slate-500 mt-2 font-medium">Preparing ID Card... Please wait a moment.</p>
            <p className="text-slate-400 text-[10px] mt-4 max-w-xs text-center">
              ዳውንሎድ (Download) በጣም ከዘገየ "Print" የሚለውን አማራጭ ይጠቀሙ። ፕሪንት ፈጣን እና አስተማማኝ ነው። <br/>
              (If Download is slow, please use the "Print" option.)
            </p>
            <div className="mt-8 flex gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
            </div>
            <button 
              onClick={() => setLoading(false)}
              className="mt-10 px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-sm font-bold transition-all border border-slate-200"
            >
              ይቅር (Cancel)
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Helper Components ---

function PreviewModal({ record, assets, onClose, onPrint, onDownload, onEdit, user }: { record: IDRecord, assets: Assets, onClose: () => void, onPrint: (side: 'front' | 'back' | 'both' | 'combined') => void, onDownload: (side: 'front' | 'back' | 'both' | 'combined') => void, onEdit: () => void, user: User | null }) {
  const [activeTab, setActiveTab] = useState<'front' | 'back' | 'both' | 'combined'>('both');
  const canPrint = user?.role === 'Administrator' || (user?.role === 'Data Entry' && record.status === 'approved');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh]"
      >
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold">የመታወቂያ ካርድ ዝርዝር እይታ</h3>
            <p className="text-xs text-slate-500">ከማተምዎ በፊት የፊት እና የጀርባ ገጾችን ያረጋግጡ</p>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('front')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'front' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              ፊት (Front)
            </button>
            <button 
              onClick={() => setActiveTab('back')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'back' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              ጀርባ (Back)
            </button>
            <button 
              onClick={() => setActiveTab('both')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'both' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              ሁለቱም ገጽ
            </button>
            <button 
              onClick={() => setActiveTab('combined')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'combined' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              የተቀናጀ
            </button>
          </div>

          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8 lg:p-12 flex-1 overflow-y-auto bg-slate-50">
          <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-12 lg:gap-20 min-h-full">
            {/* Front Side */}
            <div className={`space-y-6 flex flex-col items-center w-full lg:w-auto ${activeTab === 'back' || activeTab === 'combined' ? 'hidden lg:flex opacity-0 pointer-events-none absolute' : 'flex'}`}>
              <div className="flex items-center justify-between w-full px-2 max-w-[85.6mm]">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Front Side / የፊት ገፅ</span>
                {canPrint && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onPrint('front')}
                      className="p-2 bg-white text-slate-600 rounded-lg shadow-sm hover:bg-slate-50 transition-all"
                      title="Print Front Only"
                    >
                      <Printer size={14} />
                    </button>
                    <button 
                      onClick={() => onDownload('front')}
                      className="p-2 bg-white text-slate-600 rounded-lg shadow-sm hover:bg-slate-50 transition-all"
                      title="Download Front Only"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div id={`card-front-${record.id_number}`} className="scale-[1.1] sm:scale-125 lg:scale-150 origin-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-[3.18mm]">
                <IDCardFront data={record} assets={assets} />
              </div>
            </div>

            {/* Back Side */}
            <div className={`space-y-6 flex flex-col items-center w-full lg:w-auto ${activeTab === 'front' || activeTab === 'combined' ? 'hidden lg:flex opacity-0 pointer-events-none absolute' : 'flex'}`}>
              <div className="flex items-center justify-between w-full px-2 max-w-[85.6mm]">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Back Side / የጀርባ ገፅ</span>
                {canPrint && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onPrint('back')}
                      className="p-2 bg-white text-slate-600 rounded-lg shadow-sm hover:bg-slate-50 transition-all"
                      title="Print Back Only"
                    >
                      <Printer size={14} />
                    </button>
                    <button 
                      onClick={() => onDownload('back')}
                      className="p-2 bg-white text-slate-600 rounded-lg shadow-sm hover:bg-slate-50 transition-all"
                      title="Download Back Only"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div id={`card-back-${record.id_number}`} className="scale-[1.1] sm:scale-125 lg:scale-150 origin-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-[3.18mm]">
                <IDCardBack data={record} assets={assets} />
              </div>
            </div>

            {/* Combined View */}
            {activeTab === 'combined' && (
              <div className="flex flex-col items-center gap-8 w-full">
                <div className="flex flex-col items-center gap-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Combined Layout / የተቀናጀ እይታ</span>
                  <div className="flex flex-col gap-4 p-4 bg-white rounded-[3.18mm] shadow-2xl border border-slate-100 scale-110 sm:scale-125 lg:scale-150">
                    <IDCardFront data={record} assets={assets} />
                    <div className="border-t border-dashed border-slate-200"></div>
                    <IDCardBack data={record} assets={assets} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex gap-2">
            {(user?.role === 'Administrator' || (user?.role === 'Data Entry' && record.status === 'pending')) && (
              <button 
                onClick={onEdit}
                className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
              >
                <Edit size={18} />
                አርትዕ (Edit)
              </button>
            )}
            <button 
              onClick={onClose}
              className="w-full sm:w-auto px-8 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              ወደ መዝገቦች ተመለስ (Back)
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {!canPrint && record.status === 'pending' && (
              <div className="px-6 py-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl text-xs font-bold flex items-center gap-2">
                <ShieldAlert size={16} />
                ማሳሰቢያ፡ ይህ መታወቂያ በአስተዳዳሪ ሲጸድቅ ማተም ይችላሉ። (Pending Approval)
              </div>
            )}
            {canPrint && (
              <>
                <button 
                  onClick={() => onDownload('both')}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl"
                >
                  <Download size={24} />
                  ሁለቱንም ገጽ አውርድ
                </button>
                <button 
                  onClick={() => onPrint('combined')}
                  className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-2xl shadow-[#0596694d] hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
                >
                  <Printer size={24} />
                  የተቀናጀ አትም (Print)
                </button>
                <button 
                  onClick={() => onPrint('both')}
                  className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-2xl shadow-[#2563eb4d] hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
                >
                  <Printer size={24} />
                  ሁለቱንም ገጽ አትም
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
        active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-xl">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function AssetUpload({ label, image, onUpload }: { label: string, image?: string, onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-slate-700">{label}</p>
      <div className="relative group w-full aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center">
        {image ? (
          <img src={image} className="w-full h-full object-contain p-2" alt={label} />
        ) : (
          <Camera size={24} className="text-slate-300" />
        )}
        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-xs font-bold">ፋይሉን ቀይር (Change)</span>
        </div>
        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={onUpload} />
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder, icon }: { label: string, value: string, onChange: (v: string) => void, placeholder: string, icon: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-500 ml-1">{label}</label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
        <input 
          type="text" 
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all"
        />
      </div>
    </div>
  );
}

function Login({ onLogin, loading, serverStatus, dbStatus }: { onLogin: (c: any) => void, loading: boolean, serverStatus: 'checking' | 'online' | 'offline', dbStatus: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ email: email.trim(), password });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden"
      >
        <div className="p-10 bg-slate-900 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 flex">
            <div className="flex-1 bg-[#009a44]" />
            <div className="flex-1 bg-[#fedd00]" />
            <div className="flex-1 bg-[#ef3340]" />
          </div>
          
          {/* Professional Decorated Logo */}
          <div className="relative w-20 h-20 bg-white rounded-full shadow-2xl flex items-center justify-center mx-auto mb-6 border-2 border-[#D4AF37] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-50 to-white" />
            <div className="absolute top-0 left-0 w-full h-1 flex">
              <div className="flex-1 bg-[#009a44]" />
              <div className="flex-1 bg-[#fedd00]" />
              <div className="flex-1 bg-[#ef3340]" />
            </div>
            <Shield size={40} className="text-slate-900 relative z-10 drop-shadow-md" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-black bg-gradient-to-b from-[#FFD700] via-[#D4AF37] to-[#B8860B] bg-clip-text text-transparent leading-tight">
              ቤንሻንጉል ጉሙዝ ክልል ፖሊስ ኮሚሽን <br />
              የመታወቂያ ሲስተም
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              BGR Police Commission ID System
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-10 space-y-6">
          <FormInput 
            label="ኢሜይል (Email)" 
            value={email} 
            onChange={setEmail} 
            placeholder="ኢሜይል ያስገቡ" 
            icon={<User size={18} />} 
          />
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">የይለፍ ቃል (Password)</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Shield size={18} />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="የይለፍ ቃል ያስገቡ"
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all"
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading && <Loader2 className="animate-spin" size={18} />}
            ይግቡ
          </button>
          <div className="text-center pt-4 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-900 leading-relaxed">
              በቤንሻንጉል ጉሙዝ ክልል ፖሊስ ኮሚሽን ቴክኖሎጂ ማስፋፊያ ክፍል የተሰራ
            </p>
            <p className="text-[10px] font-black text-[#D4AF37] mt-1">
              (by D,Ins B.Y)
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function UserManagement() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'Viewer' as 'Viewer' | 'Administrator' | 'Data Entry' });

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id }));
      setUsers(data);
    } catch (e) {
      console.error("Fetch users error:", e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'users'), {
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        active: true,
        created_at: new Date().toISOString()
      });
      fetchUsers();
      setShowAdd(false);
      setNewUser({ email: '', password: '', role: 'Viewer' });
    } catch (e) {
      console.error("Add user error:", e);
      alert("Failed to add user");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('ይህንን ተጠቃሚ ማጥፋት እንደሚፈልጉ እርግጠኛ ነዎት?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      fetchUsers();
    } catch (e) {
      alert('ተጠቃሚውን ሲያጠፉ ስህተት ተከስቷል');
    }
  };

  const handleUpdateRole = async (id: string, role: string) => {
    try {
      await updateDoc(doc(db, 'users', id), { role });
      fetchUsers();
    } catch (e) {
      alert('ሚናውን ሲቀይሩ ስህተት ተከስቷል');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', id), { active: !currentStatus });
      fetchUsers();
    } catch (e) {
      alert('ሁኔታውን ሲቀይሩ ስህተት ተከስቷል');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">የተጠቃሚዎች አስተዳደር</h2>
          <p className="text-slate-500">የሲስተም መግቢያ ፍቃዶችን እና ሚናዎችን ይቆጣጠሩ</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          አዲስ ተጠቃሚ ጨምር
        </button>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">
              <th className="px-8 py-4">ኢሜይል</th>
              <th className="px-8 py-4">ሚና</th>
              <th className="px-8 py-4">ሁኔታ</th>
              <th className="px-8 py-4 text-right">ተግባራት</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-8 py-4 font-bold text-slate-700">{u.email || u.username}</td>
                <td className="px-8 py-4">
                  <select 
                    value={u.role || 'Viewer'}
                    onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                    className="bg-slate-100 border-none rounded-lg text-xs font-bold p-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Administrator">አስተዳዳሪ</option>
                    <option value="Data Entry">መረጃ አስገቢ</option>
                    <option value="Viewer">ተመልካች</option>
                  </select>
                </td>
                <td className="px-8 py-4">
                  <button
                    onClick={() => handleToggleActive(u.id, u.active !== false)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                      u.active !== false 
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                        : 'bg-red-50 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    {u.active !== false ? 'ገባሪ' : 'ያልነቃ'}
                  </button>
                </td>
                <td className="px-8 py-4 text-right">
                  <button 
                    onClick={() => handleDeleteUser(u.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <X size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdd(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 bg-blue-600 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold">አዲስ ተጠቃሚ ጨምር</h3>
                <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-white/20 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="p-8 space-y-6">
                <FormInput 
                  label="ኢሜይል" 
                  value={newUser.email || ''} 
                  onChange={(v) => setNewUser({...newUser, email: v})} 
                  placeholder="የኢሜይል አድራሻ" 
                  icon={<User size={18} />} 
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">የይለፍ ቃል (Password)</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <Shield size={18} />
                    </div>
                    <input 
                      type="password" 
                      value={newUser.password || ''}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      placeholder="የይለፍ ቃል"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">ሚና (Role)</label>
                  <select 
                    value={newUser.role || 'Viewer'}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-bold"
                  >
                    <option value="Administrator">አስተዳዳሪ (Administrator)</option>
                    <option value="Data Entry">መረጃ አስገቢ (Data Entry)</option>
                    <option value="Viewer">ተመልካች (Viewer)</option>
                  </select>
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading && <Loader2 className="animate-spin" size={18} />}
                  ተጠቃሚ ፍጠር
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VerificationView({ idNumber, assets: initialAssets }: { idNumber: string, assets: Assets }) {
  const [record, setRecord] = useState<IDRecord | null>(null);
  const [assets, setAssets] = useState<Assets>(initialAssets);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch record from Firestore
        const q = query(collection(db, 'ids'), where('id_number', '==', idNumber.trim()), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const recordDoc = querySnapshot.docs[0];
          const recordData = { ...recordDoc.data(), id: recordDoc.id } as IDRecord;
          
          // ONLY allow viewing if approved
          if (recordData.status === 'approved') {
            setRecord(recordData);
          } else {
            setRecord(null);
          }

          // Log scan (even if not approved, useful for security tracking)
          await addDoc(collection(db, 'scans'), {
            id_number: idNumber,
            timestamp: new Date().toISOString(),
            ip: 'Client-side',
            user_agent: navigator.userAgent
          });
        }

        // Fetch assets if they are empty
        if (Object.keys(assets).length === 0) {
          const assetsSnapshot = await getDocs(collection(db, 'assets'));
          const assetsData = assetsSnapshot.docs.reduce((acc: any, doc) => ({ ...acc, [doc.id]: doc.data().value }), {});
          setAssets(assetsData);
        }
      } catch (err) {
        console.error("Verification fetch error:", err);
        setRecord(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [idNumber]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-blue-600" size={48} />
    </div>
  );

  if (!record) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
        <X size={40} />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">ልክ ያልሆነ መታወቂያ (Invalid ID)</h1>
      <p className="text-slate-500 mt-2">ይህ መታወቂያ "{idNumber}" በመረጃ ቋታችን ውስጥ አልተገኘም ወይም አልጸደቀም።</p>
      <p className="text-slate-400 text-xs mt-4">This ID Number was not found in our database or is not yet approved.</p>
      <button 
        onClick={() => window.location.href = '/'}
        className="mt-8 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold"
      >
        ወደ መግቢያ ተመለስ (Back to Login)
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 sm:p-12 select-none">
      <div className="mb-8 text-center">
        {record.deleted ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-500 rounded-full text-sm font-bold mb-4 border border-red-500/30">
            <X size={16} />
            Revoked ID / የተሰረዘ መታወቂያ
          </div>
        ) : (new Date(record.expires_at) < new Date()) ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-500 rounded-full text-sm font-bold mb-4 border border-amber-500/30">
            <ShieldAlert size={16} />
            Expired ID / ጊዜው ያለፈበት መታወቂያ
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#10b98133] text-emerald-400 rounded-full text-sm font-bold mb-4">
            <Check size={16} />
            Verified Official ID / ህጋዊ መታወቂያ
          </div>
        )}
        <h1 className="text-white text-xl font-bold">BGR Police Commission</h1>
        <p className="text-slate-400 text-sm">Secure Verification Portal / ደህንነቱ የተጠበቀ ማረጋገጫ</p>
      </div>

      <div className="flex flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-4">
          <div className="scale-[0.8] sm:scale-110 lg:scale-[1.5] origin-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] rounded-[3.18mm]">
             <div className="relative">
               <IDCardFront data={record} assets={assets} />
             </div>
          </div>
        </div>
      </div>

      <div className="mt-32 max-w-sm text-center">
        <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">
          Security Notice: This page is for verification only. Any attempt to alter this data is a crime.
        </p>
        <p className="text-slate-600 text-[9px] mt-2">
          ማሳሰቢያ፡ ይህ ገፅ ለመታወቂያ ማረጋገጫ ብቻ የሚያገለግል ነዉ። መረጃውን ለመለወጥ መሞከር በህግ ያስቀጣል።
        </p>
      </div>
    </div>
  );
}
