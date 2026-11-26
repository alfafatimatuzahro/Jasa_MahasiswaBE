import { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import db from '../config/db';

dotenv.config();

export const chatWithAsistenJasa = async (req: Request, res: Response) => {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey || apiKey.includes('ISI_KEY')) {
      return res.status(500).json({
        success: false,
        message: 'GEMINI_API_KEY belum dikonfigurasi dengan benar di .env.'
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const { message, user_id } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Pesan tidak boleh kosong.'
      });
    }

    // 1. Ambil data jasa yang disetujui dari database MySQL sesuai kolom aktual
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

    const daftarJasaKonteks = services.length > 0
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

    // 3. Panggil Gemini dengan Structured JSON Output
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
              description: 'Balasan ramah dari Asisten Jasa untuk user.'
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
                  price: { type: Type.NUMBER }
                },
                required: ['id', 'title', 'category', 'price']
              }
            }
          },
          required: ['reply', 'recommended_services']
        }
      }
    });

    const aiData = JSON.parse(response.text || '{}');

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
      data: aiData
    });

  } catch (error) {
    console.error('Error Asisten Jasa:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada Asisten Jasa.'
    });
  }
};