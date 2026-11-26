import { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import db from '../config/db';

dotenv.config();

const MODELS_PRIORITY = ['gemini-2.5-flash-lite', 'gemini-3.8-flash'];

const SYNONYMS: Record<string, string[]> = {
  coding: ['coding', 'web', 'website', 'aplikasi', 'program', 'pemrograman', 'it', 'react', 'flutter', 'laravel', 'frontend', 'backend', 'html', 'css', 'js', 'python', 'java'],
  desain: ['desain', 'design', 'ppt', 'presentasi', 'poster', 'logo', 'canva', 'grafis', 'ui', 'ux', 'figma', 'banner'],
  data: ['data', 'spss', 'skripsi', 'statistik', 'olah', 'excel', 'analisis', 'kuesioner'],
  ketik: ['ketik', 'tulis', 'makalah', 'jurnal', 'dokumen', 'word', 'tugas', 'laporan', 'parafrase'],
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('AI_REQUEST_TIMEOUT')), ms)
    ),
  ]);
}

async function generateWithFallback(ai: GoogleGenAI, baseParams: any) {
  let lastError: any;

  for (const modelName of MODELS_PRIORITY) {
    try {
      return await withTimeout(
        ai.models.generateContent({
          ...baseParams,
          model: modelName,
        }),
        10000
      );
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      const isRetryable =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('high demand') ||
        msg.includes('429') ||
        msg.includes('AI_REQUEST_TIMEOUT');

      if (isRetryable) {
        continue;
      }
      break;
    }
  }

  throw lastError;
}

function fallbackDatabaseSearch(message: string, services: any[]) {
  if (!services || services.length === 0) {
    return {
      reply: 'Saat ini belum ada jasa yang berstatus aktif di database.',
      recommended_services: [],
    };
  }

  const lower = message.toLowerCase();
  const budgetMatch = lower.match(/(\d+)\s*(rb|ribu|k)?/);
  let budgetAmount: number | null = null;

  const isMinBudget = /(ke\s*atas|keatas|minimal|min|lebih\s*dari|di\s*atas|diatas|mulai)/.test(lower);
  const isMaxBudget = /(under|di\s*bawah|dibawah|maksimal|maks|max|kurang\s*dari)/.test(lower);

  if (budgetMatch) {
    const num = parseInt(budgetMatch[1], 10);
    budgetAmount = num < 1000 ? num * 1000 : num;
  }

  const stopWords = [
    'carikan', 'cari', 'jasa', 'harga', 'budget', 'yang', 'untuk', 'nya', 'harganya',
    'bantu', 'tolong', 'buat', 'mau', 'butuh', 'under', 'dibawah', 'bawah',
    'diatas', 'atas', 'minimal', 'maksimal', 'mulai', 'lebih', 'dari', 'ada', 'apa', 'saja'
  ];

  const keywords = lower
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.includes(w) && !/^\d+(rb|ribu|k)?$/.test(w));

  const matchKeyword = (s: any) => {
    if (keywords.length === 0) return true;
    const text = `${s.title} ${s.category} ${s.description || ''}`.toLowerCase();
    return keywords.some((k) => {
      const related = SYNONYMS[k] || [k];
      return related.some((syn) => text.includes(syn));
    });
  };

  const matchBudget = (s: any) => {
    if (budgetAmount === null) return true;
    const price = Number(s.price);
    if (isMinBudget) return price >= budgetAmount;
    if (isMaxBudget) return price <= budgetAmount;
    return price <= budgetAmount; // jika "harga 50000", izinkan <= 50000 tapi urutkan yang paling dekat dengan 50000 dulu
  };

  // Urutkan agar harga yang paling mendekati / sama dengan target budget muncul di paling atas
  const sortByClosestBudget = (list: any[]) => {
    if (budgetAmount === null) return list;
    return [...list].sort(
      (a, b) => Math.abs(Number(a.price) - budgetAmount!) - Math.abs(Number(b.price) - budgetAmount!)
    );
  };

  const budgetLabel = budgetAmount
    ? isMinBudget
      ? ` (budget minimal Rp${budgetAmount.toLocaleString('id-ID')})`
      : isMaxBudget
        ? ` (budget maksimal Rp${budgetAmount.toLocaleString('id-ID')})`
        : ` (kisaran budget Rp${budgetAmount.toLocaleString('id-ID')})`
    : '';

  // 1. Cari yang cocok kata kunci DAN budget, diurutkan dari yang paling mendekati target harga
  const exactMatched = sortByClosestBudget(
    services.filter((s) => matchKeyword(s) && matchBudget(s))
  );

  if (exactMatched.length > 0) {
    return {
      reply: `Berikut rekomendasi jasa yang sesuai dengan kebutuhanmu${budgetLabel}:`,
      recommended_services: exactMatched.slice(0, 5).map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        price: Number(s.price),
      })),
    };
  }

  // 2. Jika kategori cocok tapi rentang harga belum ada, tawarkan opsi yang tersedia
  const keywordOnlyMatched = sortByClosestBudget(
    services.filter((s) => matchKeyword(s))
  );
  if (keywordOnlyMatched.length > 0) {
    return {
      reply: `Belum ada jasa${budgetLabel}, namun berikut pilihan jasa serupa yang tersedia di database:`,
      recommended_services: keywordOnlyMatched.slice(0, 5).map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        price: Number(s.price),
      })),
    };
  }

  // 3. Jika belum spesifik, tampilkan contoh jasa yang tersedia
  return {
    reply:
      'Berikut beberapa layanan yang sedang tersedia di Jasa Mahasiswa. Ceritakan detail tugas atau budget-mu agar pencariannya lebih pas:',
    recommended_services: services.slice(0, 5).map((s) => ({
      id: s.id,
      title: s.title,
      category: s.category,
      price: Number(s.price),
    })),
  };
}

