import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
  Plus, History, Search, Printer, Download, 
  Shield, User, Phone, Briefcase, Award, 
  ChevronRight, Languages, Loader2, Camera,
  Eye, X, Check, Database as DbIcon, RefreshCw, HardDrive
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
      className="relative w-[85.6mm] h-[53.98mm] rounded-[3.18mm] overflow-hidden flex flex-col p-2 border border-[#d977064d] select-none"
      style={{ 
        printColorAdjust: 'exact',
        background: 'linear-gradient(135deg, #fbbf24 0%, #fef3c7 50%, #2563eb 100%)'
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center h-16 px-1">
        <img src={assets.bgr_flag || "https://picsum.photos/seed/bgr/100/60"} className="h-10 w-16 object-cover rounded-sm shadow-sm" alt="BGR Flag" />
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-sm border border-[#1e3a8a1a] -mt-4">
          <img 
            src={assets.police_logo || "https://picsum.photos/seed/logo/120/120"} 
            className="w-18 h-18 object-contain" 
            alt="Police Logo" 
          />
        </div>
        <img src={assets.eth_flag || "https://picsum.photos/seed/eth/100/60"} className="h-10 w-16 object-cover rounded-sm shadow-sm" alt="ETH Flag" />
      </div>

      {/* Commission Name */}
      <div className="text-center -mt-1">
        <h1 className="text-[8px] font-bold text-blue-900 leading-tight">የቤንሻንጉል ጉምዝ ክልል ፖሊስ ኮሚሽን</h1>
        <h2 className="text-[7px] font-semibold text-blue-800 uppercase tracking-tighter">Benishangul-Gumuz Region Police Commission</h2>
        <div className="mt-0.5 border-t border-[#1e3a8a33] pt-0.5">
          <p className="text-[8px] font-black text-red-600 tracking-widest leading-none">የመታወቂያ ካርድ</p>
          <p className="text-[6px] font-bold text-blue-900 uppercase tracking-widest">IDENTITY CARD</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 mt-1 gap-2">
        {/* Left Side: Details */}
        <div className="flex-1 flex flex-col justify-center space-y-0.5 pl-1">
          <div className="flex flex-col">
            <span className="text-[5px] text-[#1e3a8ab3] font-bold">ID NO / መታወቂያ ቁጥር</span>
            <span className="text-[8px] font-black text-blue-900">{data.id_number || "BGR-POL-00000"}</span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-[5px] text-[#1e3a8ab3] font-bold">FULL NAME / ሙሉ ስም</span>
            <span className="text-[7px] font-bold text-gray-900 leading-none">{data.full_name_am}</span>
            <span className="text-[6px] font-medium text-gray-800 uppercase">{data.full_name_en}</span>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <div className="flex flex-col">
              <span className="text-[5px] text-[#1e3a8ab3] font-bold">RANK / ማዕረግ</span>
              <span className="text-[6px] font-bold text-gray-900">{data.rank_am} / {data.rank_en}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[5px] text-[#1e3a8ab3] font-bold">PHONE / ስልክ</span>
              <span className="text-[6px] font-bold text-gray-900">{data.phone}</span>
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-[5px] text-[#1e3a8ab3] font-bold">RESPONSIBILITY / ሀላፊነት</span>
            <span className="text-[6px] font-bold text-gray-900">{data.responsibility_am} / {data.responsibility_en}</span>
          </div>
        </div>

        {/* Right Side: Photo & Barcode */}
        <div className="w-20 flex flex-col items-center justify-center pr-1">
          <div className="w-16 h-20 bg-white border-2 border-amber-500 rounded-md overflow-hidden shadow-inner">
            {data.photo_url ? (
              <img src={data.photo_url} className="w-full h-full object-cover" alt="Member" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#d977064d]">
                <User size={32} />
              </div>
            )}
          </div>
          <div className="mt-1 scale-[0.4] origin-top">
            <Barcode value={data.id_number || "BGR-POL-00000"} height={30} width={1.5} fontSize={0} margin={0} />
          </div>
        </div>
      </div>

      {/* Footer Accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-900"></div>
    </div>
  );
});

const IDCardBack = React.forwardRef<HTMLDivElement, { data: Partial<IDRecord>, assets: Assets }>(({ data, assets }, ref) => {
  return (
    <div 
      ref={ref}
      className="relative w-[85.6mm] h-[53.98mm] rounded-xl overflow-hidden flex flex-col p-4 border border-gray-200 select-none"
      style={{ 
        printColorAdjust: 'exact',
        backgroundColor: '#ffffff'
      }}
    >
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
        <img src={assets.police_logo || "https://picsum.photos/seed/logo/200/200"} className="w-48 h-48 object-contain" alt="Watermark" />
      </div>

      <div className="relative z-10 flex h-full gap-6 items-center">
        {/* Left: Large QR Code Section */}
        <div className="flex flex-col items-center justify-center space-y-2">
          <span className="text-[7px] font-bold text-blue-900 uppercase tracking-wider">VERIFICATION / ማረጋገጫ</span>
          <div className="p-2 bg-white border-2 border-slate-100 rounded-lg shadow-sm">
            <QRCodeSVG 
              value={`${window.location.origin}/verify/${data.id_number}`} 
              size={110} 
            />
          </div>
        </div>

        {/* Right: Text and Signature */}
        <div className="flex-1 flex flex-col justify-between h-full py-2">
          <div className="space-y-3">
            <p className="text-[9px] font-bold text-gray-800 leading-tight">
              ይህንን መታወቂያ የያዘ የቤንሻንጉል ጉምዝ ክልል ፖሊስ ኮሚሽን የፖሊስ አባል ነዉ፤ ህግን የማስከበር ስልጣን ተሰጥቶታል፡፡ ህግን ሲያስከብር መታወቂያዉን የማሳየት ግዴታ አለበት፡፡
            </p>
            <p className="text-[8px] font-medium text-gray-600 italic leading-tight">
              This ID holder is a member of the Benishangul-Gumuz Region Police Commission; authorized to enforce the law. Must show ID when enforcing the law.
            </p>
          </div>
          
          <div className="flex flex-col items-center self-end mt-4">
            {data.commissioner_signature ? (
              <img src={data.commissioner_signature} className="h-10 w-32 object-contain mix-blend-multiply" alt="Signature" />
            ) : (
              <div className="h-10 w-32 border-b border-gray-400 mb-1"></div>
            )}
            <span className="text-[7px] font-bold text-gray-500 uppercase">COMMISSIONER SIGNATURE / የኮሚሽነሩ ፊርማ</span>
          </div>
        </div>
      </div>
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

  const [formData, setFormData] = useState({
    full_name_am: '',
    full_name_en: '',
    rank_am: '',
    rank_en: '',
    responsibility_am: '',
    responsibility_en: '',
    phone: '',
    photo_url: '',
    commissioner_signature: ''
  });

  const [printSide, setPrintSide] = useState<'front' | 'back' | 'both'>('both');
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Police_ID_Card",
  });

  const handlePrintSide = (side: 'front' | 'back' | 'both') => {
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
        }
      }
    }, 1000);
  };

  const [showScans, setShowScans] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
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

  const handleLogin = async (credentials: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        if (res.status === 405) {
          alert('Server Error: Method Not Allowed (405). This usually means the API routing is not correctly configured on the server.');
        } else {
          alert(data.error || `Login failed (${res.status})`);
        }
      }
    } catch (e) {
      alert('Login error');
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
    try {
      // Small delay to ensure all images/fonts are fully rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      if (side === 'both') {
        const front = document.getElementById(`card-front-${idNumber}`);
        const back = document.getElementById(`card-back-${idNumber}`);
        if (!front || !back) return;

        // Create a temporary container for both
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.gap = '40px';
        container.style.padding = '40px';
        container.style.backgroundColor = 'white';
        container.style.position = 'fixed';
        container.style.top = '-10000px';
        container.style.left = '-10000px';
        
        const frontClone = front.cloneNode(true) as HTMLElement;
        const backClone = back.cloneNode(true) as HTMLElement;
        
        // Reset scales and shadows on clones for clean capture
        frontClone.style.transform = 'none';
        frontClone.style.boxShadow = 'none';
        frontClone.style.margin = '0';
        
        backClone.style.transform = 'none';
        backClone.style.boxShadow = 'none';
        backClone.style.margin = '0';
        
        container.appendChild(frontClone);
        container.appendChild(backClone);
        document.body.appendChild(container);

        const canvas = await html2canvas(container, {
          scale: 4,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            const elements = clonedDoc.getElementsByTagName('*');
            for (let i = 0; i < elements.length; i++) {
              const el = elements[i] as HTMLElement;
              const style = window.getComputedStyle(el);
              
              // Check all relevant color properties
              const props = ['color', 'background-color', 'border-color', 'box-shadow', 'fill', 'stroke'];
              props.forEach(prop => {
                const value = style.getPropertyValue(prop);
                if (value && (value.includes('oklch') || value.includes('oklab'))) {
                  // Force a safe fallback
                  if (prop === 'box-shadow') {
                    el.style.setProperty(prop, 'none', 'important');
                  } else if (prop === 'background-color') {
                    // Try to keep it transparent if it's a modern color we can't parse
                    el.style.setProperty(prop, 'transparent', 'important');
                  } else if (prop === 'border-color') {
                    el.style.setProperty(prop, 'currentColor', 'important');
                  } else {
                    el.style.setProperty(prop, 'inherit', 'important');
                  }
                }
              });
            }
          }
        });

        const link = document.createElement('a');
        link.download = `BGR_Police_ID_${idNumber}_Full.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        document.body.removeChild(container);
      } else {
        const element = document.getElementById(`card-${side}-${idNumber}`);
        if (!element) return;
        
        // Clone to avoid scale issues
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.transform = 'none';
        clone.style.position = 'fixed';
        clone.style.top = '-10000px';
        document.body.appendChild(clone);

        const canvas = await html2canvas(clone, {
          scale: 3,
          useCORS: true,
          logging: false,
          backgroundColor: null,
          onclone: (clonedDoc) => {
            const elements = clonedDoc.getElementsByTagName('*');
            for (let i = 0; i < elements.length; i++) {
              const el = elements[i] as HTMLElement;
              const style = window.getComputedStyle(el);
              
              const props = ['color', 'background-color', 'border-color', 'box-shadow', 'fill', 'stroke'];
              props.forEach(prop => {
                const value = style.getPropertyValue(prop);
                if (value && (value.includes('oklch') || value.includes('oklab'))) {
                  if (prop === 'box-shadow') {
                    el.style.setProperty(prop, 'none', 'important');
                  } else if (prop === 'background-color') {
                    el.style.setProperty(prop, 'transparent', 'important');
                  } else if (prop === 'border-color') {
                    el.style.setProperty(prop, 'currentColor', 'important');
                  } else {
                    el.style.setProperty(prop, 'inherit', 'important');
                  }
                }
              });
            }
          }
        });
        
        const link = document.createElement('a');
        link.download = `BGR_Police_ID_${idNumber}_${side}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        document.body.removeChild(clone);
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download image. Please try again.');
    } finally {
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

      const res = await apiFetch('/api/ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });
      
      if (!res.ok) throw new Error('Failed to create ID');
      
      const result = await res.json();
      if (result.success) {
        fetchRecords();
        setFormData({
          full_name_am: '', full_name_en: '',
          rank_am: '', rank_en: '',
          responsibility_am: '', responsibility_en: '',
          phone: '', photo_url: '',
          commissioner_signature: ''
        });
        setView('history');
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
    return <Login onLogin={handleLogin} loading={loading} />;
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
                <NavButton active={view === 'create'} onClick={() => setView('create')} icon={<Plus size={18} />} label="New ID" />
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
                    <h2 className="text-2xl font-bold">Create New Member ID</h2>
                    <p className="text-blue-100 text-sm">Fill in the details. Missing translations will be generated automatically.</p>
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
                      {translating ? 'Translating...' : 'Generate ID Card'}
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
                    onClick={() => setView('create')}
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
        <div ref={printRef} key={`${selectedRecord?.id}-${printSide}`} className="print-container p-[5mm] bg-white">
          {selectedRecord && (
            <div className="flex flex-col items-center gap-8">
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
      </div>
    </div>
  );
}

// --- Helper Components ---

function PreviewModal({ record, assets, onClose, onPrint, onDownload }: { record: IDRecord, assets: Assets, onClose: () => void, onPrint: (side: 'front' | 'back' | 'both') => void, onDownload: (side: 'front' | 'back' | 'both') => void }) {
  const [activeTab, setActiveTab] = useState<'front' | 'back' | 'both'>('both');

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
          </div>

          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8 lg:p-12 flex-1 overflow-y-auto bg-slate-50">
          <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-12 lg:gap-20 min-h-full">
            {/* Front Side */}
            {(activeTab === 'both' || activeTab === 'front') && (
              <div className="space-y-6 flex flex-col items-center w-full lg:w-auto">
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
            )}

            {/* Back Side */}
            {(activeTab === 'both' || activeTab === 'back') && (
              <div className="space-y-6 flex flex-col items-center w-full lg:w-auto">
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
            )}
          </div>
        </div>

        <div className="p-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <button 
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
          >
            Back to Records
          </button>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button 
              onClick={() => onDownload('both')}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl"
            >
              <Download size={24} />
              Download Full (Front & Back)
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

function Login({ onLogin, loading }: { onLogin: (c: any) => void, loading: boolean }) {
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
          <div className="text-center space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Default: police / police1234
            </p>
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

function VerificationView({ idNumber, assets }: { idNumber: string, assets: Assets }) {
  const [record, setRecord] = useState<IDRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    fetch(`/api/ids/${idNumber}`)
      .then(res => res.json())
      .then(data => {
        setRecord(data);
        setLoading(false);
      });
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
      <h1 className="text-2xl font-bold text-slate-900">Invalid ID Card</h1>
      <p className="text-slate-500 mt-2">This ID record could not be found in our secure database.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 sm:p-12">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#10b98133] text-emerald-400 rounded-full text-sm font-bold mb-4">
          <Check size={16} />
          Verified Official ID
        </div>
        <h1 className="text-white text-xl font-bold">BGR Police Commission</h1>
        <p className="text-slate-400 text-sm">Secure Verification Portal</p>
      </div>

      <div className="flex flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-4">
          <p className="text-[#ffffff66] text-[10px] uppercase tracking-[0.2em] font-bold">Front Side / የፊት ገፅ</p>
          <div className="scale-110 sm:scale-150 origin-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-[3.18mm]">
            <IDCardFront data={record} assets={assets} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <p className="text-[#ffffff66] text-[10px] uppercase tracking-[0.2em] font-bold">Back Side / የጀርባ ገፅ</p>
          <div className="scale-110 sm:scale-150 origin-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-[3.18mm]">
            <IDCardBack data={record} assets={assets} />
          </div>
        </div>
      </div>

      <div className="mt-24 max-w-xs text-center">
        <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">
          Security Notice: This page is for verification only. Screenshots and editing are strictly prohibited.
        </p>
      </div>
    </div>
  );
}
