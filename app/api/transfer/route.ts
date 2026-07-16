import { NextRequest, NextResponse } from 'next/server';

interface TransferRequestPayload {
  accountNumber: string;
  accountName: string;
  amount: string;
  bankCode: string;
}

interface ChapaResponse {
  message: string;
  status: string;
  data?: {
    reference: string;
  };
}

// 1. ADD GET HANDLER: Prevents 405 Method Not Allowed if the browser hits this route directly
export async function GET() {
  return NextResponse.json(
    { message: "Chapa Transfer API Route is active. Send a POST request to make a transfer." },
    { status: 200 }
  );
}

// 2. POST HANDLER: Performs the actual transfer
export async function POST(request: NextRequest) {
  try {
    const body: TransferRequestPayload = await request.json();
    const { accountNumber, accountName, amount, bankCode } = body;

    const uniqueReference = `TRF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const response = await fetch('https://api.chapa.co/v1/transfers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_number: accountNumber,
        account_name: accountName,
        amount: amount,
        bank_code: bankCode,
        currency: 'ETB',
        reference: uniqueReference,
        status: 'success', // Simulated success in Test Mode
      }),
    });

    const data: ChapaResponse = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Transfer failed' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Transfer API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
