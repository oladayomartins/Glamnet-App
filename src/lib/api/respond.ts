import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

  // A transaction that could not start, or lost a write conflict, is
  // contention rather than a fault. Reporting it as 500 "Something went wrong"
  // tells a provider nothing; 409 tells them to try again.
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2028" || error.code === "P2034")
  ) {
    return NextResponse.json(
      {
        error: {
          code: "CONTENDED",
          message: "The database was busy. Please try that again.",
        },
      },
      { status: 409 },
    );
  }

  console.error("Unhandled API error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong." } },
    { status: 500 },
  );
}
