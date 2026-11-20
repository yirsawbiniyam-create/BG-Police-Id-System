import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { 
  Plus, History, Search, Printer, Download, 
  Shield, User, Phone, Briefcase, Award, 
  ChevronRight, Languages, Loader2, Camera,
  Eye, EyeOff, X, Check, Database as DbIcon, RefreshCw,
  ShieldAlert, Edit, Trash2, CreditCard, RotateCcw, KeyRound, AlertTriangle,
  ArrowLeft, Lock, Send, CheckCircle2, Menu, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import { translateText, fastLocalTranslate } from './services/gemini';
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
  or,
  serverTimestamp
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
  fayda_number?: string;
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
  status: 'pending' | 'needs_correction' | 'approved' | 'rejected';
  is_registered?: boolean;
  approved_by?: string;
  approved_at?: string;
  correction_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  resubmitted?: boolean;
  resubmitted_at?: string;
  created_by_email?: string;
}

type UserRole = 'Administrator' | 'Approver' | 'Data Entry' | 'Viewer';

interface User {
  id: string;
  username?: string;
  email: string;
  role: UserRole;
  active?: boolean;
}

interface Assets {
  bgr_flag?: string;
  eth_flag?: string;
  police_logo?: string;
  commissioner_signature?: string;
}

// --- Security & Optimization Helpers ---

const sanitizeText = (val: unknown, maxLen = 200): string => {
  if (typeof val === 'number') return String(val).trim().slice(0, maxLen);
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .trim()
    .slice(0, maxLen);
};

const getFaydaValue = (data: any): string => {
  if (!data || typeof data !== 'object') return '';
  const raw = data.fayda_number ?? data.fayda ?? data.fin ?? data.faydaNumber ?? '';
  return sanitizeText(raw, 60);
};

