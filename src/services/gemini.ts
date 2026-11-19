// Instant local dictionary & Ethiopic phonetic fallback so slow or offline internet never stalls ID creation
const AM_TO_EN_POLICE_TERMS: Record<string, string> = {
  'ኮሚሽነር': 'Commissioner',
  'ምክትል ኮሚሽነር': 'Deputy Commissioner',
  'ረዳት ኮሚሽነር': 'Assistant Commissioner',
  'ኮማንደር': 'Commander',
  'ዋና ኢንስፔክተር': 'Chief Inspector',
  'ኢንስፔክተር': 'Inspector',
  'ምክትል ኢንስፔክተር': 'Deputy Inspector',
  'ረዳት ኢንስፔክተር': 'Assistant Inspector',
  'ዋና ሳጅን': 'Chief Sergeant',
  'ሳጅን': 'Sergeant',
  'ምክትል ሳጅን': 'Deputy Sergeant',
  'ረዳት ሳጅን': 'Assistant Sergeant',
  'ዋና ኮንስታብል': 'Chief Constable',
  'ኮንስታብል': 'Constable',
  'ምክትል ኮንስታብል': 'Deputy Constable',
  'ረዳት ኮንስታብል': 'Assistant Constable',
  'መርማሪ': 'Investigator',
  'የወንጀል መርማሪ': 'Criminal Investigator',
  'የትራፊክ ፖሊስ': 'Traffic Police',
  'የፖሊስ አባል': 'Police Officer',
  'ኦፊሰር': 'Officer',
  'ኃላፊ': 'Head / Director',
  'ዳይሬክተር': 'Director',
  'ቡድን መሪ': 'Team Leader',
  'አስተባባሪ': 'Coordinator',
  'ባለሙያ': 'Specialist',
  'አዛዥ': 'Commander',
  'ጥበቃ': 'Security Officer',
  'የመረጃ ባለሙያ': 'Data Specialist',
  'አድሚን': 'Administrator',
};

const EN_TO_AM_POLICE_TERMS: Record<string, string> = Object.fromEntries(
  Object.entries(AM_TO_EN_POLICE_TERMS).map(([am, en]) => [en.toLowerCase(), am])
);

