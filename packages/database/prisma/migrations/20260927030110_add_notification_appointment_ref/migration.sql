-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "appointmentId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_appointmentId_idx" ON "Notification"("appointmentId");
