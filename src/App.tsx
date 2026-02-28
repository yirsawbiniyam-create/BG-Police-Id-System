import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
  Plus, History, Search, Printer, Download, 
  Shield, User, Phone, Briefcase, Award, 
  ChevronRight, Languages, Loader2, Camera,
  Eye, X, Check, Database as DbIcon, RefreshCw, HardDrive,
  ShieldAlert, Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import { translateText } from './services/gemini';

// --- Types ---

interface IDRecord {
  id: number;
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
  created_at: string;
}

interface User {
  id: number;
  username: string;
  role: 'Administrator' | 'Data Entry' | 'Viewer';
}

interface Assets {
  bgr_flag?: string;
  eth_flag?: string;
  police_logo?: string;
}

// --- Components ---

const IDCardFront = React.forwardRef<HTMLDivElement, { data: Partial<IDRecord>, assets: Assets }>(({ data, assets }, ref) => {
  return (
    <div 
      ref={ref}
      className="relative w-[85.6mm] h-[53.98mm] rounded-[3.18mm] overflow-hidden flex flex-col p-[1.5mm] select-none box-border"
      style={{ 
        printColorAdjust: 'exact',
        background: 'linear-gradient(135deg, #fcd34d 0%, #fffbeb 40%, #ffffff 60%, #dbeafe 100%)',
        border: '0.2mm solid rgba(30, 58, 138, 0.1)'
      }}
    >
      {/* Background Pattern / Security Element */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
        <Shield size={200} style={{ color: '#1e3a8a' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex justify-between items-start h-12 px-2 pt-1">
        <img 
          src={assets.bgr_flag || "https://picsum.photos/seed/bgr/100/60"} 
          className="h-7 w-12 object-cover rounded-sm shadow-sm" 
          alt="BGR Flag" 
          crossOrigin="anonymous"
        />
        <div className="flex flex-col items-center -mt-1">
          <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center">
            <img 
              src={assets.police_logo || "https://picsum.photos/seed/logo/120/120"} 
              className="w-full h-full object-contain" 
              style={{ opacity: 0.9 }}
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
      <div className="relative z-10 text-center mb-0.5 mt-1">
        <h1 className="text-[8px] font-extrabold leading-none tracking-tight" style={{ color: '#1e3a8a' }}>የቤንሻንጉል ጉምዝ ክልል ፖሊስ ኮሚሽን</h1>
        <h2 className="text-[6px] font-bold uppercase tracking-tighter leading-none mt-0.5" style={{ color: '#1e40af' }}>Benishangul-Gumuz Region Police Commission</h2>
        <div className="mt-0.5 border-t pt-0.5 flex justify-center gap-3" style={{ borderTopColor: 'rgba(30, 58, 138, 0.2)' }}>
          <p className="text-[8px] font-black tracking-widest leading-none" style={{ color: '#dc2626' }}>የመታወቂያ ካርድ</p>
          <p className="text-[6px] font-bold uppercase tracking-widest leading-none self-center" style={{ color: '#1e3a8a' }}>IDENTITY CARD</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-1 gap-1.5 px-1 overflow-hidden">
        {/* Left Column: Details */}
        <div className="w-[55mm] flex flex-col justify-center py-0.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-2 py-0.5 rounded-md border shadow-sm" style={{ backgroundColor: '#1e3a8a', borderColor: '#1e3a8a' }}>
              <span className="text-[4.5px] font-bold uppercase whitespace-nowrap" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>ID NO / መታወቂያ ቁጥር:</span>
              <span className="text-[9px] font-black text-white tracking-wider">{data.id_number || "BGR-POL-00000"}</span>
            </div>
            
            <div className="p-1 rounded-md border-l-2" style={{ backgroundColor: 'rgba(219, 234, 254, 0.5)', borderLeftColor: '#2563eb' }}>
              <div className="text-[4.5px] font-bold uppercase" style={{ color: 'rgba(30, 58, 138, 0.6)' }}>FULL NAME / ሙሉ ስም</div>
              <div className="text-[9px] font-bold leading-tight truncate" style={{ color: '#0f172a' }}>{data.full_name_am}</div>
              <div className="text-[7.5px] font-semibold uppercase leading-tight truncate" style={{ color: '#334155' }}>{data.full_name_en}</div>
            </div>

            <div className="grid grid-cols-1 gap-0.5">
              <div>
                <div className="text-[4.5px] font-bold uppercase" style={{ color: 'rgba(30, 58, 138, 0.6)' }}>RANK / ማዕረግ</div>
                <div className="text-[7.5px] font-bold truncate" style={{ color: '#0f172a' }}>{data.rank_am} / <span className="text-[6.5px] font-medium uppercase" style={{ color: '#475569' }}>{data.rank_en}</span></div>
              </div>
            </div>

            <div>
              <div className="text-[4.5px] font-bold uppercase" style={{ color: 'rgba(30, 58, 138, 0.6)' }}>RESPONSIBILITY / ሀላፊነት</div>
              <div className="text-[7.5px] font-bold truncate" style={{ color: '#0f172a' }}>{data.responsibility_am} / {data.responsibility_en}</div>
            </div>
          </div>
        </div>

        {/* Right Column: Photo */}
        <div className="w-[22mm] flex flex-col items-center justify-center">
          <div className="w-[20mm] h-[25mm] bg-white border-2 rounded-lg overflow-hidden shadow-md relative" style={{ borderColor: '#f59e0b' }}>
            {data.photo_url ? (
              <img 
                src={data.photo_url} 
                className="w-full h-full object-contain bg-slate-50" 
                alt="Member" 
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-amber-200">
                <User size={35} />
              </div>
            )}
          </div>
          <div className="mt-0.5 text-[5px] font-bold uppercase tracking-widest" style={{ color: 'rgba(30, 58, 138, 0.4)' }}>Official Photo</div>
        </div>
      </div>

      {/* Footer Accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 flex" style={{ backgroundColor: '#1e3a8a' }}>
        <div className="h-full w-1/3" style={{ backgroundColor: '#facc15' }}></div>
        <div className="h-full w-1/3" style={{ backgroundColor: '#16a34a' }}></div>
        <div className="h-full w-1/3" style={{ backgroundColor: '#1e3a8a' }}></div>
      </div>
    </div>
  );
});

const IDCardBack = React.forwardRef<HTMLDivElement, { data: Partial<IDRecord>, assets: Assets }>(({ data, assets }, ref) => {
  return (
    <div 
      ref={ref}
      className="relative w-[85.6mm] h-[53.98mm] rounded-[3.18mm] overflow-hidden flex flex-col p-[2mm] select-none box-border"
      style={{ 
        printColorAdjust: 'exact',
        backgroundColor: '#ffffff',
        border: '0.2mm solid rgba(0, 0, 0, 0.05)'
      }}
    >
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
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
          <p className="text-[7px] font-extrabold leading-tight text-justify" style={{ color: '#0f172a' }}>
            ይህ የመታወቂያ ካርድ የቤንሻንጉል ጉምዝ ክልል ፖሊስ ኮሚሽን ንብረት ነው፡፡ ይህንን መታወቂያ የያዘ ግለሰብ የኮሚሽኑ የፖሊስ አባል በመሆኑ ሕግን የማስከበርና የማስገደድ ሙሉ ሥልጣን ተሰጥቶታል፡፡ መታወቂያው ቢጠፋ ወይም በሌላ ግለሰብ እጅ ቢገኝ በአቅራቢያው ለሚገኝ ፖሊስ ጣቢያ እንዲያስረክቡ እናሳስባለን፡፡
          </p>
          <p className="text-[6px] font-bold italic leading-tight text-justify" style={{ color: '#64748b' }}>
            This identity card is the property of the BGR Police Commission. The holder is a member of the police commission and is fully authorized to enforce the law. If found, please return it to the nearest police station.
          </p>
        </div>

        {/* Middle: Details in Two Lines */}
        <div className="py-1 flex flex-col gap-0.5 border-b" style={{ borderBottomColor: '#f1f5f9' }}>
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex items-center gap-1">
              <span className="text-[4px] font-bold uppercase" style={{ color: '#94a3b8' }}>ፆታ / GENDER:</span>
              <span className="text-[6.5px] font-black" style={{ color: '#1e293b' }}>{data.gender || "N/A"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[4px] font-bold uppercase" style={{ color: '#94a3b8' }}>ቁመት / HEIGHT:</span>
              <span className="text-[6.5px] font-black" style={{ color: '#1e293b' }}>{data.height || "N/A"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[4px] font-bold uppercase" style={{ color: '#94a3b8' }}>መልክ / COMPLEXION:</span>
              <span className="text-[6.5px] font-black" style={{ color: '#1e293b' }}>{data.complexion || "N/A"}</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex items-center gap-1">
              <span className="text-[4px] font-bold uppercase" style={{ color: '#94a3b8' }}>ስልክ / PHONE:</span>
              <span className="text-[6.5px] font-black" style={{ color: '#1d4ed8' }}>{data.phone || "N/A"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[4px] font-bold uppercase" style={{ color: '#94a3b8' }}>ደም / BLOOD:</span>
              <span className="text-[6.5px] font-black" style={{ color: '#dc2626' }}>{data.blood_type || "N/A"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[4px] font-bold uppercase" style={{ color: '#94a3b8' }}>ጡረታ / BADGE:</span>
              <span className="text-[6.5px] font-black" style={{ color: '#1e293b' }}>{data.badge_number || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Bottom: QR, Emergency, Signature */}
        <div className="h-[24mm] flex items-center justify-between pt-1">
          {/* QR Code (Even Larger) */}
          <div className="flex flex-col items-center gap-0.5">
            <div className="p-1.5 bg-white border rounded-lg shadow-md" style={{ borderColor: '#e2e8f0' }}>
              <QRCodeSVG 
                value={`${window.location.origin}/verify/${data.id_number}`} 
                size={85} 
                level="H"
              />
            </div>
            <span className="text-[5px] font-black tracking-tighter" style={{ color: '#1e3a8a' }}>{data.id_number}</span>
          </div>

          {/* Emergency Contact */}
          <div className="flex flex-col items-center text-center px-2 border-x h-full justify-center" style={{ borderLeftColor: '#f1f5f9', borderRightColor: '#f1f5f9' }}>
            <span className="text-[4px] font-bold uppercase mb-0.5" style={{ color: '#94a3b8' }}>Emergency Contact</span>
            <span className="text-[6px] font-bold leading-tight truncate max-w-[25mm]" style={{ color: '#1e293b' }}>{data.emergency_contact_name || "N/A"}</span>
            <span className="text-[6.5px] font-black" style={{ color: '#1d4ed8' }}>{data.emergency_contact_phone || "N/A"}</span>
          </div>

          {/* Signature */}
          <div className="flex flex-col items-center w-[25mm]">
            <div className="h-12 w-full flex items-center justify-center relative">
              {data.commissioner_signature ? (
                <img 
                  src={data.commissioner_signature} 
                  className="h-full w-full object-contain" 
                  alt="Signature" 
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="w-full border-b mb-1" style={{ borderBottomColor: '#cbd5e1' }}></div>
              )}
            </div>
            <div className="text-[4px] font-bold uppercase text-center leading-none mt-1" style={{ color: '#94a3b8' }}>
              Commissioner Signature<br/>የኮሚሽነሩ ፊርማ
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'create' | 'history' | 'verify' | 'maintenance' | 'users'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<IDRecord[]>([]);
  const [assets, setAssets] = useState<Assets>({});
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<IDRecord | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);

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
    commissioner_signature: ''
  });

  const [printSide, setPrintSide] = useState<'front' | 'back' | 'both' | 'combined'>('both');
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Police_ID_Card",
  });

  const handlePrintSide = (side: 'front' | 'back' | 'both' | 'combined') => {
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

  const [showScans, setShowScans] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser && savedUser !== "undefined") {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to parse saved user:", e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  useEffect(() => {
    console.log("Current Auth State:", { hasToken: !!token, user: user?.username });
    if (token) {
      fetchAssets();
      fetchRecords();
      if (user?.role === 'Administrator') {
        fetchBackups();
      }
    }
  }, [token, user]);

  const apiFetch = async (url: string, options: any = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      handleLogout();
      throw new Error('Session expired');
    }
    return res;
  };

  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) setServerStatus('online');
        else setServerStatus('offline');
      } catch (e) {
        setServerStatus('offline');
      }
    };
    checkServer();
    const interval = setInterval(checkServer, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (credentials: any) => {
    console.log("Attempting login with:", credentials.username);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        data = { error: `Server returned non-JSON response (${res.status})` };
      }

      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      } else {
        if (res.status === 404) {
          alert('Server Error: Login API not found (404). The server might be restarting or the route is misconfigured.');
        } else if (res.status === 405) {
          alert('Server Error: Method Not Allowed (405).');
        } else {
          const errorMsg = data.error || `Login failed (${res.status})`;
          const details = data.details ? `\n\nDetails: ${data.details}` : '';
          alert(`${errorMsg}${details}`);
        }
      }
    } catch (e) {
      console.error("Login fetch error:", e);
      alert('Login error: Could not connect to the server. Please check your internet connection or if the server is down.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setView('dashboard');
  };

  const fetchBackups = async () => {
    try {
      const res = await apiFetch('/api/backups');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setBackups(data);
    } catch (e) {
      console.error("Failed to fetch backups:", e);
    }
  };

  const createBackup = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/backups', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        fetchBackups();
        alert(`Backup created successfully: ${data.filename}`);
      }
    } catch (e) {
      console.error("Backup error:", e);
      alert("Backup failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to restore from ${filename}? This will overwrite current data.`)) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        alert("Database restored successfully. Refreshing data...");
        fetchRecords();
        fetchAssets();
      }
    } catch (e) {
      console.error("Restore error:", e);
      alert("Restore failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (idNumber: string, side: 'front' | 'back' | 'both') => {
    setLoading(true);
    let captureContainer: HTMLDivElement | null = null;
    
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

      const sidesToCapture = side === 'both' ? ['front', 'back'] : [side];
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

      // Explicitly wait for all images in the capture container to load
      const imagesToLoad = Array.from(captureContainer.querySelectorAll('img'));
      await Promise.all(imagesToLoad.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));

      const canvas = await html2canvas(captureContainer, {
        scale: 2, // Moderate scale for better compatibility
        useCORS: true,
        logging: true, // Enable logging for debugging
        backgroundColor: '#ffffff',
        allowTaint: false,
        imageTimeout: 30000,
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
      if (captureContainer && captureContainer.parentNode) {
        document.body.removeChild(captureContainer);
      }
      setLoading(false);
    }
  };

  const fetchScans = async (idNumber: string) => {
    try {
      const res = await apiFetch(`/api/scans/${idNumber}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setScanHistory(data);
      setShowScans(true);
    } catch (e) {
      console.error("Fetch scans error:", e);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await apiFetch('/api/assets');
      if (!res.ok) throw new Error('Failed to fetch assets');
      const data = await res.json();
      console.log("Assets fetched successfully:", Object.keys(data));
      setAssets(data);
    } catch (e) {
      console.error("Fetch assets error:", e);
    }
  };

  const fetchRecords = async (search = '') => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/ids?search=${search}`);
      if (!res.ok) throw new Error('Failed to fetch records');
      const data = await res.json();
      setRecords(data);
    } catch (e) {
      console.error("Fetch records error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAssetUpload = async (key: keyof Assets, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const res = await apiFetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value: base64 })
        });
        if (res.ok) {
          fetchAssets();
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error("Asset upload failed:", res.status, errData);
          alert(`Asset upload failed: ${res.status} ${errData.error || ''}`);
        }
      } catch (error) {
        console.error("Asset upload error:", error);
        alert("Asset upload failed. Check console.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, photo_url: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTranslating(true);
    
    try {
      // Auto-translate missing fields before submission
      const fields = ['full_name', 'rank', 'responsibility'];
      const finalData = { ...formData };
      
      for (const field of fields) {
        const amKey = `${field}_am` as keyof typeof formData;
        const enKey = `${field}_en` as keyof typeof formData;
        
        if (formData[amKey] && !formData[enKey]) {
          finalData[enKey] = await translateText(formData[amKey], 'en');
        } else if (formData[enKey] && !formData[amKey]) {
          finalData[amKey] = await translateText(formData[enKey], 'am');
        }
      }

      const isUpdate = !!finalData.id;
      const url = isUpdate ? `/api/ids/${finalData.id}` : '/api/ids';
      const method = isUpdate ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });
      
      if (!res.ok) throw new Error(`Failed to ${isUpdate ? 'update' : 'create'} ID`);
      
      const result = await res.json();
      if (result.success) {
        fetchRecords();
        setFormData({
          id: null,
          full_name_am: '', full_name_en: '',
          rank_am: '', rank_en: '',
          responsibility_am: '', responsibility_en: '',
          phone: '', photo_url: '',
          blood_type: '', badge_number: '',
          gender: '', complexion: '', height: '',
          emergency_contact_name: '', emergency_contact_phone: '',
          commissioner_signature: ''
        });
        setView('history');
        alert(isUpdate ? "መረጃው በትክክል ተሻሽሏል!" : "መታወቂያው በትክክል ተመዝግቧል!");
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert("ስህተት ተፈጥሯል! እባክዎ እንደገና ይሞክሩ። (Error: " + (error instanceof Error ? error.message : String(error)) + ")");
    } finally {
      setLoading(false);
      setTranslating(false);
    }
  };

  // Verification View Logic
  const path = window.location.pathname;
  if (path.startsWith('/verify/')) {
    const idNum = path.split('/')[2];
    return <VerificationView idNumber={idNum} assets={assets} />;
  }

  if (!token) {
    return <Login onLogin={handleLogin} loading={loading} serverStatus={serverStatus} />;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <Shield size={24} />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-none text-blue-900">BGR Police</h1>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">ID Management System</p>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<Shield size={18} />} label="Dashboard" />
              {(user?.role === 'Administrator' || user?.role === 'Data Entry') && (
                <NavButton 
                  active={view === 'create'} 
                  onClick={() => {
                    setFormData({
                      id: null,
                      full_name_am: '', full_name_en: '',
                      rank_am: '', rank_en: '',
                      responsibility_am: '', responsibility_en: '',
                      phone: '', photo_url: '',
                      blood_type: '', badge_number: '',
                      gender: '', complexion: '', height: '',
                      emergency_contact_name: '', emergency_contact_phone: '',
                      commissioner_signature: ''
                    });
                    setView('create');
                  }} 
                  icon={<Plus size={18} />} 
                  label="New ID" 
                />
              )}
              <NavButton active={view === 'history'} onClick={() => setView('history')} icon={<History size={18} />} label="Records" />
              {user?.role === 'Administrator' && (
                <>
                  <NavButton active={view === 'maintenance'} onClick={() => setView('maintenance')} icon={<DbIcon size={18} />} label="Maintenance" />
                  <NavButton active={view === 'users'} onClick={() => setView('users')} icon={<User size={18} />} label="Users" />
                </>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search records..." 
                  className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 w-64 transition-all"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    fetchRecords(e.target.value);
                  }}
                />
              </div>
              <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-900">{user?.username}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{user?.role}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="Logout"
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total IDs" value={records.length} icon={<User className="text-blue-600" />} />
                <StatCard title="Recent Scans" value="24" icon={<Eye className="text-emerald-600" />} />
                <StatCard title="System Status" value="Active" icon={<Check className="text-blue-600" />} />
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Camera size={24} className="text-blue-600" />
                  System Assets Configuration
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                  <AssetUpload 
                    label="BGR Flag" 
                    image={assets.bgr_flag} 
                    onUpload={(e) => handleAssetUpload('bgr_flag', e)} 
                  />
                  <AssetUpload 
                    label="Police Logo" 
                    image={assets.police_logo} 
                    onUpload={(e) => handleAssetUpload('police_logo', e)} 
                  />
                  <AssetUpload 
                    label="Ethiopian Flag" 
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
                    <h2 className="text-2xl font-bold">{formData.id ? 'Edit Member ID' : 'Create New Member ID'}</h2>
                    <p className="text-blue-100 text-sm">{formData.id ? 'Update member details' : 'Fill in the details. Missing translations will be generated automatically.'}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <FormInput label="Full Name (Amharic)" value={formData.full_name_am} onChange={(v) => setFormData({...formData, full_name_am: v})} placeholder="ሙሉ ስም" icon={<User size={18}/>} />
                      <FormInput label="Full Name (English)" value={formData.full_name_en} onChange={(v) => setFormData({...formData, full_name_en: v})} placeholder="Full Name" icon={<User size={18}/>} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Rank (Amharic)" value={formData.rank_am} onChange={(v) => setFormData({...formData, rank_am: v})} placeholder="ማዕረግ" icon={<Award size={18}/>} />
                        <FormInput label="Rank (English)" value={formData.rank_en} onChange={(v) => setFormData({...formData, rank_en: v})} placeholder="Rank" icon={<Award size={18}/>} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Responsibility (Amharic)" value={formData.responsibility_am} onChange={(v) => setFormData({...formData, responsibility_am: v})} placeholder="ሀላፊነት" icon={<Briefcase size={18}/>} />
                        <FormInput label="Responsibility (English)" value={formData.responsibility_en} onChange={(v) => setFormData({...formData, responsibility_en: v})} placeholder="Responsibility" icon={<Briefcase size={18}/>} />
                      </div>
                      <FormInput label="Phone Number" value={formData.phone} onChange={(v) => setFormData({...formData, phone: v})} placeholder="+251..." icon={<Phone size={18}/>} />
                      
                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4">Front Side Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <FormInput label="Blood Type" value={formData.blood_type} onChange={(v) => setFormData({...formData, blood_type: v})} placeholder="A+, B-, etc." icon={<Check size={18}/>} />
                          <FormInput label="Badge Number" value={formData.badge_number} onChange={(v) => setFormData({...formData, badge_number: v})} placeholder="Badge #" icon={<Shield size={18}/>} />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4">Back Side Details</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <FormInput label="Gender" value={formData.gender} onChange={(v) => setFormData({...formData, gender: v})} placeholder="M/F" icon={<User size={18}/>} />
                          <FormInput label="Complexion" value={formData.complexion} onChange={(v) => setFormData({...formData, complexion: v})} placeholder="Brown, etc." icon={<Eye size={18}/>} />
                          <FormInput label="Height" value={formData.height} onChange={(v) => setFormData({...formData, height: v})} placeholder="1.75m" icon={<Plus size={18}/>} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <FormInput label="Emergency Contact Name" value={formData.emergency_contact_name} onChange={(v) => setFormData({...formData, emergency_contact_name: v})} placeholder="Name" icon={<User size={18}/>} />
                          <FormInput label="Emergency Contact Phone" value={formData.emergency_contact_phone} onChange={(v) => setFormData({...formData, emergency_contact_phone: v})} placeholder="Phone" icon={<Phone size={18}/>} />
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
                              <Camera size={32} />
                              <span className="text-[10px] font-medium">Upload Photo</span>
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
                        <p className="text-xs font-bold text-slate-500 mb-3">Commissioner Signature</p>
                        <div className="w-full h-24 bg-white rounded-2xl shadow-sm overflow-hidden border-2 border-white relative group flex items-center justify-center">
                          {formData.commissioner_signature ? (
                            <img src={formData.commissioner_signature} className="h-full object-contain" alt="Signature Preview" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
                              <Plus size={24} />
                              <span className="text-[10px] font-medium">Upload Signature</span>
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
                              reader.onloadend = () => setFormData({ ...formData, commissioner_signature: reader.result as string });
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
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={loading || translating}
                      className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {(loading || translating) && <Loader2 className="animate-spin" size={18} />}
                      {translating ? 'Translating...' : (formData.id ? 'Update Member ID' : 'Generate ID Card')}
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
                  <h2 className="text-3xl font-bold">System Maintenance</h2>
                  <p className="text-slate-500">Manage database backups and system integrity</p>
                </div>
                <button 
                  onClick={createBackup}
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                  Backup Database Now
                </button>
              </div>

              <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <HardDrive size={20} className="text-blue-600" />
                  <h3 className="font-bold">Backup History</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="px-8 py-4">Filename</th>
                        <th className="px-8 py-4">Date</th>
                        <th className="px-8 py-4">Size</th>
                        <th className="px-8 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {backups.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-8 py-12 text-center text-slate-400">
                            No backups found.
                          </td>
                        </tr>
                      ) : (
                        backups.map((backup) => (
                          <tr key={backup.filename} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-4 font-medium text-slate-700">{backup.filename}</td>
                            <td className="px-8 py-4 text-slate-500 text-sm">
                              {new Date(backup.createdAt).toLocaleString()}
                            </td>
                            <td className="px-8 py-4 text-slate-500 text-sm">
                              {(backup.size / 1024 / 1024).toFixed(2)} MB
                            </td>
                            <td className="px-8 py-4 text-right">
                              <button 
                                onClick={() => restoreBackup(backup.filename)}
                                className="px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              >
                                Restore
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex gap-4 items-start">
                <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
                  <Shield size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-amber-900">Automatic Backups</h4>
                  <p className="text-sm text-amber-800/80 mt-1">
                    The system is configured to perform automatic daily backups at 2:00 AM. 
                    These backups are stored securely on the server and can be restored from the list above.
                  </p>
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
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900">Member Records</h2>
                {(user?.role === 'Administrator' || user?.role === 'Data Entry') && (
                  <button 
                    onClick={() => {
                      setFormData({
                        id: null,
                        full_name_am: '', full_name_en: '',
                        rank_am: '', rank_en: '',
                        responsibility_am: '', responsibility_en: '',
                        phone: '', photo_url: '',
                        blood_type: '', badge_number: '',
                        gender: '', complexion: '', height: '',
                        emergency_contact_name: '', emergency_contact_phone: '',
                        commissioner_signature: ''
                      });
                      setView('create');
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                  >
                    <Plus size={20} />
                    New Member
                  </button>
                )}
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Member</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID Number</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rank & Responsibility</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
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
                        <td className="px-6 py-4 text-sm text-slate-600">{record.phone}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setFormData({
                                  id: record.id,
                                  full_name_am: record.full_name_am,
                                  full_name_en: record.full_name_en,
                                  rank_am: record.rank_am,
                                  rank_en: record.rank_en,
                                  responsibility_am: record.responsibility_am,
                                  responsibility_en: record.responsibility_en,
                                  phone: record.phone,
                                  photo_url: record.photo_url,
                                  blood_type: record.blood_type,
                                  badge_number: record.badge_number,
                                  gender: record.gender,
                                  complexion: record.complexion,
                                  height: record.height,
                                  emergency_contact_name: record.emergency_contact_name,
                                  emergency_contact_phone: record.emergency_contact_phone,
                                  commissioner_signature: record.commissioner_signature
                                });
                                setView('create');
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Edit Record"
                            >
                              <Edit size={18} />
                            </button>
                            <button 
                              onClick={() => fetchScans(record.id_number)}
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                              title="View Scan History"
                            >
                              <History size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedRecord(record);
                                setShowPreview(true);
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Eye size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedRecord(record);
                                handlePrintSide('both');
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            >
                              <Printer size={18} />
                            </button>
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
            <UserManagement apiFetch={apiFetch} />
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
                  id: selectedRecord.id,
                  full_name_am: selectedRecord.full_name_am,
                  full_name_en: selectedRecord.full_name_en,
                  rank_am: selectedRecord.rank_am,
                  rank_en: selectedRecord.rank_en,
                  responsibility_am: selectedRecord.responsibility_am,
                  responsibility_en: selectedRecord.responsibility_en,
                  phone: selectedRecord.phone,
                  photo_url: selectedRecord.photo_url,
                  blood_type: selectedRecord.blood_type,
                  badge_number: selectedRecord.badge_number,
                  gender: selectedRecord.gender,
                  complexion: selectedRecord.complexion,
                  height: selectedRecord.height,
                  emergency_contact_name: selectedRecord.emergency_contact_name,
                  emergency_contact_phone: selectedRecord.emergency_contact_phone,
                  commissioner_signature: selectedRecord.commissioner_signature
                });
                setShowPreview(false);
                setView('create');
              }
            }}
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
                <h3 className="text-xl font-bold">Verification History</h3>
                <button onClick={() => setShowScans(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {scanHistory.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No scans recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {scanHistory.map((scan) => (
                      <div key={scan.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-blue-600">{new Date(scan.scanned_at).toLocaleString()}</span>
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
        style={{ position: 'absolute', left: '0', top: '0', width: '100%', height: '0', overflow: 'hidden', opacity: 0, pointerEvents: 'none', zIndex: -1000 }}
        className="no-print"
      >
        <div ref={printRef} key={`${selectedRecord?.id}-${printSide}`} className="print-container">
          {selectedRecord && (
            <>
              {printSide === 'combined' ? (
                <div className="flex flex-col gap-0">
                  <div className="print-card" style={{ pageBreakAfter: 'avoid' }}>
                    <IDCardFront data={selectedRecord} assets={assets} />
                  </div>
                  <div className="print-card">
                    <IDCardBack data={selectedRecord} assets={assets} />
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}
            </>
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
            <div className="mt-8 flex gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Helper Components ---

function PreviewModal({ record, assets, onClose, onPrint, onDownload, onEdit }: { record: IDRecord, assets: Assets, onClose: () => void, onPrint: (side: 'front' | 'back' | 'both' | 'combined') => void, onDownload: (side: 'front' | 'back' | 'both' | 'combined') => void, onEdit: () => void }) {
  const [activeTab, setActiveTab] = useState<'front' | 'back' | 'both' | 'combined'>('both');

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
            <h3 className="text-xl font-bold">ID Card Detailed Preview</h3>
            <p className="text-xs text-slate-500">Inspect front and back sides before printing</p>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('front')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'front' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Front
            </button>
            <button 
              onClick={() => setActiveTab('back')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'back' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Back
            </button>
            <button 
              onClick={() => setActiveTab('both')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'both' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Both Sides
            </button>
            <button 
              onClick={() => setActiveTab('combined')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'combined' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Combined
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
              </div>
              <div id={`card-front-${record.id_number}`} className="scale-[1.1] sm:scale-125 lg:scale-150 origin-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-[3.18mm]">
                <IDCardFront data={record} assets={assets} />
              </div>
            </div>

            {/* Back Side */}
            <div className={`space-y-6 flex flex-col items-center w-full lg:w-auto ${activeTab === 'front' || activeTab === 'combined' ? 'hidden lg:flex opacity-0 pointer-events-none absolute' : 'flex'}`}>
              <div className="flex items-center justify-between w-full px-2 max-w-[85.6mm]">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Back Side / የጀርባ ገፅ</span>
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
            <button 
              onClick={onEdit}
              className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
            >
              <Edit size={18} />
              Edit
            </button>
            <button 
              onClick={onClose}
              className="w-full sm:w-auto px-8 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              Back to Records
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button 
              onClick={() => onDownload('both')}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl"
            >
              <Download size={24} />
              Download Full (Front & Back)
            </button>
            <button 
              onClick={() => onPrint('combined')}
              className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-2xl shadow-[#0596694d] hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
            >
              <Printer size={24} />
              Print Combined
            </button>
            <button 
              onClick={() => onPrint('both')}
              className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-2xl shadow-[#2563eb4d] hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
            >
              <Printer size={24} />
              Print Both Sides Together
            </button>
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
          <span className="text-white text-xs font-bold">Change Asset</span>
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all"
        />
      </div>
    </div>
  );
}

function Login({ onLogin, loading, serverStatus }: { onLogin: (c: any) => void, loading: boolean, serverStatus: 'checking' | 'online' | 'offline' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ username: username.trim(), password });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden"
      >
        <div className="p-10 bg-blue-600 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield size={32} />
          </div>
          <h2 className="text-2xl font-bold">BGR Police Commission</h2>
          <p className="text-blue-100 text-sm mt-1">ID Management System Login</p>
          <div className="mt-4 flex justify-center items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              serverStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 
              serverStatus === 'offline' ? 'bg-red-400' : 'bg-slate-400'
            }`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-100">
              System: {serverStatus}
            </span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-10 space-y-6">
          <FormInput 
            label="Username" 
            value={username} 
            onChange={setUsername} 
            placeholder="Enter username" 
            icon={<User size={18} />} 
          />
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Password</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Shield size={18} />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
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
            Sign In
          </button>
          <div className="text-center space-y-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              DEFAULT: POLICE / POLICE1234
            </p>
            <button 
              type="button"
              onClick={async () => {
                if(confirm("Reset admin user to default?")) {
                  try {
                    const res = await fetch('/api/auth/reset-admin', { method: 'POST' });
                    const data = await res.json();
                    alert(data.message || "Reset successful");
                  } catch (e) {
                    alert("Reset failed");
                  }
                }
              }}
              className="text-[10px] text-blue-400 hover:text-blue-600 font-bold uppercase tracking-widest"
            >
              Reset Admin Account
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function UserManagement({ apiFetch }: { apiFetch: (u: string, o?: any) => Promise<Response> }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Viewer' });

  const fetchUsers = async () => {
    const res = await apiFetch('/api/users');
    const data = await res.json();
    setUsers(data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        fetchUsers();
        setShowAdd(false);
        setNewUser({ username: '', password: '', role: 'Viewer' });
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add user');
      }
    } catch (e) {
      alert('Error adding user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user');
      }
    } catch (e) {
      alert('Error deleting user');
    }
  };

  const handleUpdateRole = async (id: number, role: string) => {
    try {
      const res = await apiFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (e) {
      alert('Error updating role');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">User Management</h2>
          <p className="text-slate-500">Manage system access and roles</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          Add New User
        </button>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">
              <th className="px-8 py-4">Username</th>
              <th className="px-8 py-4">Role</th>
              <th className="px-8 py-4">Created At</th>
              <th className="px-8 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-8 py-4 font-bold text-slate-700">{u.username}</td>
                <td className="px-8 py-4">
                  <select 
                    value={u.role}
                    onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                    className="bg-slate-100 border-none rounded-lg text-xs font-bold p-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Data Entry">Data Entry</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </td>
                <td className="px-8 py-4 text-slate-500 text-sm">
                  {new Date(u.created_at).toLocaleDateString()}
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
                <h3 className="text-xl font-bold">Add New User</h3>
                <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-white/20 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="p-8 space-y-6">
                <FormInput 
                  label="Username" 
                  value={newUser.username} 
                  onChange={(v) => setNewUser({...newUser, username: v})} 
                  placeholder="Username" 
                  icon={<User size={18} />} 
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Password</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <Shield size={18} />
                    </div>
                    <input 
                      type="password" 
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      placeholder="Password"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Role</label>
                  <select 
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-bold"
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Data Entry">Data Entry</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading && <Loader2 className="animate-spin" size={18} />}
                  Create User
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
        // Fetch record if not already loaded or if idNumber changed
        if (!record || record.id_number !== idNumber) {
          const recordRes = await fetch(`/api/ids/${idNumber}`);
          if (!recordRes.ok) throw new Error(`HTTP error! status: ${recordRes.status}`);
          const recordData = await recordRes.json();
          setRecord(recordData);
        }

        // Fetch assets if they are empty
        if (Object.keys(assets).length === 0) {
          const assetsRes = await fetch('/api/assets');
          if (assetsRes.ok) {
            const assetsData = await assetsRes.json();
            setAssets(assetsData);
          }
        }
      } catch (err) {
        console.error("Verification fetch error:", err);
        setRecord(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [idNumber]); // Only depend on idNumber

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
      <h1 className="text-2xl font-bold text-slate-900">Invalid ID Card</h1>
      <p className="text-slate-500 mt-2">This ID record could not be found in our secure database.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 sm:p-12 select-none">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#10b98133] text-emerald-400 rounded-full text-sm font-bold mb-4">
          <Check size={16} />
          Verified Official ID / ህጋዊ መታወቂያ
        </div>
        <h1 className="text-white text-xl font-bold">BGR Police Commission</h1>
        <p className="text-slate-400 text-sm">Secure Verification Portal / ደህንነቱ የተጠበቀ ማረጋገጫ</p>
      </div>

      <div className="flex flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-4">
          <div className="scale-110 sm:scale-150 lg:scale-[2.0] origin-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] rounded-[3.18mm]">
            <IDCardFront data={record} assets={assets} />
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
