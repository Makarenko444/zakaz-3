import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'requests.json');

interface ConnectionRequest {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  tariff: string;
  comment: string;
  createdAt: string;
  status: 'new' | 'processing' | 'completed' | 'cancelled';
}

async function ensureDataFile() {
  const dataDir = path.join(process.cwd(), 'data');

  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2));
  }
}

async function readRequests(): Promise<ConnectionRequest[]> {
  await ensureDataFile();
  const data = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

async function writeRequests(requests: ConnectionRequest[]) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(requests, null, 2));
}

export async function GET() {
  try {
    const requests = await readRequests();
    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error reading requests:', error);
    return NextResponse.json(
      { error: 'Ошибка при чтении заявок' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { fullName, phone, email, address, tariff, comment, createdAt } = body;

    if (!fullName || !phone || !email || !address || !tariff) {
      return NextResponse.json(
        { error: 'Не все обязательные поля заполнены' },
        { status: 400 }
      );
    }

    const requests = await readRequests();

    const newRequest: ConnectionRequest = {
      id: `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fullName,
      phone,
      email,
      address,
      tariff,
      comment: comment || '',
      createdAt: createdAt || new Date().toISOString(),
      status: 'new',
    };

    requests.push(newRequest);
    await writeRequests(requests);

    return NextResponse.json(
      { message: 'Заявка успешно создана', request: newRequest },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating request:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании заявки' },
      { status: 500 }
    );
  }
}
