import { NextRequest, NextResponse } from 'next/server';

// Define the shape of the incoming request from your frontend
interface TransferRequestPayload {
  accountNumber: string;
  accountName: string;
  amount: string;
  bankCode: string;
}

// Define the shape of Chapa's expected response (partial)
interface ChapaResponse {
  message: string;
  status: string;
  data?: {
    reference: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: TransferRequestPayload = await request.json();
    const { accountNumber, accountName, amount, bankCode } = body;

    // Generate a unique transaction reference
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
        status: 'success', // Simulates instant success in Test Mode
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