export const chatWithAsistenJasa = async (req: Request, res: Response) => {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'GEMINI_API_KEY belum terbaca di .env.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const { message, user_id } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Pesan tidak boleh kosong.',
      });
    }

    const [services]: any = await db.query(
      `SELECT 
         s.id, 
         s.judul AS title, 
         COALESCE(c.nama, 'UMUM') AS category, 
         s.harga AS price, 
         s.deskripsi AS description
       FROM services s
       LEFT JOIN categories c ON s.category_id = c.id
       WHERE LOWER(s.status) IN ('aktif', 'approved')`
    );

    const daftarJasaKonteks =
      services.length > 0
        ? JSON.stringify(services)
        : 'Tidak ada jasa yang tersedia saat ini.';

    const systemInstruction = `
Kamu adalah "Asisten Jasa" di aplikasi Jasa Mahasiswa.
Tugasmu membantu mahasiswa menemukan jasa yang sesuai dengan kebutuhan tugas dan budget mereka.

ATURAN KETAT:
1. Kamu HANYA BOLEH merekomendasikan jasa yang ada di dalam DATA DATABASE berikut:
${daftarJasaKonteks}
2. DILARANG KERAS mengarang, menebak, atau menyebutkan layanan/harga di luar DATA DATABASE tersebut.
3. Jika user mencari harga tertentu (misal Rp50.000), prioritaskan jasa yang harganya sama atau paling mendekati angka tersebut.
4. Jika tidak ada jasa yang cocok di database, katakan dengan sopan bahwa jasa tersebut belum tersedia dan tawarkan kategori yang ada di database.
`;

    let aiData: any;

    try {
      const response = await generateWithFallback(ai, {
        contents: String(message),
        config: {
          systemInstruction,
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'Balasan ramah dari Asisten Jasa untuk user.',
              },
              recommended_services: {
                type: Type.ARRAY,
                description: 'Daftar jasa dari database yang direkomendasikan.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                  },
                  required: ['id', 'title', 'category', 'price'],
                },
              },
            },
            required: ['reply', 'recommended_services'],
          },
        },
      });

      aiData = JSON.parse(response?.text || '{}');
    } catch (aiErr: any) {
      console.warn('Gemini padat/timeout, beralih ke pencarian database lokal:', aiErr?.message);
      aiData = fallbackDatabaseSearch(String(message), services);
    }

    try {
      await db.query(
        'INSERT INTO ai_search_logs (user_id, query_pencarian, respon_ai) VALUES (?, ?, ?)',
        [user_id || null, String(message), aiData.reply || '']
      );
    } catch (_) {
      // Abaikan jika tabel log belum dibuat
    }

    return res.status(200).json({
      success: true,
      data: aiData,
    });
  } catch (error: any) {
    console.error('Error Asisten Jasa:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Terjadi kesalahan pada Asisten Jasa.',
    });
  }
};
