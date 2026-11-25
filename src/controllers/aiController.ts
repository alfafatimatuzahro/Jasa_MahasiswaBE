import { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
// Sesuaikan import prisma / model database milikmu di sini
// import prisma from '../prisma'; 

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const chatWithAsistenJasa = async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;

    // 1. Ambil daftar jasa yang tersedia dari database kamu (contoh dummy array, ganti dengan query DB)
    // const services = await prisma.service.findMany({ where: { status: 'APPROVED' } });
    const services = [
      { id: 1, title: "Jasa Web React & UI Tailwind", category: "CODING", price: 50000 },
      { id: 2, title: "Desain Presentasi PPT & Canva", category: "DESAIN", price: 30000 },
      { id: 3, title: "Bantuan Olah Data SPSS & Excel", category: "DATA", price: 75000 },
    ];

    // 2. Berikan konteks katalog jasa ke AI melalui System Instruction
    const systemInstruction = `
      Kamu adalah "Asisten Jasa", asisten ramah untuk platform Jasa Mahasiswa.
      Tugasmu membantu mahasiswa menemukan jasa yang sesuai dengan kebutuhan tugas kuliah dan budget mereka.
      
      Daftar jasa yang tersedia saat ini:
      ${JSON.stringify(services)}

      Aturan menjawab:
      - Gunakan bahasa Indonesia yang santai, ramah, dan membantu.
      - Jika kebutuhan user sudah jelas dan cocok dengan salah satu jasa di daftar, sebutkan rekomendasinya dan isi "recommendedServiceId" dengan ID jasa tersebut.
      - Jika user masih bingung atau belum menyebutkan detail tugas/budget, ajukan pertanyaan lanjutan yang singkat dan isi "recommendedServiceId" dengan null.
      - Jangan pernah merekomendasikan jasa di luar daftar yang diberikan.
    `;

    // 3. Panggil Gemini API dengan output terstruktur (JSON)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...(history || []), // Riwayat chat sebelumnya (opsional)
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: "Pesan balasan ramah untuk pengguna"
            },
            recommendedServiceId: {
              type: Type.INTEGER,
              nullable: true,
              description: "ID jasa dari daftar yang paling cocok, atau null jika belum ada yang pas"
            }
          },
          required: ["reply", "recommendedServiceId"]
        }
      }
    });

    // 4. Parse hasil JSON dari AI dan gabungkan dengan detail objek jasa
    const aiResult = JSON.parse(response.text || '{}');
    const recommendedService = aiResult.recommendedServiceId
      ? services.find((s) => s.id === aiResult.recommendedServiceId) || null
      : null;

    // 5. Kirim ke Flutter
    return res.status(200).json({
      success: true,
      reply: aiResult.reply,
      recommendedService: recommendedService, // Akan berisi objek jasa jika cocok, atau null
    });

  } catch (error) {
    console.error("AI Chat Error:", error);
    return res.status(500).json({
      success: false,
      message: "Maaf, Asisten Jasa sedang mengalami gangguan."
    });
  }
};