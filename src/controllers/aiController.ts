import { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import db from '../config/db';

dotenv.config();

const MODELS_PRIORITY = ['gemini-2.5-flash-lite', 'gemini-3.8-flash'];

async function generateWithFallback(ai: GoogleGenAI, baseParams: any) {
  let lastError: any;

  for (const modelName of MODELS_PRIORITY) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          ...baseParams,
          model: modelName,
        });
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        const isOverloaded =
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('high demand') ||
          msg.includes('429');

        if (isOverloaded) {
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }
        break;
      }
    }
  }

  throw lastError;
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

    // 1. Ambil data jasa yang disetujui dari database MySQL
    const [services]: any = await db.query(
      `SELECT 
         s.id, 
         s.judul AS title, 
         COALESCE(c.nama, 'UMUM') AS category, 
         s.harga AS price, 
         s.deskripsi AS description
       FROM services s
       LEFT JOIN categories c ON s.category_id = c.id
       WHERE s.status = 'approved'`
    );

    const daftarJasaKonteks =
      services.length > 0
        ? JSON.stringify(services)
        : 'Tidak ada jasa yang tersedia saat ini.';

    // 2. Batasi AI hanya menggunakan data dari database
    const systemInstruction = `
Kamu adalah "Asisten Jasa" di aplikasi Jasa Mahasiswa.
Tugasmu membantu mahasiswa menemukan jasa yang sesuai dengan kebutuhan tugas dan budget mereka.

ATURAN KETAT:
1. Kamu HANYA BOLEH merekomendasikan jasa yang ada di dalam DATA DATABASE berikut:
${daftarJasaKonteks}
2. DILARANG KERAS mengarang, menebak, atau menyebutkan layanan/harga di luar DATA DATABASE tersebut.
3. Jika tidak ada jasa yang cocok di database, katakan dengan sopan bahwa jasa tersebut belum tersedia dan tawarkan kategori yang ada di database.
4. Jika user masih bingung atau belum spesifik, tanyakan detail kebutuhan tugas atau kisaran budget-nya (kosongkan array recommended_services).
`;

    // 3. Panggil Gemini dengan Structured JSON Output + Auto Retry & Fallback Model
    const response = await generateWithFallback(ai, {
      contents: String(message),
      config: {
        systemInstruction: systemInstruction,
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

    const aiData = JSON.parse(response?.text || '{}');

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
    const msg = String(error?.message || '');
    if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
      return res.status(503).json({
        success: false,
        message: 'Server AI sedang padat sementara. Silakan coba kirim pesan lagi dalam beberapa detik.',
      });
    }
    return res.status(500).json({
      success: false,
      message: error?.message || 'Terjadi kesalahan pada Asisten Jasa.',
    });
  }
};
