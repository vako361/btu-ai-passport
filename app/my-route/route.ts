import { NextResponse } from 'next/server';

// GET - read data
export async function GET() {
  try {
    const data = { message: 'Data loaded successfully.' };

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST - create data
export async function POST(request: Request) {
  try {
    const body = await request.json();

    return NextResponse.json(
      { message: 'Data created successfully.', data: body },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json(
      { error: 'Invalid data.' },
      { status: 400 }
    );
  }
}

// PUT - update data
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    return NextResponse.json(
      { message: 'Data updated successfully.', data: body },
      { status: 200 }
    );
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json(
      { error: 'Update failed.' },
      { status: 400 }
    );
  }
}

// DELETE - delete data
export async function DELETE() {
  try {
    return NextResponse.json(
      { message: 'Data deleted successfully.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json(
      { error: 'Delete failed.' },
      { status: 500 }
    );
  }
}