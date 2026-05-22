import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

interface ApprovePayload {
  text?: string;
  approved?: boolean;
  id?: string | number;
  time?: string;
  format?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { text, approved, id, time, format } = (await req.json()) as ApprovePayload;

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Text URL is required' },
        { status: 400 }
      );
    }

    const approvedValue = approved ? 'true' : 'false';

    // Try to update first
    let result = await prisma.$executeRawUnsafe(
      `UPDATE "your_name_table" SET "Approved" = $1 WHERE "text" = $2`,
      approvedValue,
      text
    );

    // If no rows updated, it might be a new entry (manual upload)
    if (result === 0 && id) {
      result = await prisma.$executeRawUnsafe(
        `INSERT INTO "your_name_table" ("id", "text", "time", "format", "Approved") VALUES ($1, $2, $3, $4, $5)`,
        parseInt(String(id), 10) || 4,
        text,
        time || new Date().toISOString(),
        format || 'Image',
        approvedValue
      );
    }

    console.log(`[API Ads] Processed ad: ${text}, Result: ${result}`);

    return NextResponse.json({
      success: true,
      rowsAffected: result,
    });
  } catch (error) {
    console.error('[API Ads] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
