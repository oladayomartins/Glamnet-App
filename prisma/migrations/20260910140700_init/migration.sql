-- CreateTable
CREATE TABLE "Hub" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "travelFeeMinor" INTEGER NOT NULL DEFAULT 500,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priceMinor" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SERVICE',
    "category" TEXT NOT NULL DEFAULT 'Hair',
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "rating" REAL NOT NULL DEFAULT 5,
    "completedBookings" INTEGER NOT NULL DEFAULT 0,
    "isAcceptingWork" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hubId" TEXT NOT NULL,
    CONSTRAINT "Provider_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProviderService" (
    "providerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    PRIMARY KEY ("providerId", "serviceId"),
    CONSTRAINT "ProviderService_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProviderService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProviderAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    CONSTRAINT "ProviderAvailability_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProviderTimeOff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'Unavailable',
    CONSTRAINT "ProviderTimeOff_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmergencyPricingConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "thresholdMinutes" INTEGER NOT NULL DEFAULT 720,
    "surchargeType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "surchargeValue" INTEGER NOT NULL DEFAULT 2500,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingType" TEXT NOT NULL DEFAULT 'NORMAL',
    "bookingCreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appointmentStartAt" DATETIME NOT NULL,
    "noticePeriodMinutes" INTEGER NOT NULL,
    "thresholdMinutesUsed" INTEGER NOT NULL DEFAULT 720,
    "serviceDurationMinutes" INTEGER NOT NULL,
    "reservedDurationMinutes" INTEGER NOT NULL,
    "reservedUntilAt" DATETIME NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "travelFeeMinor" INTEGER NOT NULL,
    "emergencySurchargeMinor" INTEGER NOT NULL DEFAULT 0,
    "otherSurchargesMinor" INTEGER NOT NULL DEFAULT 0,
    "trustFeeMinor" INTEGER NOT NULL DEFAULT 50,
    "totalInvoicePriceMinor" INTEGER NOT NULL,
    "providerEarningsMinor" INTEGER NOT NULL DEFAULT 0,
    "providerEmergencyEarningsMinor" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "sector" TEXT NOT NULL,
    "referenceImageUrl" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "addressLine" TEXT NOT NULL DEFAULT '',
    "addressUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "cancelledReason" TEXT NOT NULL DEFAULT '',
    "customerId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "providerId" TEXT,
    CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SERVICE',
    CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingBroadcast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "respondedAt" DATETIME,
    "earningsMinor" INTEGER NOT NULL DEFAULT 0,
    "emergencyEarningsMinor" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BookingBroadcast_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingBroadcast_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingStatusEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'SYSTEM',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingStatusEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'PUSH',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bookingType" TEXT NOT NULL DEFAULT 'NORMAL',
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Hub_sector_key" ON "Hub"("sector");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_email_key" ON "Provider"("email");

-- CreateIndex
CREATE INDEX "Provider_hubId_idx" ON "Provider"("hubId");

-- CreateIndex
CREATE INDEX "ProviderService_serviceId_idx" ON "ProviderService"("serviceId");

-- CreateIndex
CREATE INDEX "ProviderAvailability_providerId_idx" ON "ProviderAvailability"("providerId");

-- CreateIndex
CREATE INDEX "ProviderTimeOff_providerId_startAt_idx" ON "ProviderTimeOff"("providerId", "startAt");

-- CreateIndex
CREATE INDEX "EmergencyPricingConfig_isActive_effectiveFrom_idx" ON "EmergencyPricingConfig"("isActive", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_bookingType_idx" ON "Booking"("bookingType");

-- CreateIndex
CREATE INDEX "Booking_providerId_appointmentStartAt_idx" ON "Booking"("providerId", "appointmentStartAt");

-- CreateIndex
CREATE INDEX "Booking_appointmentStartAt_idx" ON "Booking"("appointmentStartAt");

-- CreateIndex
CREATE INDEX "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");

-- CreateIndex
CREATE INDEX "BookingBroadcast_providerId_status_idx" ON "BookingBroadcast"("providerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BookingBroadcast_bookingId_providerId_key" ON "BookingBroadcast"("bookingId", "providerId");

-- CreateIndex
CREATE INDEX "BookingStatusEvent_bookingId_createdAt_idx" ON "BookingStatusEvent"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_audience_createdAt_idx" ON "Notification"("audience", "createdAt");