const hashPassword = async (password: string): Promise<string> => {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const toHex = (arr: Uint8Array) =>
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  return `pbkdf2_sha256$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
};

const verifyPassword = async (plain: string, stored: string): Promise<boolean> => {
  if (!stored) return false;
  if (!stored.startsWith('pbkdf2_sha256$')) {
    if (plain.length !== stored.length) return false;
    let diff = 0;
    for (let i = 0; i < plain.length; i++) {
      diff |= plain.charCodeAt(i) ^ stored.charCodeAt(i);
    }
    return diff === 0;
  }
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  const [, saltHex, hashHex] = parts;
  if (!saltHex || !hashHex || saltHex.length % 2 !== 0) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(plain),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const derivedHex = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (derivedHex.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < derivedHex.length; i++) {
    diff |= derivedHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
  }
  return diff === 0;
};

const raceWithTimeout = <T,>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> => {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallbackValue);
      }
    }, ms);
    promise
      .then((val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallbackValue);
        }
      });
  });
};

const resizeImage = (base64Str: string, maxWidth = 800, maxHeight = 800, preservePng = false): Promise<string> => {
  return new Promise((resolve) => {
    const isPng = preservePng;
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

      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (!isPng) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, Math.round(width), Math.round(height));
      }
      if (isPng) {
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

const ID_CARD_BACKGROUND = 'linear-gradient(135deg, #fbbf24 0%, #fcd34d 40%, #ffedd5 60%, #fff7ed 100%)';
const matchedLogoCache = new Map<string, string>();

const stripOuterWhiteBackground = (src: string): Promise<string> => {
  if (!src) return Promise.resolve(src);
  const cached = matchedLogoCache.get(src);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const maxDim = 480;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(src);
          return;
        }
        if (w > maxDim || h > maxDim) {
          const scale = Math.min(maxDim / w, maxDim / h);
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const visited = new Uint8Array(w * h);
        const queue = new Int32Array(w * h);
        let head = 0;
        let tail = 0;

        const isOuterWhite = (idx: number) => {
          const p = idx * 4;
          const a = data[p + 3];
          if (a < 20) return true;
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          return r >= 224 && g >= 224 && b >= 224 && (maxC - minC) <= 32;
        };

        const enqueueIfWhite = (x: number, y: number) => {
          const idx = y * w + x;
          if (!visited[idx] && isOuterWhite(idx)) {
            visited[idx] = 1;
            queue[tail++] = idx;
          }
        };

        for (let x = 0; x < w; x++) {
          enqueueIfWhite(x, 0);
          enqueueIfWhite(x, h - 1);
        }
        for (let y = 1; y < h - 1; y++) {
          enqueueIfWhite(0, y);
          enqueueIfWhite(w - 1, y);
        }

        while (head < tail) {
          const idx = queue[head++];
          const p = idx * 4;
          data[p + 3] = 0;
          const x = idx % w;
          const y = (idx - x) / w;
          if (x > 0) enqueueIfWhite(x - 1, y);
          if (x < w - 1) enqueueIfWhite(x + 1, y);
          if (y > 0) enqueueIfWhite(x, y - 1);
          if (y < h - 1) enqueueIfWhite(x, y + 1);
        }

        // Soften 1px anti-aliased fringe adjacent to removed outer white pixels
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            if (visited[idx]) continue;
            const p = idx * 4;
            const r = data[p];
            const g = data[p + 1];
            const b = data[p + 2];
            const minC = Math.min(r, g, b);
            const maxC = Math.max(r, g, b);
            if (minC >= 195 && (maxC - minC) <= 35) {
              const hasClearedNeighbor =
                visited[idx - 1] || visited[idx + 1] || visited[idx - w] || visited[idx + w];
              if (hasClearedNeighbor) {
                data[p + 3] = Math.round(data[p + 3] * 0.25);
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const out = canvas.toDataURL('image/png');
        matchedLogoCache.set(src, out);
        resolve(out);
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
};

function useCardMatchedLogo(logoSrc?: string) {
  const [matched, setMatched] = useState<string | undefined>(() =>
    logoSrc ? (matchedLogoCache.get(logoSrc) || logoSrc) : undefined
  );

  useEffect(() => {
    let active = true;
    if (!logoSrc) {
      setMatched(undefined);
      return;
    }
    const cached = matchedLogoCache.get(logoSrc);
    if (cached) {
      setMatched(cached);
      return;
    }
    setMatched(logoSrc);
    stripOuterWhiteBackground(logoSrc).then((clean) => {
      if (active) setMatched(clean);
    });
    return () => {
      active = false;
    };
  }, [logoSrc]);

  return matched;
}

const matchedPhotoCache = new Map<string, string>();

const stripPhotoBackgroundAndBlend = (src: string): Promise<string> => {
  if (!src) return Promise.resolve(src);
  const cached = matchedPhotoCache.get(src);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        if (!srcW || !srcH) {
          resolve(src);
          return;
        }

        // Preserve normal passport/bust portrait ("ጉርድ ፎቶ") intact without slicing head or shoulders
        const w = 312;
        const h = 392;
        const targetRatio = w / h;
        const srcRatio = srcW / srcH;
        let sx = 0, sy = 0, sw = srcW, sh = srcH;
        if (srcRatio > targetRatio) {
          sw = Math.round(srcH * targetRatio);
          sx = Math.max(0, Math.round((srcW - sw) / 2));
        } else {
          sh = Math.round(srcW / targetRatio);
          sy = 0;
        }

        const workCanvas = document.createElement('canvas');
        workCanvas.width = w;
        workCanvas.height = h;
        const wctx = workCanvas.getContext('2d');
        if (!wctx) {
          resolve(src);
          return;
        }
        wctx.imageSmoothingEnabled = true;
        wctx.imageSmoothingQuality = 'high';
        wctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

        const imageData = wctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const total = w * h;

        // 1. Gently brighten clear uniform top/side studio backdrop toward white WITHOUT cutting or deleting the person
        const lum = new Float32Array(total);
        for (let i = 0; i < total; i++) {
          const p = i * 4;
          lum[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
        }
        const edgeMag = new Float32Array(total);
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            edgeMag[idx] = Math.abs(lum[idx + 1] - lum[idx - 1]) + Math.abs(lum[idx + w] - lum[idx - w]);
          }
        }

        let sumR = 0, sumG = 0, sumB = 0, cnt = 0;
        let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 10; x++) {
            for (const cx of [x, w - 1 - x]) {
              const p = (y * w + cx) * 4;
              if (data[p + 3] > 200) {
                const r = data[p], g = data[p + 1], b = data[p + 2];
                sumR += r; sumG += g; sumB += b; cnt++;
                if (r < minR) minR = r; if (r > maxR) maxR = r;
                if (g < minG) minG = g; if (g > maxG) maxG = g;
                if (b < minB) minB = b; if (b > maxB) maxB = b;
              }
            }
          }
        }
        const bgR = cnt > 0 ? sumR / cnt : 255;
        const bgG = cnt > 0 ? sumG / cnt : 255;
        const bgB = cnt > 0 ? sumB / cnt : 255;
        const bgSpread = Math.max(maxR - minR, maxG - minG, maxB - minB);
        const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
        const looksLikeSkin = (bgR - bgB > 28) && bgG < 200;
        const hasUniformBackdrop = cnt > 0 && bgSpread <= 38 && bgLum >= 105 && !looksLikeSkin;

        if (hasUniformBackdrop) {
          const visited = new Uint8Array(total);
          const queue = new Int32Array(total);
          let head = 0, tail = 0;

          const isBackdrop = (x: number, y: number, idx: number) => {
            const p = idx * 4;
            if (data[p + 3] < 40) return true;
            const r = data[p], g = data[p + 1], b = data[p + 2];
            // Protect face & central torso region so nothing in the portrait is ever altered
            const fx = (x / w - 0.5) / 0.29;
            const fy = (y / h - 0.44) / 0.34;
            if (fx * fx + fy * fy <= 1) return false;
            const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
            return dist <= 32 && edgeMag[idx] < 38;
          };

          const enqueue = (x: number, y: number) => {
            const idx = y * w + x;
            if (!visited[idx] && isBackdrop(x, y, idx)) {
              visited[idx] = 1;
              queue[tail++] = idx;
            }
          };

          for (let x = 0; x < w; x++) enqueue(x, 0);
          for (let y = 1; y < Math.round(h * 0.72); y++) {
            enqueue(0, y);
            enqueue(w - 1, y);
          }

          while (head < tail) {
            const idx = queue[head++];
            const p = idx * 4;
            // Shift studio background smoothly toward white instead of carving hard holes
            data[p] = Math.round(data[p] * 0.16 + 255 * 0.84);
            data[p + 1] = Math.round(data[p + 1] * 0.16 + 255 * 0.84);
            data[p + 2] = Math.round(data[p + 2] * 0.16 + 255 * 0.84);
            const x = idx % w;
            const y = (idx - x) / w;
            if (x > 0) enqueue(x - 1, y);
            if (x < w - 1) enqueue(x + 1, y);
            if (y > 0) enqueue(x, y - 1);
            if (y < h - 1) enqueue(x, y + 1);
          }
        }

        // 2. Keep the FULL rectangular portrait completely intact (no circle/oval crop!),
        // softly feathering ONLY the outermost 5-7% perimeter edges so it blends cleanly into the ID card background
        const smooth = (t: number) => {
          const c = Math.max(0, Math.min(1, t));
          return c * c * (3 - 2 * c);
        };

        const featherX = Math.max(12, Math.round(w * 0.065));
        const featherTop = Math.max(10, Math.round(h * 0.045));
        const featherBottom = Math.max(14, Math.round(h * 0.075));

        for (let y = 0; y < h; y++) {
          const fyTop = y < featherTop ? smooth(y / featherTop) : 1;
          const fyBot = y > h - 1 - featherBottom ? smooth((h - 1 - y) / featherBottom) : 1;
          const fy = fyTop * fyBot;
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const p = idx * 4;
            if (data[p + 3] === 0) continue;
            const fxLeft = x < featherX ? smooth(x / featherX) : 1;
            const fxRight = x > w - 1 - featherX ? smooth((w - 1 - x) / featherX) : 1;
            const edgeKeep = fy * fxLeft * fxRight;
            if (edgeKeep < 1) {
              const whiteMix = (1 - edgeKeep) * 0.45;
              data[p] = Math.round(data[p] * (1 - whiteMix) + 255 * whiteMix);
              data[p + 1] = Math.round(data[p + 1] * (1 - whiteMix) + 255 * whiteMix);
              data[p + 2] = Math.round(data[p + 2] * (1 - whiteMix) + 255 * whiteMix);
              data[p + 3] = Math.round(data[p + 3] * edgeKeep);
            }
          }
        }

        wctx.putImageData(imageData, 0, 0);

        const out = workCanvas.toDataURL('image/png');
        matchedPhotoCache.set(src, out);
        resolve(out);
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
};

function useCardMatchedPhoto(photoSrc?: string) {
  const [matched, setMatched] = useState<string | undefined>(() =>
    photoSrc ? (matchedPhotoCache.get(photoSrc) || photoSrc) : undefined
  );

  useEffect(() => {
    let active = true;
    if (!photoSrc) {
      setMatched(undefined);
      return;
    }
    const cached = matchedPhotoCache.get(photoSrc);
    if (cached) {
      setMatched(cached);
      return;
    }
    setMatched(photoSrc);
    stripPhotoBackgroundAndBlend(photoSrc).then((clean) => {
      if (active) setMatched(clean);
    });
    return () => {
      active = false;
    };
  }, [photoSrc]);

  return matched;
}

// --- Components ---

function CardOrnamentalFrame({ variant = 'front' }: { variant?: 'front' | 'back' }) {
  const outerColor = variant === 'front' ? '#1e3a8a' : '#b45309';
  const innerColor = variant === 'front' ? '#b45309' : '#1e3a8a';
  const accentColor = '#d97706';

  return (
    <div className="absolute inset-[1.1mm] pointer-events-none z-20">
      {/* Top-Left Disconnected Corner Bracket */}
      <div
        className="absolute top-0 left-0 w-[9mm] h-[5.5mm] rounded-tl-[2.2mm]"
        style={{ borderTop: `1.6px solid ${outerColor}`, borderLeft: `1.6px solid ${outerColor}` }}
      />
      <div
        className="absolute top-[0.7mm] left-[0.7mm] w-[5.5mm] h-[3.5mm] rounded-tl-[1.4mm]"
        style={{ borderTop: `0.9px solid ${innerColor}`, borderLeft: `0.9px solid ${innerColor}` }}
      />

      {/* Top-Right Disconnected Corner Bracket */}
      <div
        className="absolute top-0 right-0 w-[9mm] h-[5.5mm] rounded-tr-[2.2mm]"
        style={{ borderTop: `1.6px solid ${outerColor}`, borderRight: `1.6px solid ${outerColor}` }}
      />
      <div
        className="absolute top-[0.7mm] right-[0.7mm] w-[5.5mm] h-[3.5mm] rounded-tr-[1.4mm]"
        style={{ borderTop: `0.9px solid ${innerColor}`, borderRight: `0.9px solid ${innerColor}` }}
      />

      {/* Bottom-Left Disconnected Corner Bracket */}
      <div
        className="absolute bottom-0 left-0 w-[9mm] h-[5.5mm] rounded-bl-[2.2mm]"
        style={{ borderBottom: `1.6px solid ${outerColor}`, borderLeft: `1.6px solid ${outerColor}` }}
      />
      <div
        className="absolute bottom-[0.7mm] left-[0.7mm] w-[5.5mm] h-[3.5mm] rounded-bl-[1.4mm]"
        style={{ borderBottom: `0.9px solid ${innerColor}`, borderLeft: `0.9px solid ${innerColor}` }}
      />

      {/* Bottom-Right Disconnected Corner Bracket */}
      <div
        className="absolute bottom-0 right-0 w-[9mm] h-[5.5mm] rounded-br-[2.2mm]"
        style={{ borderBottom: `1.6px solid ${outerColor}`, borderRight: `1.6px solid ${outerColor}` }}
      />
      <div
        className="absolute bottom-[0.7mm] right-[0.7mm] w-[5.5mm] h-[3.5mm] rounded-br-[1.4mm]"
        style={{ borderBottom: `0.9px solid ${innerColor}`, borderRight: `0.9px solid ${innerColor}` }}
      />

      {/* Left Mid-Edge Disconnected Accent Bars (with clear gaps from corners) */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-[0.9mm]">
        <div className="w-[1.2px] h-[3.5mm] rounded-full" style={{ backgroundColor: '#009a44' }} />
        <div className="w-[2.5px] h-[2.5px] rotate-45" style={{ backgroundColor: accentColor }} />
        <div className="w-[1.2px] h-[3.5mm] rounded-full" style={{ backgroundColor: '#ef3340' }} />
      </div>

      {/* Right Mid-Edge Disconnected Accent Bars (with clear gaps from corners) */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-[0.9mm]">
        <div className="w-[1.2px] h-[3.5mm] rounded-full" style={{ backgroundColor: '#009a44' }} />
        <div className="w-[2.5px] h-[2.5px] rotate-45" style={{ backgroundColor: accentColor }} />
        <div className="w-[1.2px] h-[3.5mm] rounded-full" style={{ backgroundColor: '#ef3340' }} />
      </div>

      {/* Top & Bottom Disconnected Short Center Accents (only on back so front logo/footer stay clean) */}
      {variant === 'back' && (
        <>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-[1.2mm]">
            <div className="w-[5mm] h-[1.2px] rounded-full" style={{ backgroundColor: '#009a44' }} />
            <div className="w-[3mm] h-[1.2px] rounded-full" style={{ backgroundColor: '#fbbf24' }} />
            <div className="w-[5mm] h-[1.2px] rounded-full" style={{ backgroundColor: '#ef3340' }} />
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-[1.2mm]">
            <div className="w-[5mm] h-[1.2px] rounded-full" style={{ backgroundColor: '#009a44' }} />
            <div className="w-[3mm] h-[1.2px] rounded-full" style={{ backgroundColor: '#fbbf24' }} />
            <div className="w-[5mm] h-[1.2px] rounded-full" style={{ backgroundColor: '#ef3340' }} />
          </div>
        </>
      )}
    </div>
  );
}

const IDCardFront = React.forwardRef<HTMLDivElement, { data: Partial<IDRecord>, assets: Assets }>(({ data, assets }, ref) => {
  const isApproved = data.status === 'approved' && !data.deleted;
  const matchedLogo = useCardMatchedLogo(assets.police_logo);
  const matchedPhoto = useCardMatchedPhoto(data.photo_url);

  const rankCombined = `${data.rank_am || ''}${data.rank_en ? ` / ${data.rank_en}` : ''}`.trim();
  const rankLen = rankCombined.length;
  const rankTextClass =
    rankLen > 36
      ? 'text-[5.2px] leading-[1.04] tracking-[-0.015em]'
      : rankLen > 22
      ? 'text-[5.8px] leading-[1.08]'
      : 'text-[6.7px] leading-[1.12]';
  const rankEnClass = rankLen > 36 ? 'text-[4.8px]' : rankLen > 22 ? 'text-[5.3px]' : 'text-[5.8px]';

  const respCombined = `${data.responsibility_am || ''}${data.responsibility_en ? ` / ${data.responsibility_en}` : ''}`.trim();
  const respLen = respCombined.length;
  const respTextClass =
    respLen > 56
      ? 'text-[5px] leading-[1.03] tracking-[-0.02em]'
      : respLen > 34
      ? 'text-[5.6px] leading-[1.06] tracking-[-0.015em]'
      : 'text-[6.5px] leading-[1.1]';
  const respEnClass = respLen > 56 ? 'text-[4.6px]' : respLen > 34 ? 'text-[5.2px]' : 'text-[5.8px]';

  return (
    <div 
      ref={ref}
      className="crisp-card-text relative w-[85.6mm] h-[53.98mm] rounded-[3.18mm] overflow-hidden flex flex-col p-[2.3mm] select-none box-border"
      style={{ 
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
        background: ID_CARD_BACKGROUND,
        border: 'none'
      }}
    >
      {/* Ornamental Disconnected Frame */}
      <CardOrnamentalFrame variant="front" />

      {/* Unapproved / Not Registered Security Overlay */}
      {!isApproved && (
        <div
          className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.18)' }}
        >
          <div
            className="-rotate-12 px-3 py-1 rounded border-2 text-center"
            style={{
              backgroundColor: 'rgba(185, 28, 28, 0.14)',
              borderColor: 'rgba(185, 28, 28, 0.55)',
              color: '#991b1b'
            }}
          >
            <div className="text-[7px] font-black tracking-widest uppercase">PENDING APPROVAL · UNREGISTERED</div>
            <div className="text-[6.5px] font-black">ያልጸደቀ · በሲስተም ያልተመዘገበ</div>
          </div>
        </div>
      )}

      {/* Background Pattern / Security Element */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none flex items-center justify-center">
        <Shield size={200} style={{ color: '#1e3a8a' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex justify-between items-start h-[9.6mm] px-2 pt-0.5 pb-0.5 border-b border-black/10">
        <img 
          src={assets.bgr_flag || "https://picsum.photos/seed/bgr/100/60"} 
          className="h-6 w-10.5 object-cover rounded-sm shadow-sm" 
          alt="BGR Flag" 
          crossOrigin="anonymous"
        />
        <div className="flex flex-col items-center -mt-1">
          <div
            className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center"
            style={{
              background: ID_CARD_BACKGROUND,
              border: '1.5px solid rgba(217, 119, 6, 0.45)'
            }}
          >
            <img 
              src={matchedLogo || "https://picsum.photos/seed/logo/120/120"} 
              className="w-full h-full object-contain p-0.5" 
              alt="Police Logo" 
              crossOrigin="anonymous"
            />
          </div>
        </div>
        <img 
          src={assets.eth_flag || "https://picsum.photos/seed/eth/100/60"} 
          className="h-6 w-10.5 object-cover rounded-sm shadow-sm" 
          alt="ETH Flag" 
          crossOrigin="anonymous"
        />
      </div>

      {/* Commission Name & Digital ID Title */}
      <div className="relative z-10 text-center mb-[1.5px] mt-[1.5px]">
        <h1 className="text-[7.5px] font-black leading-[1.08]" style={{ color: '#0b1b3a' }}>የቤንሻንጉል ጉምዝ ክልል ፖሊስ ኮሚሽን</h1>
        <h2 className="text-[5.7px] font-extrabold uppercase tracking-[0.02em] leading-[1.08] mt-[1px]" style={{ color: '#1d4ed8' }}>Benishangul-Gumuz Region Police Commission</h2>
        <div className="flex justify-center mt-[1.5px]">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-[1px] rounded-full text-[5.7px] font-black tracking-[0.04em] leading-none"
            style={{
              background: 'linear-gradient(90deg, #ecfdf5 0%, #fef9c3 50%, #ecfdf5 100%)',
              color: '#065f46',
              border: '0.8px solid #047857',
              boxShadow: '0 1px 2px rgba(4, 120, 87, 0.14)'
            }}
          >
            <span className="w-1 h-1 rounded-full inline-block" style={{ backgroundColor: '#047857' }} />
            የፖሊስ ዲጂታል መታወቂያ ካርድ
            <span className="w-1 h-1 rounded-full inline-block" style={{ backgroundColor: '#047857' }} />
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-1 gap-1 px-1 overflow-hidden">
        {/* Left Column: Details */}
        <div className="w-[55.5mm] flex flex-col justify-center py-0.5">
          <div className="space-y-[1.8px]">
            {/* Signature Two-Tone Royal Crimson & Burnished Gold ID Number Crest */}
            <div
              className="flex items-stretch justify-between rounded-md overflow-hidden shadow-sm w-full"
              style={{
                border: '1.3px solid #d97706',
                background: 'linear-gradient(135deg, #881337 0%, #991b1b 42%, #3b0764 100%)',
                boxShadow: '0 1px 3px rgba(136, 19, 55, 0.32)'
              }}
            >
              <div
                className="flex items-center gap-1 px-1.5 py-[1.6px] shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #fef08a 0%, #fbbf24 55%, #d97706 100%)',
                  borderRight: '1px solid #f59e0b'
                }}
              >
                <span
                  className="w-1.5 h-1.5 rotate-45 inline-block shrink-0"
                  style={{ backgroundColor: '#7f1d1d' }}
                />
                <span className="text-[4.6px] font-black uppercase tracking-[0.04em] leading-none" style={{ color: '#0b1b3a' }}>
                  መለያ ቁጥር · ID NO
                </span>
              </div>
              <div
                className="flex-1 flex items-center justify-center px-2 py-[1.6px]"
                style={{
                  background: 'linear-gradient(135deg, #881337 0%, #7f1d1d 45%, #3b0764 100%)'
                }}
              >
                <span
                  className="text-[8px] font-black tracking-[0.11em] font-mono leading-none"
                  style={{ color: '#fef9c3', textShadow: '0 1px 1px rgba(0, 0, 0, 0.45)' }}
                >
                  {data.id_number || "BGR-POL-1600000"}
                </span>
              </div>
            </div>
            
            <div className="px-1 py-[1.8px] rounded-sm border-l-2" style={{ borderLeftColor: '#1d4ed8', backgroundColor: 'rgba(255, 255, 255, 0.90)' }}>
              <div className="text-[4.4px] font-black uppercase leading-none" style={{ color: '#b45309' }}>ሙሉ ስም / FULL NAME</div>
              <div className="text-[8px] font-black leading-[1.12] whitespace-normal break-words" style={{ color: '#0b1b3a' }}>{data.full_name_am}</div>
              <div className="text-[6.6px] font-black uppercase leading-[1.1] whitespace-normal break-words" style={{ color: '#065f46' }}>{data.full_name_en}</div>
            </div>

            <div className="grid grid-cols-[37%_63%] gap-1 items-start">
              <div className="min-w-0">
                <div className="text-[4.4px] font-black uppercase leading-none mb-[1px]" style={{ color: '#1d4ed8' }}>ማዕረግ / RANK</div>
                <div className={`font-black whitespace-normal break-words ${rankTextClass}`} style={{ color: '#7c2d12' }}>
                  {data.rank_am}
                  {data.rank_en ? (
                    <>
                      {' / '}
                      <span className={`font-extrabold uppercase ${rankEnClass}`} style={{ color: '#1e293b' }}>{data.rank_en}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[4.4px] font-black uppercase leading-none mb-[1px]" style={{ color: '#047857' }}>ኃላፊነት / RESPONSIBILITY</div>
                <div className={`font-black whitespace-normal break-words ${respTextClass}`} style={{ color: '#1e1b4b' }}>
                  {data.responsibility_am}
                  {data.responsibility_en ? (
                    <>
                      {' / '}
                      <span className={`font-extrabold uppercase ${respEnClass}`} style={{ color: '#1e3a8a' }}>{data.responsibility_en}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 mt-0.5 pt-0.5 border-t" style={{ borderTopColor: 'rgba(15, 23, 42, 0.2)' }}>
              <div>
                <div className="text-[4.7px] font-black uppercase leading-none" style={{ color: '#1d4ed8' }}>የተሰጠበት ቀን / Issued Date</div>
                <div className="text-[6.1px] font-black leading-tight mt-[1px]" style={{ color: '#065f46' }}>{data.issued_at || "N/A"}</div>
              </div>
              <div>
                <div className="text-[4.7px] font-black uppercase leading-none" style={{ color: '#1e3a8a' }}>የሚያበቃበት ቀን / Expiry Date</div>
                <div className="text-[6.1px] font-black leading-tight mt-[1px]" style={{ color: '#b91c1c' }}>{data.expires_at || "N/A"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Borderless Cutout Portrait Blended Softly With White Halo + Fayda FIN Tag */}
        <div className="w-[21mm] flex flex-col items-center justify-between py-0.5">
          <div className="w-[20.5mm] h-[24mm] relative flex items-end justify-center overflow-visible">
            {matchedPhoto ? (
              <img 
                src={matchedPhoto} 
                className="w-[20.5mm] h-[24mm] object-contain relative z-10" 
                alt="Member" 
                crossOrigin="anonymous"
              />
            ) : (
              <div
                className="w-[15mm] h-[15mm] rounded-full flex items-center justify-center mb-2"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.72)', color: '#94a3b8' }}
              >
                <User size={24} />
              </div>
            )}
          </div>
          <div
            className="w-full px-1 py-[1.2px] rounded text-center leading-none overflow-hidden"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.92)',
              border: '0.8px solid #1d4ed8'
            }}
          >
            <div className="text-[3.8px] font-black uppercase leading-none" style={{ color: '#1e3a8a' }}>
              ፋይዳ / FAYDA FIN
            </div>
            <div
              className={`font-black font-mono tracking-tight leading-tight whitespace-nowrap truncate mt-[0.5px] ${
                getFaydaValue(data).length > 14
                  ? 'text-[4.3px]'
                  : getFaydaValue(data).length > 11
                  ? 'text-[4.7px]'
                  : 'text-[5.2px]'
              }`}
              style={{ color: '#0b1b3a' }}
            >
              {getFaydaValue(data) || "N/A"}
            </div>
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
  const isApproved = data.status === 'approved' && !data.deleted;
  const matchedLogo = useCardMatchedLogo(assets.police_logo);

  return (
    <div 
      ref={ref}
      className="crisp-card-text relative w-[85.6mm] h-[53.98mm] rounded-[3.18mm] overflow-hidden flex flex-col p-[2.4mm] select-none box-border"
      style={{ 
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
        backgroundColor: '#ffffff',
        border: 'none'
      }}
    >
      {/* Ornamental Disconnected Frame */}
      <CardOrnamentalFrame variant="back" />

      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.15] pointer-events-none">
        <img 
          src={matchedLogo || "https://picsum.photos/seed/logo/200/200"} 
          className="w-40 h-40 object-contain filter contrast-150" 
          alt="Watermark" 
          crossOrigin="anonymous"
        />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* Top: Notice Section */}
        <div className="flex flex-col justify-start space-y-0.5 border-b pb-1" style={{ borderBottomColor: '#cbd5e1' }}>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="text-white text-[5.5px] font-black px-2 py-0.5 rounded-sm uppercase tracking-[0.08em] shadow-sm flex items-center gap-1" style={{ backgroundColor: '#dc2626' }}>
              <ShieldAlert size={7} />
              ማስታወቂያ / NOTICE
            </div>
            <div className="flex-1 h-[0.3mm]" style={{ background: 'linear-gradient(to right, rgba(220,38,38,0.4), transparent)' }}></div>
          </div>
          <p className="text-[6.8px] font-extrabold leading-[1.26] text-left" style={{ color: '#0b1b3a' }}>
            ይህንን መታወቂያ የያዘ የፖሊስ አባል ስለሆነ ህግን የማስከበር ስልጣን ተሰጥቶታል ፣ መታወቂያዉንም የማሳየት ግዴታ አለበት፡፡ መታወቂያው ቢጠፋ ወይም በሌላ ግለሰብ እጅ ቢገኝ በአቅራቢያው ለሚገኝ ፖሊስ ጣቢያ እንዲያስረክቡ እናሳስባለን፡፡
          </p>
          <p className="text-[5.8px] font-bold leading-[1.22] text-left" style={{ color: '#065f46' }}>
            The Bearer of this ID card is a member of Police and is authorized to enforce the Law. He/she is obliged to present this ID card. If found, please return it to the nearest police station.
          </p>
        </div>

        {/* Middle: Details in Two Lines (Distinct Label vs Value Colors) */}
        <div className="py-0.5 flex flex-col gap-0.5 border-b" style={{ borderBottomColor: '#cbd5e1' }}>
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex items-center gap-1">
              <span className="text-[4.6px] font-black uppercase" style={{ color: '#b45309' }}>ፆታ / GENDER:</span>
              <span className="text-[7px] font-black" style={{ color: '#0b1b3a' }}>{data.gender === 'M' ? 'ወ / M' : data.gender === 'F' ? 'ሴ / F' : (data.gender || "N/A")}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[4.6px] font-black uppercase" style={{ color: '#1d4ed8' }}>ቁመት / HEIGHT:</span>
              <span className="text-[7px] font-black" style={{ color: '#065f46' }}>{data.height || "N/A"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[4.6px] font-black uppercase" style={{ color: '#047857' }}>መልክ / COMPLEXION:</span>
              <span className="text-[7px] font-black" style={{ color: '#4338ca' }}>{data.complexion || "N/A"}</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex items-center gap-1">
              <span className="text-[4.6px] font-black uppercase" style={{ color: '#b45309' }}>ስልክ / PHONE:</span>
              <span className="text-[7px] font-black" style={{ color: '#1e40af' }}>{data.phone || "N/A"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[4.6px] font-black uppercase" style={{ color: '#7c2d12' }}>የደም ዓይነት / BLOOD:</span>
              <span className="text-[7px] font-black" style={{ color: '#dc2626' }}>{data.blood_type || "N/A"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[4.6px] font-black uppercase" style={{ color: '#1d4ed8' }}>የመለያ ቁጥር / BADGE:</span>
              <span className="text-[7px] font-black" style={{ color: '#7c2d12' }}>{data.badge_number || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Bottom: QR on Left, Fayda Number High-Contrast Pill + Signatures on Right */}
        <div className="flex-1 flex items-center justify-between gap-2 pt-1 min-h-0">
          {/* QR Code (Active ONLY after official approval) */}
          <div className="flex flex-col items-center justify-center h-full min-w-[19mm]">
            {isApproved ? (
              <div className="p-0.5 bg-white border rounded shadow-sm flex items-center justify-center" style={{ borderColor: '#cbd5e1' }}>
                <QRCodeSVG 
                  value={`${window.location.protocol}//${window.location.host}/verify/${data.id_number}`} 
                  size={64} 
                  level="H"
                />
              </div>
            ) : (
              <div
                className="w-[17mm] h-[17mm] rounded border border-dashed flex flex-col items-center justify-center text-center p-1"
                style={{ backgroundColor: '#fef2f2', borderColor: '#dc2626', color: '#991b1b' }}
              >
                <Lock size={14} />
                <span className="text-[4.2px] font-black uppercase leading-tight mt-0.5">QR LOCKED</span>
                <span className="text-[4px] font-black leading-tight">ያልጸደቀ</span>
              </div>
            )}
            <div
              className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-[1px] rounded-full shadow-xs"
              style={{
                background: 'linear-gradient(135deg, #881337 0%, #991b1b 55%, #3b0764 100%)',
                border: '0.9px solid #f59e0b'
              }}
            >
              <span className="text-[4.8px] font-black tracking-wider font-mono" style={{ color: '#fef9c3' }}>
                {data.id_number || "BGR-POL-1600000"}
              </span>
            </div>
          </div>

          {/* Right Side: Fayda Number High-Contrast Badge + Signatures */}
          <div className="flex-1 flex flex-col justify-between h-full">
            {/* Fayda Number Badge (Dark ink on luminous tint so it NEVER blanks out on any printer) */}
            <div className="flex justify-center pt-0.5">
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-[1.8px] rounded-full shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, #fefce8 0%, #eff6ff 55%, #ecfdf5 100%)',
                  border: '1.2px solid #1d4ed8'
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#047857' }} />
                <span className="text-[5px] font-black uppercase tracking-wider" style={{ color: '#1e3a8a' }}>
                  ፋይዳ ቁጥር / FAYDA:
                </span>
                <span className="text-[7px] font-black tracking-widest font-mono" style={{ color: '#0b1b3a' }}>
                  {getFaydaValue(data) || "N/A"}
                </span>
              </div>
            </div>

            {/* Signatures Container - Side by Side */}
            <div className="flex items-end justify-around pb-0.5">
              {/* Member Signature */}
              <div className="flex flex-col items-center w-[24mm]">
                <div className="h-7.5 w-full flex items-center justify-center relative border-b border-black/30">
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
                <div className="text-[4px] font-black uppercase text-center leading-none mt-0.5" style={{ color: '#1e3a8a' }}>
                  የአባሉ ፊርማ / Member's Signature
                </div>
              </div>

              {/* Commissioner Signature */}
              <div className="flex flex-col items-center w-[24mm]">
                <div className="h-7.5 w-full flex items-center justify-center relative border-b border-black/30">
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
                <div className="text-[4px] font-black uppercase text-center leading-none mt-0.5" style={{ color: '#b45309' }}>
                  የኮሚሽነሩ ፊርማ / Commissioner Signature
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Strip */}
      <div className="absolute top-0 right-0 w-1 h-full opacity-20" style={{ background: 'linear-gradient(to bottom, #facc15, #16a34a, #1e3a8a)' }}></div>
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

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  declare state: { hasError: boolean };
  declare props: { children: React.ReactNode };
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error('UI ErrorBoundary caught:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B1B3A] text-white flex flex-col items-center justify-center p-6 text-center gap-4">
          <ShieldAlert size={44} className="text-[#E5C158]" />
          <h1 className="text-xl font-extrabold">ያልተጠበቀ ችግር ተከስቷል / Unexpected Error</h1>
          <p className="text-sm text-slate-300 max-w-md">
            ገጹን በአዲስ መልክ በመክፈት ይቀጥሉ። መረጃዎ በደህንነት ተቀምጧል።
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-[#C89B2B] text-[#0B1B3A] rounded-xl font-extrabold text-xs cursor-pointer"
          >
            እንደገና ጫን / Reload Portal
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type AppView = 'dashboard' | 'create' | 'history' | 'verify' | 'maintenance' | 'users';
type LangMode = 'am' | 'en';

export function App() {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const isLoggingInRef = useRef(false);
  const verifiedProfileUidRef = useRef<string | null>(null);
  const [createPreviewSide, setCreatePreviewSide] = useState<'front' | 'back'>('front');
  const [view, setViewState] = useState<AppView>('dashboard');
  const [viewHistory, setViewHistory] = useState<AppView[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lang, setLang] = useState<LangMode>(() => {
    try {
      const saved = localStorage.getItem('bgr_ui_lang');
      return saved === 'en' ? 'en' : 'am';
    } catch {
      return 'am';
    }
  });
  const t = (am: string, en: string) => (lang === 'am' ? am : en);
  const changeLang = (next: LangMode) => {
    setLang(next);
    try {
      localStorage.setItem('bgr_ui_lang', next);
    } catch {}
  };
  const navigateTo = (nextView: AppView) => {
    if (nextView !== view) {
      setViewHistory((prev) => [...prev.slice(-9), view]);
      setViewState(nextView);
    }
    setMobileMenuOpen(false);
  };
  const setView = navigateTo;
  const goBack = () => {
    if (viewHistory.length > 0) {
      const prev = viewHistory[viewHistory.length - 1];
      setViewHistory((h) => h.slice(0, -1));
      setViewState(prev);
    } else {
      setViewState('dashboard');
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [allRecords, setAllRecords] = useState<IDRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'needs_correction' | 'approved' | 'rejected'>('all');
  const [assets, setAssets] = useState<Assets>(() => {
    try {
      const saved = localStorage.getItem('bgr_system_assets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.warn("Storage cache notice:", e);
    }
    return {};
  });
  const matchedPoliceLogo = useCardMatchedLogo(assets.police_logo);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoSuccessMsg, setLogoSuccessMsg] = useState('');
  const [correctionModalRecord, setCorrectionModalRecord] = useState<IDRecord | null>(null);
  const [correctionNoteInput, setCorrectionNoteInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<IDRecord | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [dbStatus, setDbStatus] = useState<{ isPersistent: boolean; dbType: string; warning: string | null } | null>(null);

  const [formData, setFormData] = useState<{
    id: string | null;
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
    fayda_number: string;
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
    status?: string;
    correction_note?: string;
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
    fayda_number: '',
    gender: '',
    complexion: '',
    height: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    commissioner_signature: '',
    member_signature: '',
    issued_at: new Date().toISOString().split('T')[0],
    expires_at: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
    id_number: '',
    status: '',
    correction_note: ''
  });

  const emptyForm = {
    id: null as string | null,
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
    fayda_number: '',
    gender: '',
    complexion: '',
    height: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    commissioner_signature: '',
    member_signature: '',
    issued_at: new Date().toISOString().split('T')[0],
    expires_at: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
    id_number: '',
    status: '',
    correction_note: ''
  };

  const [isMounted, setIsMounted] = useState(false);

  const isApproverOrAdmin = user?.role === 'Administrator' || user?.role === 'Approver';

  const ensureFirebaseSessionProfile = async (sessionUser: { id?: string; email?: string; username?: string; role?: string }) => {
    let currentUser = auth.currentUser;
    if (!currentUser) {
      const cred = await signInAnonymously(auth);
      currentUser = cred.user;
    }
    if (currentUser) {
      if (verifiedProfileUidRef.current === currentUser.uid) {
        return currentUser;
      }
      const payload: Record<string, any> = {
        email: (sessionUser.email || sessionUser.username || '').toLowerCase(),
        username: sessionUser.username || sessionUser.email || '',
        role: sessionUser.role || 'Viewer',
        active: true,
        last_login: new Date().toISOString()
      };
      if (sessionUser.id && sessionUser.id !== 'superadmin-fallback' && currentUser.isAnonymous) {
        payload.user_doc_id = sessionUser.id;
      }
      await setDoc(doc(db, 'profiles', currentUser.uid), payload, { merge: true });
      verifiedProfileUidRef.current = currentUser.uid;
    }
    return currentUser;
  };

  useEffect(() => {
    setIsMounted(true);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Do not race or overwrite UI state while handleLogin is actively authenticating
      if (isLoggingInRef.current) {
        return;
      }

      const savedSession = localStorage.getItem('police_id_session');
      let sessionData: any = null;
      if (savedSession) {
        try {
          sessionData = JSON.parse(savedSession);
        } catch {
          localStorage.removeItem('police_id_session');
        }
      }

      // Restore cached session cleanly on page reload before exposing dashboard listeners
      if (sessionData && !firebaseUser) {
        try {
          const cred = await signInAnonymously(auth);
          const profilePayload: Record<string, any> = {
            email: (sessionData.email || sessionData.username || '').toLowerCase(),
            username: sessionData.username || sessionData.email || '',
            role: sessionData.role || 'Viewer',
            active: true,
            last_login: new Date().toISOString()
          };
          if (sessionData.id && sessionData.id !== 'superadmin-fallback') {
            profilePayload.user_doc_id = sessionData.id;
          }
          await setDoc(doc(db, 'profiles', cred.user.uid), profilePayload, { merge: true });
          const syncedSession = { ...sessionData, firebaseUid: cred.user.uid };
          localStorage.setItem('police_id_session', JSON.stringify(syncedSession));
          setUser({
            id: syncedSession.id,
            firebaseUid: cred.user.uid,
            username: syncedSession.username || syncedSession.email,
            email: syncedSession.email,
            role: syncedSession.role
          });
          setToken('firestore-session');
        } catch (reauthErr) {
          console.warn("Session re-sync notice:", reauthErr);
          localStorage.removeItem('police_id_session');
          setUser(null);
          setToken(null);
        }
        setIsAuthReady(true);
        return;
      }

      if (firebaseUser) {
        try {
          // Fast path: restored session already matches this Firebase UID
          if (sessionData && firebaseUser.uid === sessionData.firebaseUid) {
            setUser({
              id: sessionData.id,
              firebaseUid: firebaseUser.uid,
              username: sessionData.username || sessionData.email,
              email: sessionData.email,
              role: sessionData.role
            });
            setToken(firebaseUser.isAnonymous ? 'firestore-session' : 'firebase-token');
            setIsAuthReady(true);

            // Background sync: verify profile exists & user account wasn't deactivated
            getDoc(doc(db, 'profiles', firebaseUser.uid))
              .then(async (pSnap) => {
                if (!pSnap.exists()) {
                  await ensureFirebaseSessionProfile(sessionData);
                } else {
                  verifiedProfileUidRef.current = firebaseUser.uid;
                }
              })
              .catch(() => {});

            if (sessionData.id && sessionData.id !== 'superadmin-fallback') {
              getDoc(doc(db, 'users', sessionData.id))
                .then(async (userDocSnap) => {
                  if (userDocSnap.exists() && userDocSnap.data().active === false) {
                    localStorage.removeItem('police_id_session');
                    verifiedProfileUidRef.current = null;
                    await signOut(auth);
                    setUser(null);
                    setToken(null);
                  }
                })
                .catch(() => {});
            }
            return;
          }

          let profileDoc = null;
          try {
            profileDoc = await getDoc(doc(db, 'profiles', firebaseUser.uid));
          } catch {}

          const emailLower = firebaseUser.email?.toLowerCase() || sessionData?.email?.toLowerCase() || '';
          const isRealSuperAdmin =
            !firebaseUser.isAnonymous &&
            (emailLower === 'policeregion551@gmail.com' || emailLower === 'yirsawbiniyam@gmail.com');

          // Never auto-login bare anonymous sessions (e.g. QR verification) as unauthorized 'Viewer'
          if (firebaseUser.isAnonymous && !sessionData && !profileDoc?.exists()) {
            setUser(null);
            setToken(null);
            setIsAuthReady(true);
            return;
          }

          if (sessionData?.id && sessionData.id !== 'superadmin-fallback') {
            try {
              const userDocSnap = await getDoc(doc(db, 'users', sessionData.id));
              if (userDocSnap.exists() && userDocSnap.data().active === false) {
                localStorage.removeItem('police_id_session');
                await signOut(auth);
                setUser(null);
                setToken(null);
                setIsAuthReady(true);
                return;
              }
            } catch {}
          }

          let role = isRealSuperAdmin ? 'Administrator' : (sessionData?.role || 'Viewer');
          let email = firebaseUser.email || sessionData?.email || '';
          let username = sessionData?.username || email || 'User';
          let resolvedUserDocId: string | undefined =
            sessionData?.id && sessionData.id !== 'superadmin-fallback' ? sessionData.id : undefined;

          if (!profileDoc?.exists()) {
            if (email && !firebaseUser.isAnonymous) {
              try {
                const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()), limit(1));
                const userSnapshot = await getDocs(q);
                if (!userSnapshot.empty) {
                  const matchedDoc = userSnapshot.docs[0];
                  const userData = matchedDoc.data();
                  if (userData.active === false) {
                    localStorage.removeItem('police_id_session');
                    await signOut(auth);
                    setUser(null);
                    setToken(null);
                    setIsAuthReady(true);
                    return;
                  }
                  role = userData.role;
                  email = userData.email || email;
                  username = userData.username || email;
                  resolvedUserDocId = matchedDoc.id;
                }
              } catch (e) {
                console.warn("Users lookup failed", e);
              }
            }

            if (isRealSuperAdmin || resolvedUserDocId) {
              try {
                const profilePayload: Record<string, any> = {
                  email,
                  username,
                  role,
                  active: true,
                  last_login: new Date().toISOString()
                };
                if (resolvedUserDocId && !isRealSuperAdmin) {
                  profilePayload.user_doc_id = resolvedUserDocId;
                }
                await setDoc(doc(db, 'profiles', firebaseUser.uid), profilePayload, { merge: true });
              } catch (e) {
                console.error("Auth state profile creation failed:", e);
              }
            } else {
              setUser(null);
              setToken(null);
              setIsAuthReady(true);
              return;
            }
          } else {
            const profileData = profileDoc.data();
            if (profileData.active === false) {
              localStorage.removeItem('police_id_session');
              await signOut(auth);
              setUser(null);
              setToken(null);
              setIsAuthReady(true);
              return;
            }
            role = profileData.role || role;
            email = profileData.email || email;
            username = profileData.username || sessionData?.username || email;
          }

          setUser({
            id: resolvedUserDocId || sessionData?.id || firebaseUser.uid,
            firebaseUid: firebaseUser.uid,
            username,
            email,
            role: role as UserRole
          });
          setToken(firebaseUser.isAnonymous ? 'firestore-session' : 'firebase-token');
        } catch (err) {
          console.error("Auth sync error:", err);
          setUser(null);
          setToken(null);
        }
      } else {
        setUser(null);
        setToken(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch & subscribe to system assets via individual document listeners (avoids unauthenticated collection list queries)
  useEffect(() => {
    const canReadProtected = Boolean(user && token && auth.currentUser);
    const assetKeys: (keyof Assets)[] = canReadProtected
      ? ['police_logo', 'bgr_flag', 'eth_flag', 'commissioner_signature']
      : ['police_logo', 'bgr_flag', 'eth_flag'];

    fetchAssets(canReadProtected);

    const unsubs = assetKeys.map((key) => {
      try {
        return onSnapshot(
          doc(db, 'assets', key),
          (docSnap) => {
            const val = docSnap.exists() ? docSnap.data()?.value : undefined;
            setAssets((prev) => {
              const next = { ...prev };
              if (val) {
                next[key] = val;
              } else if (docSnap.exists() === false && prev[key]) {
                delete next[key];
              } else {
                return prev;
              }
              try {
                localStorage.setItem('bgr_system_assets', JSON.stringify(next));
              } catch {}
              return next;
            });
          },
          (err) => {
            console.warn(`Asset listener notice (${key}):`, err);
          }
        );
      } catch (e) {
        console.warn(`Asset listener init notice (${key}):`, e);
        return () => {};
      }
    });

    return () => {
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
    };
  }, [user?.id, user?.role, token]);

  const buildRecordsQuery = useCallback(() => {
    const idsRef = collection(db, 'ids');
    if (user?.role === 'Administrator' || user?.role === 'Approver') {
      return query(idsRef);
    }
    if (user?.role === 'Data Entry') {
      const creatorKey = (user.email || user.username || '').toLowerCase();
      return query(idsRef, or(
        where('created_by_email', '==', creatorKey),
        where('status', '==', 'approved')
      ));
    }
    return query(idsRef, where('status', '==', 'approved'));
  }, [user?.role, user?.email, user?.username]);

  // Real-time IndexedDB-cached snapshot listener: zero-lag search & offline-first ID workflow
  useEffect(() => {
    if (!user || !token || !auth.currentUser) {
      setAllRecords([]);
      return;
    }
    const q = buildRecordsQuery();
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ ...(d.data() as any), id: d.id }))
          .filter((r) => !r.deleted) as IDRecord[];
        setAllRecords(list);
      },
      (err) => {
        console.warn("Records real-time listener notice:", err);
      }
    );
    return () => unsub();
  }, [user, token, buildRecordsQuery]);

  // Instantaneous 0ms client-side search & status filter
  const records = useMemo(() => {
    const s = searchQuery.trim().toLowerCase();
    const statusOrder: Record<string, number> = {
      needs_correction: 0,
      pending: 1,
      approved: 2,
      rejected: 3
    };
    return allRecords
      .filter((record) => {
        if (record.deleted) return false;
        if (statusFilter !== 'all' && record.status !== statusFilter) return false;
        if (!s) return true;
        return (
          (record.full_name_am || '').toLowerCase().includes(s) ||
          (record.full_name_en || '').toLowerCase().includes(s) ||
          (record.phone || '').toLowerCase().includes(s) ||
          (record.fayda_number || '').toLowerCase().includes(s) ||
          (record.id_number || '').toLowerCase().includes(s)
        );
      })
      .sort((a, b) => {
        if (a.status !== b.status) {
          return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        }
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [allRecords, statusFilter, searchQuery]);

  // Auto-save draft
  useEffect(() => {
    if (
      formData.full_name_am ||
      formData.full_name_en ||
      formData.phone ||
      formData.fayda_number ||
      formData.badge_number ||
      formData.photo_url
    ) {
      localStorage.setItem('id_form_draft', JSON.stringify(formData));
    } else {
      localStorage.removeItem('id_form_draft');
    }
  }, [formData]);

  // Automatic 30-minute idle session timeout for security hardening
  useEffect(() => {
    if (!user || !token) return;
    let idleTimer: ReturnType<typeof setTimeout>;
    const IDLE_LIMIT_MS = 30 * 60 * 1000;
    const resetTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(async () => {
        try {
          localStorage.removeItem('police_id_session');
          await signOut(auth);
        } catch {}
        setUser(null);
        setToken(null);
        setView('dashboard');
      }, IDLE_LIMIT_MS);
    };
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(idleTimer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [user?.id, token]);

  const [printSide, setPrintSide] = useState<'front' | 'back' | 'both' | 'combined'>('both');
  const [printTriggerSeq, setPrintTriggerSeq] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);
  const pendingPrintJobRef = useRef<{
    id_doc_id: string;
    id_number: string;
    user_email: string;
    user_role: UserRole;
    side: 'front' | 'back' | 'both' | 'combined';
  } | null>(null);
  const [showPrintLogs, setShowPrintLogs] = useState(false);
  const [printLogs, setPrintLogs] = useState<any[]>([]);
  const [loadingPrintLogs, setLoadingPrintLogs] = useState(false);

  const printPageStyle = useMemo(() => {
    if (printSide === 'combined') {
      // Dedicated PVC / CR80 Card Printer (2-page duplex at exact 85.6mm x 53.98mm)
      return `
        @page {
          size: 85.6mm 53.98mm;
          margin: 0mm;
        }
        @media print {
          html, body {
            width: 85.6mm !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
        }
      `;
    }
    // Universal Office / Laser / Inkjet / PDF Printer: exact 1:1 ATM size (85.6mm x 53.98mm)
    return `
      @page {
        size: auto;
        margin: 10mm;
      }
      @media print {
        html, body {
          width: auto !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
      }
    `;
  }, [printSide]);

  const fetchPrintLogs = async () => {
    if (!user) return;
    setLoadingPrintLogs(true);
    try {
      let currentAuth = auth.currentUser;
      if (!currentAuth) {
        currentAuth = await ensureFirebaseSessionProfile(user);
      }
      const logsRef = collection(db, 'print_logs');
      const q = isApproverOrAdmin
        ? query(logsRef, orderBy('timestamp', 'desc'), limit(100))
        : query(logsRef, where('uid', '==', currentAuth?.uid || ''));
      const snap = await getDocs(q);
      const rows = snap.docs
        .map((d) => ({ ...(d.data() as any), id: d.id }))
        .sort((a, b) => {
          const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
          const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
          return tb - ta;
        });
      setPrintLogs(rows);
      setShowPrintLogs(true);
    } catch (error) {
      console.error("Fetch print logs error:", error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'print_logs');
      } catch {}
    } finally {
      setLoadingPrintLogs(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selectedRecord?.id_number ? `BGR_Police_ID_${selectedRecord.id_number}` : "Police_ID_Card",
    pageStyle: printPageStyle,
    onBeforePrint: async () => {
      if (printRef.current) {
        const imgs = Array.from(printRef.current.querySelectorAll('img')) as HTMLImageElement[];
        await Promise.race([
          Promise.all(
            imgs.map((img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((res) => {
                    img.onload = () => res();
                    img.onerror = () => res();
                  })
            )
          ),
          new Promise<void>((res) => setTimeout(res, 600))
        ]);
      }
      setLoading(false);
    },
    onAfterPrint: async () => {
      setLoading(false);
      const job = pendingPrintJobRef.current;
      pendingPrintJobRef.current = null;
      if (!job) return;
      try {
        let currentAuth = auth.currentUser;
        if (!currentAuth && user) {
          currentAuth = await ensureFirebaseSessionProfile(user);
        }
        if (!currentAuth) {
          throw new Error('No active authenticated user session for print logging.');
        }
        await addDoc(collection(db, 'print_logs'), {
          id_number: job.id_number,
          id_doc_id: job.id_doc_id,
          user_email: job.user_email,
          user_role: job.user_role,
          side: job.side,
          uid: currentAuth.uid,
          timestamp: serverTimestamp(),
        });
      } catch (error) {
        console.error("Failed to record print log in Firestore:", error);
        try {
          handleFirestoreError(error, OperationType.CREATE, 'print_logs');
        } catch {}
      }
    },
    onPrintError: (_loc, err) => {
      pendingPrintJobRef.current = null;
      setLoading(false);
      console.error("Print trigger error:", err);
      alert(t(
        "ማተም አልተቻለም። እባክዎ የብራውዘርዎን የፕሪንት ፍቃድ ያረጋግጡ።",
        "Printing failed. Please allow browser print dialogs and try again."
      ));
    },
  });

  useEffect(() => {
    if (printTriggerSeq === 0) return;
    let cancelled = false;
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 1500);
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      if (printRef.current) {
        try {
          handlePrint();
        } catch (error) {
          pendingPrintJobRef.current = null;
          setLoading(false);
          console.error("Print trigger failed:", error);
          alert(t(
            "ማተም አልተቻለም። እባክዎ የብራውዘርዎን የፕሪንት ፍቃድ ያረጋግጡ።",
            "Printing failed. Please check your browser print permissions or try a different browser."
          ));
        }
      } else {
        pendingPrintJobRef.current = null;
        setLoading(false);
        alert(t("የፕሪንት ገጹ አልተገኘም። እባክዎ እንደገና ይሞክሩ።", "Print container not found. Please try again."));
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(safetyTimer);
    };
  }, [printTriggerSeq]);

  const handlePrintSide = (side: 'front' | 'back' | 'both' | 'combined', recordOverride?: IDRecord) => {
    const target = recordOverride || selectedRecord;
    const isApproved = target?.status === 'approved' && !target?.deleted;
    const canPrint = isApproved && (isApproverOrAdmin || user?.role === 'Data Entry');
    
    if (!canPrint || !target) {
      alert(t(
        "አጽዳቂው እስኪያጸድቀው ድረስ መታወቂያውን ማተም አይቻልም። መጀመሪያ አጽዳቂው 'አጽድቅ' ማለት አለበት።",
        "Printing is locked until the Approver approves and registers this ID card in the system."
      ));
      return;
    }
    if (recordOverride) {
      setSelectedRecord(recordOverride);
    }
    const printerEmail = (user?.email || auth.currentUser?.email || user?.username || '').trim().toLowerCase();
    pendingPrintJobRef.current = {
      id_doc_id: target.id,
      id_number: target.id_number,
      user_email: printerEmail,
      user_role: user!.role,
      side,
    };

    setLoading(true);
    setPrintSide(side);
    setPrintTriggerSeq((seq) => seq + 1);
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm(t(
      'ይህንን መረጃ በእርግጠኝነት ማጥፋት ይፈልጋሉ?',
      'Are you sure you want to delete this ID record?'
    ))) return;
    try {
      if (user) await ensureFirebaseSessionProfile(user);
      const writePromise = updateDoc(doc(db, 'ids', id), {
        deleted: true,
        deleted_at: new Date().toISOString()
      });
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setAllRecords((prev) => prev.filter((r) => r.id !== id));
        writePromise.catch((err) => console.error('Offline delete sync error:', err));
      } else {
        await writePromise;
        setAllRecords((prev) => prev.filter((r) => r.id !== id));
      }
      alert(t('መረጃው በትክክል ጠፍቷል!', 'Record deleted successfully!'));
    } catch (error: any) {
      console.error("Delete error:", error);
      alert(t('ስህተት ተፈጥሯል: ', 'Error: ') + error.message);
    }
  };

  const handleApproveRecord = async (record: IDRecord) => {
    try {
      if (user) await ensureFirebaseSessionProfile(user);
      const now = new Date().toISOString();
      const approverName = user?.username || user?.email || 'Approver';
      const approvedPatch = {
        status: 'approved' as const,
        is_registered: true,
        approved_by: approverName,
        approved_at: now,
        correction_note: '',
        reviewed_by: approverName,
        reviewed_at: now
      };
      const writePromise = updateDoc(doc(db, 'ids', record.id), approvedPatch);
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        writePromise.catch((err) => console.error('Offline approve sync error:', err));
      } else {
        await writePromise;
      }
      setAllRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, ...approvedPatch } : r)));
      if (selectedRecord?.id === record.id) {
        setSelectedRecord({ ...record, ...approvedPatch });
      }
      alert(t(
        'መታወቂያው ጸድቆ በሲስተሙ (Firestore) ውስጥ በይፋ ተመዝግቧል! አሁን ፕሪንት ማድረግና QR ስካን መጠቀም ይቻላል።',
        'ID approved and officially registered in Firestore! Printing and QR verification are now enabled.'
      ));
    } catch (error: any) {
      console.error("Approve error:", error);
      alert(t('ማጽደቅ አልተቻለም: ', 'Failed to approve: ') + error.message);
    }
  };

  const handleSendBackForCorrection = async (record: IDRecord, note: string) => {
    const cleanNote = sanitizeText(note, 500);
    if (!cleanNote) {
      alert('እባክዎ መስተካከል ያለበትን ስህተት ይጻፉ። (Please enter the error note to send back.)');
      return;
    }
    try {
      if (user) await ensureFirebaseSessionProfile(user);
      const patch = {
        status: 'needs_correction' as const,
        correction_note: cleanNote,
        reviewed_by: user?.username || user?.email || 'Approver',
        reviewed_at: new Date().toISOString(),
        resubmitted: false
      };
      const writePromise = updateDoc(doc(db, 'ids', record.id), patch);
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        writePromise.catch((err) => console.error('Offline correction sync error:', err));
      } else {
        await writePromise;
      }
      setAllRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, ...patch } : r)));
      setCorrectionModalRecord(null);
      setCorrectionNoteInput('');
      if (selectedRecord?.id === record.id) {
        setSelectedRecord({ ...record, ...patch });
      }
      alert('ስህተቱ ተገልጾ ለመረጃ አስገቢው ተመልሷል! (Sent back for correction)');
    } catch (error: any) {
      console.error("Send back error:", error);
      alert('መመለስ አልተቻለም: ' + error.message);
    }
  };

  const handleRejectRecord = async (record: IDRecord) => {
    if (!confirm('ይህንን መታወቂያ ውድቅ ማድረግ ይፈልጋሉ? (Reject this ID?)')) return;
    try {
      if (user) await ensureFirebaseSessionProfile(user);
      const patch = {
        status: 'rejected' as const,
        reviewed_by: user?.username || user?.email || 'Approver',
        reviewed_at: new Date().toISOString()
      };
      const writePromise = updateDoc(doc(db, 'ids', record.id), patch);
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        writePromise.catch((err) => console.error('Offline reject sync error:', err));
      } else {
        await writePromise;
      }
      setAllRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, ...patch } : r)));
    } catch (error: any) {
      console.error("Reject error:", error);
      alert('ስህተት: ' + error.message);
    }
  };

  const [showScans, setShowScans] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);

  const handleLogin = async (credentials: any) => {
    const rawIdentifier = sanitizeText(credentials.email, 200);
    let identifier = rawIdentifier.toLowerCase();
    if (!identifier || !credentials.password) {
      alert(t("እባክዎ ዩሰርኔም/ኢሜይል እና የይለፍ ቃል ያስገቡ።", "Please enter both username/email and password."));
      return;
    }

    // Auto-correct common typo
    if (identifier.endsWith('@gamil.com')) {
      identifier = identifier.replace('@gamil.com', '@gmail.com');
    }

    // Client-side brute-force lockout protection (60s lockout after 5 failed attempts)
    const lockKey = `bgr_login_lock_${identifier}`;
    const getLockState = () => {
      try {
        const raw = localStorage.getItem(lockKey);
        return raw ? JSON.parse(raw) : { count: 0, lockedUntil: 0 };
      } catch {
        return { count: 0, lockedUntil: 0 };
      }
    };
    const recordFailure = () => {
      try {
        const cur = getLockState();
        const nextCount = (cur.count || 0) + 1;
        const lockedUntil = nextCount >= 5 ? Date.now() + 60000 : 0;
        localStorage.setItem(lockKey, JSON.stringify({ count: nextCount >= 5 ? 0 : nextCount, lockedUntil }));
      } catch {}
    };
    const clearFailures = () => {
      try {
        localStorage.removeItem(lockKey);
      } catch {}
    };

    const lockState = getLockState();
    if (lockState.lockedUntil && lockState.lockedUntil > Date.now()) {
      const waitSec = Math.ceil((lockState.lockedUntil - Date.now()) / 1000);
      alert(t(
        `ከፍተኛ የተሳሳተ ሙከራ ስለተደረገ ለ ${waitSec} ሰከንድ ቆይተው እንደገና ይሞክሩ።`,
        `Too many failed login attempts. Please wait ${waitSec} seconds before retrying.`
      ));
      return;
    }

    isLoggingInRef.current = true;
    setLoading(true);
    try {
      // Ensure Firebase Auth session exists before reading protected users collection
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      // 1. Parallel Firestore-backed lookup by email OR username (1 network round-trip)
      let userData: any = null;
      let userDocId: string | null = null;

      const emailQ = query(collection(db, 'users'), where('email', '==', identifier), limit(1));
      const userLowerQ = query(collection(db, 'users'), where('username_lower', '==', identifier), limit(1));
      const [emailSnap, userLowerSnap] = await Promise.all([getDocs(emailQ), getDocs(userLowerQ)]);

      if (!emailSnap.empty) {
        const userDoc = emailSnap.docs[0];
        userData = userDoc.data();
        userDocId = userDoc.id;
      } else if (!userLowerSnap.empty) {
        const userDoc = userLowerSnap.docs[0];
        userData = userDoc.data();
        userDocId = userDoc.id;
      } else if (rawIdentifier !== identifier) {
        const userExactQ = query(collection(db, 'users'), where('username', '==', rawIdentifier), limit(1));
        const userExactSnap = await getDocs(userExactQ);
        if (!userExactSnap.empty) {
          const userDoc = userExactSnap.docs[0];
          userData = userDoc.data();
          userDocId = userDoc.id;
        }
      }

      if (userData && userDocId) {
        if (userData.active === false) {
          alert(t(
            "መለያዎ ታግዷል። እባክዎ አስተዳዳሪውን ያነጋግሩ።",
            "Your account has been deactivated. Please contact the Administrator."
          ));
          return;
        }

        const isPasswordValid = await verifyPassword(credentials.password, String(userData.password || ''));
        if (isPasswordValid) {
          clearFailures();
          try {
            // Auto-migrate legacy plaintext password to PBKDF2-SHA-256 hash on login
            if (!String(userData.password || '').startsWith('pbkdf2_sha256$')) {
              hashPassword(credentials.password)
                .then((upgradedHash) => updateDoc(doc(db, 'users', userDocId!), { password: upgradedHash }))
                .catch(() => {});
            }

            const currentAuth = auth.currentUser || (await signInAnonymously(auth)).user;
            const uid = currentAuth.uid;

            const resolvedEmail = (userData.email || '').toLowerCase();
            const resolvedUsername = userData.username || resolvedEmail || rawIdentifier;

            await setDoc(doc(db, 'profiles', uid), {
              email: resolvedEmail || resolvedUsername.toLowerCase(),
              username: resolvedUsername,
              role: userData.role,
              active: userData.active !== false,
              user_doc_id: userDocId,
              last_login: new Date().toISOString()
            }, { merge: true });
            verifiedProfileUidRef.current = uid;

            const sessionUser = {
              id: userDocId,
              firebaseUid: uid,
              username: resolvedUsername,
              email: resolvedEmail || resolvedUsername.toLowerCase(),
              role: userData.role || 'Viewer'
            };

            localStorage.setItem('police_id_session', JSON.stringify(sessionUser));
            setUser(sessionUser as any);
            setToken('firestore-session');
            setIsAuthReady(true);
            return;
          } catch (anonErr: any) {
            console.error("Session profile creation failed:", anonErr);
            let errMsg = "Login session initialization failed.";
            if (anonErr.code === 'auth/network-request-failed' || anonErr.message?.includes('network-request-failed')) {
              errMsg += " Network error. This usually means the domain is not authorized in Firebase Console.";
            }
            alert(errMsg);
            return;
          }
        } else {
          recordFailure();
          alert(t(
            "የገባው ዩሰርኔም/ኢሜይል ወይም የይለፍ ቃል ትክክል አይደለም።",
            "Invalid username/email or password."
          ));
          return;
        }
      }

      // 2. Fallback to Firebase Auth Email/Password directly (no signOut gap/bounce)
      if (identifier.includes('@')) {
        const cred = await signInWithEmailAndPassword(auth, identifier, credentials.password);
        clearFailures();

        const fbUser = cred.user;
        const emailLower = (fbUser.email || identifier).toLowerCase();
        const isSuperAdminAccount =
          emailLower === 'policeregion551@gmail.com' || emailLower === 'yirsawbiniyam@gmail.com';
        let role: UserRole = isSuperAdminAccount ? 'Administrator' : 'Viewer';
        let username = fbUser.displayName || emailLower;
        let docId = isSuperAdminAccount ? 'superadmin-fallback' : fbUser.uid;

        if (isSuperAdminAccount) {
          await setDoc(doc(db, 'profiles', fbUser.uid), {
            email: emailLower,
            username,
            role,
            active: true,
            last_login: new Date().toISOString()
          }, { merge: true });
        } else {
          const existingSnap = await getDoc(doc(db, 'profiles', fbUser.uid)).catch(() => null);
          if (!existingSnap?.exists() || existingSnap.data()?.active === false) {
            throw new Error(t("የተጠቃሚ መለያ በሲስተሙ ውስጥ አልተገኘም።", "Staff profile not found or deactivated."));
          }
          const existingData = existingSnap.data()!;
          role = (existingData.role as UserRole) || 'Viewer';
          username = existingData.username || username;
          docId = existingData.user_doc_id || fbUser.uid;
        }

        const sessionUser = {
          id: docId,
          firebaseUid: fbUser.uid,
          username,
          email: emailLower,
          role
        };

        localStorage.setItem('police_id_session', JSON.stringify(sessionUser));
        verifiedProfileUidRef.current = fbUser.uid;
        setUser(sessionUser as any);
        setToken('firebase-token');
        setIsAuthReady(true);
      } else {
        recordFailure();
        alert(t(
          "የገባው ዩሰርኔም ወይም የይለፍ ቃል አልተገኘም።",
          "User not found or wrong password."
        ));
      }
    } catch (e: any) {
      recordFailure();
      console.error("Login error:", e);
      let msg = e.message;
      if (e.code === 'auth/network-request-failed') {
        msg = "Network error. Please ensure your domain is authorized in Firebase Console: " + window.location.hostname;
      } else if (e.code === 'auth/operation-not-allowed') {
        msg = "የመግቢያ ዘዴው አልበራም (Login method not enabled). እባክዎን በፋየርቤዝ ኮንሶል (Firebase Console) ውስጥ 'Email/Password' እና 'Anonymous' መግቢያዎችን ያብሩ።";
      } else if (e.code === 'auth/invalid-email') {
        msg = "የተሳሳተ ኢሜል ወይም ዩሰርኔም ነው (Invalid email or username).";
      } else if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password') {
        msg = t("የገባው ኢሜይል ወይም የይለፍ ቃል ትክክል አይደለም።", "Invalid email or password.");
      }
      alert(t('መግባት አልተቻለም: ', 'Login error: ') + msg);
    } finally {
      isLoggingInRef.current = false;
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('police_id_session');
      verifiedProfileUidRef.current = null;
      await signOut(auth);
      setView('dashboard');
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('online');

  const handleDownload = async (idNumber: string, side: 'front' | 'back' | 'both' | 'combined', recordOverride?: IDRecord) => {
    const target = recordOverride || selectedRecord;
    const isApproved = target?.status === 'approved' && !target?.deleted;
    const canDownload = isApproved && (isApproverOrAdmin || user?.role === 'Data Entry');
    
    if (!canDownload) {
      alert(t(
        "አጽዳቂው እስኪያጸድቀው ድረስ መታወቂያውን ማውረድ አይቻልም።",
        "Downloading is locked until the Approver approves and registers this ID card."
      ));
      return;
    }
    setLoading(true);
    let captureContainer: HTMLDivElement | null = null;
    
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        alert("ዝግጅቱ በጣም ዘግይቷል። እባክዎ በድጋሚ ይሞክሩ ወይም 'Print' የሚለውን አማራጭ ይጠቀሙ። (Preparation is taking too long. Please try again or use 'Print'.)");
      }
    }, 30000);

    try {
      await new Promise(resolve => setTimeout(resolve, 120));

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
        
        const blended = clone.querySelectorAll('.mix-blend-multiply');
        blended.forEach(el => (el as HTMLElement).classList.remove('mix-blend-multiply'));
        
        const images = clone.querySelectorAll('img');
        images.forEach(img => {
          img.setAttribute('crossorigin', 'anonymous');
        });

        const allElements = clone.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i] as HTMLElement;
          const style = window.getComputedStyle(el);
          
          const colorProps = ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'];
          colorProps.forEach(prop => {
            const cssProp = prop.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
            const value = style.getPropertyValue(cssProp);
            if (value && (value.includes('oklch') || value.includes('oklab'))) {
              if (prop === 'color') el.style.color = '#1e293b';
              if (prop === 'backgroundColor' && value !== 'rgba(0, 0, 0, 0)') {
                el.style.backgroundColor = '#ffffff';
              }
              if (prop === 'borderColor') el.style.borderColor = '#e2e8f0';
            }
          });
          
          const shadow = style.getPropertyValue('box-shadow');
          if (shadow && (shadow.includes('oklch') || shadow.includes('oklab'))) {
            el.style.boxShadow = 'none';
          }
        }

        captureContainer.appendChild(clone);
      }
      
      if (!foundAny) throw new Error("No card elements found to capture");

      document.body.appendChild(captureContainer);

      const imagesToLoad = Array.from(captureContainer.querySelectorAll('img'));
      const imageLoadPromises = imagesToLoad.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          const timeout = setTimeout(() => {
            console.warn("Image load timed out, replacing with placeholder:", img.src);
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
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: false,
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

  const fetchAssets = async (includeProtected = Boolean(user)) => {
    const keys: (keyof Assets)[] = includeProtected
      ? ['police_logo', 'bgr_flag', 'eth_flag', 'commissioner_signature']
      : ['police_logo', 'bgr_flag', 'eth_flag'];
    try {
      const snaps = await Promise.all(
        keys.map(async (key) => {
          try {
            const snap = await getDoc(doc(db, 'assets', key));
            return [key, snap.exists() ? snap.data()?.value : undefined] as const;
          } catch (err) {
            console.warn(`Fetch asset notice (${key}):`, err);
            return [key, undefined] as const;
          }
        })
      );
      const data: Partial<Assets> = {};
      for (const [k, v] of snaps) {
        if (v) data[k] = v;
      }
      if (Object.keys(data).length > 0) {
        setAssets(prev => {
          const next = { ...prev, ...data };
          try {
            localStorage.setItem('bgr_system_assets', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    } catch (e) {
      console.error("Fetch assets error:", e);
    }
  };

  const handleAssetUpload = async (key: keyof Assets, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    if (key === 'police_logo') setLogoUploading(true);
    reader.onloadend = async () => {
      try {
        let base64 = reader.result as string;
        if (base64.startsWith('data:image')) {
          base64 = await resizeImage(base64, 500, 500, key === 'police_logo' || key === 'commissioner_signature');
        }
        if (user) {
          await ensureFirebaseSessionProfile(user);
        }
        await setDoc(doc(db, 'assets', key), {
          value: base64,
          updated_at: new Date().toISOString()
        });
        setAssets(prev => {
          const next = { ...prev, [key]: base64 };
          try {
            localStorage.setItem('bgr_system_assets', JSON.stringify(next));
          } catch {}
          return next;
        });
        if (key === 'police_logo') {
          setLogoSuccessMsg('የፖሊስ ኮሚሽኑ ይፋዊ ሎጎ በተሳካ ሁኔታ ተቀምጧል! በመግቢያ ገፅ፣ በዳሽቦርድ እና በሁሉም መታወቂያዎች ላይ ተግባራዊ ሆኗል።');
          setTimeout(() => setLogoSuccessMsg(''), 6000);
        }
      } catch (error: any) {
        console.error("Asset upload error:", error);
        alert("የፋይል ጭነት አልተሳካም (Asset upload failed): " + (error?.message || ''));
      } finally {
        if (key === 'police_logo') setLogoUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    if (!confirm('ይህንን ሎጎ ማስወገድ ይፈልጋሉ? (Remove custom logo?)')) return;
    try {
      if (user) {
        await ensureFirebaseSessionProfile(user);
      }
      await deleteDoc(doc(db, 'assets', 'police_logo'));
      setAssets(prev => {
        const next = { ...prev };
        delete next.police_logo;
        try {
          localStorage.setItem('bgr_system_assets', JSON.stringify(next));
        } catch {}
        return next;
      });
    } catch (error: any) {
      console.error("Remove logo error:", error);
      alert("ሎጎውን ማስወገድ አልተቻለም: " + (error?.message || ''));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = await resizeImage(reader.result as string, 420, 520);
      setFormData((prev) => ({ ...prev, photo_url: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTranslating(true);

    try {
      const finalData: any = {
        ...formData,
        full_name_am: sanitizeText(formData.full_name_am, 180),
        full_name_en: sanitizeText(formData.full_name_en, 180),
        rank_am: sanitizeText(formData.rank_am, 120),
        rank_en: sanitizeText(formData.rank_en, 120),
        responsibility_am: sanitizeText(formData.responsibility_am, 160),
        responsibility_en: sanitizeText(formData.responsibility_en, 160),
        phone: sanitizeText(formData.phone, 40),
        blood_type: sanitizeText(formData.blood_type, 20),
        badge_number: sanitizeText(formData.badge_number, 60),
        fayda_number: sanitizeText(formData.fayda_number, 60),
        gender: sanitizeText(formData.gender, 20),
        complexion: sanitizeText(formData.complexion, 60),
        height: sanitizeText(formData.height, 30),
        emergency_contact_name: sanitizeText(formData.emergency_contact_name, 140),
        emergency_contact_phone: sanitizeText(formData.emergency_contact_phone, 40),
      };

      // Instantaneous 0ms local translation/transliteration so slow or offline internet NEVER delays submission;
      // background Gemini refinement silently upgrades fields when online.
      const fields = ['full_name', 'rank', 'responsibility'] as const;
      const pendingBgTranslations: Array<{ source: string; targetLang: 'am' | 'en'; targetKey: string }> = [];

      for (const field of fields) {
        const amKey = `${field}_am`;
        const enKey = `${field}_en`;
        const amVal = finalData[amKey];
        const enVal = finalData[enKey];
        if (amVal && !enVal) {
          const instant = fastLocalTranslate(amVal, 'en');
          finalData[enKey] = instant || amVal;
          if (typeof navigator === 'undefined' || navigator.onLine !== false) {
            pendingBgTranslations.push({ source: amVal, targetLang: 'en', targetKey: enKey });
          }
        } else if (enVal && !amVal) {
          const instant = fastLocalTranslate(enVal, 'am');
          finalData[amKey] = instant || enVal;
          if (!instant && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
            pendingBgTranslations.push({ source: enVal, targetLang: 'am', targetKey: amKey });
          }
        }
      }
      setTranslating(false);

      const triggerBackgroundRefinement = (docId: string) => {
        if (pendingBgTranslations.length === 0) return;
        Promise.all(
          pendingBgTranslations.map(async (item) => {
            const refined = await translateText(item.source, item.targetLang, 3500);
            return { key: item.targetKey, value: refined };
          })
        )
          .then((results) => {
            const patch: Record<string, string> = {};
            for (const r of results) {
              if (r.value && r.value !== finalData[r.key]) {
                patch[r.key] = r.value;
              }
            }
            if (Object.keys(patch).length > 0) {
              setAllRecords((prev) =>
                prev.map((rec) => (rec.id === docId ? { ...rec, ...patch } : rec))
              );
              setSelectedRecord((prev) =>
                prev && prev.id === docId ? { ...prev, ...patch } : prev
              );
              updateDoc(doc(db, 'ids', docId), patch).catch(() => {});
            }
          })
          .catch(() => {});
      };

      if (user) {
        await ensureFirebaseSessionProfile(user);
      }

      let photo_url = finalData.photo_url || '';
      if (photo_url.length > 420000 && photo_url.startsWith('data:image')) {
        photo_url = await resizeImage(photo_url, 380, 480, false);
      }
      let commissioner_signature = finalData.commissioner_signature || assets.commissioner_signature || '';
      if (commissioner_signature.length > 350000 && commissioner_signature.startsWith('data:image')) {
        commissioner_signature = await resizeImage(commissioner_signature, 360, 180, true);
        if (commissioner_signature.length > 450000) {
          commissioner_signature = await resizeImage(commissioner_signature, 320, 160, false);
        }
      }
      let member_signature = finalData.member_signature || '';
      if (member_signature.length > 350000 && member_signature.startsWith('data:image')) {
        member_signature = await resizeImage(member_signature, 360, 180, true);
        if (member_signature.length > 450000) {
          member_signature = await resizeImage(member_signature, 320, 160, false);
        }
      }

      const cleanFayda = getFaydaValue(finalData);
      const recordId = finalData.id;
      const isUpdate = !!recordId;

      // Whitelist ONLY schema-allowed Firestore fields so legacy/extra keys or nulls never cause silent rule rejection
      const cleanRecordCore = {
        full_name_am: finalData.full_name_am || '',
        full_name_en: finalData.full_name_en || '',
        rank_am: finalData.rank_am || '',
        rank_en: finalData.rank_en || '',
        responsibility_am: finalData.responsibility_am || '',
        responsibility_en: finalData.responsibility_en || '',
        phone: finalData.phone || '',
        photo_url,
        blood_type: finalData.blood_type || '',
        badge_number: finalData.badge_number || '',
        fayda_number: cleanFayda,
        gender: finalData.gender || '',
        complexion: finalData.complexion || '',
        height: finalData.height || '',
        emergency_contact_name: finalData.emergency_contact_name || '',
        emergency_contact_phone: finalData.emergency_contact_phone || '',
        commissioner_signature,
        member_signature,
        issued_at: sanitizeText(finalData.issued_at, 40) || new Date().toISOString().split('T')[0],
        expires_at: sanitizeText(finalData.expires_at, 40) || new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
      };

      if (isUpdate) {
        try {
          const existingRecord = allRecords.find((r) => r.id === recordId);
          const existingStatus = finalData.status ?? existingRecord?.status;
          const safeStatus: 'pending' | 'needs_correction' | 'approved' | 'rejected' =
            existingStatus === 'approved' || existingStatus === 'needs_correction' || existingStatus === 'rejected' || existingStatus === 'pending'
              ? existingStatus
              : 'pending';

          const updatePayload: Record<string, any> = {
            ...cleanRecordCore,
            id_number: sanitizeText(finalData.id_number ?? existingRecord?.id_number, 64) || `BGR-POL-1600001`,
            status: safeStatus,
            is_registered: Boolean(finalData.is_registered ?? existingRecord?.is_registered),
            deleted: Boolean(finalData.deleted ?? existingRecord?.deleted),
            correction_note: sanitizeText(finalData.correction_note ?? existingRecord?.correction_note, 500),
            updated_at: new Date().toISOString()
          };

          const createdAt = finalData.created_at ?? existingRecord?.created_at;
          const createdByEmail = finalData.created_by_email ?? existingRecord?.created_by_email;
          const approvedBy = finalData.approved_by ?? existingRecord?.approved_by;
          const approvedAt = finalData.approved_at ?? existingRecord?.approved_at;
          const reviewedBy = finalData.reviewed_by ?? existingRecord?.reviewed_by;
          const reviewedAt = finalData.reviewed_at ?? existingRecord?.reviewed_at;
          const resubmitted = finalData.resubmitted ?? existingRecord?.resubmitted;
          const resubmittedAt = finalData.resubmitted_at ?? existingRecord?.resubmitted_at;
          const deletedAt = finalData.deleted_at ?? existingRecord?.deleted_at;

          if (typeof createdAt === 'string' && createdAt) updatePayload.created_at = createdAt;
          if (typeof createdByEmail === 'string' && createdByEmail) updatePayload.created_by_email = createdByEmail;
          if (typeof approvedBy === 'string' && approvedBy) updatePayload.approved_by = approvedBy;
          if (typeof approvedAt === 'string' && approvedAt) updatePayload.approved_at = approvedAt;
          if (typeof reviewedBy === 'string' && reviewedBy) updatePayload.reviewed_by = reviewedBy;
          if (typeof reviewedAt === 'string' && reviewedAt) updatePayload.reviewed_at = reviewedAt;
          if (typeof resubmitted === 'boolean') updatePayload.resubmitted = resubmitted;
          if (typeof resubmittedAt === 'string' && resubmittedAt) updatePayload.resubmitted_at = resubmittedAt;
          if (typeof deletedAt === 'string' && deletedAt) updatePayload.deleted_at = deletedAt;

          if (user?.role === 'Data Entry' || updatePayload.status === 'needs_correction') {
            updatePayload.status = 'pending';
            updatePayload.is_registered = false;
            updatePayload.resubmitted = true;
            updatePayload.resubmitted_at = new Date().toISOString();
          }

          const updatedRecord: IDRecord = {
            ...(existingRecord || {}),
            ...updatePayload,
            id: recordId
          } as IDRecord;

          const writePromise = setDoc(doc(db, 'ids', recordId), updatePayload);
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            writePromise.catch((err) => {
              console.error('Offline update sync failed:', err);
            });
          } else {
            await writePromise;
          }

          setAllRecords((prev) =>
            prev.map((r) => (r.id === recordId ? updatedRecord : r))
          );
          setSelectedRecord(updatedRecord);
          triggerBackgroundRefinement(recordId);

          if (user?.role === 'Data Entry') {
            alert(t(
              "መረጃው ተስተካክሎ ለአጽዳቂው በድጋሚ ተልኳል!",
              "Record fixed and resubmitted to the Approver!"
            ));
          } else {
            alert(t(
              "መረጃው በትክክል ተሻሽሏል!",
              "Record updated successfully!"
            ));
          }

          setSelectedRecord(updatedRecord);
          setShowPreview(true);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `ids/${recordId}`);
        }
      } else {
        try {
          // 0ms ID sequence calculation from real-time synced records + persisted local counter
          let nextNum = 1;
          try {
            const storedSeq = parseInt(localStorage.getItem('bgr_last_id_seq') || '0', 10);
            if (!Number.isNaN(storedSeq) && storedSeq >= nextNum) {
              nextNum = storedSeq + 1;
            }
          } catch {}
          for (const rec of allRecords) {
            const m = (rec.id_number || '').match(/BGR-POL-16(\d+)/);
            if (m) {
              const n = parseInt(m[1], 10);
              if (n >= nextNum) nextNum = n + 1;
            }
          }
          try {
            localStorage.setItem('bgr_last_id_seq', String(nextNum));
          } catch {}

          const id_number = `BGR-POL-16${String(nextNum).padStart(5, '0')}`;
          const newRecordData = {
            ...cleanRecordCore,
            id_number,
            deleted: false,
            status: 'pending' as const,
            is_registered: false,
            correction_note: '',
            resubmitted: false,
            created_by_email: (user?.email || user?.username || 'anonymous').toLowerCase(),
            created_at: new Date().toISOString()
          };

          const newDocRef = doc(collection(db, 'ids'));
          const createdRecord: IDRecord = { id: newDocRef.id, ...newRecordData };

          const createPromise = setDoc(newDocRef, newRecordData);
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            createPromise.catch((err) => {
              console.error('Offline create sync failed:', err);
            });
          } else {
            await createPromise;
          }

          setAllRecords((prev) => [createdRecord, ...prev]);
          triggerBackgroundRefinement(newDocRef.id);

          alert(t(
            "መታወቂያው ተዘጋጅቶ ለአጽዳቂው ተልኳል! አጽዳቂው እስኪያጸድቀው ድረስ ፕሪንት ማድረግና QR ስካን አይሰራም።",
            "ID card prepared and sent to the Approver! Printing and QR scanning remain locked until approved."
          ));

          setSelectedRecord(createdRecord);
          setShowPreview(true);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'ids');
        }
      }

      setFormData(emptyForm);
      localStorage.removeItem('id_form_draft');
      setView('history');
    } catch (error: any) {
      console.error("Submission error:", error);
      let errorMsg = error.message;
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMsg = t(
            "አዝናለሁ! ይህን ተግባር ለማከናወን የሚያስችል በቂ ፈቃድ የለዎትም። እባክዎ እንደገና ይግቡ ወይም አስተዳዳሪውን ያነጋግሩ።",
            "Permission Denied: You do not have sufficient permissions for this action. Please sign in again."
          );
        } else if (parsed.error) {
          errorMsg = parsed.error;
        }
      } catch (e) {
        if (error.message.includes("insufficient permissions") || error.message.includes("PERMISSION_DENIED")) {
          errorMsg = t(
            "አዝናለሁ! ይህን ተግባር ለማከናወን የሚያስችል በቂ ፈቃድ የለዎትም። እባክዎ እንደገና ይግቡ ወይም አስተዳዳሪውን ያነጋግሩ።",
            "Permission Denied: You do not have sufficient permissions for this action."
          );
        }
      }
      alert(t("ስህተት ተፈጥሯል! እባክዎ እንደገና ይሞክሩ። (", "An error occurred! Please try again. (") + errorMsg + ")");
    } finally {
      setLoading(false);
      setTranslating(false);
    }
  };

  // Verification View Logic (Strictly isolated read-only QR verification route)
  if (isMounted && (window.location.pathname === '/verify' || window.location.pathname.startsWith('/verify/'))) {
    const idNum = window.location.pathname.replace(/^\/verify\/?/, '').split('/')[0] || '';
    return <VerificationView idNumber={idNum} assets={assets} lang={lang} onChangeLang={changeLang} />;
  }

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0B1B3A] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#D4AF37]" size={44} />
      </div>
    );
  }

  if (!token) {
    return (
      <Login
        onLogin={handleLogin}
        loading={loading}
        serverStatus={serverStatus}
        dbStatus={dbStatus}
        assets={assets}
        lang={lang}
        onChangeLang={changeLang}
      />
    );
  }

  const pendingReviewCount = records.filter(r => r.status === 'pending' || r.status === 'needs_correction').length;
  const approvedCount = records.filter(r => r.status === 'approved').length;
  const needsCorrectionCount = records.filter(r => r.status === 'needs_correction').length;
  const pendingCount = records.filter(r => r.status === 'pending').length;

  const viewTitleMap: Record<AppView, string> = {
    dashboard: t('ዋና ዳሽቦርድ', 'Executive Dashboard'),
    create: formData.id ? t('የአባል መረጃ ማስተካከያ', 'Edit Member ID') : t('አዲስ መታወቂያ መመዝገቢያ', 'Prepare New ID'),
    history: t('የመታወቂያ መዝገቦች እና ማጽደቂያ', 'ID Registry & Approvals'),
    maintenance: t('የሲስተም ጥገና', 'System Maintenance'),
    users: t('የተጠቃሚዎች አስተዳደር', 'User Management'),
    verify: t('ማረጋገጫ', 'Verification')
  };

  const roleLabel = (role?: string) => {
    if (role === 'Administrator') return t('አስተዳዳሪ', 'Administrator');
    if (role === 'Approver') return t('አጽዳቂ', 'Approver');
    if (role === 'Data Entry') return t('መረጃ አስገቢ', 'Data Entry');
    return t('ተመልካች', 'Viewer');
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900 font-sans flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Executive Navy Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 shrink-0 bg-[#0B1B3A] text-white flex flex-col border-r border-slate-800 transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-1 flex w-full">
          <div className="flex-1 bg-[#009a44]" />
          <div className="flex-1 bg-[#fedd00]" />
          <div className="flex-1 bg-[#ef3340]" />
        </div>

        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigateTo('dashboard')}
            className="flex items-center gap-3 text-left min-w-0"
          >
            <div
              className="w-10 h-10 rounded-xl border-2 border-[#C89B2B] flex items-center justify-center shrink-0 overflow-hidden shadow-md"
              style={{ background: ID_CARD_BACKGROUND }}
            >
              {matchedPoliceLogo ? (
                <img src={matchedPoliceLogo} alt="BGR Police Logo" className="w-full h-full object-contain p-0.5" />
              ) : (
                <Shield size={20} className="text-[#0B1B3A]" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight text-white truncate">
                {t('ቢጂአር ፖሊስ', 'BGR Police')}
              </h1>
              <p className="text-[10px] font-bold text-[#E5C158] uppercase tracking-wider truncate">
                {t('የመታወቂያ ሲስተም', 'ID Registry')}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          <NavButton
            active={view === 'dashboard'}
            onClick={() => navigateTo('dashboard')}
            icon={<Shield size={18} />}
            label={t('ዳሽቦርድ', 'Dashboard')}
          />
          {(user?.role === 'Administrator' || user?.role === 'Data Entry') && (
            <NavButton
              active={view === 'create'}
              onClick={() => {
                const hasData = formData.full_name_am || formData.full_name_en || formData.phone || formData.fayda_number || formData.photo_url;
                if (hasData && !formData.id && view !== 'create') {
                  if (confirm(t('ያልተቀመጠ መረጃ አለ። አዲስ መመዝገብ ይፈልጋሉ?', 'Unsaved form data found. Start a fresh ID form?'))) {
                    setFormData(emptyForm);
                  }
                }
                navigateTo('create');
              }}
              icon={<Plus size={18} />}
              label={t('አዲስ መታወቂያ', 'Prepare New ID')}
            />
          )}
          <NavButton
            active={view === 'history'}
            onClick={() => navigateTo('history')}
            icon={<History size={18} />}
            label={t('መዝገቦች እና ማጽደቂያ', 'ID Records')}
            badge={pendingReviewCount > 0 ? pendingReviewCount : undefined}
          />
          {user?.role === 'Administrator' && (
            <>
              <NavButton
                active={view === 'maintenance'}
                onClick={() => navigateTo('maintenance')}
                icon={<DbIcon size={18} />}
                label={t('የሲስተም ጥገና', 'Maintenance')}
              />
              <NavButton
                active={view === 'users'}
                onClick={() => navigateTo('users')}
                icon={<User size={18} />}
                label={t('ተጠቃሚዎች', 'Users & Roles')}
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-white/10 bg-[#08142B] space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#162C59] border border-white/15 flex items-center justify-center text-[#E5C158] font-bold text-sm shrink-0">
              {(user?.username || user?.email || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{user?.username || user?.email}</p>
              <p className="text-[10px] font-semibold text-slate-300 truncate">{roleLabel(user?.role)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-xl bg-white/8 hover:bg-red-600/90 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut size={15} />
            {t('ከሲስተም ውጣ', 'Sign Out')}
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden shrink-0"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>

            {view !== 'dashboard' && (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer border border-slate-200"
              >
                <ArrowLeft size={14} />
                {t('ተመለስ', 'Back')}
              </button>
            )}

            <div className="flex items-center gap-2 min-w-0 text-sm">
              <span className="hidden sm:inline text-slate-700 font-black truncate">
                {t('ቢጂአር ፖሊስ ኮሚሽን', 'BGR Police')}
              </span>
              <ChevronRight size={14} className="hidden sm:inline text-slate-400 shrink-0" />
              <span className="font-black text-[#0B1B3A] truncate">{viewTitleMap[view]}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder={t('ስም፣ መታወቂያ፣ ፋይዳ ወይም ስልክ...', 'Search name, ID, Fayda, phone...')}
                className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-[#1E40AF] focus:ring-2 focus:ring-blue-500/20 w-56 xl:w-64 outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Language Switcher */}
            <div className="inline-flex items-center bg-slate-100 border border-slate-200 p-0.5 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => changeLang('am')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  lang === 'am' ? 'bg-[#0B1B3A] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                አማ
              </button>
              <button
                type="button"
                onClick={() => changeLang('en')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  lang === 'en' ? 'bg-[#0B1B3A] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
            </div>

            {(user?.role === 'Administrator' || user?.role === 'Data Entry') && view !== 'create' && (
              <button
                type="button"
                onClick={() => {
                  setFormData(emptyForm);
                  navigateTo('create');
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-xl text-xs font-bold shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus size={15} />
                {t('አዲስ መታወቂያ', 'New ID')}
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              {/* Executive Hero Banner */}
              <div className="bg-[#0B1B3A] text-white rounded-2xl border border-slate-800 p-6 sm:p-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 flex">
                  <div className="flex-1 bg-[#009a44]" />
                  <div className="flex-1 bg-[#fedd00]" />
                  <div className="flex-1 bg-[#ef3340]" />
                </div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                    <div
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-[#C89B2B] shadow-lg flex items-center justify-center overflow-hidden shrink-0"
                      style={{ background: ID_CARD_BACKGROUND }}
                    >
                      {matchedPoliceLogo ? (
                        <img src={matchedPoliceLogo} alt="BGR Police Commission Logo" className="w-full h-full object-contain p-1.5" />
                      ) : (
                        <Shield size={42} className="text-[#0B1B3A]" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/10 border border-white/15 text-[#E5C158] text-[11px] font-extrabold uppercase tracking-wider">
                        {t('ይፋዊ የመታወቂያ መመዝገቢያ ፖርታል', 'Official ID Issuance & Verification Portal')}
                      </span>
                      <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
                        {t('ቤንሻንጉል ጉሙዝ ክልል ፖሊስ ኮሚሽን', 'Benishangul-Gumuz Region Police Commission')}
                      </h2>
                      <p className="text-xs sm:text-sm font-semibold text-slate-200 max-w-2xl">
                        {t(
                          'አዘጋጁ መታወቂያውን ካዘጋጀ በኋላ ለአጽዳቂ ይልካል። አጽዳቂው ሲያጸድቀው በፋየርስቶር ተመዝግቦ ፕሪንትና QR ስካን ይከፈታል።',
                          'Preparers submit new IDs to the Approver. Printing and QR scanning remain strictly locked until official approval registers the card in Firestore.'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
                    {(user?.role === 'Administrator' || user?.role === 'Data Entry') && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(emptyForm);
                          navigateTo('create');
                        }}
                        className="px-4 py-2.5 bg-[#C89B2B] hover:bg-[#B4881F] text-[#0B1B3A] rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
                      >
                        <Plus size={16} />
                        {t('አዲስ መታወቂያ አዘጋጅ', 'Prepare New ID')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigateTo('history')}
                      className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <History size={16} />
                      {t('መዝገቦችን ክፈት', 'Open Registry')}
                    </button>
                  </div>
                </div>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title={t('ጠቅላላ መታወቂያዎች', 'Total IDs')}
                  value={records.length}
                  icon={<User size={20} className="text-[#1E40AF]" />}
                  tone="blue"
                />
                <StatCard
                  title={t('ማጽደቅ የሚጠብቁ', 'Pending Approval')}
                  value={pendingCount}
                  icon={<RefreshCw size={20} className="text-amber-600" />}
                  tone="amber"
                />
                <StatCard
                  title={t('ማስተካከያ የሚፈልጉ', 'Needs Correction')}
                  value={needsCorrectionCount}
                  icon={<AlertTriangle size={20} className="text-orange-600" />}
                  tone="orange"
                />
                <StatCard
                  title={t('የጸደቁ እና የተመዘገቡ', 'Approved & Registered')}
                  value={approvedCount}
                  icon={<CheckCircle2 size={20} className="text-emerald-600" />}
                  tone="emerald"
                />
              </div>

              {/* Workflow Status Summary Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                    <Lock size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-950">
                      {t('የደህንነት ህግ፡ ያልጸደቀ መታወቂያ አይታተምም እና ስካን አይሆንም', 'Security Rule: Unapproved IDs Cannot Be Printed or Scanned')}
                    </h3>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5 leading-relaxed">
                      {t(
                        'አዘጋጁ መረጃውን አስገብቶ ለአጽዳቂው ይልካል። አጽዳቂው "አጽድቅ" ሲል መታወቂያው በሲስተሙ ይመዘገባል፤ ፕሪንት ማድረግ እና QR ስካን ወዲያውኑ ይሰራል።',
                        'Once submitted by Data Entry, the Approver reviews and approves the record to register it in Firestore and unlock printing and live QR verification.'
                      )}
                    </p>
                  </div>
                </div>
                {isApproverOrAdmin && pendingReviewCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('pending');
                      navigateTo('history');
                    }}
                    className="px-4 py-2 bg-[#0B1B3A] hover:bg-[#142952] text-white rounded-xl text-xs font-extrabold transition-all whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {t(`በጥበቃ ላይ ያሉትን እይ (${pendingReviewCount})`, `Review Queue (${pendingReviewCount})`)}
                  </button>
                )}
              </div>

              {user?.role === 'Administrator' ? (
                <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-xs border border-slate-200 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-950 flex items-center gap-2">
                        <Camera size={20} className="text-[#1E40AF]" />
                        {t('የፖሊስ ኮሚሽኑ ሎጎ እና የሲስተም ፋይሎች (Admin Assets)', 'Commission Logo & System Assets (Admin)')}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {t(
                          'እዚህ የሚያስገቡት የፖሊስ ኮሚሽኑ ሎጎ በመግቢያ ገፅ፣ በዳሽቦርድ እና በሁሉም መታወቂያዎች ላይ በቋሚነት ይቀመጣል።',
                          'The uploaded commission logo is persisted in Firestore and displayed on Login, Dashboard, Verification, and all ID cards.'
                        )}
                      </p>
                    </div>
                    {assets.police_logo && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3.5 py-2 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-xs font-bold transition-all flex items-center gap-2 self-start whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Trash2 size={14} />
                        {t('ሎጎ አስወግድ', 'Remove Logo')}
                      </button>
                    )}
                  </div>

                  {logoSuccessMsg && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                      <Check size={16} className="text-emerald-600 shrink-0" />
                      <span>{logoSuccessMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 relative">
                      <AssetUpload
                        label={t('የፖሊስ ኮሚሽኑ ይፋዊ ሎጎ', 'Official Police Logo')}
                        changeLabel={t('ፋይሉን ቀይር', 'Change File')}
                        image={matchedPoliceLogo || assets.police_logo}
                        previewBg={ID_CARD_BACKGROUND}
                        onUpload={(e) => handleAssetUpload('police_logo', e)}
                      />
                      {logoUploading && (
                        <div className="mt-2 flex items-center gap-2 text-xs font-bold text-[#1E40AF]">
                          <Loader2 size={14} className="animate-spin" />
                          {t('በመጫን ላይ...', 'Uploading...')}
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200">
                      <AssetUpload
                        label={t('የቢጂአር ሰንደቅ አላማ', 'BGR Flag')}
                        changeLabel={t('ፋይሉን ቀይር', 'Change File')}
                        image={assets.bgr_flag}
                        onUpload={(e) => handleAssetUpload('bgr_flag', e)}
                      />
                    </div>
                    <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200">
                      <AssetUpload
                        label={t('የኢትዮጵያ ሰንደቅ አላማ', 'Ethiopia Flag')}
                        changeLabel={t('ፋይሉን ቀይር', 'Change File')}
                        image={assets.eth_flag}
                        onUpload={(e) => handleAssetUpload('eth_flag', e)}
                      />
                    </div>
                    <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200">
                      <AssetUpload
                        label={t('የኮሚሽነሩ ፊርማ', 'Commissioner Signature')}
                        changeLabel={t('ፋይሉን ቀይር', 'Change File')}
                        image={assets.commissioner_signature}
                        onUpload={(e) => handleAssetUpload('commissioner_signature', e)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-[#C89B2B]"
                    style={{ background: ID_CARD_BACKGROUND }}
                  >
                    {matchedPoliceLogo ? (
                      <img src={matchedPoliceLogo} alt="Police Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Shield className="text-[#0B1B3A]" size={22} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-950">
                      {t('ቤንሻንጉል ጉሙዝ ክልል ፖሊስ ኮሚሽን ይፋዊ ሲስተም', 'Benishangul-Gumuz Region Police Commission Official System')}
                    </h4>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">
                      {t('የመታወቂያ ዝግጅት፣ ማረጋገጫ እና የማጽደቅ ሂደት በዚህ ዳሽቦርድ ይከናወናል።', 'ID card preparation, verification, and approval workflow are managed here.')}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="max-w-4xl mx-auto space-y-4"
            >
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
                <div className="px-6 py-5 sm:px-8 sm:py-6 bg-[#0B1B3A] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={goBack}
                      className="mt-0.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ArrowLeft size={14} />
                      {t('ተመለስ', 'Back')}
                    </button>
                    <div>
                      <h2 className="text-lg sm:text-xl font-extrabold">
                        {formData.id ? t('የአባል መረጃ አርትዕ', 'Edit Member ID Record') : t('አዲስ የአባል መታወቂያ አዘጋጅተህ ለአጽዳቂ ላክ', 'Prepare Member ID & Submit to Approver')}
                      </h2>
                      <p className="text-slate-300 text-xs mt-0.5">
                        {formData.id
                          ? t('የአባሉን መረጃ እዚህ ያሻሽሉ።', 'Update the member details below.')
                          : t('መረጃዎችን በትክክል ያስገቡ፤ ሲያስቀምጡ ለአጽዳቂው በቀጥታ ይላካል።', 'Complete member fields accurately. Submitting sends this ID to the Approver queue.')}
                      </p>
                      {localStorage.getItem('id_form_draft') && !formData.id && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white/10 border border-white/15 rounded-md text-[10px] font-bold uppercase tracking-wider text-[#E5C158]">
                          <DbIcon size={11} />
                          {t('ረቂቅ መረጃ ተገኝቷል', 'Draft Loaded')}
                        </div>
                      )}
                    </div>
                  </div>
                  {(!formData.id && (formData.full_name_am || formData.full_name_en || formData.phone || formData.fayda_number || formData.photo_url)) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t('ፎርሙን ማጽዳት ይፈልጋሉ?', 'Clear all entered form fields?'))) {
                          setFormData(emptyForm);
                          localStorage.removeItem('id_form_draft');
                        }
                      }}
                      className="px-3.5 py-2 bg-white/10 hover:bg-red-500/80 border border-white/15 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-center"
                    >
                      <Trash2 size={14} />
                      {t('ፎርሙን አጽዳ', 'Clear Form')}
                    </button>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
                  {formData.id && (formData.status === 'needs_correction' || formData.correction_note) && (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                      <div>
                        <p className="text-sm font-bold text-amber-900">
                          {t('ከአጽዳቂው የተላከ የማስተካከያ መመሪያ', 'Approver Correction Note')}
                        </p>
                        <p className="text-sm text-amber-800 mt-1 font-medium">
                          {formData.correction_note || t('እባክዎ መረጃውን በድጋሚ አረጋግጠው ያስተካክሉ።', 'Please review and correct the flagged details.')}
                        </p>
                        <p className="text-[11px] text-amber-700 mt-1">
                          {t('መረጃውን ካስተካከሉ በኋላ ከታች ያለውን በተን ሲጫኑ ለአጽዳቂው በድጋሚ ይላካል።', 'Saving updates will resubmit this record to the Approver queue.')}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <FormInput label={t('ሙሉ ስም (በአማርኛ)', 'Full Name (Amharic)')} value={formData.full_name_am} onChange={(v) => setFormData((prev) => ({...prev, full_name_am: v}))} placeholder={t('ሙሉ ስም በአማርኛ', 'Full name in Amharic')} icon={<User size={17}/>} />
                      <FormInput label={t('ሙሉ ስም (በእንግሊዝኛ)', 'Full Name (English)')} value={formData.full_name_en} onChange={(v) => setFormData((prev) => ({...prev, full_name_en: v}))} placeholder="Full Name" icon={<User size={17}/>} />
                      <div className="grid grid-cols-2 gap-3">
                        <FormInput label={t('ማዕረግ (አማርኛ)', 'Rank (Amharic)')} value={formData.rank_am} onChange={(v) => setFormData((prev) => ({...prev, rank_am: v}))} placeholder={t('ማዕረግ', 'Rank AM')} icon={<Award size={17}/>} />
                        <FormInput label={t('ማዕረግ (እንግሊዝኛ)', 'Rank (English)')} value={formData.rank_en} onChange={(v) => setFormData((prev) => ({...prev, rank_en: v}))} placeholder="Rank" icon={<Award size={17}/>} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormInput label={t('ኃላፊነት (አማርኛ)', 'Responsibility (AM)')} value={formData.responsibility_am} onChange={(v) => setFormData((prev) => ({...prev, responsibility_am: v}))} placeholder={t('ኃላፊነት', 'Role AM')} icon={<Briefcase size={17}/>} />
                        <FormInput label={t('ኃላፊነት (እንግሊዝኛ)', 'Responsibility (EN)')} value={formData.responsibility_en} onChange={(v) => setFormData((prev) => ({...prev, responsibility_en: v}))} placeholder="Responsibility" icon={<Briefcase size={17}/>} />
                      </div>
                      <FormInput label={t('ስልክ ቁጥር', 'Phone Number')} value={formData.phone} onChange={(v) => setFormData((prev) => ({...prev, phone: v}))} placeholder="+251..." icon={<Phone size={17}/>} />
                      <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-wider">
                            {t('ፋይዳ መለያ ቁጥር (በመታወቂያው ፊትና ጀርባ ላይ ይገባል)', 'Fayda FIN (Appears on Front & Back ID)')}
                          </span>
                          {getFaydaValue(formData) && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black font-mono">
                              {t('ተገናኝቷል', 'Synced')}
                            </span>
                          )}
                        </div>
                        <FormInput label={t('የፋይዳ ቁጥር (FIN)', 'Fayda Number (FIN)')} value={formData.fayda_number} onChange={(v) => setFormData((prev) => ({...prev, fayda_number: v}))} placeholder={t('የፋይዳ መለያ ቁጥር ያስገቡ (ለምሳሌ 1234 5678 9012)', 'Enter Fayda FIN number')} icon={<CreditCard size={17}/>} />
                      </div>

                      <div className="pt-4 border-t border-slate-200">
                        <h4 className="text-xs font-extrabold text-[#B45309] uppercase tracking-wider mb-3">
                          {t('የፊት ለፊት መረጃዎች እና ቀናት', 'Front Card Details & Validity Dates')}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <FormInput label={t('የደም ዓይነት', 'Blood Type')} value={formData.blood_type} onChange={(v) => setFormData((prev) => ({...prev, blood_type: v}))} placeholder="A+, B-, O+" icon={<Check size={17}/>} />
                          <FormInput label={t('የመለያ ቁጥር (Badge)', 'Badge Number')} value={formData.badge_number} onChange={(v) => setFormData((prev) => ({...prev, badge_number: v}))} placeholder={t('መለያ ቁጥር', 'Badge No.')} icon={<Shield size={17}/>} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-extrabold text-[#1E3A8A] ml-0.5">{t('የተሰጠበት ቀን', 'Issued Date')}</label>
                            <input
                              type="date"
                              value={formData.issued_at}
                              onChange={(e) => setFormData((prev) => ({...prev, issued_at: e.target.value}))}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#065F46] font-bold focus:bg-white focus:border-[#047857] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all tabular-nums"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-extrabold text-[#9F1239] ml-0.5">{t('የሚያበቃበት ቀን', 'Expiry Date')}</label>
                            <input
                              type="date"
                              value={formData.expires_at}
                              onChange={(e) => setFormData((prev) => ({...prev, expires_at: e.target.value}))}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#B91C1C] font-bold focus:bg-white focus:border-[#DC2626] focus:ring-2 focus:ring-red-500/20 outline-none transition-all tabular-nums"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200">
                        <h4 className="text-xs font-extrabold text-[#B45309] uppercase tracking-wider mb-3">
                          {t('የጀርባ ገጽ መረጃዎች', 'Back Card Physical & Emergency Info')}
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                          <FormInput label={t('ጾታ', 'Gender')} value={formData.gender} onChange={(v) => setFormData((prev) => ({...prev, gender: v}))} placeholder={t('ወ / ሴ', 'M / F')} icon={<User size={16}/>} />
                          <FormInput label={t('መልክ', 'Complexion')} value={formData.complexion} onChange={(v) => setFormData((prev) => ({...prev, complexion: v}))} placeholder={t('ጠይም...', 'Complexion')} icon={<Eye size={16}/>} />
                          <FormInput label={t('ቁመት', 'Height')} value={formData.height} onChange={(v) => setFormData((prev) => ({...prev, height: v}))} placeholder="1.75m" icon={<Plus size={16}/>} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <FormInput label={t('የአደጋ ጊዜ ተጠሪ ስም', 'Emergency Contact')} value={formData.emergency_contact_name} onChange={(v) => setFormData((prev) => ({...prev, emergency_contact_name: v}))} placeholder={t('ስም', 'Contact Name')} icon={<User size={16}/>} />
                          <FormInput label={t('የአደጋ ጊዜ ተጠሪ ስልክ', 'Emergency Phone')} value={formData.emergency_contact_phone} onChange={(v) => setFormData((prev) => ({...prev, emergency_contact_phone: v}))} placeholder="+251..." icon={<Phone size={16}/>} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col items-center justify-center p-5 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <p className="text-xs font-extrabold text-[#1E3A8A] mb-3">{t('የአባሉ ፎቶ (Member Photo)', 'Member Photo')}</p>
                        <div className="w-40 h-52 bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 relative group">
                          {formData.photo_url ? (
                            <img src={formData.photo_url} className="w-full h-full object-cover" alt="Preview" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2 p-2 text-center">
                              <Camera size={28} />
                              <span className="text-[11px] font-medium">{t('ፎቶ ይጫኑ ወይም ያንሱ', 'Upload or Capture Photo')}</span>
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

                      <div className="flex flex-col items-center justify-center p-5 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <p className="text-xs font-extrabold text-[#1E3A8A] mb-3">{t('የአባሉ ፊርማ', "Member's Signature")}</p>
                        <div className="w-full h-24 bg-white rounded-xl shadow-xs overflow-hidden border border-slate-200 relative group flex items-center justify-center">
                          {formData.member_signature ? (
                            <img src={formData.member_signature} className="h-full object-contain" alt="Member Signature Preview" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
                              <Camera size={22} />
                              <span className="text-[11px] font-medium">{t('ፊርማ ይጫኑ', 'Upload Signature')}</span>
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
                                const base64 = await resizeImage(reader.result as string, 360, 180, true);
                                setFormData((prev) => ({ ...prev, member_signature: base64 }));
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center p-5 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <p className="text-xs font-extrabold text-[#B45309] mb-3">{t('የኮሚሽነሩ ፊርማ', 'Commissioner Signature')}</p>
                        <div className="w-full h-24 bg-white rounded-xl shadow-xs overflow-hidden border border-slate-200 relative group flex items-center justify-center">
                          {formData.commissioner_signature ? (
                            <img src={formData.commissioner_signature} className="h-full object-contain" alt="Signature Preview" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
                              <Camera size={22} />
                              <span className="text-[11px] font-medium">{t('ፊርማ ይጫኑ', 'Upload Signature')}</span>
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
                                const base64 = await resizeImage(reader.result as string, 360, 180, true);
                                setFormData((prev) => ({ ...prev, commissioner_signature: base64 }));
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </div>
                      </div>

                      {/* Live ID Card Preview synced directly with the form */}
                      <div className="p-4 bg-[#F4F6FA] rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-[#0B1B3A]">
                            {t('የመታወቂያ ቀጥታ እይታ', 'Live ID Card Preview')}
                          </span>
                          <div className="inline-flex bg-white border border-slate-200 p-0.5 rounded-lg">
                            <button
                              type="button"
                              onClick={() => setCreatePreviewSide('front')}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-black cursor-pointer transition-all ${
                                createPreviewSide === 'front' ? 'bg-[#0B1B3A] text-white' : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {t('የፊት ገፅ', 'Front')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setCreatePreviewSide('back')}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-black cursor-pointer transition-all ${
                                createPreviewSide === 'back' ? 'bg-[#0B1B3A] text-white' : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {t('የጀርባ ገፅ', 'Back')}
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-center overflow-x-auto py-1">
                          <div className="origin-top shadow-lg rounded-[3.18mm]">
                            {createPreviewSide === 'front' ? (
                              <IDCardFront
                                data={{
                                  ...formData,
                                  id: formData.id || 'preview',
                                  id_number: formData.id_number || 'BGR-POL-1600001',
                                  commissioner_signature: formData.commissioner_signature || assets.commissioner_signature || '',
                                  status: (formData.status as any) || 'pending',
                                }}
                                assets={assets}
                              />
                            ) : (
                              <IDCardBack
                                data={{
                                  ...formData,
                                  id: formData.id || 'preview',
                                  id_number: formData.id_number || 'BGR-POL-1600001',
                                  commissioner_signature: formData.commissioner_signature || assets.commissioner_signature || '',
                                  status: (formData.status as any) || 'pending',
                                }}
                                assets={assets}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={goBack}
                      className="px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all flex items-center gap-2 text-sm whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ArrowLeft size={16} />
                      {t('ተመለስ / ይቅር', 'Back / Cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={loading || translating}
                      className="px-6 py-2.5 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 text-sm disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {(loading || translating) ? <Loader2 className="animate-spin" size={17} /> : <Send size={16} />}
                      {translating
                        ? t('እየተተረጎመ...', 'Translating...')
                        : formData.id
                        ? (user?.role === 'Data Entry' || formData.status === 'needs_correction'
                          ? t('አስተካክለህ ለአጽዳቂ ላክ', 'Fix & Resubmit to Approver')
                          : t('መረጃ አሻሽል', 'Save Changes'))
                        : t('አዘጋጅተህ ለአጽዳቂ ላክ', 'Prepare & Send to Approver')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'maintenance' && (
            <motion.div
              key="maintenance"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">{t('የሲስተም ጥገና', 'System Maintenance')}</h2>
                  <p className="text-sm font-semibold text-slate-600">{t('የሲስተም ፋይሎችን እና ደህንነትን ይቆጣጠሩ', 'Manage system storage, database status, and official signature assets')}</p>
                </div>
                <button
                  type="button"
                  onClick={goBack}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowLeft size={15} />
                  {t('ተመለስ', 'Back')}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                    <DbIcon size={18} className="text-[#1E40AF]" />
                    <h3 className="font-black text-slate-950">{t('የመረጃ ማስቀመጫ', 'Database Storage')}</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500 font-medium">{t('የመረጃ ቋት ዓይነት', 'Database Engine')}</span>
                      <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                        Firebase Firestore
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500 font-medium">{t('የመረጃ ቆይታ', 'Persistence')}</span>
                      <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                        {t('ቋሚ (Permanent)', 'Permanent')}
                      </span>
                    </div>
                    <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200">
                      <p className="text-xs text-blue-900 leading-relaxed">
                        {t(
                          'ሁሉም የጸደቁ መታወቂያዎች እና የሲስተም ፋይሎች በቀጥታ በፋየርስቶር (Firestore) ውስጥ በቋሚነት ይመዘገባሉ።',
                          'All approved ID cards, user accounts, and system logo assets are permanently stored in Firebase Firestore.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                    <Award size={18} className="text-[#1E40AF]" />
                    <h3 className="font-black text-slate-950">{t('የሲስተም ፋይሎች', 'Official Signature Asset')}</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('የኮሚሽነሩ ፊርማ', 'Commissioner Signature')}</label>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-24 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                          {assets.commissioner_signature ? (
                            <img src={assets.commissioner_signature} className="h-full object-contain" alt="Signature" />
                          ) : (
                            <span className="text-xs font-semibold text-slate-600">{t('ምንም ፊርማ አልተጫነም', 'No signature uploaded')}</span>
                          )}
                        </div>
                        <label className="px-4 py-2.5 bg-[#0B1B3A] hover:bg-[#142952] text-white rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap shrink-0">
                          {t('ጫን', 'Upload')}
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    {t('ተመለስ', 'Back')}
                  </button>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-950">
                      {t('የአባላት መታወቂያ መዝገብ እና ማጽደቂያ', 'Member ID Registry & Approval Queue')}
                    </h2>
                    <p className="text-xs font-semibold text-slate-600">
                      {t('ያልጸደቁ መታወቂያዎች ፕሪንት አይሆኑም እንዲሁም QR ስካን አይሰሩም።', 'Only approved & registered IDs can be printed or scanned.')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                  <div className="relative flex-1 sm:flex-none md:hidden">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder={t('ፈልግ...', 'Search...')}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap bg-white border border-slate-200 p-1 rounded-xl gap-1">
                    {(['all', 'pending', 'needs_correction', 'approved', 'rejected'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          statusFilter === s
                            ? 'bg-[#0B1B3A] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {s === 'all'
                          ? t('ሁሉም', 'All')
                          : s === 'pending'
                          ? t('በጥበቃ', 'Pending')
                          : s === 'needs_correction'
                          ? t('ማስተካከያ', 'Correction')
                          : s === 'approved'
                          ? t('የጸደቁ', 'Approved')
                          : t('ውድቅ', 'Rejected')}
                      </button>
                    ))}
                  </div>
                  {(isApproverOrAdmin || user?.role === 'Data Entry') && (
                    <button
                      type="button"
                      onClick={fetchPrintLogs}
                      disabled={loadingPrintLogs}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <Printer size={15} className="text-[#1E40AF]" />
                      {t('የፕሪንት መዝገብ', 'Print Logs')}
                    </button>
                  )}
                  {(user?.role === 'Administrator' || user?.role === 'Data Entry') && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(emptyForm);
                        navigateTo('create');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-xl text-xs font-bold shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus size={16} />
                      {t('አዲስ አባል', 'New Member ID')}
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-5 py-3.5 text-[11px] font-black text-slate-700 uppercase tracking-wider">{t('አባል', 'Member')}</th>
                      <th className="px-5 py-3.5 text-[11px] font-black text-slate-700 uppercase tracking-wider">{t('መታወቂያ / ፋይዳ', 'ID / Fayda')}</th>
                      <th className="px-5 py-3.5 text-[11px] font-black text-slate-700 uppercase tracking-wider">{t('ማዕረግ እና ኃላፊነት', 'Rank & Role')}</th>
                      <th className="px-5 py-3.5 text-[11px] font-black text-slate-700 uppercase tracking-wider">{t('ሁኔታ', 'Status')}</th>
                      <th className="px-5 py-3.5 text-[11px] font-black text-slate-700 uppercase tracking-wider text-right">{t('ተግባራት', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                          {t('ምንም የተገኘ የመታወቂያ መዝገብ የለም።', 'No ID records match the current filter.')}
                        </td>
                      </tr>
                    ) : records.map((record) => {
                      const isApproved = record.status === 'approved' && !record.deleted;
                      const canPrintRow = isApproved && (isApproverOrAdmin || user?.role === 'Data Entry');
                      return (
                      <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <img src={record.photo_url || 'https://picsum.photos/seed/police/80/80'} className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" alt="" />
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-950 truncate">{record.full_name_am}</p>
                              <p className="text-xs font-bold text-slate-600 uppercase truncate">{record.full_name_en}</p>
                              {record.created_by_email && (
                                <p className="text-[11px] text-slate-600 font-semibold truncate">
                                  {t('አዘጋጅ፡', 'By:')} {record.created_by_email}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRecord(record);
                                setShowPreview(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-[#881337] via-[#991b1b] to-[#3b0764] hover:from-[#9f1239] hover:via-[#b91c1c] hover:to-[#4c1d95] text-[#FEF9C3] border border-[#F59E0B] rounded-full text-xs font-black font-mono tabular-nums w-fit shadow-xs hover:shadow-sm transition-all cursor-pointer"
                              title={t('መታወቂያውን ለማየት ይጫኑ', 'Click to preview ID card')}
                            >
                              <span className="w-1.5 h-1.5 rotate-45 bg-[#FBBF24] shrink-0" />
                              {record.id_number}
                            </button>
                            {record.fayda_number && (
                              <span className="px-2.5 py-0.5 bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-300 text-[#0B1B3A] rounded-full text-[10px] font-black font-mono tabular-nums w-fit">
                                FIN: {record.fayda_number}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-extrabold text-slate-900">{record.rank_am}</p>
                          <p className="text-xs font-semibold text-slate-600">{record.responsibility_en || record.responsibility_am}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1.5">
                            {isApproved ? (
                              <div className="flex flex-col gap-1">
                                <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[11px] font-bold flex items-center gap-1 w-fit whitespace-nowrap">
                                  <CheckCircle2 size={12} /> {t('ጸድቋል · ተመዝግቧል', 'Approved & Registered')}
                                </span>
                                {record.approved_by && (
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {t('አጽዳቂ፡', 'Approved by:')} {record.approved_by}
                                  </span>
                                )}
                              </div>
                            ) : record.status === 'needs_correction' ? (
                              <span className="px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-[11px] font-bold flex items-center gap-1 w-fit whitespace-nowrap">
                                <AlertTriangle size={12} /> {t('ማስተካከያ ይፈልጋል', 'Needs Correction')}
                              </span>
                            ) : record.status === 'rejected' ? (
                              <span className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 rounded-lg text-[11px] font-bold flex items-center gap-1 w-fit whitespace-nowrap">
                                <X size={12} /> {t('ውድቅ ተደርጓል', 'Rejected')}
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px] font-bold flex items-center gap-1 w-fit whitespace-nowrap">
                                  <Lock size={11} /> {t('ማጽደቅ በመጠባበቅ ላይ', 'Pending Approval')}
                                </span>
                                {record.resubmitted && (
                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold w-fit whitespace-nowrap">
                                    {t('ተስተካክሎ የቀረበ', 'Resubmitted')}
                                  </span>
                                )}
                              </div>
                            )}
                            {record.correction_note && (
                              <p className="text-[11px] text-orange-800 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg max-w-[240px] leading-snug">
                                <span className="font-bold">{t('ማስታወሻ፡', 'Note:')}</span> {record.correction_note}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end items-center gap-1.5 flex-wrap">
                            {isApproverOrAdmin && (record.status === 'pending' || record.status === 'needs_correction') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveRecord(record)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all flex items-center gap-1 text-xs font-bold whitespace-nowrap cursor-pointer shadow-xs"
                                  title={t('አጽድቅ እና መዝግብ', 'Approve & Register')}
                                >
                                  <Check size={14} />
                                  <span>{t('አጽድቅ', 'Approve')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCorrectionModalRecord(record);
                                    setCorrectionNoteInput(record.correction_note || '');
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 rounded-lg transition-all flex items-center gap-1 text-xs font-bold whitespace-nowrap cursor-pointer"
                                  title={t('ስህተት ገልጸህ መልስ', 'Return for Correction')}
                                >
                                  <RotateCcw size={14} />
                                  <span className="hidden xl:inline">{t('መልስ', 'Return')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectRecord(record)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition-all cursor-pointer"
                                  title={t('ውድቅ አድርግ', 'Reject')}
                                >
                                  <X size={16} />
                                </button>
                              </>
                            )}
                            {(isApproverOrAdmin || (user?.role === 'Data Entry' && record.status !== 'approved')) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData({
                                    ...emptyForm,
                                    ...record,
                                    id: record.id,
                                    fayda_number: getFaydaValue(record),
                                    member_signature: record.member_signature || '',
                                    issued_at: record.issued_at || new Date().toISOString().split('T')[0],
                                    expires_at: record.expires_at || new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
                                    id_number: record.id_number || '',
                                    status: record.status || '',
                                    correction_note: record.correction_note || ''
                                  });
                                  navigateTo('create');
                                }}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                  record.status === 'needs_correction' && user?.role === 'Data Entry'
                                    ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 px-2.5 flex items-center gap-1 text-xs font-bold whitespace-nowrap'
                                    : 'text-slate-500 hover:text-[#1E40AF] hover:bg-blue-50'
                                }`}
                                title={record.status === 'needs_correction' ? t('አስተካክለህ እንደገና ላክ', 'Fix & Resubmit') : t('መረጃ አርትዕ', 'Edit Record')}
                              >
                                <Edit size={15} />
                                {record.status === 'needs_correction' && user?.role === 'Data Entry' && (
                                  <span>{t('አስተካክል', 'Fix')}</span>
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => fetchScans(record.id_number)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                              title={t('የፍተሻ ታሪክ', 'Scan Logs')}
                            >
                              <History size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRecord(record);
                                setShowPreview(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-[#1E40AF] hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                              title={t('እይታ', 'Preview ID')}
                            >
                              <Eye size={15} />
                            </button>
                            {canPrintRow ? (
                              <button
                                type="button"
                                onClick={() => handlePrintSide('both', record)}
                                className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all cursor-pointer"
                                title={t('መታወቂያ አትም (Print Both Sides)', 'Print Official ID')}
                              >
                                <Printer size={15} />
                              </button>
                            ) : (
                              <span
                                className="p-1.5 text-slate-300 cursor-not-allowed inline-flex items-center"
                                title={t('አጽዳቂው እስኪያጸድቀው ማተም አይቻልም', 'Locked until approved & registered')}
                              >
                                <Lock size={15} />
                              </span>
                            )}
                            {user?.role === 'Administrator' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(record.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                title={t('መረጃ አጥፋ', 'Delete Record')}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
          {view === 'users' && user?.role === 'Administrator' && (
            <UserManagement
              currentUser={user}
              lang={lang}
              onBack={goBack}
              onCurrentUserUpdated={(updated) => {
                setUser((prev) => prev ? { ...prev, ...updated } : updated as User);
                const saved = localStorage.getItem('police_id_session');
                if (saved) {
                  try {
                    const parsed = JSON.parse(saved);
                    localStorage.setItem('police_id_session', JSON.stringify({ ...parsed, ...updated }));
                  } catch {}
                }
                if (auth.currentUser) {
                  const profilePayload: Record<string, any> = {
                    email: (updated.email || updated.username || '').toLowerCase(),
                    username: updated.username || updated.email || '',
                    role: updated.role || 'Administrator',
                    active: true,
                    last_login: new Date().toISOString()
                  };
                  const docId = updated.id || user?.id;
                  if (docId && docId !== 'superadmin-fallback' && auth.currentUser.isAnonymous) {
                    profilePayload.user_doc_id = docId;
                  }
                  setDoc(doc(db, 'profiles', auth.currentUser.uid), profilePayload, { merge: true }).catch(() => {});
                }
              }}
            />
          )}
        </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {showPreview && selectedRecord && (() => {
          const liveSelectedRecord = allRecords.find((r) => r.id === selectedRecord.id) || selectedRecord;
          return (
          <PreviewModal
            record={liveSelectedRecord}
            assets={assets}
            lang={lang}
            onClose={() => setShowPreview(false)}
            onPrint={(side) => handlePrintSide(side, liveSelectedRecord)}
            onDownload={(side) => handleDownload(liveSelectedRecord.id_number, side, liveSelectedRecord)}
            onEdit={() => {
              setFormData({
                ...emptyForm,
                ...liveSelectedRecord,
                id: liveSelectedRecord.id,
                fayda_number: getFaydaValue(liveSelectedRecord),
                member_signature: liveSelectedRecord.member_signature || '',
                issued_at: liveSelectedRecord.issued_at || new Date().toISOString().split('T')[0],
                expires_at: liveSelectedRecord.expires_at || new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
                id_number: liveSelectedRecord.id_number || '',
                status: liveSelectedRecord.status || '',
                correction_note: liveSelectedRecord.correction_note || ''
              });
              setShowPreview(false);
              navigateTo('create');
            }}
            onApprove={isApproverOrAdmin ? () => handleApproveRecord(liveSelectedRecord) : undefined}
            onRequestCorrection={isApproverOrAdmin ? () => {
              setCorrectionModalRecord(liveSelectedRecord);
              setCorrectionNoteInput(liveSelectedRecord.correction_note || '');
            } : undefined}
            user={user}
          />
          );
        })()}
      </AnimatePresence>

      {/* Correction Note Modal */}
      <AnimatePresence>
        {correctionModalRecord && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCorrectionModalRecord(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 bg-[#0B1B3A] text-white flex justify-between items-center border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold">{t('ስህተቱን ገልጸህ ለማስተካከያ መልስ', 'Return ID for Correction')}</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {correctionModalRecord.full_name_am} ({correctionModalRecord.id_number})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCorrectionModalRecord(null)}
                  className="p-1.5 hover:bg-white/15 rounded-lg transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    {t('መስተካከል ያለበት ስህተት', 'Correction Reason')}
                  </label>
                  <textarea
                    rows={4}
                    value={correctionNoteInput}
                    onChange={(e) => setCorrectionNoteInput(e.target.value)}
                    placeholder={t(
                      'ምሳሌ፡ የስም ፊደል ስህተት አለበት ወይም የፋይዳ ቁጥር ትክክል አይደለም...',
                      'e.g., Name spelling mismatch or invalid Fayda number...'
                    )}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCorrectionModalRecord(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    {t('ተመለስ', 'Back')}
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const rec = correctionModalRecord;
                        setCorrectionModalRecord(null);
                        setShowPreview(false);
                        setFormData({
                          ...emptyForm,
                          ...rec,
                          id: rec.id,
                          fayda_number: getFaydaValue(rec),
                          member_signature: rec.member_signature || '',
                          issued_at: rec.issued_at || new Date().toISOString().split('T')[0],
                          expires_at: rec.expires_at || new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
                          id_number: rec.id_number || '',
                          status: rec.status || '',
                          correction_note: rec.correction_note || ''
                        });
                        navigateTo('create');
                      }}
                      className="py-2.5 px-3.5 bg-blue-50 border border-blue-200 text-[#1E40AF] hover:bg-blue-100 rounded-xl font-bold transition-all text-xs whitespace-nowrap cursor-pointer"
                    >
                      {t('እኔ አስተካክዬ ልመልስ', 'Edit Myself')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendBackForCorrection(correctionModalRecord, correctionNoteInput)}
                      className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer shadow-xs"
                    >
                      <RotateCcw size={14} />
                      {t('ስህተቱን ገልጸህ መልስ', 'Send Back')}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
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
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">{t('የማረጋገጫ ታሪክ', 'QR Scan & Verification Logs')}</h3>
                <button
                  type="button"
                  onClick={() => setShowScans(false)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  {t('ተመለስ', 'Back')}
                </button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {scanHistory.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-8">
                    {t('ምንም የተመዘገበ ፍተሻ የለም።', 'No verification scan logs recorded yet.')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {scanHistory.map((scan, idx) => {
                      const scanTime = scan.timestamp || scan.scanned_at;
                      const scanIp = scan.ip || scan.ip_address || 'Client-side';
                      return (
                        <div key={scan.id || idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex justify-between items-start mb-1.5 gap-2">
                            <span className="text-xs font-bold text-[#1E40AF] tabular-nums">
                              {isMounted && scanTime ? new Date(scanTime).toLocaleString() : '-'}
                            </span>
                            <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-600 font-mono">
                              {scanIp}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono break-all">{scan.user_agent}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Logs Modal */}
      <AnimatePresence>
        {showPrintLogs && (
          <div className="fixed inset-0 z-[115] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPrintLogs(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {t('የመታወቂያ ፕሪንት ታሪክ (Firestore Audit Log)', 'ID Card Print Audit Logs')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('የታተመበት ሰዓት፣ ያተመው ተጠቃሚ ኢሜይል እና የመታወቂያ ቁጥር', 'Recorded timestamp, printer email, and printed ID number')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrintLogs(false)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <ArrowLeft size={13} />
                  {t('ተመለስ', 'Back')}
                </button>
              </div>
              <div className="p-6 max-h-[65vh] overflow-y-auto">
                {printLogs.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-8">
                    {t('ምንም የተመዘገበ የፕሪንት ታሪክ የለም።', 'No ID print events have been logged yet.')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {printLogs.map((log, idx) => {
                      const tsDate = log.timestamp?.toDate
                        ? log.timestamp.toDate()
                        : log.timestamp
                        ? new Date(log.timestamp)
                        : null;
                      return (
                        <div key={log.id || idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-gradient-to-r from-[#881337] via-[#991b1b] to-[#3b0764] text-[#FEF9C3] border border-[#F59E0B] rounded-full text-xs font-black font-mono tabular-nums shadow-xs">
                                <span className="w-1.5 h-1.5 rotate-45 bg-[#FBBF24] shrink-0" />
                                {log.id_number}
                              </span>
                              <span className="text-xs font-bold text-slate-800">{log.user_email}</span>
                              {log.user_role && (
                                <span className="text-[11px] font-semibold text-slate-500">· {log.user_role}</span>
                              )}
                            </div>
                            {log.side && (
                              <p className="text-[11px] text-slate-500">
                                {t('የፕሪንት ገጽ፡', 'Layout:')} <span className="font-semibold uppercase">{log.side}</span>
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-bold text-[#1E40AF] tabular-nums shrink-0">
                            {tsDate ? tsDate.toLocaleString() : '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Off-screen Print Content (Full printable width for 1:1 ATM size on ANY printer) */}
      <div
        style={{ position: 'fixed', left: '-9999px', top: '0', width: '210mm', pointerEvents: 'none', zIndex: -1000 }}
        className="no-print"
        aria-hidden="true"
      >
        <div ref={printRef} className="print-container" style={{ margin: 0, padding: 0, backgroundColor: '#ffffff' }}>
          {selectedRecord && (
            <div style={{ margin: 0, padding: 0 }}>
              {printSide === 'combined' ? (
                /* Dedicated CR80 / PVC Card Printer Duplex Mode: Page 1 Front, Page 2 Back at exact 85.6mm x 53.98mm */
                <div style={{ display: 'flex', flexDirection: 'column', margin: 0, padding: 0 }}>
                  <div className="print-card print-card-duplex">
                    <IDCardFront data={selectedRecord} assets={assets} />
                  </div>
                  <div className="print-card print-card-duplex">
                    <IDCardBack data={selectedRecord} assets={assets} />
                  </div>
                </div>
              ) : printSide === 'both' ? (
                /* Universal Office / A4 / Letter / PDF Printer Mode: Front + Back Side-by-Side on ONE Sheet at exact ATM Size (85.6mm x 53.98mm) */
                <div style={{ padding: '2mm 0', backgroundColor: '#ffffff' }}>
                  <div style={{ fontSize: '8px', fontWeight: 700, color: '#334155', marginBottom: '2.5mm', fontFamily: 'sans-serif' }}>
                    BGR Police Commission · Official ATM / CR80 Size (85.6mm × 53.98mm) · {selectedRecord.id_number} · Scale: 100% (Actual Size)
                  </div>
                  <div className="print-sheet-both" style={{ display: 'flex', flexDirection: 'row', gap: '5mm', alignItems: 'flex-start' }}>
                    <div className="print-card-slot">
                      <div style={{ fontSize: '7.5px', fontWeight: 700, color: '#475569', marginBottom: '1.5mm', textTransform: 'uppercase' }}>
                        Front Side · የፊት ገፅ
                      </div>
                      <div className="print-card-cutframe">
                        <div className="print-card">
                          <IDCardFront data={selectedRecord} assets={assets} />
                        </div>
                      </div>
                    </div>
                    <div className="print-card-slot">
                      <div style={{ fontSize: '7.5px', fontWeight: 700, color: '#475569', marginBottom: '1.5mm', textTransform: 'uppercase' }}>
                        Back Side · የጀርባ ገፅ
                      </div>
                      <div className="print-card-cutframe">
                        <div className="print-card">
                          <IDCardBack data={selectedRecord} assets={assets} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Single Side Print (Front Only or Back Only) at exact 85.6mm x 53.98mm ATM size */
                <div style={{ padding: '2mm 0', backgroundColor: '#ffffff' }}>
                  <div className="print-card-cutframe">
                    <div className="print-card">
                      {printSide === 'front' ? (
                        <IDCardFront data={selectedRecord} assets={assets} />
                      ) : (
                        <IDCardBack data={selectedRecord} assets={assets} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-white/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-20 h-20 border-4 border-slate-200 border-t-[#0B1B3A] rounded-full animate-spin flex items-center justify-center" />
            <h3 className="text-xl font-bold text-slate-900 mt-6">{t('እየተዘጋጀ ነው...', 'Processing Request...')}</h3>
            <p className="text-slate-500 mt-1 text-sm font-medium">{t('እባክዎ ትንሽ ይጠብቁ።', 'Please wait a moment.')}</p>
            <button
              type="button"
              onClick={() => setLoading(false)}
              className="mt-8 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 cursor-pointer"
            >
              {t('ይቅር', 'Cancel')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Helper Components ---

function PreviewModal({
  record,
  assets,
  lang,
  onClose,
  onPrint,
  onDownload,
  onEdit,
  onApprove,
  onRequestCorrection,
  user
}: {
  record: IDRecord;
  assets: Assets;
  lang: LangMode;
  onClose: () => void;
  onPrint: (side: 'front' | 'back' | 'both' | 'combined') => void;
  onDownload: (side: 'front' | 'back' | 'both' | 'combined') => void;
  onEdit: () => void;
  onApprove?: () => void;
  onRequestCorrection?: () => void;
  user: User | null;
}) {
  const t = (am: string, en: string) => (lang === 'am' ? am : en);
  const [activeTab, setActiveTab] = useState<'front' | 'back' | 'both' | 'combined'>('both');
  const isApproverOrAdmin = user?.role === 'Administrator' || user?.role === 'Approver';
  const isApproved = record.status === 'approved' && !record.deleted;
  const canPrint = isApproved && (isApproverOrAdmin || user?.role === 'Data Entry');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh]"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft size={14} />
              {t('ተመለስ', 'Back')}
            </button>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-950 truncate">
                {t('የመታወቂያ ካርድ ዝርዝር እይታ', 'ID Card Inspection & Print Preview')}
              </h3>
              <p className="text-xs font-semibold text-slate-600 truncate">
                {t('ከማተምዎ በፊት የፊት እና የጀርባ ገጾችን ያረጋግጡ', 'Verify front & back details before approval or printing')}
              </p>
            </div>
          </div>

          <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('front')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${activeTab === 'front' ? 'bg-[#0B1B3A] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {t('ፊት', 'Front')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('back')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${activeTab === 'back' ? 'bg-[#0B1B3A] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {t('ጀርባ', 'Back')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('both')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${activeTab === 'both' ? 'bg-[#0B1B3A] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {t('ሁለቱም ገጽ', 'Both Sides')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('combined')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${activeTab === 'combined' ? 'bg-[#0B1B3A] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {t('የተቀናጀ', 'Combined')}
            </button>
          </div>
        </div>

        {!isApproved && (
          <div className="mx-5 mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-900">
            <Lock size={16} className="text-red-600 shrink-0" />
            <span>
              <strong className="font-bold">{t('ያልጸደቀ እና በሲስተም ያልተመዘገበ፡', 'Unapproved & Unregistered:')}</strong>{' '}
              {t(
                'አጽዳቂው "አጽድቅና መዝግብ" እስኪል ድረስ ፕሪንት ማድረግ፣ ማውረድ እና QR ስካን ማድረግ ተቆልፏል።',
                'Printing, downloading, and QR verification remain locked until the Approver approves and registers this ID.'
              )}
            </span>
          </div>
        )}

        {record.correction_note && (
          <div className="mx-5 mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-900">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span><strong className="font-bold">{t('የማስተካከያ ማስታወሻ፡', 'Correction Note:')}</strong> {record.correction_note}</span>
          </div>
        )}

        <div className="p-8 lg:p-12 flex-1 overflow-y-auto bg-[#F4F6FA]">
          <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-12 lg:gap-20 min-h-full">
            {/* Front Side */}
            <div className={`space-y-6 flex flex-col items-center w-full lg:w-auto ${activeTab === 'back' || activeTab === 'combined' ? 'hidden lg:flex opacity-0 pointer-events-none absolute' : 'flex'}`}>
              <div className="flex items-center justify-between w-full px-2 max-w-[85.6mm]">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('የፊት ገፅ', 'Front Side')}</span>
                {canPrint && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onPrint('front')}
                      className="p-2 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
                      title={t('ፊቱን ብቻ አትም', 'Print Front Only')}
                    >
                      <Printer size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload('front')}
                      className="p-2 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
                      title={t('ፊቱን ብቻ አውርድ', 'Download Front Only')}
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
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('የጀርባ ገፅ', 'Back Side')}</span>
                {canPrint && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onPrint('back')}
                      className="p-2 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
                      title={t('ጀርባውን ብቻ አትም', 'Print Back Only')}
                    >
                      <Printer size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload('back')}
                      className="p-2 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
                      title={t('ጀርባውን ብቻ አውርድ', 'Download Back Only')}
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
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('የተቀናጀ እይታ', 'Combined Layout')}</span>
                  <div className="flex flex-col gap-4 p-4 bg-white rounded-[3.18mm] shadow-2xl border border-slate-200 scale-110 sm:scale-125 lg:scale-150">
                    <IDCardFront data={record} assets={assets} />
                    <div className="border-t border-dashed border-slate-200"></div>
                    <IDCardBack data={record} assets={assets} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 sm:px-6 bg-white border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 flex-wrap">
          <div className="flex flex-wrap gap-2">
            {(isApproverOrAdmin || (user?.role === 'Data Entry' && record.status !== 'approved')) && (
              <button
                type="button"
                onClick={onEdit}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer"
              >
                <Edit size={15} />
                {record.status === 'needs_correction' && user?.role === 'Data Entry' ? t('አስተካክለህ ላክ', 'Fix & Resubmit') : t('አርትዕ', 'Edit')}
              </button>
            )}
            {isApproverOrAdmin && (record.status === 'pending' || record.status === 'needs_correction') && (
              <>
                {onApprove && (
                  <button
                    type="button"
                    onClick={onApprove}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs shadow-xs whitespace-nowrap cursor-pointer"
                  >
                    <CheckCircle2 size={15} />
                    {t('አጽድቅና መዝግብ', 'Approve & Register')}
                  </button>
                )}
                {onRequestCorrection && (
                  <button
                    type="button"
                    onClick={onRequestCorrection}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs shadow-xs whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw size={15} />
                    {t('ስህተት ገልጸህ መልስ', 'Return for Correction')}
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft size={14} />
              {t('ተመለስ', 'Back')}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto justify-end">
            {canPrint ? (
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => onDownload('both')}
                  className="px-4 py-2.5 bg-[#0B1B3A] hover:bg-[#142952] text-white rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs text-xs whitespace-nowrap cursor-pointer"
                >
                  <Download size={15} />
                  {t('ሁለቱንም ገጽ አውርድ', 'Download PNG')}
                </button>
                <button
                  type="button"
                  onClick={() => onPrint('combined')}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 text-xs whitespace-nowrap cursor-pointer"
                  title={t('ለPVC ካርድ ፕሪንተር (ገፅ 1 ፊት፣ ገፅ 2 ጀርባ)', 'For CR80 PVC card printers (2 duplex pages)')}
                >
                  <Printer size={15} />
                  {t('ካርድ ፕሪንተር (CR80)', 'CR80 Card Printer')}
                </button>
                <button
                  type="button"
                  onClick={() => onPrint('both')}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#881337] via-[#991b1b] to-[#1E40AF] hover:from-[#9f1239] hover:to-[#1D4ED8] text-white border border-[#F59E0B] rounded-xl font-extrabold shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs whitespace-nowrap cursor-pointer"
                  title={t('በማንኛውም ፕሪንተር የፊትና ጀርባ ገፅ በአንዴ በATM ሳይዝ (85.6×53.98mm) አትም', 'Print both Front & Back together on 1 page at exact ATM size on any printer')}
                >
                  <Printer size={15} />
                  {t('ፊትና ጀርባ በአንዴ አትም (ATM ሳይዝ)', 'Print Both Sides (ATM Size)')}
                </button>
              </div>
            ) : (
              <div className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <Lock size={14} />
                {t('ማተምና ማውረድ ተቆልፏል', 'Print & Download Locked')}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
  badge
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
        active
          ? 'bg-[#1E40AF] text-white shadow-sm'
          : 'text-slate-200 hover:text-white hover:bg-white/10'
      }`}
    >
      <span className="flex items-center gap-2.5 min-w-0 truncate">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="px-2 py-0.5 rounded-md bg-[#C89B2B] text-[#0B1B3A] text-[10px] font-black tabular-nums shrink-0">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone = 'blue'
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: 'blue' | 'amber' | 'orange' | 'emerald';
}) {
  const toneClasses = {
    blue: 'bg-blue-50 border-blue-200',
    amber: 'bg-amber-50 border-amber-200',
    orange: 'bg-orange-50 border-orange-200',
    emerald: 'bg-emerald-50 border-emerald-200'
  }[tone];

  return (
    <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${toneClasses}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider truncate">{title}</p>
        <p className="text-2xl font-black text-slate-950 tabular-nums mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function AssetUpload({
  label,
  changeLabel = 'ፋይሉን ቀይር / Change',
  image,
  previewBg,
  onUpload
}: {
  label: string;
  changeLabel?: string;
  image?: string;
  previewBg?: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-extrabold text-slate-900 truncate">{label}</p>
      <div
        className="relative group w-full aspect-video bg-white rounded-xl border border-dashed border-slate-300 overflow-hidden flex items-center justify-center"
        style={previewBg ? { background: previewBg } : undefined}
      >
        {image ? (
          <img src={image} className="w-full h-full object-contain p-2" alt={label} />
        ) : (
          <Camera size={22} className="text-slate-300" />
        )}
        <div className="absolute inset-0 bg-slate-950/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-xs font-bold">{changeLabel}</span>
        </div>
        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={onUpload} />
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder, icon }: { label: string, value: string, onChange: (v: string) => void, placeholder: string, icon: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-extrabold text-[#1E3A8A] ml-0.5 tracking-[0.01em]">{label}</label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B45309]">
          {icon}
        </div>
        <input
          type="text"
          autoComplete="off"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#065F46] placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-[#047857] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
        />
      </div>
    </div>
  );
}

function Login({
  onLogin,
  loading,
  serverStatus,
  dbStatus,
  assets,
  lang,
  onChangeLang
}: {
  onLogin: (c: any) => void;
  loading: boolean;
  serverStatus: 'checking' | 'online' | 'offline';
  dbStatus: any;
  assets?: Assets;
  lang: LangMode;
  onChangeLang: (next: LangMode) => void;
}) {
  const t = (am: string, en: string) => (lang === 'am' ? am : en);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const matchedLogo = useCardMatchedLogo(assets?.police_logo);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ email: email.trim(), password });
  };

  return (
    <div className="min-h-screen bg-[#0B1B3A] flex flex-col items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="p-8 sm:p-9 bg-[#08142B] text-white text-center relative overflow-hidden border-b border-slate-800">
          <div className="absolute top-0 left-0 w-full h-1 flex">
            <div className="flex-1 bg-[#009a44]" />
            <div className="flex-1 bg-[#fedd00]" />
            <div className="flex-1 bg-[#ef3340]" />
          </div>

          <div className="flex justify-end mb-3">
            <div className="inline-flex items-center bg-white/10 border border-white/15 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => onChangeLang('am')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  lang === 'am' ? 'bg-[#C89B2B] text-[#0B1B3A]' : 'text-slate-300 hover:text-white'
                }`}
              >
                አማ
              </button>
              <button
                type="button"
                onClick={() => onChangeLang('en')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  lang === 'en' ? 'bg-[#C89B2B] text-[#0B1B3A]' : 'text-slate-300 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>
          </div>

          {/* Official Police Commission Logo */}
          <div
            className="relative w-24 h-24 rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-5 border-2 border-[#C89B2B] overflow-hidden"
            style={{ background: ID_CARD_BACKGROUND }}
          >
            {matchedLogo ? (
              <img src={matchedLogo} alt="BGR Police Commission Logo" className="w-full h-full object-contain p-2 relative z-10" />
            ) : (
              <Shield size={40} className="text-[#0B1B3A] relative z-10" />
            )}
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg sm:text-xl font-black text-[#E5C158] leading-snug">
              {t('ቤንሻንጉል ጉሙዝ ክልል ፖሊስ ኮሚሽን', 'Benishangul-Gumuz Region Police Commission')}
            </h2>
            <p className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
              {t('የመታወቂያ ዝግጅትና ማረጋገጫ ሲስተም', 'Official ID Issuance & Verification System')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-7 sm:p-8 space-y-5">
          <FormInput
            label={t('ዩሰርኔም ወይም ኢሜይል', 'Username or Email')}
            value={email}
            onChange={setEmail}
            placeholder={t('ዩሰርኔም ወይም ኢሜይል ያስገቡ', 'Enter username or email')}
            icon={<User size={17} />}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 ml-0.5">{t('የይለፍ ቃል', 'Password')}</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <KeyRound size={17} />
              </div>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('የይለፍ ቃል ያስገቡ', 'Enter password')}
                className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#1E40AF] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-sm"
          >
            {loading && <Loader2 className="animate-spin" size={17} />}
            {t('ወደ ሲስተሙ ይግቡ', 'Sign In to Portal')}
          </button>
          <div className="text-center pt-4 border-t border-slate-200">
            <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
              {t('በቤንሻንጉል ጉሙዝ ክልል ፖሊስ ኮሚሽን ቴክኖሎጂ ማስፋፊያ ክፍል የተሰራ', 'Developed by BGR Police Commission Technology Expansion Department')}
            </p>
            <p className="text-[11px] font-extrabold text-[#B4881F] mt-0.5">
              (by D,Ins B.Y)
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function UserManagement({
  currentUser,
  lang,
  onBack,
  onCurrentUserUpdated
}: {
  currentUser: User | null;
  lang: LangMode;
  onBack: () => void;
  onCurrentUserUpdated: (updated: Partial<User>) => void;
}) {
  const t = (am: string, en: string) => (lang === 'am' ? am : en);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddPass, setShowAddPass] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'Data Entry' as UserRole
  });

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [showEditPass, setShowEditPass] = useState(false);

  const [selfUsername, setSelfUsername] = useState(currentUser?.username || '');
  const [selfEmail, setSelfEmail] = useState(currentUser?.email || '');
  const [selfPassword, setSelfPassword] = useState('');
  const [showSelfPass, setShowSelfPass] = useState(false);
  const [selfSaving, setSelfSaving] = useState(false);

  useEffect(() => {
    setSelfUsername(currentUser?.username || '');
    setSelfEmail(currentUser?.email || '');
  }, [currentUser?.username, currentUser?.email]);

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

  const handleSaveSelfCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = sanitizeText(selfUsername, 120);
    const cleanEmail = sanitizeText(selfEmail, 200).toLowerCase();
    if (!cleanUsername && !cleanEmail) {
      alert(t('እባክዎ ዩሰርኔም ወይም ኢሜይል ያስገቡ።', 'Please enter a username or email.'));
      return;
    }
    const trimmedPass = selfPassword.trim();
    if (trimmedPass && trimmedPass.length < 6) {
      alert(t('የይለፍ ቃሉ ቢያንስ 6 ፊደላት/ቁጥሮች መሆን አለበት።', 'Password must be at least 6 characters long.'));
      return;
    }
    setSelfSaving(true);
    try {
      let targetDocId = currentUser?.id && currentUser.id !== 'superadmin-fallback' ? currentUser.id : null;
      if (!targetDocId && cleanEmail) {
        const existingSnap = await getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1)));
        if (!existingSnap.empty) {
          targetDocId = existingSnap.docs[0].id;
        }
      }
      const payload: any = {
        username: cleanUsername || cleanEmail,
        username_lower: (cleanUsername || cleanEmail).toLowerCase(),
        email: cleanEmail || (cleanUsername ? `${cleanUsername.toLowerCase()}` : ''),
        role: currentUser?.role || 'Administrator',
        active: true,
        updated_at: new Date().toISOString()
      };
      if (trimmedPass) {
        payload.password = await hashPassword(trimmedPass);
      } else if (!targetDocId) {
        alert(t('አዲስ የአድሚን መለያ ለማስቀመጥ የይለፍ ቃል ያስገቡ።', 'Please enter a password to save the new admin account.'));
        setSelfSaving(false);
        return;
      }

      if (targetDocId) {
        await updateDoc(doc(db, 'users', targetDocId), payload);
      } else {
        const added = await addDoc(collection(db, 'users'), {
          ...payload,
          created_at: new Date().toISOString()
        });
        targetDocId = added.id;
      }

      onCurrentUserUpdated({
        id: targetDocId,
        username: payload.username,
        email: payload.email,
        role: payload.role
      });
      setSelfPassword('');
      await fetchUsers();
      alert(t('የራስዎ የአድሚን ዩሰርኔም እና የይለፍ ቃል በተሳካ ሁኔታ ተቀይሯል!', 'Your admin username & password were updated!'));
    } catch (err: any) {
      console.error("Save self credentials error:", err);
      alert(t('መረጃውን ማዘመን አልተቻለም: ', 'Failed to update credentials: ') + (err?.message || ''));
    } finally {
      setSelfSaving(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = sanitizeText(newUser.username, 120);
    const cleanEmail = sanitizeText(newUser.email, 200).toLowerCase();
    const trimmedPass = newUser.password.trim();
    if (!cleanUsername && !cleanEmail) {
      alert(t('እባክዎ ዩሰርኔም ወይም ኢሜይል ያስገቡ።', 'Please enter a username or email.'));
      return;
    }
    if (!trimmedPass || trimmedPass.length < 6) {
      alert(t('እባክዎ ቢያንስ 6 ፊደላት/ቁጥሮች ያለው የይለፍ ቃል ያስገቡ።', 'Please enter a password of at least 6 characters.'));
      return;
    }
    setLoading(true);
    try {
      const resolvedUsername = cleanUsername || cleanEmail;
      const passwordHash = await hashPassword(trimmedPass);
      await addDoc(collection(db, 'users'), {
        username: resolvedUsername,
        username_lower: resolvedUsername.toLowerCase(),
        email: cleanEmail,
        password: passwordHash,
        role: newUser.role,
        active: true,
        created_at: new Date().toISOString()
      });
      await fetchUsers();
      setShowAdd(false);
      setNewUser({ username: '', email: '', password: '', role: 'Data Entry' });
      alert(t('አዲስ ተጠቃሚ በተሳካ ሁኔታ ተፈጥሯል!', 'New user created successfully!'));
    } catch (e) {
      console.error("Add user error:", e);
      alert(t('ተጠቃሚ መጨመር አልተቻለም', 'Failed to add user'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const cleanUsername = sanitizeText(editingUser.username, 120);
    const cleanEmail = sanitizeText(editingUser.email, 200).toLowerCase();
    if (!cleanUsername && !cleanEmail) {
      alert(t('ዩሰርኔም ወይም ኢሜይል ባዶ መሆን አይችልም።', 'Username or email cannot be empty.'));
      return;
    }
    const trimmedPass = (editingUser.password || '').trim();
    if (trimmedPass && trimmedPass.length < 6) {
      alert(t('የይለፍ ቃሉ ቢያንስ 6 ፊደላት/ቁጥሮች መሆን አለበት።', 'Password must be at least 6 characters long.'));
      return;
    }
    setLoading(true);
    try {
      const resolvedUsername = cleanUsername || cleanEmail;
      const updatePayload: any = {
        username: resolvedUsername,
        username_lower: resolvedUsername.toLowerCase(),
        email: cleanEmail,
        role: editingUser.role || 'Viewer',
        active: editingUser.active !== false,
        updated_at: new Date().toISOString()
      };
      if (trimmedPass) {
        updatePayload.password = await hashPassword(trimmedPass);
      }
      await updateDoc(doc(db, 'users', editingUser.id), updatePayload);
      if (currentUser?.id === editingUser.id) {
        onCurrentUserUpdated({
          id: editingUser.id,
          username: updatePayload.username,
          email: updatePayload.email,
          role: updatePayload.role
        });
      }
      await fetchUsers();
      setEditingUser(null);
      alert(t('የተጠቃሚው መረጃ በተሳካ ሁኔታ ተቀይሯል!', 'User account updated successfully!'));
    } catch (err) {
      console.error("Update user error:", err);
      alert(t('ተጠቃሚውን ሲያዘምኑ ስህተት ተከስቷል', 'Failed to update user'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm(t('ይህንን ተጠቃሚ ማጥፋት እንደሚፈልጉ እርግጠኛ ነዎት?', 'Are you sure you want to delete this user?'))) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      fetchUsers();
    } catch (e) {
      alert(t('ተጠቃሚውን ሲያጠፉ ስህተት ተከስቷል', 'Failed to delete user'));
    }
  };

  const handleUpdateRole = async (id: string, role: string) => {
    try {
      await updateDoc(doc(db, 'users', id), { role });
      fetchUsers();
    } catch (e) {
      alert(t('ሚናውን ሲቀይሩ ስህተት ተከስቷል', 'Failed to update role'));
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', id), { active: !currentStatus });
      fetchUsers();
    } catch (e) {
      alert(t('ሁኔታውን ሲቀይሩ ስህተት ተከስቷል', 'Failed to update status'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft size={14} />
            {t('ተመለስ', 'Back')}
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950">{t('የተጠቃሚዎች አስተዳደር', 'User & Role Management')}</h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              {t('የራስዎን እና የሌሎችን (መረጃ አስገቢ፣ አጽዳቂ፣ ተመልካች) መለያ እና ሚና ያስተዳድሩ', 'Manage credentials and roles for Administrators, Approvers, Data Entry, and Viewers')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-xl font-bold shadow-xs transition-all flex items-center gap-2 text-xs whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus size={16} />
          {t('አዲስ ተጠቃሚ ጨምር', 'Add New User')}
        </button>
      </div>

      {/* Self Admin Credentials Editor */}
      <form onSubmit={handleSaveSelfCredentials} className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[#1E40AF] flex items-center justify-center shrink-0">
            <KeyRound size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{t('የራሴ አድሚን መለያ (My Admin Account)', 'My Administrator Credentials')}</h3>
            <p className="text-xs text-slate-500">{t('የራስዎን ዩሰርኔም፣ ኢሜይል እና የይለፍ ቃል እዚህ መቀየር ይችላሉ።', 'Update your own username, email, and password here.')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <FormInput
            label={t('የራሴ ዩሰርኔም', 'My Username')}
            value={selfUsername}
            onChange={setSelfUsername}
            placeholder="admin_username"
            icon={<User size={16} />}
          />
          <FormInput
            label={t('የራሴ ኢሜይል', 'My Email')}
            value={selfEmail}
            onChange={setSelfEmail}
            placeholder="admin@domain.com"
            icon={<User size={16} />}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 ml-0.5">{t('አዲስ የይለፍ ቃል', 'New Password')}</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <KeyRound size={16} />
              </div>
              <input
                type={showSelfPass ? 'text' : 'password'}
                value={selfPassword}
                onChange={(e) => setSelfPassword(e.target.value)}
                placeholder={t('አዲስ የይለፍ ቃል ያስገቡ', 'Enter new password')}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#1E40AF] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowSelfPass(!showSelfPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showSelfPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={selfSaving}
            className="h-[42px] px-5 bg-[#0B1B3A] hover:bg-[#142952] text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            {selfSaving && <Loader2 className="animate-spin" size={15} />}
            {t('የራሴን መለያ አዘምን', 'Update My Account')}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[11px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200 bg-slate-50">
              <th className="px-5 py-3.5">{t('ዩሰርኔም', 'Username')}</th>
              <th className="px-5 py-3.5">{t('ኢሜይል', 'Email')}</th>
              <th className="px-5 py-3.5">{t('ሚና', 'Role')}</th>
              <th className="px-5 py-3.5">{t('ሁኔታ', 'Status')}</th>
              <th className="px-5 py-3.5 text-right">{t('ተግባራት', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-5 py-4 font-black text-slate-950 text-sm">{u.username || u.email}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{u.email || '-'}</td>
                <td className="px-5 py-4">
                  <select
                    value={u.role || 'Viewer'}
                    onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold px-2.5 py-1.5 focus:border-[#1E40AF] outline-none"
                  >
                    <option value="Administrator">{t('አስተዳዳሪ (Administrator)', 'Administrator')}</option>
                    <option value="Approver">{t('አጽዳቂ (Approver)', 'Approver')}</option>
                    <option value="Data Entry">{t('መረጃ አስገቢ (Data Entry)', 'Data Entry')}</option>
                    <option value="Viewer">{t('ተመልካች (Viewer)', 'Viewer')}</option>
                  </select>
                </td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(u.id, u.active !== false)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap ${
                      u.active !== false
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    {u.active !== false ? t('ገባሪ', 'Active') : t('ያልነቃ', 'Disabled')}
                  </button>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUser({ ...u, password: '' });
                        setShowEditPass(false);
                      }}
                      className="p-2 text-slate-500 hover:text-[#1E40AF] hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                      title={t('ዩሰርኔም/ፓስዎርድ/ሚና ቀይር', 'Edit User')}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                      title={t('ተጠቃሚ አጥፋ', 'Delete User')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdd(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 bg-[#0B1B3A] text-white flex justify-between items-center border-b border-slate-800">
                <h3 className="text-base font-bold">{t('አዲስ ተጠቃሚ ጨምር', 'Create New User Account')}</h3>
                <button type="button" onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-white/15 rounded-lg transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <FormInput
                  label={t('ዩሰርኔም', 'Username')}
                  value={newUser.username || ''}
                  onChange={(v) => setNewUser({...newUser, username: v})}
                  placeholder={t('ምሳሌ፡ data_entry1 ወይም approver1', 'e.g. data_entry1 or approver1')}
                  icon={<User size={16} />}
                />
                <FormInput
                  label={t('ኢሜይል (አማራጭ)', 'Email (Optional)')}
                  value={newUser.email || ''}
                  onChange={(v) => setNewUser({...newUser, email: v})}
                  placeholder="user@bgrpolice.gov.et"
                  icon={<User size={16} />}
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 ml-0.5">{t('የይለፍ ቃል', 'Password')}</label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <KeyRound size={16} />
                    </div>
                    <input
                      type={showAddPass ? 'text' : 'password'}
                      value={newUser.password || ''}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      placeholder={t('የይለፍ ቃል', 'Password')}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#1E40AF] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAddPass(!showAddPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showAddPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 ml-0.5">{t('ሚና', 'Role')}</label>
                  <select
                    value={newUser.role || 'Data Entry'}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value as UserRole})}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#1E40AF] outline-none transition-all font-bold"
                  >
                    <option value="Administrator">{t('አስተዳዳሪ (Administrator)', 'Administrator')}</option>
                    <option value="Approver">{t('አጽዳቂ (Approver)', 'Approver')}</option>
                    <option value="Data Entry">{t('መረጃ አስገቢ (Data Entry)', 'Data Entry')}</option>
                    <option value="Viewer">{t('ተመልካች (Viewer)', 'Viewer')}</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    {t('ተመለስ', 'Back')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-4 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-xl font-bold shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs cursor-pointer"
                  >
                    {loading && <Loader2 className="animate-spin" size={15} />}
                    {t('ተጠቃሚ ፍጠር', 'Create User')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 bg-[#0B1B3A] text-white flex justify-between items-center border-b border-slate-800">
                <h3 className="text-base font-bold">{t('የተጠቃሚ መረጃ አስተካክል', 'Edit User Account')}</h3>
                <button type="button" onClick={() => setEditingUser(null)} className="p-1.5 hover:bg-white/15 rounded-lg transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
                <FormInput
                  label={t('ዩሰርኔም', 'Username')}
                  value={editingUser.username || ''}
                  onChange={(v) => setEditingUser({...editingUser, username: v})}
                  placeholder={t('ዩሰርኔም', 'Username')}
                  icon={<User size={16} />}
                />
                <FormInput
                  label={t('ኢሜይል', 'Email')}
                  value={editingUser.email || ''}
                  onChange={(v) => setEditingUser({...editingUser, email: v})}
                  placeholder={t('ኢሜይል', 'Email')}
                  icon={<User size={16} />}
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 ml-0.5">{t('የይለፍ ቃል', 'Password')}</label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <KeyRound size={16} />
                    </div>
                    <input
                      type={showEditPass ? 'text' : 'password'}
                      value={editingUser.password || ''}
                      onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                      placeholder={t('አዲስ የይለፍ ቃል', 'New password (optional)')}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#1E40AF] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPass(!showEditPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showEditPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 ml-0.5">{t('ሚና', 'Role')}</label>
                  <select
                    value={editingUser.role || 'Viewer'}
                    onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#1E40AF] outline-none transition-all font-bold"
                  >
                    <option value="Administrator">{t('አስተዳዳሪ (Administrator)', 'Administrator')}</option>
                    <option value="Approver">{t('አጽዳቂ (Approver)', 'Approver')}</option>
                    <option value="Data Entry">{t('መረጃ አስገቢ (Data Entry)', 'Data Entry')}</option>
                    <option value="Viewer">{t('ተመልካች (Viewer)', 'Viewer')}</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    {t('ተመለስ', 'Back')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-4 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-xl font-bold shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs cursor-pointer"
                  >
                    {loading && <Loader2 className="animate-spin" size={15} />}
                    {t('ለውጡን አስቀምጥ', 'Save Changes')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VerificationView({
  idNumber,
  assets: initialAssets,
  lang,
  onChangeLang
}: {
  idNumber: string;
  assets: Assets;
  lang: LangMode;
  onChangeLang: (next: LangMode) => void;
}) {
  const t = (am: string, en: string) => (lang === 'am' ? am : en);
  const [record, setRecord] = useState<IDRecord | null>(null);
  const [verifyState, setVerifyState] = useState<'approved' | 'unapproved' | 'deleted' | 'expired' | 'not_found'>('not_found');
  const [assets, setAssets] = useState<Assets>(initialAssets);
  const [loading, setLoading] = useState(true);
  const [scannedAt, setScannedAt] = useState<string>('');
  const matchedLogo = useCardMatchedLogo(assets.police_logo);

  // Strict read-only guard: block print, save, view-source, and copy shortcuts while on QR verification page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 's', 'c', 'u', 'x'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch {}
        }
        const cleanId = sanitizeText(decodeURIComponent(idNumber || ''), 64);
        const nowIso = new Date().toISOString();
        setScannedAt(nowIso);

        if (!cleanId) {
          setRecord(null);
          setVerifyState('not_found');
          setLoading(false);
          return;
        }

        const q = query(collection(db, 'ids'), where('id_number', '==', cleanId), limit(1));
        const querySnapshot = await getDocs(q);
        let statusAtScan = 'not_found';

        if (!querySnapshot.empty) {
          const recordDoc = querySnapshot.docs[0];
          const recordData = { ...recordDoc.data(), id: recordDoc.id } as IDRecord;
          statusAtScan = recordData.deleted ? 'deleted' : (recordData.status || 'pending');

          if (recordData.deleted) {
            setRecord(null);
            setVerifyState('deleted');
          } else if (recordData.status !== 'approved' || recordData.is_registered === false) {
            // Unapproved IDs MUST NOT verify or display card data on scan
            setRecord(null);
            setVerifyState('unapproved');
          } else if (recordData.expires_at && new Date(recordData.expires_at) < new Date()) {
            setRecord(recordData);
            setVerifyState('expired');
            statusAtScan = 'expired';
          } else {
            setRecord(recordData);
            setVerifyState('approved');
          }
        } else {
          setRecord(null);
          setVerifyState('not_found');
        }

        // Persist every QR scan event in Firestore scans collection for strict security auditing
        try {
          await addDoc(collection(db, 'scans'), {
            id_number: cleanId,
            status_at_scan: statusAtScan,
            timestamp: nowIso,
            ip: 'QR-Verify-ReadOnly',
            user_agent: (navigator.userAgent || 'Unknown').slice(0, 500)
          });
        } catch {}

        if (!assets.police_logo || !assets.bgr_flag || !assets.eth_flag) {
          const publicKeys: (keyof Assets)[] = ['police_logo', 'bgr_flag', 'eth_flag'];
          const snaps = await Promise.all(
            publicKeys.map(async (k) => {
              try {
                const s = await getDoc(doc(db, 'assets', k));
                return [k, s.exists() ? s.data()?.value : undefined] as const;
              } catch {
                return [k, undefined] as const;
              }
            })
          );
          const assetsData: Assets = { ...assets };
          for (const [k, v] of snaps) {
            if (v) assetsData[k] = v;
          }
          setAssets(assetsData);
        }
      } catch (err) {
        console.error("Verification fetch error:", err);
        setRecord(null);
        setVerifyState('not_found');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [idNumber]);

  const TopBar = (
    <div className="w-full max-w-2xl flex items-center justify-between gap-3 mb-6">
      <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-[#E5C158] text-xs font-extrabold whitespace-nowrap">
        <Lock size={14} />
        {t('የማረጋገጫ ገፅ ብቻ (Read-Only)', 'Read-Only Verification Only')}
      </div>
      <div className="inline-flex items-center bg-white/10 border border-white/15 p-0.5 rounded-xl">
        <button
          type="button"
          onClick={() => onChangeLang('am')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            lang === 'am' ? 'bg-[#C89B2B] text-[#0B1B3A]' : 'text-slate-300 hover:text-white'
          }`}
        >
          አማ
        </button>
        <button
          type="button"
          onClick={() => onChangeLang('en')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            lang === 'en' ? 'bg-[#C89B2B] text-[#0B1B3A]' : 'text-slate-300 hover:text-white'
          }`}
        >
          EN
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1B3A] select-none verify-readonly-block">
        <Loader2 className="animate-spin text-[#C89B2B]" size={44} />
      </div>
    );
  }

  if (!record || verifyState === 'unapproved' || verifyState === 'deleted' || verifyState === 'not_found') {
    const isUnapproved = verifyState === 'unapproved';
    const isDeleted = verifyState === 'deleted';
    return (
      <div
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        className="min-h-screen flex flex-col items-center justify-center bg-[#0B1B3A] p-6 sm:p-10 text-center select-none verify-readonly-block"
      >
        {TopBar}
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-red-50 border border-red-200 text-red-600 rounded-2xl flex items-center justify-center mb-5">
            {isUnapproved ? <Lock size={32} /> : <X size={32} />}
          </div>
          <h1 className="text-xl font-black text-slate-900">
            {isUnapproved
              ? t('ያልጸደቀ እና በሲስተም ያልተመዘገበ መታወቂያ', 'Unapproved & Unregistered ID Card')
              : isDeleted
              ? t('የተሰረዘ / ህጋዊ ያልሆነ መታወቂያ', 'Revoked / Invalid Official ID')
              : t('ትክክለኛ ያልሆነ / ያልተገኘ መታወቂያ', 'Invalid or Unregistered ID')}
          </h1>
          <p className="text-xs font-mono font-bold text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-lg mt-3">
            {decodeURIComponent(idNumber || '') || 'N/A'}
          </p>
          <p className="text-sm font-medium text-slate-600 mt-4 leading-relaxed">
            {isUnapproved
              ? t(
                  'ይህ መታወቂያ እስካሁን በአጽዳቂው አልጸደቀም። አጽዳቂው "አጽድቅ" እስኪል ድረስ በሲስተሙ ውስጥ አልተመዘገበም እና ተቀባይነት የለውም።',
                  'This ID card has NOT been approved by the Approver yet and is not authentic or valid.'
                )
              : isDeleted
              ? t(
                  'ይህ መታወቂያ ከሲስተሙ የተሰረዘ ስለሆነ ለአገልግሎት አይውልም።',
                  'This ID card has been revoked from the official system and is no longer valid.'
                )
              : t(
                  'ይህ መለያ ቁጥር በመረጃ ቋታችን ውስጥ አልተመዘገበም፤ እባክዎ ትክክለኛነቱን ያረጋግጡ።',
                  'This ID number was not found in the official Benishangul-Gumuz Police Commission registry.'
                )}
          </p>
          <div className="mt-6 w-full px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-extrabold flex items-center justify-center gap-2">
            <ShieldAlert size={16} />
            {t('ማረጋገጫ አልተሳካም · የመታወቂያ እይታ ተዘግቷል', 'Verification Failed · Access Restricted')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      className="min-h-screen bg-[#0B1B3A] flex flex-col items-center justify-center p-6 sm:p-10 select-none verify-readonly-block"
    >
      {TopBar}
      <div className="mb-6 text-center flex flex-col items-center max-w-xl">
        <div
          className="w-16 h-16 rounded-2xl border-2 border-[#C89B2B] shadow-xl flex items-center justify-center overflow-hidden mb-4"
          style={{ background: ID_CARD_BACKGROUND }}
        >
          {matchedLogo ? (
            <img src={matchedLogo} alt="BGR Police Logo" className="w-full h-full object-contain p-1.5 pointer-events-none" draggable={false} />
          ) : (
            <Shield size={30} className="text-[#0B1B3A]" />
          )}
        </div>

        {verifyState === 'expired' ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-200 rounded-xl text-xs sm:text-sm font-black mb-3 border border-amber-400/40 shadow-sm">
            <ShieldAlert size={18} />
            {t('ትክክለኛ መዝገብ ሆኖ ጊዜው ያለፈበት መታወቂያ (EXPIRED)', 'Authentic Record — EXPIRED ID')}
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/25 text-emerald-200 rounded-xl text-xs sm:text-sm font-black mb-3 border border-emerald-400/50 shadow-sm">
            <CheckCircle2 size={18} />
            {t('ትክክለኛነቱ የተረጋገጠ ህጋዊ መታወቂያ · AUTHENTIC & VERIFIED', 'Authentic & Verified Official Police ID')}
          </div>
        )}

        <h1 className="text-white text-lg sm:text-xl font-black">
          {t('የቤንሻንጉል ጉሙዝ ክልል ፖሊስ ኮሚሽን', 'Benishangul-Gumuz Region Police Commission')}
        </h1>
        <p className="text-slate-200 text-xs font-bold mt-1">
          {t('የመታወቂያ የፊት ገፅ እና የትክክለኛነት ማረጋገጫ ብቻ', 'Official Front-Side ID & Authenticity Verification Only')}
        </p>

        {/* Official Authenticity Confirmation Details */}
        <div className="mt-4 w-full bg-white/8 border border-white/15 rounded-2xl p-4 text-left space-y-2 backdrop-blur-xs">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] font-bold text-slate-300 uppercase">
              {t('የማረጋገጫ ሁኔታ', 'Authenticity Status')}
            </span>
            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
              verifyState === 'expired'
                ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                : 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
            }`}>
              {verifyState === 'expired'
                ? t('የተመዘገበ ነገር ግን ጊዜው ያለፈበት', 'Registered — Expired')
                : t('በፋየርስቶር የተመዘገበ ትክክለኛ መታወቂያ', 'Officially Registered in Firestore')}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-white/10 text-xs">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{t('መለያ ቁጥር', 'ID Number')}</p>
              <p className="font-mono font-black text-[#FEF9C3]">{record.id_number}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{t('የተሰጠበት ቀን', 'Issued Date')}</p>
              <p className="font-bold text-white tabular-nums">{record.issued_at || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{t('የሚያበቃበት ቀን', 'Expiry Date')}</p>
              <p className={`font-bold tabular-nums ${verifyState === 'expired' ? 'text-amber-300' : 'text-emerald-300'}`}>
                {record.expires_at || 'N/A'}
              </p>
            </div>
          </div>
          {record.approved_by && (
            <p className="text-[#E5C158] text-[11px] font-bold pt-1 border-t border-white/10">
              {t('ያጸደቀው አካል፡', 'Approved & Registered by:')} {record.approved_by}
            </p>
          )}
          {scannedAt && (
            <p className="text-slate-400 text-[10px] font-mono">
              {t('የተረጋገጠበት ሰዓት፡', 'Verified at:')} {new Date(scannedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Front Side ONLY (Protected Read-Only View — Back Side & Dashboard strictly hidden) */}
      <div className="flex flex-col items-center gap-3 my-4">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#E5C158]">
          {t('የመታወቂያው የፊት ገፅ (Front Side Only)', 'Official ID Front Side (Read-Only)')}
        </span>
        <div className="relative scale-[0.88] sm:scale-110 lg:scale-125 origin-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] rounded-[3.18mm] my-4">
          <IDCardFront data={record} assets={assets} />
          {/* Transparent shield prevents dragging/saving portrait or copying card text */}
          <div className="absolute inset-0 z-40 bg-transparent" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-12 max-w-md text-center space-y-1.5">
        <p className="text-slate-200 text-xs font-bold leading-relaxed">
          {t(
            'ጥብቅ የደህንነት ማሳሰቢያ፡ ይህ ገፅ የመታወቂያውን የፊት ገፅና ትክክለኛነት ለማረጋገጥ ብቻ የተዘጋጀ ነው። ወደ ዋናው ዳሽቦርድ መግባት፣ ማተም ወይም መረጃ መቀየር በጥብቅ የተከለከለ ነው።',
            'Strict Security Notice: This QR verification page displays only the ID front side and authenticity confirmation. Dashboard access, editing, copying, and printing are strictly disabled.'
          )}
        </p>
      </div>
    </div>
  );
}

export default function RootApp() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