const ETHIOPIC_PHONETIC_MAP: Record<string, string> = {
  // ha
  'ሀ': 'ha', 'ሁ': 'hu', 'ሂ': 'hi', 'ሃ': 'ha', 'ሄ': 'he', 'ህ': 'h', 'ሆ': 'ho',
  // le
  'ለ': 'le', 'ሉ': 'lu', 'ሊ': 'li', 'ላ': 'la', 'ሌ': 'le', 'ል': 'l', 'ሎ': 'lo', 'ሏ': 'lwa',
  // hha
  'ሐ': 'ha', 'ሑ': 'hu', 'ሒ': 'hi', 'ሓ': 'ha', 'ሔ': 'he', 'ሕ': 'h', 'ሖ': 'ho',
  // me
  'መ': 'me', 'ሙ': 'mu', 'ሚ': 'mi', 'ማ': 'ma', 'ሜ': 'me', 'ም': 'm', 'ሞ': 'mo', 'ሟ': 'mwa',
  // se
  'ሠ': 'se', 'ሡ': 'su', 'ሢ': 'si', 'ሣ': 'sa', 'ሤ': 'se', 'ሥ': 's', 'ሦ': 'so',
  // re
  'ረ': 're', 'ሩ': 'ru', 'ሪ': 'ri', 'ራ': 'ra', 'ሬ': 're', 'ር': 'r', 'ሮ': 'ro', 'ሯ': 'rwa',
  // se
  'ሰ': 'se', 'ሱ': 'su', 'ሲ': 'si', 'ሳ': 'sa', 'ሴ': 'se', 'ስ': 's', 'ሶ': 'so', 'ሷ': 'swa',
  // she
  'ሸ': 'she', 'ሹ': 'shu', 'ሺ': 'shi', 'ሻ': 'sha', 'ሼ': 'she', 'ሽ': 'sh', 'ሾ': 'sho', 'ሿ': 'shwa',
  // qe
  'ቀ': 'ke', 'ቁ': 'ku', 'ቂ': 'ki', 'ቃ': 'ka', 'ቄ': 'ke', 'ቅ': 'k', 'ቆ': 'ko', 'ቋ': 'kwa',
  // be
  'በ': 'be', 'ቡ': 'bu', 'ቢ': 'bi', 'ባ': 'ba', 'ቤ': 'be', 'ብ': 'b', 'ቦ': 'bo', 'ቧ': 'bwa',
  // ve
  'ቨ': 've', 'ቩ': 'vu', 'ቪ': 'vi', 'ቫ': 'va', 'ቬ': 've', 'ቭ': 'v', 'ቮ': 'vo',
  // te
  'ተ': 'te', 'ቱ': 'tu', 'ቲ': 'ti', 'ታ': 'ta', 'ቴ': 'te', 'ት': 't', 'ቶ': 'to', 'ቷ': 'twa',
  // che
  'ቸ': 'che', 'ቹ': 'chu', 'ቺ': 'chi', 'ቻ': 'cha', 'ቼ': 'che', 'ች': 'ch', 'ቾ': 'cho', 'ቿ': 'chwa',
  // ha
  'ኀ': 'ha', 'ኁ': 'hu', 'ኂ': 'hi', 'ኃ': 'ha', 'ኄ': 'he', 'ኅ': 'h', 'ኆ': 'ho',
  // ne
  'ነ': 'ne', 'ኑ': 'nu', 'ኒ': 'ni', 'ና': 'na', 'ኔ': 'ne', 'ን': 'n', 'ኖ': 'no', 'ኗ': 'nwa',
  // gnye
  'ኘ': 'gne', 'ኙ': 'gnu', 'ኚ': 'gni', 'ኛ': 'gna', 'ኜ': 'gne', 'ኝ': 'gn', 'ኞ': 'gno',
  // a
  'አ': 'a', 'ኡ': 'u', 'ኢ': 'i', 'ኣ': 'a', 'ኤ': 'e', 'እ': 'e', 'ኦ': 'o',
  // ke
  'ከ': 'ke', 'ኩ': 'ku', 'ኪ': 'ki', 'ካ': 'ka', 'ኬ': 'ke', 'ክ': 'k', 'ኮ': 'ko', 'ኳ': 'kwa',
  // khe
  'ኸ': 'he', 'ኹ': 'hu', 'ኺ': 'hi', 'ኻ': 'ha', 'ኼ': 'he', 'ኽ': 'h', 'ኾ': 'ho',
  // we
  'ወ': 'we', 'ዉ': 'wu', 'ዊ': 'wi', 'ዋ': 'wa', 'ዌ': 'we', 'ው': 'w', 'ዎ': 'wo',
  // a
  'ዐ': 'a', 'ዑ': 'u', 'ዒ': 'i', 'ዓ': 'a', 'ዔ': 'e', 'ዕ': 'e', 'ዖ': 'o',
  // ze
  'ዘ': 'ze', 'ዙ': 'zu', 'ዚ': 'zi', 'ዛ': 'za', 'ዜ': 'ze', 'ዝ': 'z', 'ዞ': 'zo', 'ዟ': 'zwa',
  // zhe
  'ዠ': 'zhe', 'ዡ': 'zhu', 'ዢ': 'zhi', 'ዣ': 'zha', 'ዤ': 'zhe', 'ዥ': 'zh', 'ዦ': 'zho',
  // ye
  'የ': 'ye', 'ዩ': 'yu', 'ዪ': 'yi', 'ያ': 'ya', 'ዬ': 'ye', 'ይ': 'y', 'ዮ': 'yo',
  // de
  'ደ': 'de', 'ዱ': 'du', 'ዲ': 'di', 'ዳ': 'da', 'ዴ': 'de', 'ድ': 'd', 'ዶ': 'do', 'ዷ': 'dwa',
  // je
  'ጀ': 'je', 'ጁ': 'ju', 'ጂ': 'ji', 'ጃ': 'ja', 'ጄ': 'je', 'ጅ': 'j', 'ጆ': 'jo', 'ጇ': 'jwa',
  // ge
  'ገ': 'ge', 'ጉ': 'gu', 'ጊ': 'gi', 'ጋ': 'ga', 'ጌ': 'ge', 'ግ': 'g', 'ጎ': 'go', 'ጓ': 'gwa',
  // te
  'ጠ': 'te', 'ጡ': 'tu', 'ጢ': 'ti', 'ጣ': 'ta', 'ጤ': 'te', 'ጥ': 't', 'ጦ': 'to', 'ጧ': 'twa',
  // che
  'ጨ': 'che', 'ጩ': 'chu', 'ጪ': 'chi', 'ጫ': 'cha', 'ጬ': 'che', 'ጭ': 'ch', 'ጮ': 'cho',
  // pe
  'ጰ': 'pe', 'ጱ': 'pu', 'ጲ': 'pi', 'ጳ': 'pa', 'ጴ': 'pe', 'ጵ': 'p', 'ጶ': 'po',
  // tse
  'ጸ': 'tse', 'ጹ': 'tsu', 'ጺ': 'tsi', 'ጻ': 'tsa', 'ጼ': 'tse', 'ጽ': 'ts', 'ጾ': 'tso',
  'ፀ': 'tse', 'ፁ': 'tsu', 'ፂ': 'tsi', 'ፃ': 'tsa', 'ፄ': 'tse', 'ፅ': 'ts', 'ፆ': 'tso',
  // fe
  'ፈ': 'fe', 'ፉ': 'fu', 'ፊ': 'fi', 'ፋ': 'fa', 'ፌ': 'fe', 'ፍ': 'f', 'ፎ': 'fo', 'ፏ': 'fwa',
  // pe
  'ፐ': 'pe', 'ፑ': 'pu', 'ፒ': 'pi', 'ፓ': 'pa', 'ፔ': 'pe', 'ፕ': 'p', 'ፖ': 'po',
};

