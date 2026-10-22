import { NextResponse } from 'next/server';

// GET - მონაცემების წასაკითხად
export async function GET() {
  try {
    const data = { message: "წარმატებით ჩაიტვირთა" };

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST - ახალი მონაცემის დასამატებლად
export async function POST(request: Request) {
  try {
    const body = await request.json();

    return NextResponse.json(
      { message: "მონაცემები წარმატებით შეიქმნა", data: body },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json(
      { error: "არასწორი მონაცემები" },
      { status: 400 }
    );
  }
}

// PUT - მონაცემის განახლებისთვის
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    return NextResponse.json(
      { message: "მონაცემები განახლდა", data: body },
      { status: 200 }
    );
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json(
      { error: "განახლება ვერ მოხერხდა" },
      { status: 400 }
    );
  }
}

// DELETE - მონაცემის წასაშლელად
export async function DELETE() {
  try {
    return NextResponse.json(
      { message: "წარმატებით წაიშალა" },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json(
      { error: "წაშლა ვერ მოხერხდა" },
      { status: 500 }
    );
  }
}