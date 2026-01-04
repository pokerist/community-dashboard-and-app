# 🏛️ DOMAIN MODEL OVERVIEW

This document provides a high-level overview of the data domain for the integrated PMS Dashboard and Community Application, built on a shared Supabase PostgreSQL database.

---

## 🗺️ High-Level Relationship Map

This map outlines the principal one-to-many (1:N) and many-to-many (M:N) relationships between the core entities.

* **User** <-> **Unit** (M:N via `ResidentUnit`)
* **User** --> **Lease** (1:N as Owner)
* **User** --> **Lease** (1:N as Tenant)
* **User** --> **Complaint** (1:N reported)
* **User** --> **Complaint** (1:N assigned)
* **User** --> **Violation** (1:N issued)
* **User** --> **Violation** (1:N targeted)
* **User** --> **Invoice** (1:N)
* **User** --> **ServiceRequest** (1:N created)
* **User** --> **AccessQRCode** (1:N generated)
* **User** --> **Booking** (1:N)
* **User** --> **SmartDevice** (1:N)
* **User** --> **Notification** (1:N sent)
* **User** --> **UserStatusLog** (1:N)
* **Unit** --> **Lease** (1:N)
* **Unit** --> **Invoice** (1:N)
* **Unit** --> **ServiceRequest** (1:N)
* **Unit** --> **ResidentUnit** (1:N)
* **Unit** --> **Booking** (1:N)
* **Unit** --> **SmartDevice** (1:N)
* **Unit** --> **AccessQRCode** (1:N)
* **Unit** --> **Complaint** (1:N)
* **Unit** --> **Violation** (1:N)
* **Unit** --> **Incident** (1:N)
* **Unit** --> **UnitFee** (1:N)
* **Service** --> **ServiceField** (1:N)
* **Service** --> **ServiceRequest** (1:N)
* **ServiceRequest** --> **ServiceRequestFieldValue** (1:N)
* **ServiceRequest** --> **Attachment** (1:N)
* **ServiceRequest** --> **Invoice** (1:N)
* **Invoice** --> **Attachment** (1:N)
* **Invoice** --> **Violation** (0..1)
* **Invoice** --> **ServiceRequest** (0..1)
* **Invoice** --> **UnitFee** (0..1)
* **Booking** --> **User** (resident) (1:N)
* **Booking** --> **Unit** (1:N)
* **Booking** --> **Facility** (1:N)
* **SmartDevice** --> **Unit**? (0..1)
* **SmartDevice** --> **User**? (0..1)
* **Notification** --> **NotificationLog** (1:N)
* **ReportTemplate** --> **ScheduledReport** (1:N)

---

## 🧱 Core Entities Detailed

### 👤 User

* **Table:** `user`
* **Description:** Represents all system users: residents (owners, tenants), contractors, operators, and staff.
* **Key Fields:** `id` (uuid), `email`, `phone`, `nameEN/AR`, **`role`**, **`userStatus`**, `nationalId`, `profilePhotoId`.
* **Relationships:**
    * **Units:** M:N via `ResidentUnit` (Tenancy).
    * **Leases:** as Owner (1:N), as Tenant (1:N).
    * **Actions:** Complains (reported 1:N), Violations (issued/targeted 1:N), Service Requests (created 1:N), Bookings (1:N).
    * **Billing/Access:** Invoices (1:N), QR Codes (generated 1:N), Smart Devices (1:N), Notifications (sent 1:N).
* **Notes:** The **`Role`** enum governs access rights across the dashboard and community app. **`ResidentUnit`** is the key link for active tenancy/residency.

### 🏢 Unit

* **Table:** `unit`
* **Description:** The physical property units (apartments, villas, etc.).
* **Key Fields:** `id`, `projectName`, `block`, **`unitNumber`**, **`type`**, `sizeSqm`, **`status`**.
* **Relationships:**
    * **Tenancy/Billing:** Leases (1:N), Invoices (1:N), UnitFees (1:N), Residents (1:N via `ResidentUnit`).
    * **Operations:** ServiceRequests (1:N), Complaints (1:N), Violations (1:N), Incidents (1:N).
    * **Community:** Bookings (1:N), SmartDevices (1:N), AccessQRCodes (1:N).