function transliterateEthiopicToLatin(text: string): string {
  const words = text.trim().split(/\s+/);
  return words
    .map((word) => {
      let out = '';
      for (const ch of word) {
        out += ETHIOPIC_PHONETIC_MAP[ch] ?? ch;
      }
      if (!out) return '';
      return out.charAt(0).toUpperCase() + out.slice(1);
    })
    .filter(Boolean)
    .join(' ');
}

export function fastLocalTranslate(text: string, targetLang: 'am' | 'en'): string | null {
  const clean = text.trim();
  if (!clean) return '';
  if (targetLang === 'en') {
    if (AM_TO_EN_POLICE_TERMS[clean]) return AM_TO_EN_POLICE_TERMS[clean];
    // Never return raw Amharic if offline; transliterate names quickly if Ethiopic
    if (/[\u1200-\u137F]/.test(clean)) {
      return transliterateEthiopicToLatin(clean);
    }
    return clean;
  }
  const byEn = EN_TO_AM_POLICE_TERMS[clean.toLowerCase()];
  if (byEn) return byEn;
  return null;
}

export async function translateText(text: string, targetLang: 'am' | 'en', timeoutMs = 2500): Promise<string> {
  const clean = text.trim();
  if (!clean) return "";

  // 1. Instant dictionary hit (0ms, zero network dependency)
  if (targetLang === 'en' && AM_TO_EN_POLICE_TERMS[clean]) {
    return AM_TO_EN_POLICE_TERMS[clean];
  }
  if (targetLang === 'am' && EN_TO_AM_POLICE_TERMS[clean.toLowerCase()]) {
    return EN_TO_AM_POLICE_TERMS[clean.toLowerCase()];
  }

  // 2. If browser is offline, return instant local fallback immediately
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return fastLocalTranslate(clean, targetLang) || clean;
  }

  const prompt = targetLang === 'en'
    ? `Translate or transliterate the following Amharic police ID field to concise English. Return ONLY the translated text: "${clean}"`
    : `Translate the following English police ID field to concise Amharic. Return ONLY the translated text: "${clean}"`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return fastLocalTranslate(clean, targetLang) || clean;
    }

    const data = await response.json();
    return data.text?.trim() || fastLocalTranslate(clean, targetLang) || clean;
  } catch {
    return fastLocalTranslate(clean, targetLang) || clean;
  } finally {
    clearTimeout(timer);
  }
}

export async function translateForm(data: any, sourceLang: 'am' | 'en') {
  const targetLang = sourceLang === 'am' ? 'en' : 'am';
  const fields = ['full_name', 'rank', 'responsibility'];

  const results: any = { ...data };
  await Promise.all(
    fields.map(async (field) => {
      const value = data[`${field}_${sourceLang}`];
      if (value) {
        results[`${field}_${targetLang}`] = await translateText(value, targetLang);
      }
    })
  );

  return results;
}
