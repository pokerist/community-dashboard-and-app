import * as DocumentPicker from 'expo-document-picker';
import { http } from '../../lib/http';

export type UploadedAttachment = {
  id: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  localUri?: string;
};

type FileUploadResponse = {
  id: string;
  key: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export async function pickSingleDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: false,
    copyToCacheDirectory: true,
    type: ['image/*', 'application/pdf'],
  });

  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) return null;
  return asset;
}

export async function pickSingleAudioDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: false,
    copyToCacheDirectory: true,
    type: ['audio/*'],
  });

  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) return null;
  return asset;
}

export async function uploadServiceAttachmentFile(
  accessToken: string,
  asset: {
    uri: string;
    name?: string | null;
    mimeType?: string | null;
  },
): Promise<UploadedAttachment> {
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name: asset.name || 'attachment',
    type: asset.mimeType || 'application/octet-stream',
  } as any);

  const response = await http.post<FileUploadResponse>(
    '/files/upload/service-attachment',
    form,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    },
  );

  return {
    id: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType,
    size: response.data.size,
  };
}

export async function pickAndUploadServiceAttachment(accessToken: string) {
  const picked = await pickSingleDocument();
  if (!picked) return null;
  return uploadServiceAttachmentFile(accessToken, picked);
}

export async function pickAndUploadAudioAttachment(accessToken: string) {
  const picked = await pickSingleAudioDocument();
  if (!picked) return null;
  return uploadServiceAttachmentFile(accessToken, picked);
}

export type FileUploadPurpose =
  | 'profile-photo'
  | 'national-id'
  | 'delegate-id'
  | 'contract'
  | 'marriage-certificate'
  | 'birth-certificate'
  | 'public-signup-photo'
  | 'service-attachment';

const uploadEndpointByPurpose: Record<FileUploadPurpose, string> = {
  'profile-photo': '/files/upload/profile-photo',
  'national-id': '/files/upload/national-id',
  'delegate-id': '/files/upload/delegate-id',
  contract: '/files/upload/contract',
  'marriage-certificate': '/files/upload/marriage-certificate',
  'birth-certificate': '/files/upload/birth-certificate',
  'public-signup-photo': '/files/upload/public-signup-photo',
  'service-attachment': '/files/upload/service-attachment',
};

export async function uploadFileByPurpose(
  accessToken: string,
  purpose: FileUploadPurpose,
  asset: {
    uri: string;
    name?: string | null;
    mimeType?: string | null;
  },
): Promise<UploadedAttachment> {
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name: asset.name || 'upload',
    type: asset.mimeType || 'application/octet-stream',
  } as any);

  const response = await http.post<FileUploadResponse>(
    uploadEndpointByPurpose[purpose],
    form,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    },
  );

  return {
    id: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType,
    size: response.data.size,
  };
}

export async function pickAndUploadFileByPurpose(
  accessToken: string,
  purpose: FileUploadPurpose,
) {
  const picked = await pickSingleDocument();
  if (!picked) return null;
  const uploaded = await uploadFileByPurpose(accessToken, purpose, picked);
  return {
    ...uploaded,
    localUri: picked.uri,
  };
}

export async function uploadPublicSignupPhoto(
  asset: {
    uri: string;
    name?: string | null;
    mimeType?: string | null;
  },
): Promise<UploadedAttachment> {
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name: asset.name || 'signup-photo',
    type: asset.mimeType || 'application/octet-stream',
  } as any);

  const response = await http.post<FileUploadResponse>(
    '/files/upload/public-signup-photo',
    form,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    },
  );

  return {
    id: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType,
    size: response.data.size,
  };
}

export async function pickAndUploadPublicSignupPhoto() {
  const picked = await pickSingleDocument();
  if (!picked) return null;
  return uploadPublicSignupPhoto(picked);
}