* **Notes:** The **central entity** for nearly every module. **`UnitStatus`** drives availability and certain operations.

### 🏠 ResidentUnit

* **Table:** `resident_unit`
* **Description:** The join table establishing a user's current residency in a unit.
* **Key Fields:** `id`, **`userId`**, **`unitId`**, `assignedAt`, **`isPrimary`**.
* **Relationships:** User $\longleftrightarrow$ Unit (M:N).
* **Notes:** Essential for determining primary residence and enforcing the unique constraint on residency **(`userId`, `unitId`)**.

### 📄 Lease

* **Table:** `lease`
* **Description:** Formal contract between an owner and optionally a tenant for a unit.
* **Key Fields:** `id`, `unitId`, **`ownerId`**, `tenantId`, `startDate`, `endDate`, `monthlyRent`, **`status`**, `contractFileId`.
* **Relationships:** Unit (1:N), Owner (1:N), Tenant (1:N), ContractFile (0..1).
* **Notes:** Central for billing, access validation, and triggering status-based notifications (e.g., **`EXPIRING_SOON`**).

### 🧾 Invoice

* **Table:** `invoice`
* **Description:** A charge or fee issued to a resident/unit.
* **Key Fields:** `id`, **`invoiceNumber`**, `unitId`, `residentId`, **`amount`**, `dueDate`, **`status`**.
* **Relationships:** Unit (1:N), Resident (0..1), Attachments (1:N).
* **Source Links:** Violation (0..1), ServiceRequest (0..1), UnitFee (0..1).
* **Notes:** Aggregates charges from multiple sources. **`Status`** is critical for payment tracking and reminder systems.

### 🚨 Event-Driven Modules

* **Complaint:** Links a **Reporter** (User), optional **Unit**, and optional **AssignedTo** (User). Tracks `priority`, `status`, and `resolutionNotes`.
* **Violation:** Links an **IssuedBy** (User), a **Targeted** Resident (User), and a **Unit**. Fine amount and links to **Invoices**.
* **Booking:** Links a **Resident** (User), their **Unit**, and the **Facility**. Essential for time slot management and access control.
* **AccessQRCode:** Used for **Visitors**. Generated by a **User** (`generatedBy`) and optionally for a **Unit**. Controlled by `type`, `validTo`, and `status`.

### ⚙️ System and Operational Entities

* **Service & ServiceField:** Defines the template for dynamic forms. A **Service** has many **ServiceFields**.
* **ServiceRequest:** The actual instance of a service request, linking to **Unit** and **CreatedBy** (User). Includes dynamic data via `ServiceRequestFieldValue`.
* **SmartDevice:** Links to an optional **Unit** and/or **User**. Contains **`integrationInfo`** for IoT management.
* **Notification:** Sent by a **User** to a **`targetAudience`** via multiple `channels`. Generates **NotificationLogs** for delivery tracking.
* **File & Attachment:** **File** is the storage reference. **Attachment** is the join table for polymorphic links (e.g., attaching a file to an **Invoice** or **ServiceRequest**).
* **UnitFee:** Represents recurring or one-time charges tied to a **Unit** and specific **`billingMonth`**, optionally linking to its generated **Invoice**.

### ✨ Modular Design Strategy

To keep the NestJS code **straightforward and simple** as requested, logic for these entities should be encapsulated:

* **Event Dispatcher:** Implement an event/message bus (e.g., using NestJS Events or message queues) to handle cascading actions (e.g., a new **Violation** fine triggers the creation of an **Invoice**).
* **Independent Modules:** Ensure modules like `ViolationModule` or `LeaseModule` are responsible for their own data consistency and only interact with others via explicit service calls or events. This isolates complexity and avoids future refactoring before deployment.