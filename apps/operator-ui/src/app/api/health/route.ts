import { NextResponse } from 'next/server';
import { prisma } from 'path/to/prisma/client'; // Adjust the import path as necessary

export async function GET() {
    let dbStatus = false;
    try {
        await prisma.$connect();
        dbStatus = true;
    } catch (error) {
        console.error('Database connection error:', error);
    }

    return NextResponse.json({
        status: 'ok',
        db: dbStatus,
        timestamp: new Date().toISOString(),
    });
}