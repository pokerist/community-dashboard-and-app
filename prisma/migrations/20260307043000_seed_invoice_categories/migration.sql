INSERT INTO "public"."InvoiceCategory"
  ("id", "label", "mappedType", "description", "isActive", "displayOrder", "color", "createdAt", "updatedAt")
VALUES
  ('3e847f34-1302-4fd8-9c2a-c3d52f3f7bb1', 'Rent', 'RENT', 'Default mapping for Rent invoices.', true, 0, '#3b82f6', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('c4ff2d1f-3e62-4d7c-b299-f72bcf4ea0ab', 'Service Fee', 'SERVICE_FEE', 'Default mapping for Service Fee invoices.', true, 1, '#10b981', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('15b1e070-0ef1-4138-9b38-65f5448d8d9b', 'Utility', 'UTILITY', 'Default mapping for Utility invoices.', true, 2, '#14b8a6', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('9bbfd570-c0f8-4d48-88ac-d4f6f05fd4d5', 'Fine', 'FINE', 'Default mapping for Fine invoices.', true, 3, '#ef4444', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('f44d9af8-a715-4da5-a13f-86afb77ce58f', 'Maintenance Fee', 'MAINTENANCE_FEE', 'Default mapping for Maintenance Fee invoices.', true, 4, '#f59e0b', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('4e5e7860-29fa-4e65-ad99-201cf8ad6459', 'Booking Fee', 'BOOKING_FEE', 'Default mapping for Booking Fee invoices.', true, 5, '#f97316', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('f0df8d00-df65-4bda-95d4-8ed4fce53e9a', 'Setup Fee', 'SETUP_FEE', 'Default mapping for Setup Fee invoices.', true, 6, '#8b5cf6', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dd332126-bb01-4f8b-983d-c1ea9f42c25c', 'Late Fee', 'LATE_FEE', 'Default mapping for Late Fee invoices.', true, 7, '#dc2626', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('bc2d89a4-1d48-47f1-99fd-c6f1a497f42a', 'Miscellaneous', 'MISCELLANEOUS', 'Default mapping for Miscellaneous invoices.', true, 8, '#64748b', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ac3d0a16-cf9a-4fe2-9df2-5bd7b1770f59', 'Owner Expense', 'OWNER_EXPENSE', 'Default mapping for Owner Expense invoices.', true, 9, '#0ea5e9', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('7cb379ce-d4cd-4a20-a830-2dfad4fd0cef', 'Management Fee', 'MANAGEMENT_FEE', 'Default mapping for Management Fee invoices.', true, 10, '#2563eb', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('1558e6b7-5a38-4f0d-a8d3-6124d97ebb9f', 'Credit Memo', 'CREDIT_MEMO', 'Default mapping for Credit Memo invoices.', true, 11, '#22c55e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('d160518d-65ce-43c1-8685-1768e13c4f6a', 'Debit Memo', 'DEBIT_MEMO', 'Default mapping for Debit Memo invoices.', true, 12, '#f43f5e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("label") DO NOTHING;
