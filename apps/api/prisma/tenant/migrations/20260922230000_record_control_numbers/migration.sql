-- Número de controle sequencial por tabela (exibição e relatórios).

ALTER TABLE "Product" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "Product_controlNumber_key" ON "Product"("controlNumber");

ALTER TABLE "Partner" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "Partner_controlNumber_key" ON "Partner"("controlNumber");

ALTER TABLE "Barn" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "Barn_controlNumber_key" ON "Barn"("controlNumber");

ALTER TABLE "FlockLot" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "FlockLot_controlNumber_key" ON "FlockLot"("controlNumber");

ALTER TABLE "Employee" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "Employee_controlNumber_key" ON "Employee"("controlNumber");

ALTER TABLE "SalesOrder" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "SalesOrder_controlNumber_key" ON "SalesOrder"("controlNumber");

ALTER TABLE "WorkShift" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "WorkShift_controlNumber_key" ON "WorkShift"("controlNumber");

ALTER TABLE "ChartAccount" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "ChartAccount_controlNumber_key" ON "ChartAccount"("controlNumber");

ALTER TABLE "StockLocation" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "StockLocation_controlNumber_key" ON "StockLocation"("controlNumber");

ALTER TABLE "PurchaseRequest" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "PurchaseRequest_controlNumber_key" ON "PurchaseRequest"("controlNumber");

ALTER TABLE "StockReceipt" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "StockReceipt_controlNumber_key" ON "StockReceipt"("controlNumber");

ALTER TABLE "User" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "User_controlNumber_key" ON "User"("controlNumber");

ALTER TABLE "Alert" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "Alert_controlNumber_key" ON "Alert"("controlNumber");

ALTER TABLE "SanitaryProduct" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "SanitaryProduct_controlNumber_key" ON "SanitaryProduct"("controlNumber");

ALTER TABLE "HealthEvent" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "HealthEvent_controlNumber_key" ON "HealthEvent"("controlNumber");

ALTER TABLE "LeaveAbsence" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "LeaveAbsence_controlNumber_key" ON "LeaveAbsence"("controlNumber");

ALTER TABLE "VacationPlan" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "VacationPlan_controlNumber_key" ON "VacationPlan"("controlNumber");

ALTER TABLE "PayrollRun" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "PayrollRun_controlNumber_key" ON "PayrollRun"("controlNumber");

ALTER TABLE "EmployeeProductWithdrawal" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "EmployeeProductWithdrawal_controlNumber_key" ON "EmployeeProductWithdrawal"("controlNumber");

ALTER TABLE "City" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "City_controlNumber_key" ON "City"("controlNumber");

ALTER TABLE "District" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "District_controlNumber_key" ON "District"("controlNumber");

ALTER TABLE "Bank" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "Bank_controlNumber_key" ON "Bank"("controlNumber");

ALTER TABLE "DailyEggProduction" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "DailyEggProduction_controlNumber_key" ON "DailyEggProduction"("controlNumber");

ALTER TABLE "DailyMortality" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "DailyMortality_controlNumber_key" ON "DailyMortality"("controlNumber");

ALTER TABLE "DailyFeedConsumption" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "DailyFeedConsumption_controlNumber_key" ON "DailyFeedConsumption"("controlNumber");

ALTER TABLE "StockMovement" ADD COLUMN "controlNumber" SERIAL NOT NULL;
CREATE UNIQUE INDEX "StockMovement_controlNumber_key" ON "StockMovement"("controlNumber");
