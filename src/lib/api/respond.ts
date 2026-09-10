import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BookingError } from "@/lib/server/booking-service";

/** Serialise a thrown error into a stable JSON error envelope. */
export function errorResponse(error: unknown) {
  if (error instanceof BookingError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "The request body was not valid.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 422 },
    );
  }

  console.error("Unhandled API error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong." } },
    { status: 500 },
  );
}
