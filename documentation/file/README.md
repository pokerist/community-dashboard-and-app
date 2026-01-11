# File Module

## Purpose & Role in the System
The File module handles file uploads, storage, and retrieval for the community dashboard. It supports attachments for service requests, profile photos, and other documents with bucket-based organization.

## Controllers, Services, and Key Classes
- **Controllers**: `FileController`
- **Services**: `FileService`
- **Key Classes**:
  - Interfaces: `FileUploadResult`
  - Adapters: File storage implementations
  - Files: `src/modules/file/file.controller.ts`, `src/modules/file/file.service.ts`

## API Endpoints

### 1. Upload Attachment
- **Endpoint**: `POST /files/upload/attachment`
- **Method**: Multipart form-data with 'file' key
- **Permissions**: Implied through usage context
- **Response**: `FileUploadResult` with file metadata

### 2. Delete File
- **Endpoint**: `DELETE /files/:fileId`
- **Permissions**: Context-dependent
- **Response**: Success confirmation

### 3. Stream File
- **Endpoint**: `GET /files/:fileId/stream`
- **Permissions**: Context-dependent
- **Response**: File stream

## Data Relationships
- **File** can be attached to:
  - User profile photos (`User.profilePhoto`)
  - Service request attachments (`Attachment.serviceRequest`)
  - Invoice documents (`Attachment.invoice`)
  - Lease contracts (`Lease.contractFile`)

## Business Logic and Workflow Rules
1. **Bucket Organization**:
   - `service-attachments`: For service request files
   - `profile-photos`: For user profile images

2. **Metadata Storage**: File info stored in database with Supabase keys

3. **Stream Serving**: Direct streaming for file access

## Example Usage

**Upload attachment**:
```bash
POST /files/upload/attachment
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary file data>
```

**Response**:
```json
{
  "id": "file-123",
  "key": "service-attachments/uuid-filename.jpg",
  "name": "receipt.jpg",
  "mimeType": "image/jpeg",
  "size": 2048576,
  "url": "https://supabase-url/storage/v1/object/service-attachments/uuid-filename.jpg"
}
```

## File References
- Controller: `src/modules/file/file.controller.ts`
- Service: `src/modules/file/file.service.ts`
- Adapters: `src/modules/file/adapters/`
- Database Model: `prisma/schema.prisma` (File, Attachment models)
- Interface: `src/common/interfaces/file-storage.interface.ts`

## External Integrations
- **Supabase Storage**: Cloud file storage
- **Prisma ORM**: File metadata persistence
