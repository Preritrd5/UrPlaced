import { NextResponse } from "next/server";
import { ImportService } from "@/modules/question-bank/services/import-service";

export async function GET() {
  const csv = ImportService.generateCsvTemplate();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="question_import_template.csv"',
    },
  });
}
