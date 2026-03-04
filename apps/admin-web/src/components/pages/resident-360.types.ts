export type ResidentOverview = {
  resident: {
    id: string;
    nationalId?: string | null;
    dateOfBirth?: string | null;
    user: {
      id: string;
      nameEN?: string | null;
      nameAR?: string | null;
      email?: string | null;
      phone?: string | null;
      userStatus: string;
      profilePhotoId?: string | null;
      nationalIdFileId?: string | null;
      roles?: Array<{ role: { id: string; name: string } }>;
    };
  };
  units: {
    residentUnits: Array<{
      id: string;
      unitId: string;
      isPrimary: boolean;
      assignedAt: string;
      unit: {
        id: string;
        projectName?: string | null;
        block?: string | null;
        unitNumber?: string | null;
        status?: string | null;
      };
    }>;
    unitAccesses: Array<{
      id: string;
      role: string;
      status: string;
      startsAt?: string | null;
      endsAt?: string | null;
      unitId: string;
      unit: {
        id: string;
        projectName?: string | null;
        block?: string | null;
        unitNumber?: string | null;
        status?: string | null;
      };
    }>;
  };
  ownership: Array<{
    id: string;
    ownerUserId: string;
    unitId: string;
    paymentMode: string;
    contractSignedAt?: string | null;
    archivedAt?: string | null;
    notes?: string | null;
    unit: {
      id: string;
      projectName?: string | null;
      block?: string | null;
      unitNumber?: string | null;
      status?: string | null;
    };
    ownerUser: {
      id: string;
      nameEN?: string | null;
      email?: string | null;
      phone?: string | null;
    };
    contractFile?: {
      id: string;
      name?: string | null;
      mimeType?: string | null;
    } | null;
    installments: Array<{
      id: string;
      sequence: number;
      dueDate: string;
      amount: string | number;
      status: string;
      paidAt?: string | null;
      referenceFile?: {
        id: string;
        name?: string | null;
        mimeType?: string | null;
      } | null;
    }>;
  }>;
  household: {
    root: {
      residentId: string;
      user: {
        id: string;
        nameEN?: string | null;
        email?: string | null;
        phone?: string | null;
        userStatus: string;
      };
      units: Array<{
        unitId: string;
        isPrimary: boolean;
        assignedAt: string;
        unit: {
          id: string;
          projectName?: string | null;
          block?: string | null;
          unitNumber?: string | null;
        };
      }>;
    };
    children: {
      family: Array<any>;
      authorized: Array<any>;
      homeStaff: Array<any>;
    };
  };
  documents: {
    total: number;
    documents: Array<{
      category: string;
      source: string;
      uploadedAt: string;
      unit?: {
        id: string;
        projectName?: string | null;
        block?: string | null;
        unitNumber?: string | null;
      };
      file: {
        id: string;
        name?: string | null;
        mimeType?: string | null;
        size?: number | null;
      };
      extra?: Record<string, unknown>;
    }>;
  };
};

